import { rushes, ripples, farBird } from './young';
import { el } from '../../elements';
import type { RGB } from '../figures';
// sets/ferry.ts — Contact (stretch 4): the crossing, "the ferry that brings you across to meet him".
// On the near side of the water a short timber jetty comes in from the right on its posts, out of a low reedy bank,
// and at its head the ferry waits, turned toward you: a small flat Song river boat with a squared, swept-up bow, a
// low woven-mat canopy (you look into it, and through it to the light at the far end; the seat is empty: it is
// yours), and the ferryman at the stern in a wide cone hat, his pole planted beside him. Across the water, high in
// the band, the far shore and the echo of his mountain (the scene, not this layer). Ink first: weathered grey
// timber, grey mats, a faded indigo jacket, the hull's wet brown in small areas only. No lantern, no warm light,
// no red.
// Life: the open water shimmers; the moored ferry may rock or drift a hand's breadth.
//
// A figure set (figures.ts, THE SET API): meta + draw(env), in world px. Painted after plane 2's mist band and the
// water (phase 1), so the crossing's water runs under the boat and the jetty.

import {
  REF_PX, VH_PX, SCENE_FIELDS, sceneField, streams, vnoise, mix, mix3, stroke, dryBrush, wash, softWash, runs, anchor, bounds, ownSprite,
  type Env, type FigureMeta, type Pt, type Rng, type Streams,
} from '../figures';

/** The set's stretch: every world x below is K + its offset (move the place by changing K). */
const K = 4;
export const meta: FigureMeta = { rect: [K + 0.5, K + 1.06, 0.1, 0.6], plane: 2, phase: 1 };

const SEED = 11;

export function* draw(env: Env) {
  const { P } = env;
  // one stream per element (figures.ts streams): adding a draw to one never re-rolls another
  const own = streams(SEED, {});
  // phones see the crossing from further away (scale 560): the things are drawn larger there, so the ferryman stays
  // well over 12 CSS px tall (as home.ts does)
  const big = Math.max(1, 0.7 * REF_PX / env.scale);
  // the ferry is the strip's one focus on open water: larger than the market's boats, so at the one hero scale (round 5)
  // it holds the focal area as the bridge and the pavilion do
  const sz = Math.max(2.0, 1.6 * big);
  const X = (u: number) => u * REF_PX, Y = (y: number) => (1 - y) * VH_PX, Ux = (x: number) => x / REF_PX;
  const f = new Float32Array(SCENE_FIELDS);
  const farY = (x: number) => { sceneField(Ux(x), P, f); return Y(f[1] > 0 ? f[1] : 0.343); };

  // The ferry's bow at the water anchors the group; the jetty runs from just past its stern to the bank. The page's
  // closing frames the far shore (its bottom edge at y ~0.27-0.29 in every width class) and shows this same layer,
  // magnified on phones and tablets: so the group keeps its top (the pole, the hat) under y ~0.30 there, and the
  // closing meets at most a reed tip in its bottom feather, never a cut-off ferryman. The larger phone group sits lower.
  const boat = ferryShape(X(K + 0.635), Y(0.228 - 0.04 * (big - 1)), sz);
  const jet = jettyShape(boat, sz, X(K + 0.7), () => own('posts'));

  // life: the open water of the crossing, below the far shore (the boat and the jetty stay still)
  const line: Pt[] = [];
  for (let x = X(K + 0.52); x <= X(K + 1.04); x += 40) line.push([x, farY(x)]);
  const top = Math.min(...line.map((p) => p[1]));
  // (contactLife: and now and then a ring set falls by itself exactly where the ferryman's pole stands in the water and
  // where the bow meets it: the same geometry ferry() draws them with, ferryDrops)
  const drops: Pt[] | undefined = el('contactLife') && !env.still ? ferryDrops(boat, sz, own) : undefined;
  anchor(env, 'shimmer', { x: X(K + 0.52), y: top, w: X(K + 1.04) - X(K + 0.52), h: Y(0.1) - top }, { waterline: line, rings: 2, ...(drops ? { drops } : {}) });

  reflections(env, boat, jet, own('reflections'), sz);           // the water first: reflections, wake, rings
  {
    // a long glassy cyan wake fanning out behind the ferry toward the open water (two lines, a lit core)
    const fb0 = boat.box, sx = fb0.x + fb0.w * 0.15, sy = fb0.y + fb0.h * 0.92;
    for (const [dy, a, w, c] of [[0, 0.75, 1.6, [168, 228, 240]], [5, 0.55, 1.2, [150, 214, 232]], [-3, 0.9, 0.8, [246, 254, 255]]] as const) {
      const pts: Pt[] = [];
      for (let k = 0; k <= 24; k++) { const u = k / 24; pts.push([sx - u * 260 * sz, sy + dy * sz * u + u * u * 22 * sz * (dy >= 0 ? 1 : 0.4) + Math.sin(u * 9) * 0.8 * sz]); }
      stroke(env.ctx, pts, { w: w * sz, col: env.ink.rgba([...c] as RGB, a), tin: 0.02, tout: 0.95, min: 0.05, dry: 0.2, seed: dy + 9 });
    }
  }
  yield;
  bank(env, jet, own('bank'), sz);                                // the near shore at the jetty's root
  reeds(env, jet.root[0] + 14 * sz, jet.wl - 1 * sz, sz, own('reeds', 'back'), 9, 0.7);
  yield;
  jetty(env, jet, own('jetty'), sz);
  rootMist(env, jet, own('mist'), sz);                              // the jetty's root goes into the shore's mist
  yield;
  // the moored ferry, drawn on its own (ownSprite): it rises and falls a little with the water (DESIGN §11.E answer 9),
  // under a CSS px, slowly, and nothing of the jetty moves with it (the box is a generous hint: the pole, the hat and the
  // rope to the head post all lie inside it). Still wherever the layer never moves its sprites.
  const fb = boat.box;
  ownSprite(env, 'boat', { x: fb.x - 30 * sz, y: fb.y - 40 * sz, w: fb.w + 60 * sz, h: fb.h + 60 * sz },
    { L: boat.L, bob: { amp: 0.45 * sz, period: 7 } }, (e) => ferry(e, boat, jet, own, sz));
  yield;
  reeds(env, jet.root[0] - 4 * sz, jet.wl + 6 * sz, sz * 1.1, own('reeds', 'root'), 12, 1);
  yield;
  // ---- a clump of rushes at the landing, in front of the jetty's root (young.ts; Work's willow is not repeated here)
  if (!env.still) {
    const rx = jet.root[0] + 22 * sz, ry = jet.wl + 8 * sz, rs = sz * 0.72;
    // contactLife (elements.ts): the rushes are their own sprite, so they bend in the breeze (the present pass)
    if (el('contactLife')) ownSprite(env, 'boat', { x: rx - 64 * rs, y: ry - 100 * rs, w: 128 * rs, h: 106 * rs }, { bend: true, range: [rx - 4000, rx + 4000] }, (e) => rushes(e, rx, ry, rs, own('d5 rushes'), 13, 52));
    else rushes(env, rx, ry, rs, own('d5 rushes'), 13, 52);
  }
  yield;
  {
    // ---- Contact's one painted moment: the ferry in the morning glow. Under the dawn light a road of light comes
    // across the water toward the boat (glassy highlights over a faint clear cyan sheet, as on the lake), the bow and
    // the pole each stand in their own broken rings, and two far birds cross over the far shore.
    const { ctx, ink } = env, Rg = own('q3 glints');
    const lx = X(K + 0.8), y0 = farY(lx) + 3;
    const fb1 = boat.box, bx = fb1.x + fb1.w * 0.3, by = jet.wl + 30 * sz, ex = mix(lx, bx, 0.55);
    // (the road runs from the far shore under the light to the near water in front of the jetty, toward the boat; laid last,
    // over the bank's mist)
    softWash(env, [[lx - 30, y0 - 2], [lx + 30, y0 - 2], [ex + 70 * sz, by + 4], [ex - 60 * sz, by + 4]], ink.rgba([128, 192, 216], 0.5), 10);
    softWash(env, [[lx - 14, y0], [lx + 14, y0], [ex + 30 * sz, by], [ex - 26 * sz, by]], ink.rgba([108, 178, 206], 0.32), 6);
    for (let i = 0; i < 24; i++) {
      const t = i / 23, y = mix(y0 + 2, by - 2 * sz, t * t) + Rg() * 2, cx = mix(lx, ex, t * t), wdt = 24 + 120 * t * sz * 0.5, L = 12 + 34 * (1 - t) * Rg() + 14 * Rg() * (0.5 + t);
      const x = cx + (Rg() - 0.5) * wdt;
      stroke(ctx, [[x - L / 2, y], [x, y + 0.2], [x + L / 2, y]], { w: 1.0 + 1.1 * (1 - t), col: ink.rgba([255, 255, 255], 0.8 + 0.2 * Rg()), tin: 0.35, tout: 0.4, min: 0.1, wob: 0.3, seed: i + 500 });
    }
    ripples(env, fb1.x + fb1.w * 0.22, fb1.y + fb1.h * 0.97, 14 * sz, own('q3 rings'), { n: 3, sq: 0.25, alpha: 0.8 });
    ripples(env, fb1.x + fb1.w * 0.86, fb1.y + fb1.h * 0.9, 6 * sz, own('q3 rings', 2), { n: 2, sq: 0.25, alpha: 0.6 });
    if (!env.still) {
      farBird(env, X(K + 0.72), Y(0.4), 8.5, -0.1, own('q3 birds', 1), 0.45);
      farBird(env, X(K + 0.735), Y(0.415), 6.5, 0.15, own('q3 birds', 2), 0.55);
    }
  }
  yield;
}

