// ridges.js — ridge profiles for the ink landscape, shared by the WebGL painter
// (uploaded as a small float texture) and the Canvas2D fallback (drawn as paths).
// Mountains never move sideways, so their silhouettes are computed once per resize
// on the CPU; the fragment shader only paints ink, texture and mist on top.

// Seeded integer hash -> [0, 1)
function hash(i, seed) {
  let h = Math.imul(i ^ 0x27d4eb2d, 0x85ebca6b) ^ Math.imul(seed + 0x165667b1, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

// 1D gradient noise, roughly [-1, 1]
function noise1(x, seed) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * f * (f * (f * 6 - 15) + 10);
  const g0 = hash(i, seed) * 2 - 1;
  const g1 = hash(i + 1, seed) * 2 - 1;
  return (g0 * f * (1 - u) + g1 * (f - 1) * u) * 2;
}

function fbm1(x, seed, octaves = 4) {
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
function ridged1(x, seed, octaves = 6) {
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

// Composition: five planes, far -> near ("level distance": wide, low, lots of sky).
// Heights are in viewport heights from the bottom edge. `env` bumps are [centre x (0..1 of width), width, gain]:
// they keep the left/upper area (where the name sits) open and pile mass on the right.
export const LAYERS = [
  { base: 0.36, amp: 0.22, freq: 1.6, seed: 11, crest: 0.5, foot: 0.27, fade: 0.15, ink: 0.42, env: [[0.22, 0.24, 0.5], [0.62, 0.30, 0.7]], floor: 0.35 },
  { base: 0.29, amp: 0.27, freq: 1.3, seed: 23, crest: 0.6, foot: 0.19, fade: 0.14, ink: 0.62, env: [[0.04, 0.15, 0.6], [0.50, 0.18, 0.45], [0.97, 0.2, 0.85]], floor: 0.15 },
  { base: 0.18, amp: 0.40, freq: 1.45, seed: 37, crest: 0.72, foot: 0.11, fade: 0.15, ink: 0.82, env: [[0.66, 0.10, 0.8], [0.77, 0.09, 1.0], [0.40, 0.12, 0.22]], floor: 0.06 },
  { base: 0.05, amp: 0.52, freq: 1.8, seed: 41, crest: 0.75, foot: 0.02, fade: 0.16, ink: 0.95, env: [[0.91, 0.12, 1.0], [1.02, 0.1, 0.6], [0.6, 0.07, 0.15]], floor: 0.02 },
  { base: -0.02, amp: 0.34, freq: 2.0, seed: 59, crest: 0.75, foot: -0.07, fade: 0.14, ink: 1.0, env: [[0.02, 0.22, 0.95], [0.26, 0.12, 0.35], [1.02, 0.06, 0.45]], floor: 0.0 },
];

function envelope(x, env, floor) {
  let e = floor;
  for (const [c, w, g] of env) {
    const d = (x - c) / w;
    e += g * Math.exp(-d * d);
  }
  return Math.min(e, 1.35);
}

/**
 * Build ridge heights for every layer.
 * @param {number} width  samples across the viewport
 * @param {number} aspect viewport width / height
 * @returns {Float32Array} width * LAYERS.length heights (row-major, far layer first)
 */
export function buildRidges(width, aspect) {
  const L = LAYERS.length;
  const out = new Float32Array(width * L);
  // Portrait screens: keep the mountains lower so the stacked name keeps its sky.
  const hs = aspect < 0.85 ? 0.86 : aspect < 1.2 ? 0.92 : 1;
  for (let l = 0; l < L; l++) {
    const { base, amp, freq, seed, crest: cw, env, floor } = LAYERS[l];
    for (let c = 0; c < width; c++) {
      const xn = (c + 0.5) / width;
      const xw = xn * aspect; // world units = viewport heights, so peaks keep their proportions
      const warp = 0.32 * fbm1(xw * 0.8 + seed, seed + 3, 3);
      const q = (xw + warp) * freq + seed * 1.7;
      const crest = ridged1(q, seed);
      const mass = 0.5 + 0.5 * fbm1(q * 0.42 + 4.1, seed + 9, 3);
      const shape = Math.pow(cw * crest + (1 - cw) * mass, 1.25); // steeper peaks
      out[l * width + c] = (base + amp * shape * envelope(xn, env, floor)) * hs;
    }
  }
  return out;
}

/**
 * Interleave heights with a smoothed slope (RG pairs) so the shader can shade the shadow
 * faces of each peak without the column-by-column streaks a raw derivative would give.
 */
export function withSlopes(heights, width, aspect) {
  const L = heights.length / width;
  const out = new Float32Array(heights.length * 2);
  const k = Math.max(1, Math.round(width * 0.004));
  const dx = (2 * k / width) * aspect;
  const raw = new Float32Array(width);
  const tmp = new Float32Array(width);
  const r = Math.max(2, Math.round(width * 0.012)); // blur radius
  for (let l = 0; l < L; l++) {
    const row = l * width;
    for (let c = 0; c < width; c++) {
      const a = heights[row + Math.max(0, c - k)];
      const b = heights[row + Math.min(width - 1, c + k)];
      raw[c] = (b - a) / dx;
    }
    // two box-blur passes ~ gaussian
    for (let pass = 0; pass < 2; pass++) {
      const src = pass ? tmp : raw;
      const dst = pass ? raw : tmp;
      for (let c = 0; c < width; c++) {
        let sum = 0;
        let n = 0;
        for (let j = -r; j <= r; j++) {
          const cc = c + j;
          if (cc >= 0 && cc < width) { sum += src[cc]; n++; }
        }
        dst[c] = sum / n;
      }
    }
    for (let c = 0; c < width; c++) {
      out[(row + c) * 2] = heights[row + c];
      out[(row + c) * 2 + 1] = raw[c];
    }
  }
  return out;
}

export const layerFeet = (aspect) => {
  const hs = aspect < 0.85 ? 0.86 : aspect < 1.2 ? 0.92 : 1;
  return LAYERS.map((l) => [l.foot * hs, l.fade, l.ink]);
};
