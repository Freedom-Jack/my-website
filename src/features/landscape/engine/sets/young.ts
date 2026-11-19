// sets/young.ts — not a set: the painted elements the sets share, drawn with the kit so they take the layer's bleed,
// the plane's mist, the grain and the drifting mist like every other figure.
//
// The willow tip (Work's and Writing's) hangs from a tapering bough that comes in from off-frame, one tapered stroke
// (inkLimb: brown-black ink with a darker bone on its shadow side, broken by flying white, with a few moss dots), its
// strands in irregular groups of different lengths, not a curtain on a rod. Then rushes at a landing, loose petals
// lying on still water, reflections torn by the ripples, ripple rings, and far birds.
// World px (figures.ts): x right, y down.

import { mix3, stroke, wash, resample, type Env, type Pt, type Rng, type RGB } from '../figures';

const AIRC: RGB = [206, 224, 234];   // the far air the misted elements fade toward

/** Soften what `paint` draws by about r world px (seven taps, below), or draw it as it is where r is small. */
function soft(env: Env, r: number, paint: () => void) {
  if (r > 0.3) {
    // (no filter in the worker: the same paint laid seven times round a small circle at a third of its
    // strength, so its edges go soft as an out-of-focus thing's do; the core keeps most of its value)
    const ctx = env.ctx;
    ctx.save();
    ctx.globalAlpha *= 0.3;   // (times the caller's alpha)
    const taps: Pt[] = [[0, 0]];
    for (let i = 0; i < 6; i++) taps.push([Math.cos(i * 1.047 + 0.3) * r * 0.75, Math.sin(i * 1.047 + 0.3) * r * 0.75]);
    for (const [dx, dy] of taps) { ctx.save(); ctx.translate(dx, dy); paint(); ctx.restore(); }
    ctx.restore();
  } else paint();
}

const pointAt = (pts: Pt[], t: number): Pt => pts[Math.min(pts.length - 1, Math.max(0, Math.round(t * (pts.length - 1))))];

// ---------------------------------------------------------------- petals
/** loosePetal's outline: obovate (wider toward its rim) with a faint notch at the rim; u runs from the heart (0) to the
 *  rim (len), v across. */
function petal(len: number, wid: number, notch: number, R: Rng): Pt[] {
  const out: Pt[] = [];
  const n = 22;
  for (let i = 0; i < n; i++) {
    const ph = (i / n) * Math.PI * 2;
    const c = (1 - Math.cos(ph)) / 2;                         // 0 at the heart, 1 at the rim
    let u = len * c;
    const v = wid * 0.5 * Math.sin(ph) * (0.42 + 0.58 * Math.pow(c, 0.6));
    u -= notch * len * Math.exp(-Math.pow((ph - Math.PI) / 0.32, 2));
    const j = 1 + (R() - 0.5) * 0.07;
    out.push([u * j, v * j]);
  }
  return out;
}
/** A loose petal lying on the water (pavilion.ts, on Writing's lake): the petal's outline turned (squashed along a
 *  random axis), pale pink, with its pooled edge. (x, y) its middle, r its length; mist 0..1 hazes it toward the air. */
