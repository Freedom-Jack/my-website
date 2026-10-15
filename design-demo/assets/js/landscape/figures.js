// figures.js — the figure layers: what in the painting is not a mountain (SPEC-R4A §12.5). DOM-free Canvas2D
// brushwork, seeded and deterministic, drawn once per (stretch, scale, palette, resolution) on an OffscreenCanvas
// in a module worker (figures.worker.js), or on the main thread in idle chunks of <= 8 ms where that is missing.
// The layer covers a world rectangle (figureMeta); the scene shader paints it *into* the painting at its plane,
// with a bleed halo (its mip levels), the plane's mist over its feet, grain on top and the drifting mist passing
// over it, so it is never pasted on.
//
//   Home (stretch 0): a tiny traveller in a white robe with a cone hat and a staff, on a path that climbs the near
//     ridge at the foot of the host peak (a soft wash, not dashes), toward a hut grounded in the ridge's saddle (a
//     ledge stroke and mist at its foot, grey tile roof, a dotted tree beside it).
//   Work (stretch 1): the river market at the rainbow bridge. The town faces the river from the far bank in broken
//     rows (Song forms: gently lifted hip-gable roofs in grey tile, open shopfronts, parasol stalls, blank signs),
//     mist swallowing half of it; the heavy woven-timber arch of the bridge with its crowd standing still; moored
//     boats with mat roofs, and one coming down to the bridge lowering its mast; willows on the near bank.
//
// Kitsch guards: Song forms only; no red lanterns, pagodas, dragons or gold; no text on signs; nothing moves in 4a.
// Colour (palette.js): light colour over ink: grey tile, timber brown on wood (small areas, never a pale wash), pale
// indigo clothes, white robes, willows in misted malachite. Under 'ink', everything is drawn in ink greys.
//
// Structure studied (not copied) from LingDong Huang's {Shan, Shui}* (MIT, 2018); the brush kit and the scenes grew
// out of the round-4 research sketch (_notes/r4/prototypes/sketch/).
//
// Authoring units: "world px" at REF_PX (1440) CSS px per stretch: wx = u * 1440 (u in stretches, absolute) and
// wy = (1 - y) * 900 (y = scene height in viewport heights; y down).

import { resolve, spec, sceneField, SCENE_FIELDS, REF_PX, HS } from './compose.js';
import { planeTop } from './ridges.js';
import { PALETTES, paletteName } from './palette.js';

const VH_PX = REF_PX / HS;   // 900 world px per viewport height

// ---------------------------------------------------------------- the layers
// rect: the world rectangle the layer covers [u0, u1, y0, y1]; plane / phase: where the shader paints it (after that
// plane's ink: phase 0; after its mist band and the water: phase 1).
const META = {
  0: { rect: [0.64, 0.9, 0.06, 0.34], plane: 3, phase: 1, scene: 'home' },
  1: { rect: [1.08, 2.04, 0.1, 0.46], plane: 2, phase: 1, scene: 'market' },
};

/** The figure layer of a stretch: { rect: [u0, u1, y0, y1], plane, phase } or null (no figures there). */
export function figureMeta(stretch) {
  const m = META[Math.round(Number(stretch))];
  return m ? { rect: m.rect.slice(), plane: m.plane, phase: m.phase } : null;
}

/** Pixel size of a layer drawn at `scale` CSS px per stretch and `dpr` device px per CSS px. */
export function layerSize(stretch, scale, dpr) {
  const m = META[Math.round(Number(stretch))];
  if (!m) return { width: 0, height: 0 };
  const [u0, u1, y0, y1] = m.rect;
  return {
    width: Math.max(2, Math.min(4096, Math.round((u1 - u0) * scale * dpr))),
    height: Math.max(2, Math.min(4096, Math.round((y1 - y0) * (scale / HS) * dpr))),
  };
}

/** Draw a layer at once (worker). */
export function drawFigures(ctx, p) {
  for (const _ of paintSteps(ctx, p)) { /* run to the end */ }
}

/**
 * The layer's painting as steps (a generator), so the main-thread fallback can paint it in idle chunks.
 * @param {CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D} ctx  sized to layerSize()
 * @param {{stretch:number, scale:number, dpr:number, palette:string, distance?:string, presence?:number}} p
 */
export function* paintSteps(ctx, p) {
  const m = META[Math.round(Number(p.stretch))];
  if (!m) return;
  const k = (p.scale / REF_PX) * p.dpr;
  const [u0, , , y1] = m.rect;
  ctx.setTransform(k, 0, 0, k, -u0 * REF_PX * k, -(1 - y1) * VH_PX * k);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const P = resolve(spec(p.distance || 'level', p.presence ?? 1), 1.6);
  // (soft washes never use ctx.filter: on many canvases each filtered draw blurs a canvas-sized layer, ~100x the cost)
  const env = { ctx, P, ink: inks(p.palette), k, scale: p.scale, softOK: false };
  if (m.scene === 'home') yield* home(env);
  else if (m.scene === 'market') yield* market(env);
}

