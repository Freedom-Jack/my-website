/**
 * ridges.js
 * One-dimensional ridge heightfields for the ink landscape.
 * Shared by the WebGL renderer and the Canvas 2D fallback, so both paint the same mountains.
 *
 * Heights are in viewport-height units measured from the bottom edge (0 = bottom, 1 = top).
 * Detail noise runs in "world" units (x = u * aspect), so a phone sees a narrower slice of the
 * same range instead of squashed mountains. The composition envelope runs in screen units (u),
 * so the massing stays art-directed at every size: a "one-corner" composition with the weight
 * low on the left (under the text) and a tall, pale peak on the right.
 */

export const SAMPLES = 1024;

/**
 * Layers run far (0) to near (5). Farther planes are paler, bluer and softer.
 * env:   [u, height] control points of the silhouette envelope.
 * paint: [u, 0..1] where the painter lays ink at all; gaps: how much of that stretch stays empty paper.
 * amp:   detail amplitude, freq: detail frequency in world units, sharp: ridged vs rounded mix.
 * tone:  ink density, fall: how far below the crest the wash stays dark, keep: residual body ink.
 * rim:   pigment pooling at the crest, tex: dry-brush texture strength along the slope,
 * fog:   mist pooled in the valley behind this ridge, soft: edge softness (far planes are 'boneless'),
 * dry:   seconds for this plane's water to dry; drying planes keep their bloom shapes (0 = fill),
 * speed: scroll parallax.
 */
export const LAYERS = [
  { env: [[0, .34], [.18, .4], [.36, .54], [.5, .43], [.62, .55], [.76, .82], [.9, .66], [1, .6]], paint: [[0, 0], [.3, .2], [.5, .85], [.62, 1]], gaps: .2, amp: .06, freq: 3.4, sharp: .75, tone: .27, fall: .085, keep: 0, rim: 0, tex: .25, fog: 0, soft: .3, speed: .04, ink: '#537188' },
  { env: [[0, .3], [.22, .36], [.4, .33], [.58, .5], [.7, .6], [.84, .5], [1, .58]], paint: [[0, .5], [.3, .7], [.5, 1]], gaps: .38, amp: .07, freq: 2.7, sharp: .7, tone: .36, fall: .07, keep: 0, rim: .04, tex: .35, fog: .45, soft: .18, speed: .07, ink: '#466378' },
  { env: [[0, .2], [.2, .24], [.42, .34], [.56, .3], [.74, .36], [.9, .44], [1, .4]], paint: [[0, 1]], gaps: .45, amp: .055, freq: 2.1, sharp: .6, tone: .5, fall: .055, keep: 0, rim: .16, tex: .45, fog: .55, soft: .1, speed: .11, ink: '#3b505d' },
  { env: [[0, .2], [.14, .17], [.34, .13], [.6, .2], [.82, .29], [1, .24]], paint: [[0, 1]], gaps: .5, amp: .045, freq: 1.7, sharp: .55, tone: .64, fall: .05, keep: 0, rim: .26, tex: .5, fog: .6, soft: .05, speed: .16, ink: '#2a3a44' },
  { env: [[0, .17], [.1, .12], [.3, .04], [.6, .02], [.8, .1], [1, .16]], paint: [[0, 1], [.24, .9], [.4, .2], [.62, .3], [.8, 1]], gaps: .4, amp: .04, freq: 1.35, sharp: .5, dry: .3, tone: .86, fall: .045, keep: 0, rim: .36, tex: .5, fog: .6, soft: .02, speed: .22, ink: '#1b262d' },
  { env: [[0, .1], [.1, .05], [.25, -.04], [.75, -.06], [.9, .03], [1, .09]], paint: [[0, 1], [.2, .8], [.32, 0], [.7, 0], [.86, 1]], gaps: .3, amp: .035, freq: 1.05, sharp: .45, dry: .26, tone: .95, fall: .04, keep: 0, rim: .45, tex: .5, fog: .5, soft: 0, speed: .3, ink: '#10171b' },
];

/* ---------- 1D gradient noise (deterministic) ---------- */
function hash(i, seed) {
  const s = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function gnoise(x, seed) {
  const i = Math.floor(x), f = x - i;
  const g0 = hash(i, seed) * 2 - 1, g1 = hash(i + 1, seed) * 2 - 1;
  const u = f * f * f * (f * (f * 6 - 15) + 10);
  return (g0 * f * (1 - u) + g1 * (f - 1) * u) * 2; // roughly [-1, 1]
}
function fbm(x, seed, oct = 4) {
  let s = 0, a = .5, f = 1, n = 0;
  for (let o = 0; o < oct; o++) { s += a * gnoise(x * f, seed + o * 13); n += a; a *= .5; f *= 2.03; }
  return s / n;
}
/** Ridged multifractal (Musgrave): sharp crests, rounded valleys. Returns ~[0, 1]. */
function ridged(x, seed) {
  let s = 0, a = .5, f = 1, w = 1, n = 0;
  for (let o = 0; o < 5; o++) {
    let r = 1 - Math.abs(gnoise(x * f, seed + o * 7));
    r *= r; r *= w;
    w = Math.min(1, Math.max(0, r * 2));
    s += r * a; n += a; a *= .5; f *= 2.03;
  }
  return s / n;
}
/** Smooth (cosine-eased) interpolation through envelope points. */
function envelope(pts, u) {
  if (u <= pts[0][0]) return pts[0][1];
  for (let k = 1; k < pts.length; k++) {
    const [u1, h1] = pts[k];
    if (u <= u1) {
      const [u0, h0] = pts[k - 1];
      const t = (u - u0) / (u1 - u0);
      return h0 + (h1 - h0) * (.5 - .5 * Math.cos(Math.PI * t));
    }
  }
  return pts[pts.length - 1][1];
}

/**
 * Build all layer heightfields.
 * @param {number} aspect viewport width / height
 * @param {number} seed   landscape seed (a different seed per page = a different stretch of the scroll)
 * @returns {Float32Array} per layer, SAMPLES pairs of [height, paint]: row-major, 2 channels
 */
export function buildHeights(aspect, seed = 7) {
  const out = new Float32Array(LAYERS.length * SAMPLES * 2);
  // Portrait screens: keep the range lower so the stacked name and copy sit on open paper.
  const vScale = aspect < .9 ? .62 + .3 * Math.max(0, aspect - .4) : 1;
  LAYERS.forEach((L, li) => {
    const s = seed * 17 + li * 101;
    for (let k = 0; k < SAMPLES; k++) {
      const u = k / (SAMPLES - 1);
      const x0 = u * aspect * L.freq;
      // Domain warp so ridges feel brushed rather than fractal.
      const x = x0 + .35 * fbm(x0 * .6 + 3.1, s + 5, 3);
      const r = ridged(x, s);
      const sm = fbm(x * .7, s + 9, 3) * .5 + .5;
      const detail = L.sharp * r + (1 - L.sharp) * sm;
      const i = (li * SAMPLES + k) * 2;
      out[i] = (envelope(L.env, u) + L.amp * (detail - .45)) * vScale;
      // Empty space: the brush skips stretches of each ridge, so mist shows through.
      const n = gnoise(u * Math.max(1.2, aspect) * 1.1 + li * 3.7, s + 31) * .5 + .5;   // one smooth octave
      const g = Math.min(1, Math.max(0, (n - L.gaps + .25) / .5));
      out[i + 1] = envelope(L.paint, u) * g * g * (3 - 2 * g);
    }
  });
  return out;
}

/** "#rrggbb" → [r, g, b] in 0..1 */
export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