export function loosePetal(env: Env, x: number, y: number, r: number, R: Rng, mist = 0) {
  const { ctx, ink } = env;
  const { rgba } = ink;
  const base = mix3(mix3([250, 222, 234], [240, 176, 204], R() * 0.6), AIRC, mist * 0.7);
  const a = R() * Math.PI * 2, sq = 0.3 + R() * 0.55, tilt = R() * Math.PI;
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const pts = petal(r, r * 0.95, 0.08, R).map(([u, v]): Pt => {
    const px = u * Math.cos(a) - v * Math.sin(a) - Math.cos(a) * r * 0.5, py = u * Math.sin(a) + v * Math.cos(a) - Math.sin(a) * r * 0.5;
    const tu = px * ct + py * st, tv = (-px * st + py * ct) * sq;
    return [x + tu * ct - tv * st, y + tu * st + tv * ct];
  });
  const paint = () => {
    const g = ctx.createLinearGradient(pts[0][0], pts[0][1], pts[11][0], pts[11][1]);
    g.addColorStop(0, rgba(mix3(base, [214, 130, 168], 0.4), 0.9 * (1 - 0.5 * mist)));
    g.addColorStop(1, rgba(mix3(base, [255, 255, 255], 0.4), 0.86 * (1 - 0.5 * mist)));
    wash(ctx, pts, g, { jit: 0 });
    ctx.strokeStyle = rgba([206, 120, 158], 0.35 * (1 - mist));
    ctx.lineWidth = Math.max(0.3, r * 0.06);
    ctx.beginPath(); ctx.moveTo(pts[6][0], pts[6][1]);
    for (let i = 7; i < 16; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  };
  if (mist > 0.3) soft(env, 0.6 + mist * 1.2, paint); else paint();
}

/** Catmull-Rom through pts, n samples per span. */
function spline(pts: Pt[], n = 6): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

interface InkC { body: RGB; bone: RGB; dot: RGB }
const INK_NB: RGB = [12, 21, 28], UMBER: RGB = [120, 80, 50];
/** brown-black ink: INK_N moved ~15 % toward umber (and its wet, paler body a breath lighter) */
const BROWN_INK: InkC = { body: mix3(mix3(INK_NB, UMBER, 0.2), [236, 238, 234], 0.1), bone: mix3(INK_NB, UMBER, 0.12), dot: mix3(INK_NB, UMBER, 0.1) };
/** the willow's bough: the brown ink, a little paler (it hangs in the air, further off) */
const WILLOW_INK: InkC = { body: mix3(BROWN_INK.body, [150, 150, 140], 0.28), bone: mix3(BROWN_INK.bone, [110, 108, 100], 0.25), dot: BROWN_INK.dot };
/**
 * A limb painted as one smoothed brush stroke, never a faceted tube with polygon kinks. The path is a Catmull-Rom
 * spline through the jittered joints; the width tapers from w0 to w1 over the whole run, with only a slight swelling
 * at the knots and the hand's unevenness; brown-black ink (INK_N toward umber) with a darker bone along the shadow
 * side; flying white in two or three irregular skips that follow the stroke; a few moss dots on top.
 */
function inkLimb(env: Env, ctl: Pt[], w0: number, w1: number, R: Rng, c: InkC, o: { dots?: number; white?: boolean; press?: number } = {}) {
  const { ctx, ink } = env;
  const { rgba } = ink;
  const K = ctl.map(([x, y], i): Pt => (i === 0 || i === ctl.length - 1 ? [x, y] : [x + (R() - 0.5) * w0 * 0.22, y + (R() - 0.5) * w0 * 0.22]));
  const P = resample(spline(K, 12), Math.max(0.7, Math.min(2, w1 * 0.7)));
  const n = P.length;
  if (n < 3) return;
  const cum: number[] = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const tot = cum[n - 1] || 1;
  // the knots' places along the run (the nearest sample to each inner joint)
  const joints = K.slice(1, -1).map(([kx, ky]) => {
    let bi = 0, bd = 1e9;
    for (let i = 0; i < n; i++) { const d = Math.hypot(P[i][0] - kx, P[i][1] - ky); if (d < bd) { bd = d; bi = i; } }
    return cum[bi] / tot;
  }).sort((p, q) => p - q);
  const ph = R() * 10;
  const half = (t: number) => {
    // (the brush pressed at the start and lifting toward the tip: thick-thin, never an even tube)
    let w = w1 + (w0 - w1) * Math.pow(1 - t, o.press ?? 1.5) * (1 + 0.12 * Math.exp(-Math.pow(t / 0.06, 2)));
    for (const j of joints) w *= 1 + 0.16 * Math.exp(-Math.pow((t - j) / 0.022, 2)) - 0.07 * Math.exp(-Math.pow((t - j - 0.05) / 0.03, 2));   // pressed at the knot, thinner just past it
    w *= 1 + 0.09 * Math.sin(t * 23 + ph) * Math.sin(t * 7.3 + ph * 0.7);                 // the hand's unevenness
    const tip = t > 0.86 ? 1 - Math.pow((t - 0.86) / 0.14, 1.5) * 0.72 : 1;
    return Math.max(0.3, w * 0.5 * tip);
  };
  // one orientation for the whole run: the normal that points up on average (no flips, no kinks)
  const raw: Pt[] = [];
  let sy = 0;
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    raw.push([nx, ny]); sy += ny;
  }
  const sg = sy > 0 ? -1 : 1;
  const U: Pt[] = [], D: Pt[] = [], nrm: Pt[] = [], hw: number[] = [];
  for (let i = 0; i < n; i++) {
    const nx = raw[i][0] * sg, ny = raw[i][1] * sg;
    const h = half(cum[i] / tot);
    const rag = (k: number) => 1 + (vn(cum[i] * 0.09 + k) - 0.5) * 0.12 + (vn(cum[i] * 0.37 + k * 3) - 0.5) * 0.08;   // (a ragged, bitten edge)
    U.push([P[i][0] + nx * h * rag(0), P[i][1] + ny * h * rag(0)]);
    D.push([P[i][0] - nx * h * rag(5), P[i][1] - ny * h * rag(5)]);
    nrm.push([nx, ny]); hw.push(h);
  }
  const poly = (A: Pt[], B: Pt[], s0: number, s1: number) => {
    ctx.beginPath(); ctx.moveTo(A[s0][0], A[s0][1]);
    for (let i = s0 + 1; i <= s1; i++) ctx.lineTo(A[i][0], A[i][1]);
    for (let i = s1; i >= s0; i--) ctx.lineTo(B[i][0], B[i][1]);
    ctx.closePath(); ctx.fill();
  };
  // the body: the wet stroke, one fill (deeper at the root, a little paler and drier toward the tip)
  const bg = ctx.createLinearGradient(P[0][0], P[0][1], P[n - 1][0], P[n - 1][1]);
  // (the wet body a mid ink, so the dry bristle strokes over it read: a dark loaded brush over a paler wet one)
  bg.addColorStop(0, rgba(mix3(c.body, [120, 116, 112], 0.3), 0.95));
  bg.addColorStop(0.55, rgba(mix3(c.body, [130, 128, 124], 0.36), 0.92));
  bg.addColorStop(1, rgba(mix3(c.body, [150, 156, 160], 0.3), 0.88));
  ctx.fillStyle = bg;
  poly(U, D, 0, n - 1);
  // bristle tracks: long dry strokes of deeper ink along the limb at different offsets across it, broken where the
  // brush ran dry, so the limb reads as one dry-brush stroke with texture (feibai), not a smooth tube
  if (w0 > 5) {
    const nt = 3 + (R() < 0.5 ? 1 : 0);
    for (let k = 0; k < nt; k++) {
      const off = -0.65 + (1.2 * (k + R() * 0.6)) / nt;
      const s0 = Math.floor(R() * 0.12 * n), s1 = Math.min(n - 1, Math.floor((0.55 + R() * 0.4) * n));
      const pts: Pt[] = [];
      for (let i = s0; i <= s1; i++) pts.push([P[i][0] + nrm[i][0] * hw[i] * off, P[i][1] + nrm[i][1] * hw[i] * off]);
      if (pts.length > 3) stroke(ctx, pts, { w: Math.max(0.5, hw[s0] * (0.16 + R() * 0.14)), col: rgba(c.bone, 0.7 + R() * 0.25), tin: 0.1, tout: 0.6, min: 0.1, wob: 0.4, dry: 0.4, seed: R() * 99 });
    }
  }
  // the bone: a darker band along the shadow (lower) side, in two or three long runs that come and go
  const inner = P.map(([x, y], i): Pt => [x - nrm[i][0] * hw[i] * 0.05, y - nrm[i][1] * hw[i] * 0.05]);
  for (const [s0, s1] of runIdx(n, R, 0.3, 0.62, 0.06)) {
    ctx.fillStyle = rgba(c.bone, 0.78);
    const mid: Pt[] = [];
    for (let i = s0; i <= s1; i++) { const k = Math.sin(Math.PI * (i - s0) / Math.max(1, s1 - s0)); mid.push([D[i][0] + (inner[i][0] - D[i][0]) * k, D[i][1] + (inner[i][1] - D[i][1]) * k]); }
    ctx.beginPath(); ctx.moveTo(mid[0][0], mid[0][1]);
    for (let i = 1; i < mid.length; i++) ctx.lineTo(mid[i][0], mid[i][1]);
    for (let i = s1; i >= s0; i--) ctx.lineTo(D[i][0], D[i][1]);
    ctx.closePath(); ctx.fill();
  }
  // flying white: two or three irregular skips along the stroke where the dry brush lifted (cut out of the layer)
  if ((o.white ?? true) && w0 > 6) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const nk = 3 + (R() < 0.5 ? 1 : 0);
    const cs = [0.06 + R() * 0.1, 0.22 + R() * 0.1, 0.4 + R() * 0.12, 0.6 + R() * 0.12].slice(0, nk);
    for (const c0 of cs) {
      const len = Math.round((0.1 + R() * 0.14) * n), s0 = Math.floor(c0 * n), s1 = Math.min(n - 2, s0 + len);
      if (s1 - s0 < 3 || hw[s0] < 2.5) continue;
      const cuts = 2 + (R() < 0.5 ? 1 : 0);
      R();   // (a draw nothing reads: it holds the stream's place for every later draw, the willows' strands included)
      for (let b = 0; b < cuts; b++) {
        const off = -0.45 + R() * 1.0, a0 = s0 + Math.floor(R() * (s1 - s0) * 0.3);
        const pts: Pt[] = [];
        for (let i = a0; i <= s1; i++) pts.push([P[i][0] + nrm[i][0] * hw[i] * off, P[i][1] + nrm[i][1] * hw[i] * off]);
        if (pts.length < 3) continue;
        stroke(ctx, pts, { w: Math.max(0.5, hw[s0] * (0.08 + R() * 0.14)), col: `rgba(0,0,0,${(0.62 + R() * 0.3).toFixed(2)})`, tin: 0.4, tout: 0.5, min: 0.05, dry: 0.45, seed: R() * 90 });
      }
    }
    ctx.restore();
  }
  // moss dots: at most five small ones on the top of the limb, 2-4 px, never in a row
  const nd = Math.min(5, Math.round(o.dots ?? 0));
  for (let d = 0; d < nd; d++) {
    const i = Math.floor((0.08 + 0.6 * R()) * (n - 1));
    if (hw[i] < 3) continue;
    const ds = (1 + R() * 1) * Math.max(1, env.scale / 1440);
    const px = U[i][0] + nrm[i][0] * ds * 0.4, py = U[i][1] + nrm[i][1] * ds * 0.4;
    ctx.fillStyle = rgba(c.dot, 0.75 + R() * 0.2);
    ctx.beginPath(); ctx.ellipse(px, py, ds, ds * (0.6 + R() * 0.3), R() * 3, 0, Math.PI * 2); ctx.fill();
  }
}
/** Index runs [s0, s1] along 0..n-1, each minF..maxF of n long, with gaps of about gapF of n between. */
function runIdx(n: number, R: Rng, minF: number, maxF: number, gapF: number): [number, number][] {
  const out: [number, number][] = [];
  let i = Math.floor(R() * gapF * n);
  while (i < n - 2) {
    const len = Math.max(2, Math.round((minF + R() * (maxF - minF)) * n));
    out.push([i, Math.min(n - 1, i + len)]);
    i += len + Math.max(1, Math.round(gapF * n * (0.4 + R() * 1.2)));
  }
  return out;
}
const vn = (x: number) => { const i = Math.floor(x), f = x - i, h = (k: number) => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }; return h(i) + (h(i + 1) - h(i)) * f * f * (3 - 2 * f); };

