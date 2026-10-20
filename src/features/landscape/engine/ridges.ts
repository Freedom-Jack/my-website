// ridges.ts — ridge profiles for the ink landscape, shared by the WebGL painter (uploaded as a
// small RGBA16F texture: crest height, smoothed slope, broad crest; plus two scene rows: water,
// waterline, technique, strokes, reflection, banks), the Canvas2D fallback (drawn as paths) and the
// footer strip (strip.ts).
//
// Heights are sampled in WORLD x (stretch units, see compose.ts), so the same mountains slide
// across the screen when the camera pans: ridges stay continuous from one stretch to the next.
// Rebuilt on the CPU only when the view changes (resize, pan, composition); ~1-3 ms.

import { LAYERS, massifs, MASSIF_STRIDE, sceneField, SCENE_FIELDS, resolve, spec, ampAt, type Resolved } from './compose';
import { pigmentAt } from './palette';

export { LAYERS };
/** Texture rows: one per plane, then four scene rows (see buildRidges). */
export const ROWS = LAYERS + 4;
export const SCENE_ROW = LAYERS;

// Seeded integer hash -> [0, 1)
function hash(i: number, seed: number) {
  let h = Math.imul(i ^ 0x27d4eb2d, 0x85ebca6b) ^ Math.imul(seed + 0x165667b1, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

// 1D gradient noise, roughly [-1, 1]
function noise1(x: number, seed: number) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * f * (f * (f * 6 - 15) + 10);
  const g0 = hash(i, seed) * 2 - 1;
  const g1 = hash(i + 1, seed) * 2 - 1;
  return (g0 * f * (1 - u) + g1 * (f - 1) * u) * 2;
}

function fbm1(x: number, seed: number, octaves: number) {
  let sum = 0;
  let amp = 0.5;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise1(x, seed + o * 17);
    x *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

// Musgrave ridged multifractal: sharp crests, broad valleys.
function ridged1(x: number, seed: number, octaves: number) {
  let sum = 0;
  let amp = 0.5;
  let w = 1;
  for (let o = 0; o < octaves; o++) {
    let n = 1 - Math.abs(noise1(x, seed + o * 31));
    n *= n;
    n *= w;
    w = Math.min(Math.max(n * 2, 0), 1);
    sum += n * amp;
    x *= 2.03;
    amp *= 0.5;
  }
  return sum; // ~0..1
}

// Per-plane noise character (far -> near). World noise runs at 1.6 viewport heights per stretch,
// the hero study's scale on a 16:10 screen.
const NOISE = [
  { seed: 11, freq: 1.6, crest: 0.5, oct: 5, crag: 0.2 },
  { seed: 23, freq: 1.3, crest: 0.6, oct: 5, crag: 0.45 },
  { seed: 37, freq: 1.45, crest: 0.72, oct: 6, crag: 0.85 },
  { seed: 41, freq: 1.8, crest: 0.75, oct: 6, crag: 0.9 },
  { seed: 59, freq: 2.0, crest: 0.75, oct: 6, crag: 0.6 },
];
const WORLD_VH = 1.6;

// The crossing's echo of the home peak: stretch 0's host plane exactly as the hero paints it (level distance,
// presence 1, a desktop aspect), sampled around its main summit and scaled down onto the far shore, so the
// silhouette across the water is the home peak itself: the tall crowned mass, the notch, the second peak.
// Computed once (lazily); `echo(dx)` takes dx in stretch 0's units from the main summit and returns the
// host's height above its base there (viewport heights).
let HOME: { P: Resolved; m: number[]; x0: number } | null = null;
function homeHost() {
  if (HOME) return HOME;
  const P = resolve(spec('level', 1), 1.6);
  const m = massifs(-0.5, 1.5, P)[2];
  let x0 = 0.7, top = -Infinity;
  for (let u = 0.5; u <= 0.9; u += 0.0005) {
    const h = planeHeight(2, u, m, P);
    if (h > top) { top = h; x0 = u; }
  }
  HOME = { P, m, x0 };
  return HOME;
}
function echo(dx: number) {
  const H = homeHost();
  return planeHeight(2, H.x0 + dx, H.m, H.P);
}

/** How far plane `l` rises above its base at world x `u` (viewport heights), before the scene's water. */
function planeHeight(l: number, u: number, m: number[], P: Resolved) {
  const { seed, freq, crest: cw, oct, crag } = NOISE[l];
  const xw = u * WORLD_VH;
  const warp = 0.32 * fbm1(xw * 0.8 + seed, seed + 3, 3);
  const q = (xw + warp) * freq + seed * 1.7;
  const crest = ridged1(q, seed, oct);
  const mass = 0.5 + 0.5 * fbm1(q * 0.42 + 4.1, seed + 9, 3);
  let shape = Math.pow(Math.max(0, cw * crest + (1 - cw) * mass), 1.25); // steeper peaks
  let env = P.floor[l];
  let host = 0;
  for (let j = 0; j < m.length; j += MASSIF_STRIDE) {
    const dx = u - m[j];
    const d = Math.abs(dx) / (dx < 0 ? m[j + 1] : m[j + 2]);
    const g = m[j + 3] * Math.exp(-Math.pow(d, 1.45)); // pointed summit, concave flanks
    env += g;
    if (m[j + 4]) env += m[j + 3] * 0.22 * Math.exp(-3.2 * d); // a host ends in a sharp summit
    if (m[j + 4]) host = Math.max(host, Math.min(1, g));
  }
  // the host summit is never left to chance
  shape += host * host * 0.4 * Math.max(0, 0.58 - shape);
  // big massifs get shoulders and sub-summits down their flanks
  const k2 = crag * Math.min(1, Math.max(0, env - 0.25) * 1.3);
  if (k2 > 0) {
    const tall = 1 + Math.min(1, Math.max(0, env - 0.9)); // the taller the massif, the more broken its flanks
    env *= 1 + k2 * tall * (0.5 * (ridged1(q * 4.6 + 5.5, seed + 11, 3) - 0.42) + 0.26 * (ridged1(q * 9.3 + 1.9, seed + 13, 2) - 0.4));
  }
  // tall massifs break into crags and pinnacles (a few per massif) instead of smooth cones
  const k = crag * Math.min(1, Math.max(0, env - 0.3) * 1.25);
  if (k > 0) {
    // pinnacle height varies along the range, so the crest never reads as a regular saw
    const vary = 0.55 + 0.45 * noise1(q * 1.7 + 3.3, seed + 21);
    shape += k * 0.5 * vary * (ridged1(q * 5.2 + 7.7, seed + 5, 3) * 1.6 - 0.55) * (0.4 + 0.6 * shape);
  }
  return P.amp[l] * ampAt(u, l) * Math.max(0, shape) * Math.min(env, 1.4);   // (round 5: the place's own relief)
}

/**
 * The top of plane `l` at world x `u` (viewport heights, before any water): where a figure can stand on it.
 * DOM-free; figures.ts places the traveller and the hut on the real slopes with it.
 */
export function planeTop(l: number, u: number, P: Resolved, m: number[] | null = null): number {
  const M = m || massifs(u - 0.05, u + 0.05, P)[l];
  let b = P.base[l];
  // (round 5) over water a far-shore plane stands on the waterline, as buildRidges paints it
  if (l <= 2) {
    const f = sceneField(u, P, PT_FIELD);
    const ws = f[0] * f[8];
    if (ws > 0) b += (Math.max(b, f[1] - 0.03) - b) * ws;
  }
  return b + planeHeight(l, u, M, P);
}
const PT_FIELD = new Float32Array(SCENE_FIELDS);

/**
 * Build ridge heights (+ smoothed slopes) for the current view, and the scene rows.
 * @param {number} samples  columns across the viewport
 * @param {{left:number, wvis:number, aspect:number, palette?:string, pigment?:number}} view  world window, the
 *   view's width in viewport heights (slopes), and the palette (pigment = a multiplier on its strength; 0 = ink)
 * @param {object} P        resolved composition (compose.resolve)
 * @param {Float32Array} [out]  reused buffer of samples * ROWS * 4
 * @returns {Float32Array} RGBA texels, row-major. Rows 0..4 are the planes, far first:
 *   [height, slope, broad height, 0]. Row 5 (SCENE_ROW): [water 0..1, waterline, bone, ink].
 *   Row 6: [strokes, reflection, banks, indigo water]. Row 7: [near bank (-1: none), shore, pigment, malachite
 *   lean]. Row 8: [terraces, still mirror, open water (no near bank), 0]. Water lies in front of planes 0-2 (the far shore), whose bases rise to the waterline there where the
 *   far shore stands on the water (shore 1; the river's far planes keep their own feet: shore 0); planes 3-4
 *   stand in front of it (headlands at the seams).
 */
export function buildRidges(samples: number, view: RidgeView, P: Resolved, out?: Float32Array | null): Float32Array {
  const n = samples * ROWS;
  if (!out || out.length !== n * 4) out = new Float32Array(n * 4);
  const { left, wvis, aspect } = view;
  const M = massifs(left, left + wvis, P);
  const heights = new Float32Array(samples);
  const raw = new Float32Array(samples);
  const tmp = new Float32Array(samples);
  const broad = new Float32Array(samples);
  const rb = Math.max(3, Math.round(samples * 0.035));
  // scene fields per column (water, waterline, technique, near bank, shore) and the pigment
  const F = SCENE_FIELDS;
  const sf = new Float32Array(samples * F);
  const fc = new Float32Array(F);
  const pg = new Float32Array(samples * 3);
  const pc = [0, 0, 0];
  const pk = view.pigment === undefined ? 1 : Math.max(0, +view.pigment || 0);
  let anyWater = false;
  for (let c = 0; c < samples; c++) {
    const u = left + ((c + 0.5) / samples) * wvis;
    sceneField(u, P, fc);
    sf.set(fc, c * F);
    if (fc[0] > 0) anyWater = true;
    if (pk > 0) { pigmentAt(u, view.palette, pc); pg[c * 3] = pc[0] * pk; pg[c * 3 + 1] = pc[1]; pg[c * 3 + 2] = pc[2]; }
  }
  // the echo rows (the crossing's far view of the home peak)
  const E = M.echo;
  for (let l = 0; l < LAYERS; l++) {
    const m = M[l];
    const base = P.base[l];
    const shore = anyWater && l <= 2;   // a far-shore plane: it stands on the waterline over water
    for (let c = 0; c < samples; c++) {
      const u = left + ((c + 0.5) / samples) * wvis;
      let b = base;
      const ws = shore ? sf[c * F] * sf[c * F + 8] : 0;
      // over water the far shore's planes rise from the waterline (just under it, so their feet melt into the mist on it)
      if (ws > 0) b += (Math.max(base, sf[c * F + 1] - 0.03) - base) * ws;
      let h = b + planeHeight(l, u, m, P);
      for (let j = 0; j < E.length; j += 4) {
        if (E[j] !== l) continue;
        const s = E[j + 2];
        const dx = (u - E[j + 1]) / s;                 // in stretch 0's units
        if (Math.abs(dx) >= 0.5) continue;
        const wy = sf[c * F] > 0 ? sf[c * F + 1] : base;
        // the home host's silhouette at the echo's scale, a little flattened by the distance
        const he = wy - 0.025 + 0.85 * P.hsc * s * E[j + 3] * echo(dx);
        const t = 1 - Math.min(1, Math.max(0, (Math.abs(dx) - 0.36) / 0.14));
        h = Math.max(h, h + (he - h) * t * t * (3 - 2 * t));
      }
      heights[c] = h;
    }
    // terraced hills keep rounded crests: where the scene has terraces, the terraced planes (2 and nearer) take
    // most of their own broad crest (no pinnacles: fields, not crags); the guests behind keep their profile (rounded,
    // the low ones would read as a flat shelf)
    if (l >= 2) {
      let any = false;
      for (let c = 0; c < samples; c++) if (sf[c * F + 9] > 0.01) { any = true; break; }
      if (any) {
        boxBlur(heights, tmp, samples, rb);
        boxBlur(tmp, broad, samples, rb);
        for (let c = 0; c < samples; c++) { const t = sf[c * F + 9]; heights[c] += (broad[c] - heights[c]) * t * 0.75; }
      }
    }
    slopes(heights, raw, tmp, samples, aspect);
    // broad crest: the massif without its pinnacles, so washes follow the mass, not every spire
    boxBlur(heights, tmp, samples, rb);
    boxBlur(tmp, broad, samples, rb);
    const row = l * samples;
    for (let c = 0; c < samples; c++) {
      const o = (row + c) * 4;
      out[o] = heights[c];
      out[o + 1] = raw[c];
      out[o + 2] = Math.max(broad[c], heights[c] - 0.25);
      out[o + 3] = 0;
    }
  }
  const r5 = LAYERS * samples, r6 = (LAYERS + 1) * samples, r7 = (LAYERS + 2) * samples, r8 = (LAYERS + 3) * samples;
  for (let c = 0; c < samples; c++) {
    const o = (r5 + c) * 4, o6 = (r6 + c) * 4, o7 = (r7 + c) * 4, o8 = (r8 + c) * 4, f = c * F;
    out[o] = sf[f]; out[o + 1] = sf[f + 1]; out[o + 2] = sf[f + 2]; out[o + 3] = sf[f + 3];
    out[o6] = sf[f + 4]; out[o6 + 1] = sf[f + 5]; out[o6 + 2] = sf[f + 6]; out[o6 + 3] = pg[c * 3 + 2];
    out[o7] = sf[f + 7]; out[o7 + 1] = sf[f + 8]; out[o7 + 2] = pg[c * 3]; out[o7 + 3] = pg[c * 3 + 1];
    out[o8] = sf[f + 9]; out[o8 + 1] = sf[f + 10]; out[o8 + 2] = sf[f + 11]; out[o8 + 3] = 0;
  }
  return out;
}

/** The world window a ridge buffer is built for (buildRidges). */
export interface RidgeView {
  left: number;
  wvis: number;
  aspect: number;
  palette?: string;
  pigment?: number;
}

/** Highest crest of each plane in a ridge buffer (for the horizon state). */
export function crestMax(buf: Float32Array, samples: number, out: Float32Array = new Float32Array(LAYERS)): Float32Array {
  for (let l = 0; l < LAYERS; l++) {
    let m = -Infinity;
    for (let c = 0, o = l * samples * 4; c < samples; c++, o += 4) if (buf[o] > m) m = buf[o];
    out[l] = m;
  }
  return out;
}

// Smoothed slope (dh/dx in viewport heights) so the shader can shade the shadow faces of each
// peak without the column streaks a raw derivative would give. Two running-sum box blurs.
function slopes(h: Float32Array, raw: Float32Array, tmp: Float32Array, w: number, aspect: number) {
  const k = Math.max(1, Math.round(w * 0.004));
  const dx = ((2 * k) / w) * aspect;
  for (let c = 0; c < w; c++) {
    raw[c] = (h[Math.min(w - 1, c + k)] - h[Math.max(0, c - k)]) / dx;
  }
  const r = Math.max(2, Math.round(w * 0.012));
  boxBlur(raw, tmp, w, r);
  boxBlur(tmp, raw, w, r);
}
function boxBlur(src: Float32Array, dst: Float32Array, w: number, r: number) {
  let sum = 0;
  let n = 0;
  for (let j = 0; j <= r && j < w; j++) { sum += src[j]; n++; }
  for (let c = 0; c < w; c++) {
    dst[c] = sum / n;
    const add = c + r + 1;
    const sub = c - r;
    if (add < w) { sum += src[add]; n++; }
    if (sub >= 0) { sum -= src[sub]; n--; }
  }
}

/** Per-plane [foot, fade, ink] for the shader (and the 2D painter). */
export function layerFeet(P: Resolved): Float32Array {
  const out = new Float32Array(LAYERS * 3);
  for (let l = 0; l < LAYERS; l++) {
    out[l * 3] = P.foot[l];
    out[l * 3 + 1] = P.fade[l];
    out[l * 3 + 2] = P.ink[l];
  }
  return out;
}