// ---------------------------------------------------------------- geometry (no drawing)
// The ferry in three-quarter view, bow toward the viewer: a along the keel from the bow (0) to the stern (L), b across
// (- left, + right), h up from the water. The keel runs up and to the right into the water (A), the beam nearly level
// (Bv): we see the bow's transom, the right side, and down into the boat.
function ferryShape(x0: number, y0: number, s: number) {
  const L = 54 * s, B = 19 * s, H = 3.9 * s;
  const A: Pt = [0.36, -0.4], Bv: Pt = [1.06, -0.13];
  const P3 = (a: number, b: number, h: number): Pt => [x0 + A[0] * a + Bv[0] * b, y0 + A[1] * a + Bv[1] * b - h];
  const hw = (t: number) => B * 0.5 * (0.34 + 0.66 * Math.pow(Math.sin(Math.PI * (0.05 + 0.9 * t)), 0.55));
  const hs = (t: number) => H * (1 + 1.7 * Math.pow(1 - t, 3.2) + 0.7 * Math.pow(t, 4));     // the sheer, swept up at the bow
  const hc = (t: number) => H * 1.85 * Math.pow(Math.max(0, 1 - t / 0.2), 1.4) + H * 0.4 * Math.pow(Math.max(0, (t - 0.88) / 0.12), 2);   // the chine: the raked bow and stern lift out of the water
  const N = 18;
  const gL: Pt[] = [], gR: Pt[] = [], cR: Pt[] = [], wR: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    gL.push(P3(L * t, -hw(t), hs(t)));
    gR.push(P3(L * t, hw(t), hs(t)));
    cR.push(P3(L * t, hw(t) * 0.88, hc(t)));
    wR.push(P3(L * t, hw(t) * 0.88, 0));
  }
  const box = bounds([gL, gR, [P3(L * 0.9, 0, 30 * s), P3(L * 0.2, 0, -16 * s), P3(L * 0.84, B, -12 * s)]], 3 * s);
  return { x0, y0, s, L, B, H, A, Bv, P3, hw, hs, hc, N, gL, gR, cR, wR, box };
}
type FerryShape = ReturnType<typeof ferryShape>;
interface Jetty {
  headX: number;
  root: Pt;
  wl: number;
  dh: number;
  dw: number;
  D: Pt;
  s: number;
  Rp: () => Rng;
  headPost?: Pt;
}
// The jetty: from just past the ferry's stern to the bank at the right, along the water a little nearer than the
// stern; its deck dh above the water and dw deep (along the oblique depth D).
function jettyShape(b: FerryShape, s: number, rootMin: number, Rp: () => Rng): Jetty {
  const stern = b.P3(b.L, b.hw(1) * 0.88, 0);
  const headX = stern[0] + 9 * s;
  return { headX, root: [Math.max(headX + 92 * s, rootMin), 0], wl: stern[1] + 2.5 * s, dh: 5.5 * s, dw: 9 * s, D: [0.72, -0.48], s, Rp };
}
// the front posts, irregularly spaced, from the head to the root (positions only: the reflections use them too)
function postXs(j: Jetty, R: Rng) {
  const xs = [j.headX];
  for (let x = j.headX + (22 + R() * 8) * j.s; x < j.root[0] - 10 * j.s; x += (22 + R() * 12) * j.s) xs.push(x);
  xs.push(j.root[0] - 3 * j.s);
  return xs;
}