/**
 * The willow tip, Work's over the town and Writing's over the lake (never neon lime, a uniform pipe or combs of
 * identical drops). A brown-ink bough that comes in from off-frame and tapers to a twig; the strands hang from it in
 * groups with gaps, their lengths 3 : 1, all bent by one wind; each strand's leaves follow it, turned along it with a
 * little jitter, smaller toward the tip; spring yellow-green near (#9DC77A), misted far (#BFD9B0), the far strands
 * hazed. No tip hangs below `floorY` (the town's roofline, the lake's water). ctl = the bough's joints (world px);
 * side = a second, shorter bough or null; s = scale; wind = sideways push at a strand's tip per px of its length;
 * lmax = the main bough's longest strand and bw = its width at the root (both times s).
 */
export function willowTip(env: Env, ctl: Pt[], side: Pt[] | null, s: number, floorY: number, R: Rng, wind = -0.32, lmax = 108, bw = 9) {
  const { ctx, ink } = env;
  const { rgba } = ink;
  const near: RGB = [157, 199, 122], nearD: RGB = [112, 160, 92], far: RGB = [191, 217, 176];
  interface Strand { pts: Pt[]; back: boolean; len: number }
  const strands: Strand[] = [];
  const hang = (P: Pt[], t0: number, t1: number, n: number, Lmax: number) => {
    let t = t0 + R() * 0.04;
    let left = n;
    while (t <= t1 && left > 0) {
      const grp = 2 + Math.floor(R() * 3);
      for (let g = 0; g < grp && left > 0; g++, left--) {
        const [bx, by] = pointAt(P, Math.min(t1, t + g * 0.018));
        const room = floorY - by - 4 * s;
        if (room < 10 * s) continue;
        const len = Math.min(room, Lmax * s * (0.34 + 0.66 * R()));   // 3 : 1 between the longest and the shortest
        const pts: Pt[] = [];
        const ph = R() * 6, sway = (0.6 + 0.8 * R());
        for (let k = 0; k <= 22; k++) {
          const u = k / 22;
          pts.push([bx + wind * len * Math.pow(u, 1.7) * sway + Math.sin(u * 3.0 + ph) * 1.6 * s * u, by + len * u * (1 - 0.06 * u)]);
        }
        strands.push({ pts, back: R() < 0.32, len });
      }
      t += 0.05 + R() * 0.05;
      if (R() < 0.3) t += 0.08 + R() * 0.06;   // a gap in the curtain
    }
  };
  const bP = resample(spline(ctl, 10), 2);
  hang(bP, 0.14, 1, 36, lmax);
  if (side) hang(resample(spline(side, 8), 2), 0.2, 1, 9, 80);
  const leafRow = (st: Strand) => {
    const mk = st.back ? 0.65 : 0;
    const stemC = mix3(mix3(near, [70, 96, 70], 0.5), AIRC, mk);
    stroke(ctx, st.pts, { w: 0.7 * s, col: rgba(stemC, st.back ? 0.4 : 0.7), tin: 0.02, tout: 0.6, min: 0.3, seed: R() * 60 });
    const n = st.pts.length - 1;
    for (let k = 1; k <= n; k++) {
      if (R() < 0.18) continue;
      const u = k / n, [px, py] = st.pts[k];
      const prv = st.pts[k - 1];
      const sa = Math.atan2(py - prv[1], px - prv[0]);   // along the strand (down, bent by the wind)
      const sd = k % 2 === 0 ? 1 : -1;
      const L = (11 + R() * 7) * s * (1 - 0.4 * u), W = L * (0.15 + R() * 0.06);
      const a = sa + sd * (0.32 + R() * 0.22) + (R() - 0.5) * 0.25;
      const tone = R();
      const c0 = st.back ? mix3(far, AIRC, 0.35) : mix3(nearD, near, 0.35 + 0.65 * u * tone + 0.2 * tone);
      const c1 = st.back ? mix3(far, [236, 244, 236], 0.25) : mix3(near, [214, 236, 190], 0.25 + 0.25 * tone);
      const al = st.back ? 0.55 : 0.9 - 0.2 * u;
      const tip: Pt = [px + Math.cos(a) * L, py + Math.sin(a) * L];
      const nx = -Math.sin(a) * W, ny = Math.cos(a) * W;
      const m: Pt = [px + Math.cos(a) * L * 0.45, py + Math.sin(a) * L * 0.45];
      const g = ctx.createLinearGradient(px, py, tip[0], tip[1]);
      g.addColorStop(0, rgba(c0, al));
      g.addColorStop(1, rgba(c1, al * 0.92));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(m[0] + nx, m[1] + ny, tip[0], tip[1]);
      ctx.quadraticCurveTo(m[0] - nx * 0.7, m[1] - ny * 0.7, px, py);
      ctx.fill();
    }
  };
  soft(env, 1.1 * s, () => strands.filter((t) => t.back).forEach(leafRow));
  inkLimb(env, ctl, bw * s, 1.4 * s * Math.max(1, bw / 9), R, WILLOW_INK, { dots: 2, white: true, press: bw > 9 ? 1.1 : 1.5 });
  if (side) inkLimb(env, side, 3.4 * s, 0.9 * s, R, WILLOW_INK, { white: false });
  strands.filter((t) => !t.back).forEach(leafRow);
}