// ---------------------------------------------------------------- noise, randomness
function hash2(x, y, s) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s, oct = 3) {
  let a = 0.5, t = 0, n = 0;
  for (let i = 0; i < oct; i++) { t += a * vnoise(x, y, s + i * 17); n += a; x *= 2.03; y *= 2.03; a *= 0.5; }
  return t / n;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (A, B, t) => [mix(A[0], B[0], t), mix(A[1], B[1], t), mix(A[2], B[2], t)];

// ---------------------------------------------------------------- inks and light colour (palette-aware)
// Every colour is cool or neutral; timber brown only ever at mid-to-dark values on small areas (never a pale wash,
// which would read as beige). Under 'ink' the colours become greys of the same value.
const BASE = {
  ink: [20, 24, 27], ink2: [42, 48, 52], wall: [236, 238, 235], white: [246, 247, 244], paper: [239, 241, 238], mist: [233, 237, 236],
  tile: [74, 82, 88], timber: [107, 84, 68], timberM: [143, 128, 120], indigo: [62, 86, 100], indigoP: [150, 166, 176],
  mal: [141, 181, 164], malD: [58, 128, 106], az: [127, 159, 184], earth: [128, 124, 120],
};
function inks(palette) {
  const strength = PALETTES[paletteName(palette)].figures;   // 0 ink, 1 misted, 1.25 rich
  const grey = (c) => { const l = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; return [l - 2, l, l + 2]; };
  const tone = (c) => (strength <= 0 ? grey(c) : strength > 1 ? mix3(grey(c), c, Math.min(1.2, strength)) : mix3(grey(c), c, 0.85 + 0.15 * strength));
  const C = {};
  for (const k in BASE) C[k] = tone(BASE[k]);
  const rgba = (c, a) => `rgba(${Math.round(Math.min(255, Math.max(0, c[0])))},${Math.round(Math.min(255, Math.max(0, c[1])))},${Math.round(Math.min(255, Math.max(0, c[2])))},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
  return { C, rgba, strength, colourK: Math.min(1.25, strength) };
}

// ---------------------------------------------------------------- the brush kit
// Resample a polyline every `step` px.
function resample(pts, step) {
  const out = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const L = Math.hypot(x1 - x0, y1 - y0);
    if (!L) continue;
    let t = step - acc;
    while (t <= L) { out.push([x0 + (x1 - x0) * t / L, y0 + (y1 - y0) * t / L]); t += step; }
    acc = (acc + L) % step;
  }
  const last = pts[pts.length - 1];
  const e = out[out.length - 1];
  if (out.length === 1 || Math.hypot(e[0] - last[0], e[1] - last[1]) > step * 0.3) out.push(last);
  return out;
}
/**
 * A brush stroke: a loaded start, a thinning tail, a width that breathes along it, and (dry) gaps where the brush
 * ran out. pts in world px. o: w (width), col, wob (width wobble), tin / tout (taper lengths, fractions), min (the
 * thinnest width), dry (0..1: how much it breaks up), seed.
 */
function stroke(ctx, pts, o = {}) {
  const w = o.w ?? 1.2, col = o.col ?? 'rgba(20,24,27,0.85)', wob = o.wob ?? 0.3, seed = o.seed ?? 1;
  const tIn = o.tin ?? 0.12, tOut = o.tout ?? 0.4, minW = o.min ?? 0.28, dry = o.dry ?? 0;
  const P = resample(pts, Math.max(0.5, Math.min(1.6, w * 0.8)));
  const n = P.length;
  if (n < 2) return;
  const Lp = [], Rp = [], on = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    let tw = Math.min(1, minW + (1 - minW) * smooth(0, tIn, t)) * Math.min(1, minW + (1 - minW) * (1 - smooth(1 - tOut, 1, t)));
    tw *= 1 + wob * (vnoise(i * 0.21, seed * 1.3, 77) - 0.5) * 2;
    const hw = Math.max(0.12, w * tw * 0.5);
    const j = (vnoise(i * 0.17, seed, 79) - 0.5) * w * 0.25;   // the brush never runs on a ruler
    Lp.push([P[i][0] + nx * (hw + j), P[i][1] + ny * (hw + j)]);
    Rp.push([P[i][0] - nx * (hw - j), P[i][1] - ny * (hw - j)]);
    on.push(dry <= 0 || vnoise(i * 0.13, seed + 5.5, 81) > dry * (0.45 + 0.55 * t));
  }
  ctx.fillStyle = col;
  let s = 0;
  while (s < n - 1) {
    while (s < n - 1 && !on[s]) s++;
    let e = s;
    while (e < n - 1 && on[e + 1]) e++;
    if (e > s) {
      ctx.beginPath();
      ctx.moveTo(Lp[s][0], Lp[s][1]);
      for (let i = s + 1; i <= e; i++) ctx.lineTo(Lp[i][0], Lp[i][1]);
      for (let i = e; i >= s; i--) ctx.lineTo(Rp[i][0], Rp[i][1]);
      ctx.closePath();
      ctx.fill();
    }
    s = e + 1;
  }
}
/** Split a polyline into runs of minLen..maxLen world px with gaps of about `gap` between them. */
function runs(pts, R, minLen, maxLen, gap) {
  const out = [];
  let cur = [], len = 0, want = minLen + R() * (maxLen - minLen), skip = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (skip > 0) { skip -= d; continue; }
    cur.push(pts[i - 1]);
    len += d;
    if (len >= want) {
      cur.push(pts[i]);
      if (cur.length > 1) out.push(cur);
      cur = []; len = 0; want = minLen + R() * (maxLen - minLen); skip = gap * (0.4 + R() * 1.2);
    }
  }
  if (cur.length > 1) out.push(cur);
  return out;
}
/** Dry brush: the stroke split into bristles that break up (flying white). */
function dryBrush(ctx, pts, o = {}) {
  const w = o.w ?? 3, col = o.col ?? 'rgba(20,24,27,0.5)', nb = o.bristles ?? 5, seed = o.seed ?? 3, thr = o.thr ?? 0.42;
  const P = resample(pts, 0.7);
  const n = P.length;
  if (n < 3) return;
  ctx.strokeStyle = col;
  for (let b = 0; b < nb; b++) {
    const off = (b / Math.max(1, nb - 1) - 0.5) * w;
    ctx.lineWidth = Math.max(0.3, (w / nb) * 1.2 * (0.7 + 0.6 * hash2(b, seed, 3)));
    let on = false;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const a = P[Math.max(0, i - 1)], c = P[Math.min(n - 1, i + 1)];
      let nx = -(c[1] - a[1]), ny = c[0] - a[0];
      const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const taper = 1 - 0.55 * t;
      const x = P[i][0] + nx * off * taper, y = P[i][1] + ny * off * taper;
      const keep = vnoise(i * 0.11, b * 3.1 + seed, 55) > thr + 0.3 * t * t;
      if (keep && !on) { ctx.moveTo(x, y); on = true; } else if (keep) ctx.lineTo(x, y); else on = false;
    }
    ctx.stroke();
  }
}
/** A wash: a filled shape whose edge wanders a little, with the faint darker line where the pigment pooled. */
function wash(ctx, pts, col, o = {}) {
  const jit = o.jit ?? 0.35, seed = o.seed ?? 7;
  const q = jit > 0 ? pts.map(([x, y], i) => [x + (hash2(i, seed, 11) - 0.5) * jit, y + (hash2(i, seed, 13) - 0.5) * jit]) : pts;
  ctx.beginPath();
  ctx.moveTo(q[0][0], q[0][1]);
  for (let i = 1; i < q.length; i++) ctx.lineTo(q[i][0], q[i][1]);
  ctx.closePath();
  ctx.fillStyle = col;
  ctx.fill();
  if (o.edge) {
    ctx.strokeStyle = o.edge;
    ctx.lineWidth = o.edgeW ?? 0.5;
    ctx.stroke();
  }
}
/** A soft wash (ink wicking into wet paper): blurred where the context can, else a few stacked, offset fills. */
function softWash(env, pts, col, r, o = {}) {
  const { ctx } = env;
  if (env.softOK && r > 0) {
    ctx.save();
    ctx.filter = `blur(${(r * env.k).toFixed(2)}px)`;
    wash(ctx, pts, col, { ...o, edge: null });
    ctx.restore();
    return;
  }
  const n = 4;
  const m = /rgba\((\d+),(\d+),(\d+),([\d.]+)\)/.exec(col);
  const a = m ? +m[4] : 1;
  const c = m ? `rgba(${m[1]},${m[2]},${m[3]},${(1 - Math.pow(1 - a, 1 / n)).toFixed(3)})` : col;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const dx = Math.cos(ang) * r * 0.5, dy = Math.sin(ang) * r * 0.5;
    wash(ctx, pts.map(([x, y]) => [x + dx, y + dy]), c, { ...o, edge: null, seed: (o.seed ?? 7) + i });
  }
}
// ---------------------------------------------------------------- figures (people)
/**
 * A tiny standing figure, Song manner: a robe (a soft trapezoid), a dark head with a top-knot or a cone hat, a
 * light line at the robe's edge. (x, y) = the feet; s = scale (1 ~ 10 px tall). Never walking in 4a.
 */
function person(env, x, y, s, R, o = {}) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const lean = o.lean ?? (R() - 0.5) * 0.22;
  const h = 10 * s;
  const sx = x + Math.sin(lean) * h * 0.7, sy = y - h * 0.68;   // shoulders
  const wide = (o.wide ? 4.6 : 3.7) * s;
  const robes = [C.white, C.white, C.white, C.indigoP, C.indigoP, mix3(C.ink2, C.white, 0.55), C.white];
  const robe = o.robe || robes[Math.floor(R() * robes.length)];
  const dir = o.flip ? -1 : 1;
  const hem = [[x + wide * 0.5 + (R() - 0.5) * s * 0.6, y - 0.6 * s], [x - wide * 0.5 + (R() - 0.5) * s * 0.6, y - 0.6 * s]];
  const body = [[sx - 1.05 * s, sy + 0.2 * s], [sx + 1.1 * s, sy + 0.1 * s], hem[0], hem[1]];
  wash(ctx, body, rgba(robe, 0.96), { jit: 0.25 * s, seed: x * 7 + y });
  // the robe's edges: light, broken lines (a white robe needs them to exist at all on pale paper)
  const line = rgba(C.ink, o.outline ?? 0.62);
  stroke(ctx, [body[0], hem[1]], { w: 0.5 * s, col: line, wob: 0.4, seed: x, tin: 0.05, tout: 0.3 });
  stroke(ctx, [body[1], hem[0]], { w: 0.42 * s, col: rgba(C.ink, 0.45), wob: 0.4, seed: y, tin: 0.05, tout: 0.4 });
  // a sash
  stroke(ctx, [[sx - 0.9 * s, sy + 2.5 * s], [sx + 1.0 * s, sy + 2.3 * s]], { w: 0.45 * s, col: rgba(C.ink2, 0.45), tin: 0, tout: 0.2 });
  // feet under the hem
  stroke(ctx, [[x - 0.9 * s, y - 0.7 * s], [x - 1.1 * s, y + 0.1 * s]], { w: 0.55 * s, col: rgba(C.ink, 0.85), tin: 0, tout: 0.1 });
  stroke(ctx, [[x + 0.7 * s, y - 0.7 * s], [x + 0.95 * s, y + 0.1 * s]], { w: 0.55 * s, col: rgba(C.ink, 0.85), tin: 0, tout: 0.1 });
  // an arm: hanging, or raised (pointing, shading the eyes)
  const arm = o.arm ?? (R() < 0.3 ? 'up' : 'down');
  if (arm === 'up') stroke(ctx, [[sx + dir * 0.9 * s, sy + 0.8 * s], [sx + dir * 2.3 * s, sy - 0.9 * s]], { w: 0.55 * s, col: rgba(C.ink, 0.6) });
  else stroke(ctx, [[sx + dir * 0.95 * s, sy + 0.6 * s], [sx + dir * 1.5 * s, sy + 3.6 * s]], { w: 0.5 * s, col: rgba(C.ink, 0.5) });
  // head: a pale face under dark hair, a top-knot (or a cone hat)
  const hx = sx + Math.sin(lean) * 2.2 * s, hy = sy - 1.6 * s;
  ctx.fillStyle = rgba(mix3(C.white, C.ink2, 0.12), 0.97);
  ctx.beginPath(); ctx.arc(hx, hy, 1.05 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = rgba(C.ink, 0.92);
  ctx.beginPath(); ctx.arc(hx - dir * 0.2 * s, hy - 0.3 * s, 0.95 * s, Math.PI * 0.92, Math.PI * 2.08); ctx.fill();
  if (o.hat === 'cone') {
    const brim = 2.9 * s;
    wash(ctx, [[hx - brim, hy - 0.15 * s], [hx + brim, hy - 0.35 * s], [hx + 0.2 * s, hy - 2.2 * s]], rgba(mix3(C.white, C.ink2, 0.28), 0.97), { jit: 0.15 * s });
    stroke(ctx, [[hx - brim, hy - 0.15 * s], [hx + 0.2 * s, hy - 2.2 * s], [hx + brim, hy - 0.35 * s]], { w: 0.42 * s, col: rgba(C.ink, 0.7), tin: 0.08, tout: 0.15 });
  } else {
    ctx.beginPath(); ctx.arc(hx + dir * 0.1 * s, hy - 1.15 * s, 0.5 * s, 0, Math.PI * 2); ctx.fill();
  }
  if (o.pole) {   // a carrying pole with two loads
    const a = [sx - 5.5 * s, sy + 0.4 * s], b = [sx + 5.5 * s, sy - 0.3 * s];
    stroke(ctx, [a, b], { w: 0.5 * s, col: rgba(C.ink, 0.85), tin: 0.05, tout: 0.05 });
    for (const p of [a, b]) {
      stroke(ctx, [p, [p[0], p[1] + 3 * s]], { w: 0.28 * s, col: rgba(C.ink, 0.5), tin: 0, tout: 0 });
      wash(ctx, [[p[0] - 1.4 * s, p[1] + 3 * s], [p[0] + 1.4 * s, p[1] + 3 * s], [p[0] + 1.1 * s, p[1] + 5 * s], [p[0] - 1.1 * s, p[1] + 5 * s]], rgba(C.timber, 0.75));
    }
  }
  if (o.staff) stroke(ctx, [[sx + dir * 1.8 * s, sy - 0.6 * s], [x + dir * 2.4 * s, y + 0.2 * s]], { w: 0.45 * s, col: rgba(C.ink, 0.9), tin: 0, tout: 0.05 });
  if (o.punt) stroke(ctx, [[sx + dir * 1.5 * s, sy - 3.2 * s], [sx - dir * 6.5 * s, y + 8.5 * s]], { w: 0.5 * s, col: rgba(C.ink, 0.9), tin: 0.05, tout: 0.3 });
  if (o.pull) stroke(ctx, [[sx + dir * 0.9 * s, sy + 0.4 * s], o.pull], { w: 0.28 * s, col: rgba(C.ink, 0.55), tin: 0, tout: 0 });
}

// ---------------------------------------------------------------- trees
/** A tree in dots (an ink cluster of short dabs on a crooked trunk). (x, y) = the foot. */
function dotTree(env, x, y, s, R, o = {}) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const H = 20 * s;
  const lean = (R() - 0.5) * 5 * s;
  stroke(ctx, [[x, y + 0.5], [x + lean * 0.4 + (R() - 0.5) * 2 * s, y - H * 0.5], [x + lean, y - H * 0.85]], { w: 1.7 * s, col: rgba(C.ink, 0.85), tin: 0, tout: 0.7, wob: 0.5, seed: x });
  const leaf = o.green && ink.strength > 0 ? mix3(C.ink, C.malD, 0.35) : C.ink;
  const clusters = o.clusters ?? 4;
  for (let c = 0; c < clusters; c++) {
    const cx = x + lean * 0.8 + (R() - 0.5) * 12 * s, cy = y - H * (0.62 + R() * 0.4);
    for (let i = 0; i < 18; i++) {
      const px = cx + (R() - 0.5) * 10 * s, py = cy + (R() - 0.5) * 5.5 * s;
      const a = (R() - 0.5) * 0.6;
      stroke(ctx, [[px - 1.1 * s, py + a], [px + 1.1 * s, py - a - 0.3 * s]], { w: 1.15 * s, col: rgba(leaf, 0.3 + R() * 0.4), tin: 0.2, tout: 0.6, wob: 0.3, seed: i + c * 31 });
    }
  }
}
/** A pine: a leaning trunk and flat, layered needle masses (dark ink). */
function pine(env, x, y, s, R) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const H = 24 * s;
  const lean = (R() < 0.5 ? -1 : 1) * (2 + R() * 3) * s;
  const top = [x + lean, y - H];
  stroke(ctx, [[x, y + 0.5], [x + lean * 0.3, y - H * 0.45], top], { w: 1.6 * s, col: rgba(C.ink, 0.9), tin: 0, tout: 0.5, wob: 0.4, seed: x * 3 });
  for (let i = 0; i < 4; i++) {
    const t = 0.45 + i * 0.17;
    const bx = x + lean * t, by = y - H * t;
    const wdt = (7 - i * 1.3) * s;
    for (let j = 0; j < 9; j++) {
      const px = bx + (R() - 0.5) * wdt * 2, py = by + (R() - 0.5) * 1.6 * s;
      stroke(ctx, [[px - 1.6 * s, py + 0.5 * s], [px, py - 0.7 * s], [px + 1.6 * s, py + 0.5 * s]], { w: 0.75 * s, col: rgba(C.ink, 0.35 + R() * 0.35), tin: 0.1, tout: 0.4, seed: j + i * 11 });
    }
  }
}
/**
 * A willow, the way the scroll paints them: a thick, leaning, gnarled trunk that forks low, boughs that arch up and
 * out and then droop, and long cascades of strands in misted malachite falling from their outer halves, longest
 * where the boughs droop furthest, so the tree has the shape of a fountain, never a box. A few strands are darker.
 * (x, y) = the foot.
 */
function willow(env, x, y, s, R, o = {}) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const lean = o.lean ?? (R() < 0.5 ? -1 : 1) * (0.15 + R() * 0.3);
  const H = 22 * s;
  // the trunk: thick at the foot, bending, forking at ~60%
  const trunk = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    trunk.push([x + lean * H * 0.6 * t * t + (vnoise(t * 3, x, 4) - 0.5) * 3.2 * s, y - H * t]);
  }
  const fork = trunk[5];
  const limbs = [trunk.slice(5), [fork, [fork[0] - lean * 5 * s - 3 * s, fork[1] - H * 0.25], [fork[0] - lean * 7 * s - 6 * s, fork[1] - H * 0.42]]];
  // boughs from the top of each limb: up and out, then drooping
  const boughs = [];
  for (const limb of limbs) {
    const top = limb[limb.length - 1];
    const nb = 3 + Math.floor(R() * 2);
    for (let b = 0; b < nb; b++) {
      const side = (b / (nb - 1) - 0.5) * 2 + (R() - 0.5) * 0.4;   // -1 .. 1
      const reach = (10 + R() * 9) * s;
      const up = (4 + R() * 5) * s * (1 - 0.5 * Math.abs(side));
      const p1 = [top[0] + side * reach * 0.45, top[1] - up];
      const p2 = [top[0] + side * reach, top[1] - up * 0.4 + 2.5 * s];
      boughs.push({ pts: [top, p1, p2], side });
    }
  }
  const leafC = ink.strength > 0 ? C.mal : mix3(C.ink2, C.white, 0.45);
  const leafD = ink.strength > 0 ? mix3(C.malD, C.ink, 0.35) : C.ink2;
  // a very faint mass behind the strands (the tree's shade), shaped like the fountain
  const crownX = mix(limbs[0][limbs[0].length - 1][0], limbs[1][2][0], 0.5);
  const crownY = Math.min(limbs[0][limbs[0].length - 1][1], limbs[1][2][1]);
  softWash(env, [[crownX - 15 * s, crownY + 4 * s], [crownX, crownY - 6 * s], [crownX + 15 * s, crownY + 4 * s], [crownX + 19 * s, crownY + 22 * s], [crownX - 19 * s, crownY + 22 * s]], rgba(leafC, 0.08), 4 * s);
  // the cascades
  const sway = (o.sway ?? 1) * s * 0.6;
  for (const { pts: [a, m, b], side } of boughs) {
    const n = 15 + Math.floor(R() * 8);
    for (let k = 0; k < n; k++) {
      const t = 0.35 + 0.65 * Math.pow(R(), 0.7);              // mostly from the bough's outer half
      const p = t < 0.5 ? [mix(a[0], m[0], t * 2), mix(a[1], m[1], t * 2)] : [mix(m[0], b[0], t * 2 - 1), mix(m[1], b[1], t * 2 - 1)];
      const maxL = (22 + 16 * Math.abs(side)) * s;           // the drooping ends hang longest
      const len = maxL * (0.35 + 0.65 * R()) * (0.55 + 0.45 * t);
      const out = side * (0.6 + R() * 0.8) * s;               // a slight outward curve before the strand falls
      const dark = R() < 0.22;
      stroke(ctx, [p, [p[0] + out * 1.5, p[1] + len * 0.18], [p[0] + out * 2 + sway * 0.3, p[1] + len * 0.6], [p[0] + out * 2.1 + sway, p[1] + len]], {
        w: (dark ? 0.5 : 0.68) * s, col: dark ? rgba(leafD, 0.5) : rgba(leafC, 0.36 + R() * 0.3), tin: 0.04, tout: 0.9, wob: 0.3, min: 0.1, seed: k * 7 + x,
      });
    }
  }
  for (const { pts } of boughs) stroke(ctx, pts, { w: 1.2 * s, col: rgba(C.ink, 0.72), tin: 0.02, tout: 0.85, wob: 0.45, seed: pts[2][0] });
  stroke(ctx, limbs[1], { w: 2.2 * s, col: rgba(C.ink, 0.88), tin: 0, tout: 0.6, wob: 0.4, seed: x + 1 });
  stroke(ctx, trunk, { w: 4.6 * s, col: rgba(C.ink, 0.92), tin: 0.0, tout: 0.5, wob: 0.5, seed: x });
  dryBrush(ctx, trunk.slice(0, 6).map(([a, b]) => [a + 1.2 * s, b]), { w: 2.8 * s, col: rgba(mix3(C.ink, C.white, 0.35), 0.55), bristles: 3, seed: x, thr: 0.5 });
  stroke(ctx, [[x - 5 * s, y + 0.8], [x + 6 * s, y + 0.3]], { w: 1.5 * s, col: rgba(C.ink, 0.42), tin: 0.2, tout: 0.6 });   // its foot on the ground
}
function ellipse(cx, cy, rx, ry, n) {
  const pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  return pts;
}

// ---------------------------------------------------------------- buildings (Song oblique projection)
const D = [0.72, -0.48];    // one unit of depth on screen: we see fronts, tops and right-hand sides
/**
 * A Song house: an open shopfront (or plain wall), timber posts, and a big hip-gable roof in grey tile with a dark
 * ridge and gently lifted eave corners. (x, y) = front-left foot; w width, h wall height. o.far: paler and simpler
 * (the back rows, half lost in mist).
 */
function house(env, x, y, w, h, R, o = {}) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const far = o.far ?? 0;                     // 0 front row .. 1 far back row
  const A = 1 - 0.45 * far;                   // paleness by depth
  const d = o.d ?? w * (0.42 + R() * 0.2);
  const ox = D[0] * d, oy = D[1] * d;
  const rh = o.rh ?? h * (0.55 + R() * 0.2);  // roof height
  const ov = o.ov ?? w * (0.09 + R() * 0.04); // eave overhang
  const sk = (R() - 0.5) * 0.6;               // a slight skew: no two alike
  // reserve the paper: a near house hides what is behind it
  wash(ctx, [[x - ov, y + 0.6], [x + w, y + 0.6], [x + w + ox, y + oy + 0.6], [x + w + ov + ox, y - h + oy], [x + w * 0.84 + ox * 0.5, y - h - rh + oy * 0.5], [x + w * 0.16 + ox * 0.5, y - h - rh + oy * 0.5], [x - ov, y - h]], rgba(C.paper, A), { jit: 0.3 });
  // walls: front (lime-washed, cool), right side (in shade)
  const wallC = mix3(C.wall, C.ink2, (o.wall ?? 0) + 0.05 + R() * 0.12 + far * 0.08);
  wash(ctx, [[x + w, y], [x + w + ox, y + oy], [x + w + ox, y + oy - h], [x + w, y - h]], rgba(mix3(wallC, C.ink2, 0.24), 0.95 * A), { jit: 0.4, seed: x });
  wash(ctx, [[x, y], [x + w, y], [x + w + sk, y - h], [x + sk, y - h]], rgba(wallC, 0.97 * A), { jit: 0.4, seed: x + 1 });
  if (far < 0.8) {   // the wall's edges, drawn: a broken line, never a clean box
    stroke(ctx, [[x + sk, y - h], [x, y]], { w: 0.55, col: rgba(C.ink, 0.42 * A), tin: 0.05, tout: 0.2, dry: 0.35, seed: x + 5 });
    stroke(ctx, [[x + w + sk, y - h], [x + w, y]], { w: 0.5, col: rgba(C.ink, 0.38 * A), tin: 0.05, tout: 0.2, dry: 0.35, seed: x + 6 });
  }
  if (o.shop !== false && far < 0.6) {
    // an open shopfront: the dark interior, a counter, the goods
    const s0 = x + w * (0.1 + R() * 0.06), s1 = x + w * (o.wideShop ? 0.9 : 0.55 + R() * 0.12);
    wash(ctx, [[s0, y - h * 0.14], [s1, y - h * 0.14], [s1, y - h * 0.86], [s0, y - h * 0.86]], rgba(mix3(C.ink2, C.wall, 0.35), 0.62 * A), { jit: 0.5, seed: x + 2 });
    stroke(ctx, [[s0 - 0.6, y - h * 0.36], [s1 + 0.6, y - h * 0.38]], { w: 0.9, col: rgba(C.timber, 0.85 * A), tin: 0, tout: 0, wob: 0.2 });
    for (let i = 0; i < 4; i++) { if (R() < 0.4) continue; ctx.fillStyle = rgba(i % 2 ? C.ink2 : C.indigoP, 0.6 * A); ctx.beginPath(); ctx.arc(mix(s0, s1, 0.15 + i * 0.22), y - h * 0.44, 0.7, 0, Math.PI * 2); ctx.fill(); }
  } else if (far < 0.8 && R() < 0.6) {
    // a lattice window
    const wx = x + w * (0.25 + R() * 0.3), ww = w * 0.22;
    wash(ctx, [[wx, y - h * 0.4], [wx + ww, y - h * 0.4], [wx + ww, y - h * 0.75], [wx, y - h * 0.75]], rgba(mix3(C.ink2, C.wall, 0.5), 0.5 * A));
  }
  // posts and the sill (timber)
  if (far < 0.7) {
    const posts = Math.max(2, Math.round(w / 13) + 1);
    for (let i = 0; i < posts; i++) {
      const px = x + (w * i) / (posts - 1) + (R() - 0.5) * 0.5;
      stroke(ctx, [[px, y + 0.3], [px + sk, y - h]], { w: 0.75, col: rgba(mix3(C.timber, C.ink, 0.4), 0.75 * A), tin: 0, tout: 0.1, wob: 0.2, seed: px });
    }
    stroke(ctx, [[x + w + ox, y + oy], [x + w + ox, y + oy - h]], { w: 0.6, col: rgba(C.ink, 0.5 * A), tin: 0, tout: 0 });
  }
  stroke(ctx, [[x - 0.6, y + 0.4], [x + w + 0.5, y + 0.3], [x + w + ox, y + oy + 0.3]], { w: 0.8, col: rgba(C.ink, 0.45 * A), tin: 0.05, tout: 0.1, dry: 0.2 });
  if (o.storey && far < 0.5) {   // an upper storey: a balcony rail and a lower eave
    const my = y - h * 0.52;
    stroke(ctx, [[x - w * 0.06, my], [x + w * 1.06, my]], { w: 1.1, col: rgba(C.ink, 0.85), tin: 0.05, tout: 0.05 });
    wash(ctx, [[x - w * 0.08, my], [x + w * 1.08, my], [x + w * 1.0, my - h * 0.1], [x, my - h * 0.1]], rgba(C.tile, 0.62));
    for (let i = 0; i < 9; i++) stroke(ctx, [[x + w * (0.06 + i * 0.11), my - h * 0.13], [x + w * (0.06 + i * 0.11), my - h * 0.25]], { w: 0.4, col: rgba(C.ink, 0.5), tin: 0, tout: 0 });
  }
  // the roof: front slope, the hip on the right, the ridge with lifted ends, eaves lifted at the corners
  const ey = y - h + 0.6;
  const lift = Math.max(0.9, w * (0.03 + R() * 0.015));
  const eave = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const ex = x - ov + sk + (w + 2 * ov) * t;
    const sag = Math.sin(Math.PI * t) * lift * 0.45 - Math.pow(Math.abs(t * 2 - 1), 6) * lift;
    eave.push([ex, ey + sag]);
  }
  const rL = [x + w * (0.15 + R() * 0.04) + ox * 0.5 + sk, y - h - rh + oy * 0.5];
  const rR = [x + w * (0.85 - R() * 0.04) + ox * 0.5 + sk, y - h - rh + oy * 0.5];
  const eB = [x + w + ov + ox + sk, ey + oy - lift];
  const eF = eave[eave.length - 1];
  const tile = o.thatch ? mix3(C.timber, C.ink2, 0.45) : mix3(C.tile, C.white, 0.08 + R() * 0.14 + far * 0.25);
  wash(ctx, [eF, eB, rR], rgba(mix3(tile, C.ink, 0.3), 0.86 * A), { jit: 0.4, seed: x + 3 });
  wash(ctx, [...eave, rR, rL], rgba(tile, (o.thatch ? 0.72 : 0.68) * A), { jit: 0.4, seed: x + 4 });
  // tile rows down the slope near the eave (a few, broken); thatch: streaks
  if (far < 0.75) {
    ctx.save();
    ctx.beginPath(); ctx.moveTo(eave[0][0], eave[0][1]); for (const p of eave) ctx.lineTo(p[0], p[1]); ctx.lineTo(rR[0], rR[1]); ctx.lineTo(rL[0], rL[1]); ctx.closePath(); ctx.clip();
    const rows = Math.max(4, Math.round(w / 2.6));
    for (let i = 1; i < rows; i++) {
      const t = i / rows;
      const ex = x - ov + sk + (w + 2 * ov) * t;
      const tx = mix(rL[0], rR[0], t) + (R() - 0.5) * 0.6;
      if (vnoise(i * 0.7, x * 0.1, 9) < 0.32) continue;
      const len = 0.35 + 0.4 * R();
      stroke(ctx, [[ex, ey + 0.6], [mix(ex, tx, len), mix(ey, rL[1], len)]], { w: 0.42, col: rgba(C.ink, (o.thatch ? 0.28 : 0.3) * A), tin: 0, tout: 0.6 });
    }
    ctx.restore();
  }
  // the roof's lines: the eave (strong), the hip, the ridge with its lifted ends (strongest)
  stroke(ctx, eave, { w: 1.05, col: rgba(C.ink, 0.88 * A), tin: 0.06, tout: 0.08, wob: 0.3, seed: x * 0.1 });
  stroke(ctx, [eF, eB], { w: 0.75, col: rgba(C.ink, 0.8 * A), tin: 0.05, tout: 0.2 });
  stroke(ctx, [eF, rR], { w: 0.6, col: rgba(C.ink, 0.6 * A), tin: 0.05, tout: 0.1, dry: 0.15 });
  stroke(ctx, [eave[0], rL], { w: 0.55, col: rgba(C.ink, 0.5 * A), tin: 0.05, tout: 0.1, dry: 0.2 });
  stroke(ctx, [[rL[0] - 1.3, rL[1] - 1.1], [rL[0], rL[1]], [rR[0], rR[1]], [rR[0] + 1.3, rR[1] - 1.1]], { w: 1.6, col: rgba(C.ink, 0.9 * A), tin: 0.12, tout: 0.12, wob: 0.25 });
  if (o.awning && far < 0.4) {   // a cloth shade on two poles over the street
    const a0 = x + w * 0.06, a1 = x + w * 0.82, ay = y - h * 0.8, fy = y + h * 0.5, fx = -w * 0.03;
    const cl = R() < 0.5 ? C.white : C.indigoP;
    wash(ctx, [[a0, ay], [a1, ay], [a1 + fx, fy - h * 0.6], [a0 + fx, fy - h * 0.6]], rgba(cl, 0.93));
    stroke(ctx, [[a0 + fx, fy - h * 0.6], [a1 + fx, fy - h * 0.6]], { w: 0.7, col: rgba(C.ink, 0.8), tin: 0.05, tout: 0.05 });
    stroke(ctx, [[a0 + fx, fy - h * 0.6], [a0 + fx, fy]], { w: 0.55, col: rgba(C.ink, 0.8), tin: 0, tout: 0 });
    stroke(ctx, [[a1 + fx, fy - h * 0.6], [a1 + fx, fy]], { w: 0.55, col: rgba(C.ink, 0.8), tin: 0, tout: 0 });
  }
  return { eave, rL, rR };
}

/** A market parasol over a little stall. (x, y) = the pole's foot. */
function parasol(env, x, y, s, R) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const lean = (R() - 0.5) * 2 * s;
  const top = [x + lean, y - 14 * s];
  const rx = (9 + R() * 3) * s, ry = 2.8 * s;
  stroke(ctx, [[x, y], top], { w: 0.65 * s, col: rgba(C.ink, 0.85), tin: 0, tout: 0 });
  wash(ctx, [[x - 5.5 * s, y - 3.4 * s], [x + 5.5 * s, y - 3.4 * s], [x + 6.2 * s, y - 2.4 * s], [x - 4.8 * s, y - 2.4 * s]], rgba(C.timber, 0.8));
  for (let i = 0; i < 5; i++) { ctx.fillStyle = rgba(i % 2 ? C.ink2 : C.indigoP, 0.7); ctx.beginPath(); ctx.arc(x - 4 * s + i * 2 * s, y - 4 * s, 0.7 * s, 0, Math.PI * 2); ctx.fill(); }
  const cc = R() < 0.6 ? C.white : C.indigoP;
  const dome = [];
  for (let i = 0; i <= 16; i++) { const a = Math.PI * (1 + i / 16); dome.push([top[0] + Math.cos(a) * rx, top[1] + 1.5 * s + Math.sin(a) * ry]); }
  const rim = [];
  for (let i = 16; i >= 0; i--) { const a = Math.PI * (i / 16); rim.push([top[0] + Math.cos(a) * rx, top[1] + 1.5 * s + Math.sin(a) * ry * 0.35]); }
  wash(ctx, [...dome, ...rim], rgba(cc, 0.95));
  for (let i = 1; i < 8; i++) stroke(ctx, [top, dome[i * 2]], { w: 0.32 * s, col: rgba(C.ink, 0.32), tin: 0, tout: 0.2 });
  stroke(ctx, dome, { w: 0.7 * s, col: rgba(C.ink, 0.85), tin: 0.05, tout: 0.05 });
  stroke(ctx, rim, { w: 0.5 * s, col: rgba(C.ink, 0.55), tin: 0.05, tout: 0.05 });
}

/**
 * A boat lying along the river: (x, y) = the waterline at the stern (left end); L = length. Its beam runs into
 * depth, so we see the near side, the deck from above, a barrel mat cabin. o.mast: 'up' (moored), 'lowering' (it
 * comes down to the bridge: the mast tilted back on its tabernacle, the crew on the ropes), 'none'.
 */
function boat(env, x, y, L, R, o = {}) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const s = o.s ?? 1;
  const beam = o.beam ?? L * 0.15;
  const DB = [0.66, -0.42];
  const P = (u, v, w = 0) => [x + u + DB[0] * w, y - v + DB[1] * w];   // u along, v up, w across
  const hh = o.hull ?? 4.4 * s;
  const sheer = (t) => hh * (1 + 0.65 * Math.pow(Math.abs(t * 2 - 1), 2.6)) + (t > 0.5 ? (t - 0.5) * hh * 0.5 : 0);
  const N = 18;
  const pinch = (t) => Math.pow(Math.sin(Math.PI * (0.04 + 0.92 * t)), 0.45);
  const gN = [], gF = [];
  for (let i = 0; i <= N; i++) { const t = i / N; const p = pinch(t); gN.push(P(L * t, sheer(t), beam * 0.5 * (1 - p))); gF.push(P(L * t, sheer(t), beam * 0.5 * (1 + p))); }
  // its reflection: darker smears torn by ripples
  for (let k = 0; k < 6; k++) {
    const yy = 1.4 + k * 1.5 * s;
    stroke(ctx, [[x + L * (0.06 + R() * 0.08), y + yy], [x + L * (0.5 + R() * 0.1), y + yy + 0.3], [x + L * (0.86 + R() * 0.1), y + yy]], { w: (1.6 - k * 0.2) * s, col: rgba(C.ink2, 0.16 - k * 0.022), tin: 0.25, tout: 0.5, wob: 0.7, dry: 0.3, seed: k + x });
  }
  // the deck seen from above, then the near side of the hull down to the water
  wash(ctx, [...gN, ...gF.slice().reverse()], rgba(mix3(C.timberM, C.white, 0.35), 0.95));
  const side = [...gN];
  for (let i = N; i >= 0; i--) { const t = i / N; side.push(P(L * (0.06 + 0.88 * t), 0, 0)); }
  wash(ctx, side, rgba(C.timber, 0.9), { edge: rgba(C.ink, 0.35) });
  stroke(ctx, side.slice(N + 1), { w: 0.8 * s, col: rgba(C.ink, 0.85), tin: 0.1, tout: 0.2 });
  stroke(ctx, gN, { w: 0.95 * s, col: rgba(C.ink, 0.88), tin: 0.04, tout: 0.08, wob: 0.25 });
  stroke(ctx, gF, { w: 0.5 * s, col: rgba(C.ink, 0.55), tin: 0.05, tout: 0.1 });
  stroke(ctx, gN.map((p) => [p[0], p[1] + hh * 0.5]).slice(2, N - 1), { w: 0.45 * s, col: rgba(C.ink, 0.38), tin: 0.2, tout: 0.3, dry: 0.3 });
  // the barrel mat cabin (grey mats, never beige)
  if (o.cabin !== false) {
    const u0 = L * (o.c0 ?? 0.3), u1 = L * (o.c1 ?? 0.7);
    const ch = o.ch ?? 5 * s, wallH = 2.1 * s;
    const base = (u) => sheer(u / L);
    const arch = (u) => { const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(P(u, base(u) + wallH + Math.sin(Math.PI * t) * ch, beam * (0.06 + 0.88 * t))); } return pts; };
    const A0 = arch(u0), A1 = arch(u1);
    const mat = mix3(C.tile, C.white, 0.5);
    wash(ctx, [P(u0, base(u0), beam * 0.06), P(u1, base(u1), beam * 0.06), A1[0], A0[0]], rgba(mix3(C.timber, C.ink2, 0.3), 0.92));
    wash(ctx, [...A0, ...A1.slice().reverse()], rgba(mat, 0.95));
    wash(ctx, [...A1, P(u1, base(u1), beam * 0.94), P(u1, base(u1), beam * 0.06)], rgba(mix3(mat, C.ink, 0.35), 0.95));
    const ribs = Math.max(3, Math.round((u1 - u0) / (3.2 * s)));
    for (let i = 1; i < ribs; i++) stroke(ctx, arch(mix(u0, u1, i / ribs)).slice(0, 8), { w: 0.38 * s, col: rgba(C.ink, 0.38), tin: 0.1, tout: 0.3 });
    stroke(ctx, A1, { w: 0.7 * s, col: rgba(C.ink, 0.85), tin: 0.05, tout: 0.05 });
    stroke(ctx, [A0[0], A1[0]], { w: 0.65 * s, col: rgba(C.ink, 0.8), tin: 0.05, tout: 0.1 });
    stroke(ctx, [A0[5], A1[5]], { w: 0.45 * s, col: rgba(C.ink, 0.5), tin: 0.1, tout: 0.1 });
  }
  if (o.mast === 'up') {
    const m0 = P(L * 0.62, sheer(0.62), beam * 0.5);
    const m1 = [m0[0] + 1.1 * s, m0[1] - L * 0.6];
    stroke(ctx, [m0, m1], { w: 1.0 * s, col: rgba(C.ink, 0.9), tin: 0, tout: 0.25 });
    stroke(ctx, [m1, P(L * 0.02, sheer(0) + 1, beam * 0.5)], { w: 0.3 * s, col: rgba(C.ink, 0.42), tin: 0, tout: 0 });
    stroke(ctx, [m1, P(L * 0.98, sheer(1) + 1, beam * 0.5)], { w: 0.3 * s, col: rgba(C.ink, 0.42), tin: 0, tout: 0 });
  } else if (o.mast === 'lowering') {
    // the drama of the scroll: the mast is being let down to pass under the bridge, tilted back over the stern
    const m0 = P(L * 0.58, sheer(0.58) + 1.5 * s, beam * 0.5);
    const ang = (o.mastAngle ?? 32) * Math.PI / 180;
    const ml = L * 0.5;
    const m1 = [m0[0] - Math.cos(ang) * ml, m0[1] - Math.sin(ang) * ml];
    stroke(ctx, [m0, m1], { w: 1.2 * s, col: rgba(C.ink, 0.92), tin: 0.04, tout: 0.2 });
    stroke(ctx, [m0, P(L * 0.58, sheer(0.58), beam * 0.5)], { w: 1.4 * s, col: rgba(C.ink, 0.9), tin: 0, tout: 0 });   // the tabernacle
    // one rope from the masthead forward, taken in by the crew at the bow
    const bow = P(L * 0.86, sheer(0.86) + 6 * s, beam * 0.5);
    stroke(ctx, [m1, [mix(m1[0], bow[0], 0.5), mix(m1[1], bow[1], 0.5) + 2 * s], bow], { w: 0.32 * s, col: rgba(C.ink, 0.55), tin: 0, tout: 0 });
    o.masthead = bow;
  }
  for (const [u, w, opt] of o.crew || []) {
    const p = P(L * u, sheer(u), beam * w);
    person(env, p[0], p[1], s * 0.92, R, { ...opt, pull: opt.pull && o.masthead ? o.masthead : undefined });
  }
}

/**
 * The rainbow bridge: a heavy woven-timber arch spanning the river into depth (from the near bank at A, `span` world
 * px along `dir` to the far bank), its deck across x (bw). We see its top, its right-hand face (bundles of timber
 * beams in a polygonal arch, beam ends crossing them), the rails, and the crowd standing on it.
 */
function bridge(env, A, span, Hb, R, o = {}) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const bw = o.bw ?? 22, ramp = o.ramp ?? 0.16, T = o.T ?? 10;
  const Db = o.dir || [0.9, -0.42];
  const N = 60;
  const base = (t) => [A[0] + Db[0] * span * t, A[1] + Db[1] * span * t];
  // the arch: half a polygon of straight beams (the woven timber), half a round curve, so it reads both as built of
  // beams and as the rainbow it is named for
  const K = [0, 0.16, 0.36, 0.64, 0.84, 1];
  const KH = [0, 0.66, 0.97, 0.97, 0.66, 0];
  const lift = (t) => {
    if (t <= 0 || t >= 1) return 0;
    let poly = 0;
    for (let i = 0; i < K.length - 1; i++) if (t <= K[i + 1]) { poly = mix(KH[i], KH[i + 1], (t - K[i]) / (K[i + 1] - K[i])); break; }
    return Hb * mix(poly, Math.pow(Math.sin(Math.PI * t), 0.6), 0.5);
  };
  const deckLift = (t) => {
    if (t < 0) return Math.max(0, 4 + (t / ramp) * 4);
    if (t > 1) return Math.max(0, 4 - ((t - 1) / ramp) * 4);
    return Math.max(4, lift(t) + 2);
  };
  const deckAt = (t, w = 0) => { const b = base(t); return [b[0] + w * bw, b[1] - deckLift(t)]; };
  const ts = []; for (let i = 0; i <= N; i++) ts.push(-ramp + (1 + 2 * ramp) * i / N);
  // shadow on the water under the arch, and its broken reflection
  for (let k = 0; k < 9; k++) {
    const t = 0.15 + R() * 0.7; const b = base(t);
    stroke(ctx, [[b[0] + bw * 0.1, b[1] + 3 + k * 1.2], [b[0] + bw * 1.7, b[1] + 3.3 + k * 1.2]], { w: 1.1, col: rgba(C.ink2, 0.13), tin: 0.2, tout: 0.6, dry: 0.3, seed: k });
  }
  // the far (left) face's arch, glimpsed under the deck
  const backArch = []; for (let i = 0; i <= N; i++) { const t = i / N; const b = base(t); backArch.push([b[0], b[1] - lift(t)]); }
  stroke(ctx, backArch.slice(3, -3), { w: 1.6, col: rgba(mix3(C.timber, C.ink, 0.5), 0.45), tin: 0.1, tout: 0.1 });
  // the deck's top surface (planks: timber, lighter)
  wash(ctx, [...ts.map((t) => deckAt(t, 0)), ...ts.slice().reverse().map((t) => deckAt(t, 1))], rgba(mix3(C.timberM, C.white, 0.25), 0.94));
  for (let i = 2; i < N - 1; i += 3) stroke(ctx, [deckAt(ts[i], 0.05), deckAt(ts[i], 0.95)], { w: 0.3, col: rgba(C.ink, 0.22), tin: 0, tout: 0 });
  // the far rail
  const farRail = ts.map((t) => { const p = deckAt(t, 0); return [p[0], p[1] - 4.4]; });
  stroke(ctx, farRail, { w: 0.65, col: rgba(C.ink, 0.65), tin: 0.05, tout: 0.05 });
  for (let i = 0; i <= N; i += 2) stroke(ctx, [deckAt(ts[i], 0), farRail[i]], { w: 0.42, col: rgba(C.ink, 0.45), tin: 0, tout: 0 });
  // the crowd on the deck: thickest on the crown, some at the rail looking down at the boat; nobody walks
  const people = [];
  const nP = o.people ?? 30;
  for (let i = 0; i < nP; i++) {
    let t = R(); t = 0.5 + (t - 0.5) * (0.55 + 0.7 * R());
    people.push([t * (1 + ramp) - ramp * 0.5, 0.12 + 0.76 * R()]);
  }
  people.sort((a, b) => deckAt(a[0], a[1])[1] - deckAt(b[0], b[1])[1]);
  for (const [t, w] of people) {
    const p = deckAt(t, w);
    person(env, p[0], p[1], o.fs ?? 0.82, R, { lean: (R() - 0.5) * 0.4, arm: R() < 0.4 ? 'up' : 'down', flip: R() < 0.55 });
  }
  for (const [t, w] of o.stalls ?? []) { const p = deckAt(t, w); parasol(env, p[0], p[1], 0.75, R); }
  // the visible face: bundles of timber beams in the polygonal arch, beam ends crossing them, a dark underside
  const face = [], faceLow = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N; const b = base(t);
    const top = [b[0] + bw, b[1] - lift(t)];
    face.push(top);
    faceLow.push([top[0], top[1] + T * (0.85 + 0.3 * Math.pow(Math.abs(t * 2 - 1), 2))]);
  }
  wash(ctx, [...face, ...faceLow.slice().reverse()], rgba(C.timber, 0.94), { edge: rgba(C.ink, 0.4) });
  for (const f of [0.3, 0.55, 0.78]) {   // the beam bundles running along the arch
    const line = face.map((p, i) => [p[0], mix(p[1], faceLow[i][1], f)]);
    stroke(ctx, line.slice(1, -1), { w: 0.55, col: rgba(C.ink, 0.5), tin: 0.05, tout: 0.05, dry: 0.25, seed: f * 100 });
  }
  for (let i = 2; i < N - 1; i += 2) {   // beam ends crossing the bundles (the woven lattice)
    const a = face[i], b = faceLow[i];
    stroke(ctx, [[a[0] + 0.3, a[1] + 0.2], [b[0] - 0.2, b[1] - 0.3]], { w: 0.75, col: rgba(mix3(C.ink, C.timber, 0.25), 0.7), tin: 0, tout: 0 });
  }
  stroke(ctx, face, { w: 1.35, col: rgba(C.ink, 0.9), tin: 0.04, tout: 0.04, wob: 0.2 });
  stroke(ctx, faceLow, { w: 1.6, col: rgba(C.ink, 0.88), tin: 0.04, tout: 0.04, wob: 0.25 });
  // the near rail and its posts
  const deckN = ts.map((t) => deckAt(t, 1));
  const rail = deckN.map(([x, y]) => [x, y - 4.8]);
  stroke(ctx, deckN, { w: 0.95, col: rgba(C.ink, 0.88), tin: 0.04, tout: 0.04 });
  for (let i = 0; i <= N; i += 2) stroke(ctx, [deckN[i], rail[i]], { w: 0.55, col: rgba(C.ink, 0.85), tin: 0, tout: 0 });
  stroke(ctx, rail, { w: 0.85, col: rgba(C.ink, 0.88), tin: 0.04, tout: 0.04, wob: 0.15 });
  // abutments: stone, set into the banks
  for (const t of [0, 1]) {
    const b = base(t);
    wash(ctx, [[b[0] - 5, b[1] + 1.6], [b[0] + bw + 7, b[1] + 1.6], [b[0] + bw + 5, b[1] - 6], [b[0] - 3, b[1] - 5]], rgba(mix3(C.ink2, C.white, 0.55), 0.7), { jit: 1 });
    dryBrush(ctx, [[b[0] - 7, b[1] + 1.6], [b[0] + bw + 9, b[1] + 1.9]], { w: 2.4, col: rgba(C.ink, 0.5), bristles: 4, seed: b[0] });
  }
  return { deckAt, base };
}

// ---------------------------------------------------------------- Home: the traveller and the hut
// They stand on the near ridge (plane 3) at the foot of the host peak. The path comes up out of the mist along the
// ridge's crest from the lower left; the traveller has reached the saddle where the ridge rests and looks on up to
// the hut, perched on a ledge of the crag just under the skyline, nestled among a few dark trees.
function* home(env) {
  const { ctx, P, ink } = env;
  const { C, rgba } = ink;
  const R = rng(5);
  // the phone's album leaf sees this place from further away: the figures are drawn larger there, so the traveller
  // is never less than 12 CSS px tall (a painter's licence: figures are always drawn to be read)
  const big = Math.max(1, 0.7 * REF_PX / env.scale);
  const X = (u) => u * REF_PX, Y = (y) => (1 - y) * VH_PX;
  const crest = (u) => planeTop(3, u, P);
  const at = (u, dy = 0) => [X(u), Y(crest(u)) + dy];
  // the ridge under his feet, drawn as a painter draws a figure's own ground: a wash of body under the crest, the
  // crest itself in a dry, dark contour, texture strokes down the slope, moss dots along the top
  const ridge = [];
  for (let u = 0.722; u <= 0.836; u += 0.002) ridge.push(at(u, 0.6));
  const body = [...ridge, ...ridge.slice().reverse().map(([x, y], i) => [x - 4, y + 13 + 6 * Math.sin(i * 0.11)])];
  softWash(env, body, rgba(mix3(C.ink2, C.indigo, 0.5), 0.16), 2.5);
  for (const seg of runs(ridge, R, 30, 90, 9)) stroke(ctx, seg, { w: 1.4 * big, col: rgba(C.ink, 0.42 + R() * 0.2), tin: 0.2, tout: 0.45, wob: 0.7, dry: 0.3, seed: seg[0][0] });
  for (let i = 2; i < ridge.length - 2; i += 3) {
    if (R() < 0.35) continue;
    const [x, y] = ridge[i];
    const len = 4 + R() * 7;
    stroke(ctx, [[x, y + 1.2], [x - 1.2 - R() * 1.5, y + 1.2 + len]], { w: 0.75 * big, col: rgba(C.ink, 0.22 + R() * 0.18), tin: 0.1, tout: 0.7, dry: 0.3, seed: i });
  }
  for (let i = 0; i < ridge.length; i += 4) {
    if (R() < 0.5) continue;
    const [x, y] = ridge[i];
    ctx.fillStyle = rgba(ink.strength > 0 ? mix3(C.ink, C.malD, 0.3) : C.ink, 0.55 + R() * 0.3);
    ctx.beginPath(); ctx.ellipse(x + (R() - 0.5) * 2, y - 0.4, (0.9 + R() * 0.5) * big, 0.6 * big, 0, 0, Math.PI * 2); ctx.fill();
  }
  // the path: a soft pale wash just under the crest (paper reserved by the brush), climbing toward the saddle
  const path = [];
  for (let u = 0.728; u <= 0.812; u += 0.002) path.push(at(u, 2.4));
  const band = [...path.map(([x, y], i) => [x, y - 0.5 - 0.35 * Math.sin(i * 0.3)]), ...path.slice().reverse().map(([x, y], i) => [x, y + 1.8 + 0.4 * Math.sin(i * 0.23)])];
  softWash(env, band, rgba(C.white, 0.5), 0.7);
  const hu = 0.846;
  // the ledge is seated on the crag, not hung off its edge: the crest climbs steeply here, so the shelf goes in below
  // the lowest crest point across its whole width (left lip to right end), never over the sky beside the flank
  let footY = Y(crest(hu)) + 7;
  for (let d = -19; d <= 22; d += 1) footY = Math.max(footY, Y(crest(hu + (d * big) / REF_PX)) + 4);
  const ledge = [X(hu), footY];
  yield;
  // trees where the path comes out of the mist
  dotTree(env, X(0.738), Y(crest(0.738)) + 2.2, 0.55 * big, R, { clusters: 5 });
  dotTree(env, X(0.748), Y(crest(0.748)) + 3, 0.42 * big, R, { green: true });
  pine(env, X(0.79), Y(crest(0.79)) + 1.5, 0.58 * big, R);
  yield;
  // the hut on its ledge: a shelf of rock under it (a dark dry stroke, a pale shelf), trees around, mist at its foot
  const [lx, ly] = ledge;
  // the ledge: a shelf of the crag itself (a pale top worn by feet, a dark lip, the rock face falling away below)
  softWash(env, [[lx - 19 * big, ly - 1.5], [lx + 22 * big, ly - 2.4], [lx + 20 * big, ly + 2.6], [lx - 17 * big, ly + 3]], rgba(mix3(C.paper, C.ink2, 0.3), 0.55), 1);
  dotTree(env, lx - 15 * big, ly + 0.5, 0.62 * big, R, { green: true, clusters: 5 });
  dotTree(env, lx + 4 * big, ly - 1.5, 0.5 * big, R, { clusters: 3 });
  pine(env, lx + 15 * big, ly + 1, 0.52 * big, R);
  house(env, lx - 8 * big, ly, 16 * big, 5.4 * big, R, { d: 8 * big, shop: false, rh: 4.4 * big, ov: 2 * big, far: 0.15, wall: 0.3 });
  stroke(ctx, [[lx - 17 * big, ly + 2.2], [lx - 9 * big, ly + 1.2], [lx + 1 * big, ly + 2.4], [lx + 9 * big, ly + 1.6], [lx + 16 * big, ly + 3.4]], { w: 1.6 * big, col: rgba(C.ink, 0.5), tin: 0.25, tout: 0.4, wob: 0.8, dry: 0.25, seed: 12 });
  // mist at its foot: a pale band under the lip that the plane's own mist band continues (grounds it, never a box)
  softWash(env, [[lx - 24 * big, ly + 4], [lx + 26 * big, ly + 3.4], [lx + 22 * big, ly + 12 * big], [lx - 20 * big, ly + 13 * big]], rgba(C.mist, 0.42), 4);
  for (let i = 0; i < 3; i++) {   // the rock under the lip: a few slanting texture strokes down the face
    const sx = lx - 12 * big + i * 9 * big + (R() - 0.5) * 3;
    stroke(ctx, [[sx, ly + 3.5], [sx - (3 + R() * 2) * big, ly + (6 + R() * 4) * big]], { w: 0.9 * big, col: rgba(C.ink, 0.3), tin: 0.1, tout: 0.7, dry: 0.35, seed: i });
  }

  yield;
  // the traveller at the saddle: a white robe, a cone hat, a staff, leaning into the climb toward the hut
  const [tx, ty] = at(0.802, 2.2);
  softWash(env, ellipse(tx + 0.8 * big, ty + 0.4, 4.6 * big, 1.1 * big, 10), rgba(C.ink, 0.16), 0.6);   // his shadow on the path
  person(env, tx, ty, 1.8 * big, R, { hat: 'cone', lean: 0.18, arm: 'down', robe: C.white, staff: true, outline: 0.88 });
  yield;
}

// ---------------------------------------------------------------- Work: the river market at the rainbow bridge
function* market(env) {
  const { ctx, P, ink } = env;
  const { C, rgba } = ink;
  const R = rng(7);
  const X = (u) => u * REF_PX, Y = (y) => (1 - y) * VH_PX, Ux = (x) => x / REF_PX;
  const f = new Float32Array(SCENE_FIELDS);
  const banks = (x) => { sceneField(Ux(x), P, f); return [Y(f[1]), Y(f[7])]; };   // [far bank, near bank], world px
  const farB = (x) => banks(x)[0] + (vnoise(x / 60, 0.2, 5) - 0.5) * 2.5;
  const nearB = (x) => banks(x)[1] + (vnoise(x / 55, 0.8, 6) - 0.5) * 3;
  const x0 = X(1.12), x1 = X(2.0);
  const items = [];

  // the far bank: a stone embankment along the water and the street behind it; the near bank: earth and grass
  const top = [], bot = [];
  for (let x = x0; x <= x1; x += 5) { top.push([x, farB(x)]); bot.push([x, nearB(x)]); }
  wash(ctx, [...top.map(([x, y]) => [x, y - 13]), ...top.slice().reverse()], rgba(C.paper, 0.85), { jit: 0 });
  // the embankment: a soft grey band of stone under the street, its top edge drawn in a long, lightly broken line
  const emb = top.filter((p) => p[0] > x0 + 60 && p[0] < x1 - 40);
  softWash(env, [...emb.map(([x, y]) => [x, y - 0.5]), ...emb.slice().reverse().map(([x, y]) => [x, y + 3.2])], rgba(mix3(C.ink2, C.white, 0.55), 0.55), 0.8);
  for (const seg of runs(emb, R, 90, 260, 14)) stroke(ctx, seg, { w: 1.1, col: rgba(C.ink, 0.5), tin: 0.15, tout: 0.2, wob: 0.6, dry: 0.15, seed: seg[0][0] });
  for (const seg of runs(emb, R, 40, 140, 30)) stroke(ctx, seg.map(([x, y]) => [x, y + 3.4]), { w: 0.8, col: rgba(C.ink, 0.28), tin: 0.2, tout: 0.3, wob: 0.6, dry: 0.3, seed: seg[0][0] + 1 });
  // the near bank: a soft earth-grey ground falling away to the bottom, its waterline a long, wet edge
  const nb = bot.filter((p) => p[0] > x0 + 80 && p[0] < x1 - 60);
  softWash(env, [...bot.map(([x, y]) => [x, y + 1]), [x1, bot[bot.length - 1][1] + 44], [x0, bot[0][1] + 44]], rgba(C.earth, 0.085), 3);
  softWash(env, [...nb.map(([x, y]) => [x, y]), ...nb.slice().reverse().map(([x, y]) => [x, y + 5])], rgba(C.ink2, 0.16), 1.6);
  for (const seg of runs(nb, R, 70, 240, 22)) stroke(ctx, seg, { w: 1.2 + R() * 0.8, col: rgba(C.ink, 0.38 + R() * 0.14), tin: 0.2, tout: 0.35, wob: 0.7, dry: 0.12, seed: seg[0][0] });
  yield;

  // the bridge: from the near bank, crossing the river on a long diagonal into depth, its arch high, so it reads as
  // the scroll's rainbow bridge seen from the side
  const BD = [0.95, -0.3];
  const bc = X(1.565);
  const span = (nearB(bc) - farB(bc) + 4) / -BD[1];
  const bA = [bc - BD[0] * span * 0.5, nearB(bc - BD[0] * span * 0.5) + 1.5];
  const bB = [bA[0] + BD[0] * span, bA[1] + BD[1] * span];

  // the town: a front row facing the water, a broken second and third row behind (up and right, along D), gaps
  // for trees, street life in front. The back rows are paler and simpler, half lost in the mist.
  for (const [row, depth, sc, keep, far] of [[3, 66, 0.78, 0.5, 0.85], [2, 33, 0.9, 0.7, 0.45], [1, 0, 1.0, 0.86, 0]]) {
    for (let x = x0 + 30 + R() * 30; x < x1 - 30;) {
      const s = sc * (0.85 + R() * 0.3);
      const w = (22 + R() * 34) * s, h = (9 + R() * 5) * s;
      const xx = x + D[0] * depth;
      const y = farB(x + w * 0.5) - 13 + D[1] * depth + (R() - 0.5) * 2;
      const nearBridge = row === 1 && xx + w > bB[0] - 26 && xx < bB[0] + 34;
      if (R() < keep && !nearBridge) {
        const thatch = R() < 0.12;
        const storey = !thatch && row < 3 && R() < 0.22, awning = row === 1 && !storey && R() < 0.32;
        const opts = { d: w * (0.4 + R() * 0.26), wideShop: R() < 0.4, shop: row === 1 || R() < 0.25, thatch, storey, awning, far };
        items.push({ y, f: () => house(env, xx, y, w, storey ? h * 1.55 : h, R, opts) });
        if (row > 1 && R() < 0.34) { const tx = xx + w * (0.2 + R() * 0.6), ty = y + 2; items.push({ y: ty + 1, f: () => (R() < 0.5 ? willow(env, tx, ty, 0.5, R) : dotTree(env, tx, ty, 0.55, R, { green: true })) }); }
        if (row === 1) {
          const n = 1 + Math.floor(R() * 3.4);
          for (let i = 0; i < n; i++) { const fx = xx + R() * w, fy = y + 4 + R() * 7; items.push({ y: fy, f: () => person(env, fx, fy, 0.95 + R() * 0.15, R, { pole: R() < 0.15, flip: R() < 0.5 }) }); }
          if (R() < 0.26) { const px = xx + w * (0.3 + R() * 0.4), py = y + 10; items.push({ y: py, f: () => parasol(env, px, py, 0.9, R) }); }
        }
      } else if (row <= 2 && R() < 0.7) {
        const tx = xx + w * 0.5, ty = y + 2;
        items.push({ y: ty, f: () => (R() < 0.55 ? willow(env, tx, ty, 0.62, R) : dotTree(env, tx, ty, 0.6, R, { green: true })) });
      }
      x += w + (3 + R() * 12) * s;
    }
  }
  // the near bank: big willows, grass, stones, a stall and a small crowd at the bridge's foot
  for (const [u, s] of [[1.235, 1.2], [1.37, 1.55], [1.875, 1.3]]) { const x = X(u); const y = nearB(x) + 21; items.push({ y, f: () => willow(env, x, y, s, R, { sway: 1.3 }) }); }
  for (let i = 0; i < 46; i++) {
    const rx = x0 + 80 + R() * (x1 - x0 - 160), ry = nearB(rx) + 3 + R() * 7;
    items.push({ y: ry, f: () => stroke(ctx, [[rx, ry], [rx + (R() - 0.3) * 4, ry - 4 - R() * 5]], { w: 0.8, col: rgba(ink.strength > 0 ? mix3(C.malD, C.ink, 0.4) : C.ink2, 0.32 + R() * 0.15), tin: 0, tout: 0.9 }) });
  }
  for (let i = 0; i < 6; i++) {
    const rx = x0 + 120 + R() * (x1 - x0 - 240), ry = nearB(rx) + 6 + R() * 6;
    items.push({ y: ry, f: () => { wash(ctx, ellipse(rx, ry, 3 + R() * 3, 1.5 + R(), 9), rgba(mix3(C.ink2, C.white, 0.5), 0.6)); stroke(ctx, [[rx - 3, ry + 1.2], [rx + 3.5, ry + 1]], { w: 0.7, col: rgba(C.ink, 0.5), tin: 0.1, tout: 0.4 }); } });
  }
  items.push({ y: bA[1] + 13, f: () => parasol(env, bA[0] - 26, bA[1] + 13, 1.0, R) });
  for (let i = 0; i < 9; i++) { const fx = bA[0] - 80 + R() * 95, fy = nearB(fx) + 7 + R() * 13; items.push({ y: fy, f: () => person(env, fx, fy, 1.05, R, { pole: i === 2, flip: R() < 0.5 }) }); }
  // boats: moored along the far bank (masts up), and the big boat coming down to the bridge, its mast being lowered
  const fb = (u) => farB(X(u));
  const boats = [
    { x: X(1.21), y: fb(1.225) + 12, L: 72, o: { s: 0.9, mast: 'up', crew: [[0.9, 0.4, { flip: true }]] } },
    { x: X(1.285), y: fb(1.305) + 14, L: 88, o: { s: 0.95, mast: 'up', c0: 0.22, c1: 0.6 } },
    { x: X(1.835), y: fb(1.845) + 12, L: 58, o: { s: 0.82, mast: 'up' } },
    { x: X(1.645), y: mix(fb(1.69), nearB(X(1.69)), 0.62), L: 140, o: { s: 1.1, mast: 'lowering', mastAngle: 28, c0: 0.24, c1: 0.52, crew: [[0.04, 0.2, { punt: true, hat: 'cone' }], [0.14, 0.15, { punt: true }], [0.8, 0.3, { arm: 'up', pull: true, flip: true }], [0.9, 0.4, { arm: 'up', pull: true, flip: true, hat: 'cone' }], [0.68, 0.7, { arm: 'up', flip: true }]] } },
    { x: X(1.905), y: nearB(X(1.91)) - 9, L: 40, o: { s: 0.75, crew: [[0.15, 0.4, { punt: true, hat: 'cone' }]], cabin: false } },
  ];
  for (const b of boats) items.push({ y: b.y, f: () => boat(env, b.x, b.y, b.L, R, b.o) });
  items.push({ y: bA[1] - 3, f: () => bridge(env, bA, span, 70, R, { dir: BD, people: 36, bw: 20, ramp: 0.12, T: 11, stalls: [[-0.1, 0.5], [1.1, 0.5]] }) });
  items.sort((a, b) => a.y - b.y);
  let n = 0;
  for (const it of items) { it.f(); if (++n % 6 === 0) yield; }

  // (the town's mist, its back rows dissolving and the banks drifting across it, and the melting of both ends of the
  // layer, are painted by the scene shader as it lays the layer in: no per-pixel work here)
  yield;
}

// ---------------------------------------------------------------- the source: a worker, or idle chunks
/**
 * Where figure layers are drawn: a module worker with OffscreenCanvas when the browser has both (Safari 16.4+), else
 * the main thread in idle chunks of <= 8 ms. request() resolves to { width, height, data (premultiplied RGBA bytes,
 * top row first) | bitmap, ms }.
 */
export function createFigureSource() {
  let worker = null, broken = false, seq = 0, dead = false;
  const pending = new Map();
  const canWorker = typeof Worker === 'function' && typeof OffscreenCanvas === 'function';
  function ensure() {
    if (worker || broken || !canWorker) return worker;
    try {
      worker = new Worker(new URL('./figures.worker.js', import.meta.url), { type: 'module', name: 'figures' });
      worker.onmessage = (e) => {
        const p = pending.get(e.data?.id);
        if (!p) return;
        pending.delete(e.data.id);
        if (e.data.error) p.fallback(); else p.resolve(e.data);
      };
      worker.onerror = (e) => {
        e.preventDefault?.();
        broken = true;
        try { worker.terminate(); } catch { /* ignore */ }
        worker = null;
        const all = [...pending.values()];
        pending.clear();
        all.forEach((p) => p.fallback());
      };
    } catch { broken = true; worker = null; }
    return worker;
  }
  function request(params) {
    return new Promise((resolve, reject) => {
      if (dead) { reject(new Error('destroyed')); return; }
      const id = ++seq;
      const fallback = () => { if (!dead) idleDraw(params).then(resolve, reject); };
      const w = ensure();
      if (!w) { fallback(); return; }
      pending.set(id, { resolve, reject, fallback });
      w.postMessage({ id, ...params });
    });
  }
  return {
    request,
    destroy() {
      dead = true;
      try { worker?.terminate(); } catch { /* ignore */ }
      worker = null;
      pending.clear();
    },
  };
}

/** Premultiply straight RGBA in place (the GPU path filters premultiplied texels, so edges never darken). */
export function premultiply(d) {
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a === 255) continue;
    if (a === 0) { d[i] = d[i + 1] = d[i + 2] = 0; continue; }
    d[i] = (d[i] * a + 127) / 255;
    d[i + 1] = (d[i + 1] * a + 127) / 255;
    d[i + 2] = (d[i + 2] * a + 127) / 255;
  }
  return d;
}

// The main-thread fallback: the same steps, run in idle time, at most ~8 ms at a go.
function idleDraw(p) {
  return new Promise((resolve, reject) => {
    const { width, height } = layerSize(p.stretch, p.scale, p.dpr);
    let canvas;
    try {
      canvas = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(width, height) : Object.assign(document.createElement('canvas'), { width, height });
    } catch (err) { reject(err); return; }
    const ctx = canvas.getContext('2d', { willReadFrequently: p.out !== 'bitmap' });
    if (!ctx) { reject(new Error('no 2d context')); return; }
    const steps = paintSteps(ctx, p);
    let ms = 0;
    const ric = typeof requestIdleCallback === 'function' ? requestIdleCallback : (f) => setTimeout(() => f({ timeRemaining: () => 8 }), 16);
    const run = (deadline) => {
      const t0 = performance.now();
      const budget = Math.min(8, Math.max(2, deadline?.timeRemaining?.() ?? 8));
      try {
        while (performance.now() - t0 < budget) {
          if (steps.next().done) {
            ms += performance.now() - t0;
            if (p.out === 'bitmap') resolve({ width, height, bitmap: canvas, ms });
            else {
              const img = ctx.getImageData(0, 0, width, height);
              resolve({ width, height, data: premultiply(img.data), ms });
            }
            return;
          }
        }
      } catch (err) { reject(err); return; }
      ms += performance.now() - t0;
      ric(run, { timeout: 300 });
    };
    ric(run, { timeout: 300 });
  });
}