// ---------------------------------------------------------------- the water
function reflections(env: Env, b: FerryShape, j: Jetty, R: Rng, s: number) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const wet = mix3(C.ink, C.indigo, 0.45);
  // the boat mirrored at its waterline (the hull, the canopy's height, the ferryman faintly), laid as torn smears
  const mir = (p: Pt, t: number, side: number): Pt => { const w = b.P3(b.L * t, side * b.hw(t) * 0.88, 0); return [p[0], 2 * w[1] - p[1]]; };
  const sil: Pt[] = [];
  for (let i = 1; i <= b.N; i++) { const t = i / b.N; sil.push(mir(b.P3(b.L * t, b.hw(t), b.hs(t) + (t > 0.25 && t < 0.66 ? 8 * s : 0)), t, 1)); }
  for (let i = b.N; i >= 1; i--) { const t = i / b.N; sil.push(mir(b.gL[i], t, -1)); }
  const xs = sil.map((p) => p[0]), ys = sil.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  // its body: a soft dark mass under the hull (it holds the boat on the water at phone size), then the torn smears
  wash(ctx, sil.map(([x, y]): Pt => [x, mix(y, y0, 0.45)]), rgba(wet, 0.34), { jit: 0.4 * s, seed: 2 });
  ctx.save();
  ctx.beginPath(); ctx.moveTo(sil[0][0], sil[0][1]); for (const p of sil) ctx.lineTo(p[0], p[1]); ctx.closePath(); ctx.clip();
  for (let y = y0 + 0.8 * s, k = 0; y < y1 + 1.5 * s; y += (1.8 + k * 0.15) * s, k++) {
    const d = (y - y0) / (y1 - y0 + 1.5 * s);
    stroke(ctx, [[x0 - 2 * s + R() * 5 * s, y], [x1 + 1 * s - R() * 8 * s, y + 0.15 * s]], { w: 1.6 * s, col: rgba(wet, 0.6 * (1 - d) + 0.06), tin: 0.12, tout: 0.3, wob: 0.6, dry: 0.3 + 0.35 * d, seed: k * 3 + 1 });
  }
  ctx.restore();
  // where the hull sits in the water: a dark lip, and the wake's long, pale-dark strokes either side of the bow
  stroke(ctx, b.wR.slice(4, b.N), { w: 0.9 * s, col: rgba(C.ink, 0.6), tin: 0.15, tout: 0.3, wob: 0.5, dry: 0.12, seed: 4 });
  const bow = b.P3(b.L * 0.2, 0, 0);
  for (let k = 0; k < 3; k++) {
    const yy = bow[1] + (1.2 + k * 2.4) * s, half = (12 + k * 10) * s;
    stroke(ctx, [[bow[0] - half * 1.1, yy + R() * s], [bow[0] - half * 0.15, yy + 0.4 * s]], { w: 0.75 * s, col: rgba(wet, 0.34 - k * 0.08), tin: 0.35, tout: 0.3, dry: 0.3, seed: 20 + k });
    stroke(ctx, [[bow[0] + half * 0.5, yy - 0.2 * s], [bow[0] + half * 1.4, yy + R() * s]], { w: 0.7 * s, col: rgba(wet, 0.28 - k * 0.07), tin: 0.3, tout: 0.5, dry: 0.35, seed: 30 + k });
  }
  // the jetty mirrored: each front post's broken dark vertical, the deck's faint band, all torn by ripples
  for (const px of postXs(j, j.Rp())) {
    for (let k = 0; k < 4; k++) {
      const y = j.wl + (1.4 + k * 2.4) * s;
      stroke(ctx, [[px + (R() - 0.5) * 0.8 * s, y], [px + (R() - 0.5) * 0.8 * s, y + 1.6 * s]], { w: 1.6 * s, col: rgba(wet, 0.42 - k * 0.09), tin: 0.1, tout: 0.4, wob: 0.6, seed: px + k });
    }
  }
  for (let k = 0; k < 3; k++) {
    const y = j.wl + (2.2 + k * 2.8) * s;
    const pts: Pt[] = [];
    for (let x = j.headX - 3 * s; x <= j.root[0]; x += 5 * s) pts.push([x, y + (vnoise(x / 30, k, 3) - 0.5) * 0.6 * s]);
    for (const seg of runs(pts, R, 16 * s, 50 * s, 7 * s)) stroke(ctx, seg, { w: 1.2 * s, col: rgba(wet, 0.2 - k * 0.05), tin: 0.2, tout: 0.3, dry: 0.4, seed: seg[0][0] });
  }
}