/**
 * Rushes at a landing (Contact; Writing's water's edge): thin, tapered, ink-grey-green strokes, bowing,
 * a few broken and bent, a few pale seed heads; the far ones misted. (x0, y0) = the clump's foot (world px).
 */
export function rushes(env: Env, x0: number, y0: number, s: number, R: Rng, n = 14, spread = 46) {
  const { ctx, ink } = env;
  const inkG: RGB = [74, 94, 84], pale: RGB = [150, 168, 156];
  for (let i = 0; i < n; i++) {
    const bx = x0 + (R() - 0.5) * spread * s, H = (34 + R() * 52) * s, lean = (R() - 0.6) * 22 * s;
    const mk = R() < 0.3 ? 0.5 : 0;
    const pts: Pt[] = [];
    for (let k = 0; k <= 12; k++) { const u = k / 12; pts.push([bx + lean * u * u, y0 - H * u + (R() - 0.5) * 0.3 * s]); }
    const c = mix3(mix3(inkG, pale, R() * 0.35), AIRC, mk);
    stroke(ctx, pts, { w: (1.0 + R() * 0.7) * s, col: ink.rgba(c, 0.85 - 0.35 * mk), tin: 0.02, tout: 0.92, min: 0.06, seed: R() * 50 });
    if (R() < 0.3) {   // a blade bent over
      const [mx, my] = pts[6 + Math.floor(R() * 3)];
      const d = lean >= 0 ? 1 : -1;
      stroke(ctx, [[mx, my], [mx + d * 10 * s, my - 6 * s], [mx + d * 22 * s, my + 2 * s]], { w: 1.1 * s, col: ink.rgba(c, 0.75 - 0.3 * mk), tin: 0.05, tout: 0.9, min: 0.06, seed: R() * 50 });
    }
    if (R() < 0.22) {   // a seed head
      const [hx, hy] = pts[12];
      stroke(ctx, [[hx, hy + 1 * s], [hx + lean * 0.05, hy - 7 * s]], { w: 2.2 * s, col: ink.rgba(mix3([128, 116, 96], AIRC, mk), 0.7), tin: 0.3, tout: 0.6, min: 0.3, seed: R() * 40 });
    }
  }
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

// ---------------------------------------------------------------- the water: reflections and ripple rings

/**
 * A reflection on the river, broken by the ripples. `draw` paints the thing again, mirrored about the
 * water's level line through `at`, at `alpha`, softened by `blur` world px (the seven-tap soft() in the worker), clipped
 * to the river's surface (`river`, a closed outline) in level rows with breaks: the ripples tear it, wider further out,
 * and it fades with depth below the line (`fade` world px), so it reads as glassy water, never a pasted copy.
 */
export function reflectIn(env: Env, river: Pt[], at: Pt, draw: () => void, R: Rng, o: { alpha?: number; blur?: number; box?: [number, number, number, number]; fade?: number; m?: number } = {}): void {
  const { ctx } = env;
  const al = o.alpha ?? 0.3, bl = o.blur ?? 2, fade = o.fade ?? 60, m = o.m ?? 0;
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const [px, py] of river) { bx0 = Math.min(bx0, px); bx1 = Math.max(bx1, px); by0 = Math.min(by0, py); by1 = Math.max(by1, py); }
  if (o.box) { bx0 = Math.max(bx0, o.box[0]); by0 = Math.max(by0, o.box[1]); bx1 = Math.min(bx1, o.box[2]); by1 = Math.min(by1, o.box[3]); }
  if (bx1 <= bx0 || by1 <= by0) return;
  // the ripple rows, binned by their depth below the water's line (y = at.y + m (x - at.x)): the mirror fades with depth
  const bins = 4;
  const runs: [number, number, number, number][][] = Array.from({ length: bins }, () => []);
  for (let y = by0; y < by1;) {
    const h = 1.3 + R() * 1.3;
    let far = 0;
    for (let x = bx0 - R() * 40; x < bx1;) {
      const dep = y - (at[1] + m * (x - at[0]));
      far = Math.min(1, Math.max(0, dep / Math.max(1, fade)));
      const run = 10 + R() * mix(120, 36, far), gap = 1.2 + R() * mix(4, 14, far);
      if (dep > 0 && dep < fade) runs[Math.min(bins - 1, Math.floor(far * bins))].push([x, y, run, h]);
      x += run + gap;
    }
    y += h + 0.4 + R() * mix(0.5, 1.8, far);
  }
  for (let k = 0; k < bins; k++) {
    if (!runs[k].length) continue;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(river[0][0], river[0][1]);
    for (let i = 1; i < river.length; i++) ctx.lineTo(river[i][0], river[i][1]);
    ctx.closePath();
    ctx.clip();
    ctx.beginPath();
    for (const [x, y, w, h] of runs[k]) ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.transform(1, 2 * m, 0, -1, 0, 2 * (at[1] - m * at[0]));
    ctx.globalAlpha = al * Math.pow(1 - k / bins, 1.3);
    soft(env, bl * (1 + k * 0.35), draw);
    ctx.restore();
  }
}