// ---------------------------------------------------------------- the near shore and its reeds
function bank(env: Env, j: Jetty, R: Rng, s: number) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const rx = j.root[0], ry = j.wl;
  // the near shore under the jetty's root, running off to the right: land is paper the brush left, here laid as
  // flat strokes of paper over the water that thin out toward you and to the left (no edge but the wet one), its wet
  // edge a broken dark line, a few dry strokes of its slope, tufts of grass. Most of it is mist.
  const edge: Pt[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    edge.push([rx - 14 * s + t * 120 * s, ry + 1.2 * s + Math.pow(t, 1.3) * 20 * s + (vnoise(t * 6, 3, 5) - 0.5) * 2.4 * s]);
  }
  const edgeAt = (x: number) => { for (let i = 1; i < edge.length; i++) if (edge[i][0] >= x) { const [a, b] = [edge[i - 1], edge[i]]; return mix(a[1], b[1], (x - a[0]) / (b[0] - a[0])); } return edge[edge.length - 1][1]; };
  for (let k = 0; k < 13; k++) {
    const dy = (0.8 + k * 2.6) * s;
    const xa = rx - 10 * s + k * 3.5 * s + R() * 8 * s;   // each lower stroke starts further right: the land thins away
    const xb = rx + (70 + R() * 70 - k * 3) * s;          // and ends ragged, in mist
    const pts: Pt[] = [];
    for (let x = xa; x <= xb; x += 6 * s) pts.push([x, edgeAt(x) + dy]);
    if (pts.length > 1) stroke(ctx, pts, { w: 3.2 * s, col: rgba(C.paper, 0.58 - k * 0.035), tin: 0.25, tout: 0.45, wob: 0.5, min: 0.2, seed: k * 13 + 3 });
  }
  // the wet edge: strong at the jetty's root, thinning out to the right where the shore goes into mist
  for (const seg of runs(edge.slice(0, 8), R, 18 * s, 50 * s, 6 * s)) {
    const fade = 1 - Math.min(1, Math.max(0, (seg[0][0] - rx) / (70 * s)));
    stroke(ctx, seg, { w: 1.25 * s, col: rgba(C.ink, 0.15 + 0.4 * fade), tin: 0.2, tout: 0.5, wob: 0.7, dry: 0.3 + 0.3 * (1 - fade), seed: seg[0][0] });
  }
  for (let i = 0; i < 5; i++) {   // the slope: a few dry, flat strokes, paler toward you
    const x = rx + (4 + R() * 60) * s, y = edgeAt(x) + (3 + R() * 8) * s;
    stroke(ctx, [[x, y], [x + (8 + R() * 12) * s, y + (R() - 0.2) * 1.5 * s]], { w: 0.8 * s, col: rgba(C.ink, 0.14 + R() * 0.12), tin: 0.2, tout: 0.6, dry: 0.45, seed: i });
  }
  for (let i = 0; i < 4; i++) {   // grass tufts along the edge
    const e = edge[1 + Math.floor(R() * 10)];
    for (let k = 0; k < 3; k++) stroke(ctx, [[e[0] + k * 0.8 * s, e[1] + 0.3 * s], [e[0] + (k - 1) * 1.2 * s + (R() - 0.5) * s, e[1] - (2 + R() * 3) * s]], { w: 0.6 * s, col: rgba(ink.strength > 0 ? mix3(C.ink, C.malD, 0.3) : C.ink, 0.45), tin: 0, tout: 0.9 });
  }
}

/** A clump of reeds: n tapered blades from a base, leaning, a few bent over at the tip, a few seed heads; their
 *  short broken reflection. `a` = strength (1 near, less for the ones behind). */
function reeds(env: Env, x: number, y: number, s: number, R: Rng, n: number, a: number) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const col = ink.strength > 0 ? mix3(C.ink, C.malD, 0.24) : C.ink;
  const lean = (R() - 0.5) * 0.5;
  for (let i = 0; i < n; i++) {
    const bx = x + (R() - 0.5) * 12 * s, by = y + (R() - 0.5) * 2.4 * s;
    const h = (8 + R() * 13) * s, ang = lean + (R() - 0.5) * 0.75;
    const tip: Pt = [bx + Math.sin(ang) * h, by - Math.cos(ang) * h];
    const mid: Pt = [bx + Math.sin(ang) * h * 0.5 + (R() - 0.5) * 1.6 * s, by - Math.cos(ang) * h * 0.52];
    const pts: Pt[] = [[bx, by], mid, tip];
    if (R() < 0.35) pts.push([tip[0] + (ang > 0 ? 1 : -1) * (2 + R() * 3) * s, tip[1] + (1.5 + R() * 2.5) * s]);   // bent over
    stroke(ctx, pts, { w: (0.75 + R() * 0.45) * s, col: rgba(col, a * (0.5 + R() * 0.38)), tin: 0.05, tout: 0.85, wob: 0.3, min: 0.12, seed: bx * 3 + i });
    if (R() < 0.28) stroke(ctx, [[tip[0], tip[1] + 0.6 * s], [tip[0] + Math.sin(ang) * 2.4 * s, tip[1] - 2.4 * s]], { w: 1.3 * s, col: rgba(C.ink, a * 0.62), tin: 0.2, tout: 0.6, seed: i });
  }
  for (let k = 0; k < 2; k++) stroke(ctx, [[x - 7 * s, y + (2.4 + k * 2.4) * s], [x + 7 * s, y + (2.6 + k * 2.4) * s]], { w: 0.85 * s, col: rgba(mix3(C.ink, C.indigo, 0.45), a * (0.26 - k * 0.08)), tin: 0.3, tout: 0.4, dry: 0.4, seed: x + k });
}