/**
 * A few broken ripple rings on the water at (x, y), painted, never UI circles: 2-3 rings
 * squashed by the view, spacing growing outward, each 2-3 arcs of unequal sweep in thick-thin ink that fade toward
 * their ends (never closed), the inner ring the darkest; on the side toward the light a white lit arc just outside it,
 * and a breath of pale light laid in the water inside the inner ring.
 */
export function ripples(env: Env, x: number, y: number, r0: number, R: Rng, o: { n?: number; sq?: number; alpha?: number; lightDir?: number } = {}): void {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const n = o.n ?? 3, sq = o.sq ?? 0.26, al = o.alpha ?? 1, ld = o.lightDir ?? Math.PI * 1.25;
  const TAU = Math.PI * 2;
  const arc = (rr: number, a0: number, a1: number, k = 28): Pt[] => Array.from({ length: k + 1 }, (_, j): Pt => {
    const a = a0 + (a1 - a0) * (j / k);
    const wob = 1 + 0.05 * Math.sin(a * 3 + rr);
    return [x + Math.cos(a) * rr * wob, y + Math.sin(a) * rr * sq * wob];
  });
  // the pale light in the water inside the inner ring
  const g = ctx.createRadialGradient(x, y, 0, x, y, r0 * 1.1);
  g.addColorStop(0, rgba(C.white, 0.35 * al));
  g.addColorStop(1, rgba(C.white, 0));
  ctx.save(); ctx.translate(x, y); ctx.scale(1, sq); ctx.translate(-x, -y);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r0 * 1.1, 0, TAU); ctx.fill();
  ctx.restore();
  let r = r0;
  const inkC = mix3(C.ink, C.indigo, 0.55);
  for (let i = 0; i < n; i++) {
    const nArc = 2 + (R() < 0.5 ? 1 : 0);
    const total = (0.55 + 0.2 * R()) * TAU;
    let a = R() * TAU;
    for (let k = 0; k < nArc; k++) {
      const span = (total / nArc) * (0.5 + 0.9 * R());
      // (thicker on the near side of the ring, the side toward the viewer)
      const mid = a + span / 2, near = 0.6 + 0.4 * Math.max(0, Math.sin(mid));
      stroke(ctx, arc(r, a, a + span), { w: Math.max(0.6, (2.2 - i * 0.6) * near * (0.8 + 0.4 * R())), col: rgba(inkC, (0.42 - i * 0.11) * al), tin: 0.45, tout: 0.5, min: 0.05, wob: 0.35, dry: 0.15, seed: x + i * 7 + k });
      a += span + 0.2 + 0.4 * R();
    }
    // the lit arc: a white hairline just outside the ring, on the side toward the light
    const h0 = ld - 0.35 - 0.15 * R(), h1 = ld + 0.3 + 0.15 * R();
    stroke(ctx, arc(r * 1.08 + 0.8, h0, h1, 16), { w: 1.0, col: rgba(C.white, (0.85 - i * 0.2) * al), tin: 0.35, tout: 0.45, min: 0.1, seed: y + i });
    r *= 1.45 + 0.35 * R();
  }
}

/**
 * A far bird gliding (drawn whole at this size, a bird reads as a nail clipping): an open V of two tapered strokes,
 * thick at the body and thin to the wing tips, meeting at a slightly dropped body dot. size = span (6-10 px), ang =
 * heading tilt, mist 0..1 (hazed toward the air).
 */
export function farBird(env: Env, x: number, y: number, size: number, ang: number, R: Rng, mist = 0.5) {
  const { ctx, ink } = env;
  const col = ink.rgba(mix3([30, 42, 54], AIRC, mist * 0.7), 0.9 - mist * 0.3);
  const h = size / 2, ca = Math.cos(ang), sa = Math.sin(ang);
  const P = (u: number, v: number): Pt => [x + u * ca - v * sa, y + u * sa + v * ca];
  const lift = 0.35 + R() * 0.25, bend = 0.12 + R() * 0.1;
  for (const sd of [-1, 1]) {
    const k = sd < 0 ? 1 : 0.85 + R() * 0.2;
    const pts = [P(0, 0), P(sd * h * 0.45 * k, -h * lift * 0.9 - h * bend), P(sd * h * k, -h * lift * 0.55)];
    stroke(ctx, spline(pts, 6), { w: Math.max(0.9, size * 0.16), col, tin: 0.0, tout: 0.95, min: 0.08, wob: 0.15, seed: R() * 90 });
  }
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(...P(0, h * 0.12), Math.max(0.6, size * 0.09), Math.max(0.5, size * 0.07), ang, 0, Math.PI * 2); ctx.fill();
}