// ---------------------------------------------------------------- the jetty
function jetty(env: Env, j: Jetty, R: Rng, s: number) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const { headX, wl, dh, dw, D } = j;
  const rootX = j.root[0];
  // old timber, never ruled: a long sag between the head and the bank, and the boards' own small unevenness
  const sag = (x: number) => Math.sin(Math.PI * Math.min(1, Math.max(0, (x - headX) / (j.root[0] - headX)))) * 1.6 * s + (vnoise(x / (36 * s), 1.7, 9) - 0.5) * 1.6 * s;
  const front = (x: number, up = 0): Pt => [x, wl - dh - up + sag(x)];
  const back = (x: number, up = 0): Pt => [x + D[0] * dw, wl - dh - up + sag(x) + D[1] * dw];
  const xs: number[] = [];
  for (let x = headX - 2 * s; x < rootX + 8 * s; x += 5 * s) xs.push(x);
  const posts = postXs(j, j.Rp());
  const postC = mix3(C.ink, C.timber, 0.3);
  // the back row of posts, glimpsed under the deck (paler: further off)
  for (const px of posts) {
    const p = back(px + 2 * s);
    stroke(ctx, [[p[0], p[1]], [p[0] + 0.2 * s, wl + D[1] * dw + 1 * s]], { w: 1.3 * s, col: rgba(mix3(postC, C.paper, 0.35), 0.75), tin: 0, tout: 0.3, wob: 0.3, seed: px });
  }
  // a low tie between some of the front posts, just over the water (old timber work, never a fence)
  for (let i = 0; i < posts.length - 1; i++) {
    if (R() < 0.45) continue;
    const a = posts[i], b2 = posts[i + 1], ty = wl - dh * 0.32 + (R() - 0.5) * 0.8 * s;
    stroke(ctx, [[a, ty], [b2, ty + (R() - 0.5) * 1.2 * s]], { w: 0.75 * s, col: rgba(postC, 0.55), tin: 0.1, tout: 0.2, dry: 0.3, seed: a });
  }
  // the deck seen from above: cross planks laid on the stringers, weathered grey, no two alike, one or two missing
  const pk = mix3(C.ink2, C.timberM, 0.35);
  for (let x = headX - 1 * s; x < rootX + 6 * s;) {
    const w = (2.1 + R() * 0.9) * s, over = (R() - 0.3) * 1.2 * s;
    if (R() < 0.06) { x += w; continue; }
    const a = front(x), a2 = front(x + w * 0.88), b1 = back(x + over * 0.4), b2 = back(x + w * 0.88 + over * 0.4);
    wash(ctx, [[a[0], a[1] + 0.2 * s], [a2[0], a2[1] + 0.2 * s], b2, b1], rgba(mix3(pk, C.paper, 0.5 + R() * 0.24), 0.96), { jit: 0.12 * s, seed: x });
    x += w;
  }
  for (const seg of runs(xs.map((x) => back(x)), R, 14 * s, 40 * s, 3 * s)) stroke(ctx, seg, { w: 0.5 * s, col: rgba(C.ink, 0.36), tin: 0.1, tout: 0.2, wob: 0.5, dry: 0.2, seed: seg[0][0] });
  // the near beam under the boards: a dark face and a heavy, slightly broken line
  const beamTop = xs.map((x) => front(x)), beamLow = xs.map((x): Pt => { const p = front(x); return [p[0], p[1] + 1.8 * s]; });
  wash(ctx, [...beamTop, ...beamLow.slice().reverse()], rgba(mix3(C.ink, C.timber, 0.3), 0.85), { jit: 0.2 * s });
  stroke(ctx, beamTop, { w: 1.15 * s, col: rgba(C.ink, 0.88), tin: 0.04, tout: 0.1, wob: 0.35, dry: 0.06, seed: 7 });
  stroke(ctx, beamLow, { w: 0.8 * s, col: rgba(C.ink, 0.65), tin: 0.1, tout: 0.25, wob: 0.4, dry: 0.2, seed: 8 });
  // the front posts: from just above the boards into the water, each a little out of true; a dark ring at the foot
  for (const px of posts) {
    const tp = front(px);
    const lean = (R() - 0.5) * 0.9 * s + (px === posts[posts.length - 2] ? 2.2 * s : 0), up = (px === headX ? 8 : 1 + R() * 1.6) * s;   // one post has settled out of true
    stroke(ctx, [[tp[0] + lean * 0.5, tp[1] - up], [px - lean * 0.3, wl + 1 * s]], { w: (px === headX ? 2.0 : 1.6) * s, col: rgba(postC, 0.92), tin: 0.0, tout: 0.12, wob: 0.35, seed: px * 2 });
    stroke(ctx, [[px - 2.6 * s, wl + 1.1 * s], [px + 2.8 * s, wl + 1.3 * s]], { w: 0.7 * s, col: rgba(C.ink, 0.5), tin: 0.2, tout: 0.3, seed: px });
    if (px === headX) j.headPost = [tp[0] + lean * 0.4, tp[1] - up + 2.5 * s];
  }
}

// the root of the jetty and the reeds' feet in the shore's mist: a few soft strokes of paper laid over them
function rootMist(env: Env, j: Jetty, R: Rng, s: number) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const x1 = j.root[0];
  for (let k = 0; k < 5; k++) {
    const y = j.wl - j.dh * 0.4 + k * 2.6 * s, x0 = x1 - (14 + k * 7 + R() * 10) * s;
    stroke(ctx, [[x0, y], [mix(x0, x1 + 30 * s, 0.5), y + (R() - 0.5) * s], [x1 + 30 * s, y + 0.5 * s]], { w: 3 * s, col: rgba(C.paper, 0.32 - k * 0.03), tin: 0.6, tout: 0.3, wob: 0.6, min: 0.15, seed: k * 5 + 1 });
  }
}

// ---------------------------------------------------------------- the ferry
function ferry(env: Env, b: FerryShape, j: Jetty, own: Streams, s: number) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const { P3, L, hw, hs, N, gL, gR, cR } = b;
  // down into the boat: old pale planks, the thwarts across
  wash(ctx, [...gL, ...gR.slice().reverse()], rgba(mix3(mix3(C.timberM, C.ink2, 0.35), C.white, 0.4), 0.97), { jit: 0.2 * s });
  for (const t of [0.13, 0.22, 0.8, 0.93]) stroke(ctx, [P3(L * t, -hw(t) * 0.95, hs(t) - 0.4 * s), P3(L * t, hw(t) * 0.95, hs(t) - 0.4 * s)], { w: 0.5 * s, col: rgba(C.ink, 0.42), tin: 0.05, tout: 0.1 });
  // the right side, wet timber, a strake line along it; the bow's raked transom, darker, lifted clear of the water
  wash(ctx, [...gR, ...cR.slice().reverse()], rgba(mix3(C.timber, C.ink, 0.5), 0.95), { jit: 0.2 * s, seed: 5 });
  stroke(ctx, gR.map((p, i): Pt => [p[0], mix(p[1], cR[i][1], 0.5)]).slice(2, N), { w: 0.45 * s, col: rgba(C.ink, 0.4), tin: 0.2, tout: 0.3, dry: 0.3, seed: 6 });
  dryBrush(ctx, gR.map((p, i): Pt => [p[0], mix(p[1], cR[i][1], 0.3)]).slice(3, N - 1), { w: 1.6 * s, col: rgba(mix3(C.timber, C.ink, 0.15), 0.5), bristles: 3, seed: 31, thr: 0.5 });
  const bowFace = [gL[0], gR[0], cR[0], P3(0, -hw(0) * 0.88, b.hc(0))];
  wash(ctx, bowFace, rgba(mix3(C.timber, C.ink, 0.38), 0.97), { jit: 0.12 * s, seed: 9 });
  stroke(ctx, [bowFace[3], cR[0]], { w: 0.7 * s, col: rgba(C.ink, 0.85), tin: 0.1, tout: 0.1 });
  stroke(ctx, cR, { w: 0.95 * s, col: rgba(C.ink, 0.88), tin: 0.1, tout: 0.2, wob: 0.4, seed: 10 });
  stroke(ctx, gL, { w: 0.65 * s, col: rgba(C.ink, 0.7), tin: 0.05, tout: 0.1, wob: 0.3, seed: 11 });
  // the ferryman on the stern deck, behind the canopy: drawn before it, so the mats overlap him
  const ft = 0.9;
  const feet = P3(L * ft, hw(ft) * 0.3, hs(ft) - 0.5 * s);
  const hands = ferryman(env, feet[0], feet[1], 1.75 * s, own('ferryman'));
  // the pole: steep, at his right, its foot in the water off the stern quarter
  const poleFoot = poleFootOf(b, hands, s);
  // the canopy: a low barrel of woven mats on bamboo hoops over the waist; from the bow you look into it
  const t0 = 0.25, t1 = 0.66, wallH = 0.9 * s, ch = 7.4 * s;
  const arch = (t: number, from = -1, to = 1, n = 14) => {
    const pts: Pt[] = [];
    for (let i = 0; i <= n; i++) { const q = from + (to - from) * i / n; pts.push(P3(L * t, q * hw(t) * 0.93, hs(t) + wallH + ch * Math.pow(Math.max(0, 1 - q * q), 0.5))); }
    return pts;
  };
  const F0 = arch(t0), F1 = arch(t1);
  const mat = mix3(C.tile, C.white, 0.36);
  wash(ctx, [...F0, ...F1.slice().reverse()], rgba(mat, 0.97), { jit: 0.15 * s, seed: 12 });
  wash(ctx, [...arch(t0, 0.3, 1, 7), ...arch(t1, 0.3, 1, 7).reverse()], rgba(mix3(mat, C.ink, 0.32), 0.6), { jit: 0.1 * s, seed: 13 });   // the flank in shade
  for (let i = 1; i < 4; i++) stroke(ctx, arch(mix(t0, t1, i / 4), -0.65, 1, 8), { w: 0.4 * s, col: rgba(C.ink, 0.36), tin: 0.15, tout: 0.3, dry: 0.15 });   // hoops
  const Rw = own('weave');
  for (let i = 0; i < 22; i++) {   // the weave: short crossing strokes, a mat's twill, here and there
    const t = mix(t0 + 0.03, t1 - 0.02, Rw()), q = -0.45 + Rw() * 1.35;
    const p = P3(L * t, q * hw(t) * 0.93, hs(t) + wallH + ch * Math.pow(Math.max(0, 1 - q * q), 0.5));
    const d = i % 2 ? [b.A[0] * 2.4 * s + 0.9 * s, b.A[1] * 2.4 * s + 0.6 * s] : [b.A[0] * 2.4 * s - 0.9 * s, b.A[1] * 2.4 * s - 0.6 * s];
    stroke(ctx, [p, [p[0] + d[0], p[1] + d[1]]], { w: 0.3 * s, col: rgba(C.ink, 0.2), tin: 0, tout: 0.3 });
  }
  // the open mouth: dark inside, and through it the light at the far end, the empty bench
  wash(ctx, F0, rgba(mix3(C.ink, C.indigo, 0.3), 0.94), { jit: 0.1 * s, seed: 14 });
  ctx.save();
  ctx.beginPath(); ctx.moveTo(F0[0][0], F0[0][1]); for (const p of F0) ctx.lineTo(p[0], p[1]); ctx.closePath(); ctx.clip();
  const far = arch(t1, -0.82, 0.82, 10).map(([x, y]): Pt => [x, y + 1.3 * s]);
  wash(ctx, [...far, P3(L * t1, hw(t1) * 0.78, hs(t1) + 0.4 * s), P3(L * t1, -hw(t1) * 0.78, hs(t1) + 0.4 * s)], rgba(mix3(C.paper, C.indigoP, 0.35), 0.8), { jit: 0.1 * s, seed: 15 });
  const st = 0.44, bench = [P3(L * st, -hw(st) * 0.82, hs(st) + 0.4 * s), P3(L * st, hw(st) * 0.82, hs(st) + 0.4 * s)];
  wash(ctx, [bench[0], bench[1], [bench[1][0], bench[1][1] - 1.5 * s], [bench[0][0], bench[0][1] - 1.5 * s]], rgba(mix3(C.timberM, C.ink2, 0.5), 0.85));
  ctx.restore();
  // the hoop at the mouth (the mats' bound edge): the boat's strongest line; the back hoop, the ridge, the base
  stroke(ctx, F0, { w: 1.2 * s, col: rgba(C.ink, 0.92), tin: 0.05, tout: 0.05, wob: 0.3, seed: 16 });
  stroke(ctx, F1.slice(Math.floor(F1.length * 0.4)), { w: 0.7 * s, col: rgba(C.ink, 0.62), tin: 0.1, tout: 0.2, seed: 17 });
  stroke(ctx, [F0[F0.length - 1], F1[F1.length - 1]], { w: 0.75 * s, col: rgba(C.ink, 0.72), tin: 0.1, tout: 0.1 });
  stroke(ctx, [F0[7], F1[7]], { w: 0.5 * s, col: rgba(C.ink, 0.32), tin: 0.2, tout: 0.2, dry: 0.3 });
  // the gunwales over all: the boat's drawing line, the bow swept up
  stroke(ctx, gR, { w: 1.1 * s, col: rgba(C.ink, 0.9), tin: 0.03, tout: 0.08, wob: 0.3, seed: 18 });
  stroke(ctx, [gL[0], gR[0]], { w: 1.05 * s, col: rgba(C.ink, 0.9), tin: 0.05, tout: 0.05 });
  // the pole, planted in the water off the stern's right, up through his hands and past his hat
  const top: Pt = [hands[0] + (hands[0] - poleFoot[0]) * 0.62, hands[1] + (hands[1] - poleFoot[1]) * 0.62];
  const bend: Pt = [mix(poleFoot[0], hands[0], 0.5) + 0.6 * s, mix(poleFoot[1], hands[1], 0.5)];
  stroke(ctx, [poleFoot, bend, hands, top], { w: 0.8 * s, col: rgba(C.ink, 0.92), tin: 0.02, tout: 0.15, wob: 0.15, seed: 19 });
  stroke(ctx, [[poleFoot[0] - 2.8 * s, poleFoot[1] + 0.7 * s], [poleFoot[0] + 3.2 * s, poleFoot[1] + 0.9 * s]], { w: 0.65 * s, col: rgba(C.ink, 0.5), tin: 0.2, tout: 0.3 });
  // its reflection: the same slant mirrored under the water, broken by the ripples
  const pr = own('pole reflection');
  for (let k = 0; k < 4; k++) {
    const t0 = 0.08 + k * 0.2, t1 = t0 + 0.11 + pr() * 0.04;
    const at = (t: number): Pt => [poleFoot[0] + (top[0] - poleFoot[0]) * t * 0.5, poleFoot[1] + (poleFoot[1] - top[1]) * t * 0.5];   // mirrored, shortened
    stroke(ctx, [at(t0), at(t1)], { w: 0.7 * s, col: rgba(mix3(C.ink, C.indigo, 0.45), 0.4 - k * 0.08), tin: 0.2, tout: 0.3 });
  }
  // the rope from the stern to the jetty's head post, sagging
  const sp = P3(L * 0.98, hw(0.98), hs(0.98));
  const hp = j.headPost!;
  stroke(ctx, [sp, [mix(sp[0], hp[0], 0.5), Math.max(sp[1], hp[1]) + 2.2 * s], hp], { w: 0.42 * s, col: rgba(C.ink, 0.62), tin: 0, tout: 0 });
}

/** The ferryman: a short faded-indigo jacket over dark trousers rolled to the knee, a wide shallow cone hat, leaning
 *  a little toward the pole at his right, both hands on it at the chest, one knee easy. (x, y) = his feet; s = scale
 *  (1 ~ 10 px tall). Returns where his hands hold the pole. */
// The pole's foot in the water for the ferryman's hands (ferry() draws it there; contactLife drops its rings there).
function poleFootOf(b: FerryShape, hands: Pt, s: number): Pt {
  const dirP = [-0.34, -1], waterY = b.wR[b.N][1] + 1.5 * s;
  const tP = (waterY - hands[1]) / -dirP[1];
  return [hands[0] - dirP[0] * tP, waterY];
}
// Where his hands hold the pole, for his feet (x, y), his scale s and his lean (ferryman() draws them there).
function ferrymanHands(x: number, y: number, s: number, lean: number): Pt {
  const sh = [x + 0.2 * s + Math.sin(lean) * 7.1 * s, y - 7.1 * s];
  return [sh[0] + 2.5 * s, sh[1] + 1.3 * s];
}
// contactLife: the pole's foot and the bow at the water (where the wake starts), without drawing: ferry()'s feet, the
// ferryman's lean from his own seeded stream (its first draw), so the drops sit exactly on what is painted.
function ferryDrops(b: FerryShape, s: number, own: Streams): Pt[] {
  const ft = 0.9;
  const feet = b.P3(b.L * ft, b.hw(ft) * 0.3, b.hs(ft) - 0.5 * s);
  const lean = 0.1 + own('ferryman')() * 0.05;
  return [poleFootOf(b, ferrymanHands(feet[0], feet[1], 1.75 * s, lean), s), b.P3(b.L * 0.2, 0, 0)];
}
function ferryman(env: Env, x: number, y: number, s: number, R: Rng): Pt {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const lean = 0.1 + R() * 0.05;                       // toward the pole
  const hip = [x + 0.2 * s + Math.sin(lean) * 4.1 * s, y - 4.1 * s];
  const sh = [x + 0.2 * s + Math.sin(lean) * 7.1 * s, y - 7.1 * s];
  // legs: the left planted straight, the right easy at the knee; bare shins, dark rolled trousers above
  stroke(ctx, [[hip[0] - 0.65 * s, hip[1]], [x - 1.1 * s, y]], { w: 0.75 * s, col: rgba(C.ink, 0.9), tin: 0, tout: 0.1 });
  stroke(ctx, [[hip[0] + 0.55 * s, hip[1]], [x + 1.25 * s, y - 2.1 * s], [x + 1.15 * s, y + 0.1 * s]], { w: 0.72 * s, col: rgba(C.ink, 0.88), tin: 0, tout: 0.1 });
  wash(ctx, [[hip[0] - 1.4 * s, hip[1] - 0.4 * s], [hip[0] + 1.5 * s, hip[1] - 0.4 * s], [x + 1.9 * s, y - 2.3 * s], [x + 0.5 * s, y - 2.0 * s], [x - 1.6 * s, y - 2.1 * s]], rgba(mix3(C.ink2, C.indigo, 0.45), 0.9), { jit: 0.1 * s });
  // the jacket, belted, its hem flaring; the sleeve of the arm that reaches for the pole
  const jk: Pt[] = [[sh[0] - 1.3 * s, sh[1] + 0.2 * s], [sh[0] - 0.2 * s, sh[1] - 0.25 * s], [sh[0] + 1.5 * s, sh[1] + 0.05 * s], [hip[0] + 2.0 * s, hip[1] + 0.8 * s], [hip[0] - 1.9 * s, hip[1] + 0.9 * s]];
  wash(ctx, jk, rgba(mix3(C.indigoP, C.indigo, 0.62), 0.97), { jit: 0.15 * s, seed: x });
  stroke(ctx, [jk[0], jk[4]], { w: 0.52 * s, col: rgba(C.ink, 0.75), tin: 0.05, tout: 0.3, dry: 0.25, seed: x + 1 });
  stroke(ctx, [jk[2], jk[3]], { w: 0.4 * s, col: rgba(C.ink, 0.45), tin: 0.05, tout: 0.4, seed: x + 2 });
  stroke(ctx, [[hip[0] - 1.6 * s, hip[1] - 0.5 * s], [hip[0] + 1.7 * s, hip[1] - 0.7 * s]], { w: 0.5 * s, col: rgba(C.ink, 0.6), tin: 0, tout: 0.2 });
  const hands: Pt = ferrymanHands(x, y, s, lean);
  wash(ctx, [[sh[0] + 0.9 * s, sh[1] + 0.1 * s], [sh[0] + 1.7 * s, sh[1] + 0.3 * s], [hands[0] + 0.1 * s, hands[1] + 0.2 * s], [hands[0] - 0.6 * s, hands[1] + 1.1 * s], [sh[0] + 0.7 * s, sh[1] + 1.9 * s]], rgba(mix3(C.indigoP, C.indigo, 0.7), 0.95), { jit: 0.08 * s });
  stroke(ctx, [[sh[0] + 0.9 * s, sh[1] + 1.8 * s], [hands[0] - 0.5 * s, hands[1] + 1.0 * s]], { w: 0.42 * s, col: rgba(C.ink, 0.6), tin: 0.1, tout: 0.2 });
  stroke(ctx, [[sh[0] - 1.0 * s, sh[1] + 0.5 * s], [sh[0] + 0.4 * s, sh[1] + 2.0 * s], [hands[0] - 0.3 * s, hands[1] - 0.5 * s]], { w: 0.55 * s, col: rgba(C.ink, 0.62), tin: 0, tout: 0.2 });
  // the head under a wide, shallow cone hat, tilted with him: pale split bamboo, a dark brim, the shadow under it
  const hx = sh[0] + Math.sin(lean) * 1.5 * s, hy = sh[1] - 1.25 * s;
  ctx.fillStyle = rgba(C.ink, 0.85);
  ctx.beginPath(); ctx.arc(hx, hy, 0.95 * s, 0, Math.PI * 2); ctx.fill();
  const brim = 3.3 * s, tl = lean * 1.2;
  const hp = (dx: number, dy: number): Pt => [hx + dx * Math.cos(tl) - dy * Math.sin(tl), hy + dx * Math.sin(tl) + dy * Math.cos(tl)];
  const hat = [hp(-brim, -0.4 * s), hp(-0.1 * s, -2.8 * s), hp(brim, -0.5 * s), hp(0.1 * s, 0.05 * s)];
  wash(ctx, hat, rgba(mix3(C.white, C.ink2, 0.28), 0.97), { jit: 0.1 * s });
  wash(ctx, [hat[0], hat[3], hat[2], hp(0.2 * s, -0.75 * s)], rgba(mix3(C.white, C.ink2, 0.55), 0.8), { jit: 0.05 * s });
  stroke(ctx, [hat[0], hat[3], hat[2]], { w: 0.62 * s, col: rgba(C.ink, 0.9), tin: 0.08, tout: 0.08 });
  stroke(ctx, [hat[0], hat[1], hat[2]], { w: 0.4 * s, col: rgba(C.ink, 0.55), tin: 0.1, tout: 0.1, dry: 0.2 });
  return hands;
}
