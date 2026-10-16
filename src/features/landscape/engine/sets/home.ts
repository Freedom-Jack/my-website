// sets/home.ts — Home (stretch 0): his mountain. On the near ridge (plane 3), at the foot of the host peak's crag, a
// path comes up out of the mist along the ridge, over a small knoll and down into the saddle, then climbs a few steps
// cut in the rock to a ledge where a thatched hut stands with its front open, a low brushwood fence before it and a
// pine leaning over its roof. The traveller (him) walks up the path toward it: a broad hat, sloped shoulders, a white
// robe flaring at the hem, a bundle on his back and a staff planted ahead. Life: a thread of smoke from the hut's
// ridge (an anchor only: it is not drawn here, so the present pass never doubles it). Round 5: the river starts here. In
// the cleft between the near crag's two summits a thin fall drops in two tiers into the mist at its foot, where the
// river comes out from behind his mountain toward the town (compose.ts: one river the whole length).
//
// A figure set (figures.ts, THE SET API): meta + draw(env), in world px.

import { REF_PX, VH_PX, planeTop, streams, vnoise, mix, mix3, runs, stroke, wash, softWash, dotTree, ellipse, anchor, type Env, type FigureMeta, type Pt, type Rng } from '../figures';

// u1 reaches past the crag (1.06, not 0.9): on phones the hut is drawn larger and must stay clear of the right end's
// melt (the last 13 % of the rect's width), and the fall in the crag's cleft (u 0.94) stands clear of it too
export const meta: FigureMeta = { rect: [0.64, 1.06, 0.06, 0.42], plane: 3, phase: 1 };

const SEED = 5;
const OB: Pt = [0.72, -0.48];   // the Song oblique (figures.ts D, copied: a set's top level runs before figures.ts's own)

export function* draw(env: Env) {
  const { ctx, P, ink } = env;
  const { C, rgba } = ink;
  const own = streams(SEED, PINS);   // one stream per element (figures.ts streams)
  // The phone's album leaf sees this place from further away, so its figures are drawn larger (a painter's licence:
  // figures are always drawn to be read): the traveller by `big` (ts below), so he is never under 12 CSS px tall; the
  // hut by a little less, the trees and the ground marks by less again.
  const big = Math.max(1, 0.7 * REF_PX / env.scale);
  const bh = 1 + (big - 1) * 0.9;    // the hut, its ledge, its fence
  const bt = 1 + (big - 1) * 0.7;    // trees
  const bg = 1 + (big - 1) * 0.6;    // ground marks: the crest, the path, the steps
  const X = (u: number) => u * REF_PX, Y = (y: number) => (1 - y) * VH_PX;
  const crestY = (x: number) => Y(planeTop(3, x / REF_PX, P));

  // ---- the ridge under the path: a body of pale wash falling into mist, the crest in broken dry strokes
  const ridge: Pt[] = [];
  for (let u = 0.716; u <= 0.83; u += 0.002) ridge.push([X(u), crestY(X(u)) + 0.6]);
  const tone = mix3(C.ink2, C.indigo, 0.5);
  for (const [d, a, r] of [[18, 0.035, 3], [10, 0.045, 1.6], [4.5, 0.06, 0.8]]) {   // darkest under the crest, thinning
    const lower = ridge.slice().reverse().map(([x, y], i): Pt => [x - 2, y + d * bg * (0.6 + 0.8 * vnoise(i * 0.07, d, 21))]);
    softWash(env, [...ridge, ...lower], rgba(tone, a), r * bg);
  }
  // the crest and the path's edge below it never run side by side (that reads as a road with kerbs): one slow noise
  // gives the crest where it is high and the path's edge where it is low, so the brush alternates between them
  const gate = (x: number) => vnoise(x / (24 * bg), 4.2, 41);
  const Rc = own('crest');
  for (const seg of gated(ridge, (x) => gate(x) > 0.44)) {
    stroke(ctx, seg, { w: 1.15 * bg, col: rgba(C.ink, 0.3 + Rc() * 0.16), tin: 0.25, tout: 0.5, wob: 0.8, dry: 0.4, seed: seg[0][0] });
  }
  const Rs = own('slope');   // texture strokes down the near face, slanting (none where the traveller stands)
  // the traveller's scale: about 22 CSS px tall on desktops; on phones >= 12 CSS px even where the strip shows this
  // layer at 0.8 of its scale (320 and 375 px wide phones: 216 CSS px per stretch, not 270)
  const ts = Math.max(2.1, 2.05 * big);
  const tx = X(0.788), tReach = 4.5 * ts;
  for (let i = 3; i < ridge.length - 2; i += 4) {
    if (Rs() < 0.45) continue;
    const [x, y] = ridge[i];
    if (Math.abs(x - tx - 0.3 * tReach) < tReach) continue;
    const len = (4 + Rs() * 6) * bg;
    stroke(ctx, [[x, y + 2.4 * bg], [x - (1.4 + Rs() * 1.6) * bg, y + 2.4 * bg + len]], { w: 0.8 * bg, col: rgba(C.ink, 0.16 + Rs() * 0.14), tin: 0.1, tout: 0.75, dry: 0.4, seed: i });
  }
  const Rm = own('moss');
  const mossC = ink.strength > 0 ? mix3(C.ink, C.malD, 0.3) : C.ink;
  for (let i = 1; i < ridge.length; i += 5) {
    if (Rm() < 0.55) continue;
    const [x, y] = ridge[i];
    ctx.fillStyle = rgba(mossC, 0.5 + Rm() * 0.3);
    ctx.beginPath(); ctx.ellipse(x + (Rm() - 0.5) * 2, y - 0.3, (0.8 + Rm() * 0.5) * bg, 0.55 * bg, 0, 0, Math.PI * 2); ctx.fill();
  }
  yield;

  // ---- the path: a worn pale band just under the crest, its lower edge in broken dry strokes, a few pebbles; over
  // the knoll, down into the saddle, then steps up to the ledge
  const pathY = (x: number) => crestY(x) + (2.5 + 1.0 * vnoise(x * 0.045, 1.7, 23)) * bg;
  const path: Pt[] = [];
  for (let x = X(0.722); x <= X(0.817); x += 1.5) path.push([x, pathY(x)]);
  const Rp = own('path');
  for (const seg of runs(path, Rp, 22 * bg, 70 * bg, 7 * bg)) {
    const band = [...seg.map(([x, y]): Pt => [x, y - 0.7 * bg]), ...seg.slice().reverse().map(([x, y]): Pt => [x, y + 1.2 * bg])];
    softWash(env, band, rgba(C.white, 0.5), 0.5 * bg);
  }
  for (const seg of gated(path, (x) => gate(x) < 0.52 && vnoise(x / (7 * bg), 1.3, 43) > 0.38)) {
    if (seg.length < 3) continue;
    stroke(ctx, seg.map(([x, y]): Pt => [x, y + 1.6 * bg]), { w: 0.75 * bg, col: rgba(C.ink, 0.28 + Rp() * 0.18), tin: 0.2, tout: 0.5, wob: 0.6, dry: 0.45, seed: seg[0][0] + 3 });
  }
  for (let i = 0; i < 6; i++) {   // pebbles at the edge (none under his feet)
    const [x, y] = path[Math.floor(Rp() * path.length)];
    const rx = (0.5 + Rp() * 0.4) * bg, ry = 0.35 * bg;
    if (Math.abs(x - tx) < 3 * ts) continue;
    ctx.fillStyle = rgba(C.ink2, 0.35 + Rp() * 0.25);
    ctx.beginPath(); ctx.ellipse(x, y + 2.3 * bg, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  }

  // the ledge (placed now: the steps climb to it)
  const lx = X(0.829) - (bh - 1) * 3;     // its left lip, where the steps arrive
  const y0 = crestY(lx) + 1.2;            // its top: the hut's floor
  const hx = lx + 4.2 * bh;               // the hut's front-left foot
  const HW = 19 * bh, HD = 8.5 * bh;      // the hut's width and depth (thatchedHut)
  const rx0 = lx - 1.5 * bh, rx1 = hx + HW + OB[0] * HD + 3.5 * bh;   // the rock's span

  // the steps: short treads cut in the rock from the saddle up to the lip, each a pale top over a dark edge, with
  // the rock's broken edge running up beside them
  const s0: Pt = [X(0.816), pathY(X(0.816)) + 0.6 * bg], s1: Pt = [lx + 0.6 * bh, y0 + 1.8 * bh];
  const nS = Math.max(3, Math.min(6, Math.round((s0[1] - s1[1]) / (4.2 * bg))));
  const Rst = own('steps');
  for (let i = 0; i < nS; i++) {
    const t = (i + 0.5) / nS;
    const px = mix(s0[0], s1[0], t) + (Rst() - 0.5) * 0.8 * bg, py = mix(s0[1], s1[1], t);
    const a = px - 2.0 * bg, b = px + (2.0 + Rst() * 0.7) * bg;
    wash(ctx, [[a, py], [b, py - 0.2 * bg], [b - 0.3 * bg, py - 1.3 * bg], [a + 0.3 * bg, py - 1.2 * bg]], rgba(C.white, 0.8), { jit: 0.2 * bg, seed: i + 40 });
    stroke(ctx, [[a, py], [b, py - 0.2 * bg]], { w: 0.85 * bg, col: rgba(C.ink, 0.5 + Rst() * 0.2), tin: 0.15, tout: 0.3, dry: 0.15, seed: i + 7 });
    stroke(ctx, [[a, py], [a - 0.2 * bg, py + 2.4 * bg]], { w: 0.5 * bg, col: rgba(C.ink, 0.28), tin: 0, tout: 0.7, seed: i + 9 });
  }
  const side: Pt[] = [[s0[0] + 2.6 * bg, s0[1] + 0.8 * bg], [mix(s0[0], s1[0], 0.5) + 3 * bg, mix(s0[1], s1[1], 0.5) + 0.4 * bg], [s1[0] + 2.8 * bg, s1[1]]];
  stroke(ctx, side, { w: 0.7 * bg, col: rgba(C.ink, 0.32), tin: 0.2, tout: 0.3, wob: 0.6, dry: 0.45, seed: 49 });
  yield;

  // ---- small trees where the path comes out of the mist
  dotTree(env, X(0.736), crestY(X(0.736)) + 2.2 * bg, 0.6 * bt, own('path tree', 1), { clusters: 5 });
  dotTree(env, X(0.749), crestY(X(0.749)) + 2.8 * bg, 0.44 * bt, own('path tree', 2), { green: true });
  yield;

  // ---- the ledge: rock, not a shelf. A pale top (the hut's floor and a little yard), a dark broken lip, the face
  // below in a grey wash with axe-cut texture strokes, moss dots on the lip, mist swallowing its foot
  const Rr = own('rock');
  // the lip wanders (a broken rock edge, never a plank) and dips where a block has fallen from it
  const lipY = (x: number) => { const t = (x - rx0) / (rx1 - rx0); return mix(y0 + 2.2 * bh, y0 + 1.3 * bh, t) + (vnoise(x * 0.16 / bh, 2.3, 31) - 0.5) * 2 * bh + Math.exp(-((t - 0.55) ** 2) / 0.006) * 1.2 * bh; };
  const lip: Pt[] = [];
  for (let i = 0; i <= 20; i++) { const x = mix(rx0, rx1, i / 20); lip.push([x, lipY(x)]); }
  // the top, reserved (it hides the slope behind: the hut stands in front of the crag); its back edge is the crag's foot
  wash(ctx, [...lip, [rx1 - 1.5 * bh, y0 - 1.2 * bh], [mix(rx0, rx1, 0.62), y0 - 3.2 * bh], [hx - 0.5 * bh, y0 - 2.4 * bh], [rx0 + 1.5 * bh, y0 - 0.4 * bh]], rgba(mix3(C.paper, C.ink2, 0.08), 0.92), { jit: 0.4 * bh, seed: 51 });
  // the face: darkest under the lip, thinning downward
  const face: Pt[] = [...lip, [rx1 - 1.5 * bh, y0 + 8 * bh], [mix(rx0, rx1, 0.6), y0 + 12.5 * bh], [mix(rx0, rx1, 0.25), y0 + 11 * bh], [rx0 - 0.5 * bh, y0 + 6.5 * bh]];
  softWash(env, face, rgba(mix3(C.ink2, C.indigo, 0.35), 0.17), 1.2 * bh);
  softWash(env, [...lip, ...lip.slice().reverse().map(([x, y], i): Pt => [x - 0.6 * bh, y + (3 + 1.4 * Math.sin(i * 0.9)) * bh])], rgba(mix3(C.ink2, C.indigo, 0.3), 0.14), 0.6 * bh);
  // the face in facets: two creases running down to the left from the lip, each with a few axe-cut strokes beside it
  // (broad, slanting, dry, fading downward), as the Song painters cut their rock
  for (const f of [0.34, 0.72]) {
    const x = mix(rx0, rx1, f + (Rr() - 0.5) * 0.08), y = lipY(x) + 0.5 * bh;
    const crease: Pt[] = [[x, y], [x - 2.2 * bh, y + (5 + Rr() * 1.5) * bh], [x - 3.2 * bh, y + (9 + Rr() * 2) * bh]];
    stroke(ctx, crease, { w: 0.85 * bh, col: rgba(C.ink, 0.42), tin: 0.05, tout: 0.7, wob: 0.6, dry: 0.4, seed: 60 + f * 10 });
    for (let k = 0; k < 3; k++) {
      const o = (1.1 + k * 1.3 + Rr() * 0.5) * bh, len = (2.4 + Rr() * 2.2) * bh, dy = (0.6 + k * 0.9) * bh;
      stroke(ctx, [[x + o, y + dy], [x + o - len * 0.42, y + dy + len]], { w: (1.2 + Rr() * 0.5) * bh, col: rgba(C.ink, 0.17 + Rr() * 0.13), tin: 0.05, tout: 0.9, dry: 0.55, seed: 62 + k + f * 10 });
    }
  }
  stroke(ctx, lip, { w: 1.15 * bh, col: rgba(C.ink, 0.6), tin: 0.08, tout: 0.3, wob: 0.7, dry: 0.3, seed: 70 });
  stroke(ctx, [lip[0], [rx0 - 0.6 * bh, y0 + 4.5 * bh], [rx0 + 0.2 * bh, y0 + 7.5 * bh]], { w: 1.0 * bh, col: rgba(C.ink, 0.45), tin: 0.05, tout: 0.8, dry: 0.35, seed: 71 });
  for (let i = 0; i < 5; i++) {   // moss on the lip
    const x = mix(rx0, rx1, 0.06 + Rr() * 0.88);
    ctx.fillStyle = rgba(mossC, 0.55 + Rr() * 0.3);
    ctx.beginPath(); ctx.ellipse(x, lipY(x) - 0.2 * bh, (0.7 + Rr() * 0.4) * bh, 0.5 * bh, 0, 0, Math.PI * 2); ctx.fill();
  }
  // mist at its foot, over the bottom of the face and the lowest steps (the plane's own mist band continues it)
  const mist: Pt[] = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; mist.push([mix(rx0 - 8 * bh, rx1 + 3 * bh, t), y0 + (7.5 - 1.5 * t + 2.2 * Math.sin(t * 9 + 1)) * bh]); }
  for (let i = 8; i >= 0; i--) { const t = i / 8; mist.push([mix(rx0 - 10 * bh, rx1 + 1 * bh, t), y0 + (17 + 3 * Math.sin(t * 7)) * bh]); }
  softWash(env, mist, rgba(C.mist, 0.3), 6 * bh);
  softWash(env, mist.map(([x, y], i): Pt => [x + (i < 9 ? 2 : -2) * bh, y + (i < 9 ? 2 : -3) * bh]), rgba(C.mist, 0.3), 3 * bh);   // denser at its heart
  yield;

  // ---- behind the hut: a leafy tree on the crag, its crown showing over the roof's far end
  dotTree(env, hx + HW * 0.8, y0 - 6 * bh, 0.62 * bt, own('crag tree'), { green: true, clusters: 4 });
  // ---- the hut, a fence before it, and the pine that leans over its roof (drawn after: it overlaps the eave)
  const hut = thatchedHut(env, hx, y0, bh, own('hut'));
  // the fence: a short run before the closed end of the hut, and one going back into depth past its far corner
  fence(env, hx - 1.6 * bh, hx + 0.34 * HW, (x) => y0 + 1.0 * bh + (x - hx) * 0.02, bh, own('fence', 1));
  const fx = hx + HW + 1.4 * bh;
  fence(env, fx, fx + OB[0] * 6 * bh, (x) => y0 + 0.9 * bh + (x - fx) * (OB[1] / OB[0]), bh, own('fence', 2));
  pineOver(env, hx - 0.6 * bh, y0 + 1.1 * bh, 0.78 * bt, 4.2, own('hut pine'));
  // life: a thread of smoke from the ridge's far end, rising and leaning a little downwind
  const src: Pt = [mix(hut.rL[0], hut.rR[0], 0.72), hut.rL[1] - 0.5 * bh];
  anchor(env, 'smoke', { x: src[0] - 9 * bh, y: src[1] - 36 * bh, w: 24 * bh, h: 36 * bh }, { src });
  yield;

  // ---- on the knoll above him, a leafy tree; then the traveller, walking up toward it, the steps and the hut
  if (big < 2.2) dotTree(env, X(0.803), crestY(X(0.803)) + 2.4 * bg, 0.66 * bt, own('knoll tree'), { clusters: 5 });   // not on phones: no room
  traveller(env, tx, ts, pathY, own('traveller'));
  yield;

  // ---- the fall in the cleft between the near crag's summits: where the river begins
  waterfall(env, X(0.942), crestY, 1 + (big - 1) * 0.7, own('fall'));
  yield;
}

/**
 * A thin fall in a cleft of the crag (round 5: the source of the one river), as the painters leave one: unpainted paper
 * framed by dark rock. Out of the notch at x (a world px column) it drops in three short tiers that step down and aside
 * the cleft, each ribbon uneven and broken where a rock lip crosses it, the lips dark against it; its foot is lost in a
 * bank of mist (the river comes out of the mist, beyond the crag). s: scale (phones draw it larger).
 */
function waterfall(env: Env, x: number, crestY: (x: number) => number, s: number, R: Rng) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  let y = crestY(x) + 14 * s;                                    // under the notch: the fall comes out of the cleft
  let cx = x;
  const tiers: [len: number, w: number, dx: number][] = [[30, 1.7, -2.5], [42, 2.3, 3], [34, 2.8, -1.5]];
  tiers.forEach(([len, w, dx], i) => {
    const n = 8, pts: Pt[] = [];
    for (let j = 0; j <= n; j++) {
      const t = j / n;
      pts.push([cx + (vnoise(t * 2.2 + i, 7.1, 91) - 0.5) * 1.4 * s + t * 0.8 * s, y + t * len * s]);
    }
    // the rock on each side first (a wash of the crag's ink, darker on the shaded right), then the paper left for the
    // water over it: so the fall sits IN the rock, not on it
    const side = (k: number) => pts.map(([px, py]): Pt => [px + k * (w * 0.5 + 1.6) * s, py]);
    stroke(ctx, side(-1), { w: 1.6 * s, col: rgba(mix3(C.ink, C.indigo, 0.4), 0.28), tin: 0.3, tout: 0.3, wob: 0.7, dry: 0.35, seed: 31 + i });
    stroke(ctx, side(1), { w: 2.2 * s, col: rgba(mix3(C.ink, C.indigo, 0.4), 0.4), tin: 0.25, tout: 0.3, wob: 0.7, dry: 0.3, seed: 41 + i });
    // the lip it falls from: a boss of dark rock at one side of the cleft (the water runs on in front of it)
    if (i > 0) {
      const k = dx > 0 ? -1 : 1, [px, py] = pts[0];
      stroke(ctx, [[px + k * (w * 0.4) * s, py - 1.5 * s], [px + k * (w * 0.5 + 4.5) * s, py + 0.5 * s], [px + k * (w * 0.5 + 5.5) * s, py + 3 * s]], { w: 1.4 * s, col: rgba(C.ink, 0.45), tin: 0.1, tout: 0.5, wob: 0.5, dry: 0.3, seed: 71 + i });
    }
    // the water: one ribbon, uneven, paler as it falls into the mist (never a ruled line)
    stroke(ctx, pts, { w: w * s, col: rgba(C.white, 0.8 - i * 0.14), tin: 0.3, tout: 0.25, wob: 0.6, seed: 51 + i });
    // a faint streak of falling water in it
    stroke(ctx, pts.slice(1, -1).map(([px, py]): Pt => [px + (R() - 0.5) * w * 0.4 * s, py]), { w: 0.3 * s, col: rgba(C.indigoP, 0.28), tin: 0.3, tout: 0.5, dry: 0.4, seed: 61 + i });
    // a breath of spray where it lands on the next lip
    const end = pts[pts.length - 1];
    if (i < tiers.length - 1) softWash(env, ellipse(end[0] + dx * 0.4 * s, end[1] + 1.5 * s, 3.5 * s, 1.4 * s, 12), rgba(C.white, 0.4), 1.2 * s);
    cx = end[0] + dx * s;
    y = end[1] + 1.5 * s;
  });
  // its foot in the mist: the fall thins away into a long, low bank of it (laid over its last tier)
  softWash(env, ellipse(cx + 4 * s, y - 6 * s, 30 * s, 6 * s, 18), rgba(C.mist, 0.36), 8 * s);
  softWash(env, ellipse(cx + 14 * s, y + 3 * s, 52 * s, 8 * s, 18), rgba(C.mist, 0.32), 12 * s);
}

/**
 * The traveller, walking up a path to the right: a broad shallow hat, sloped shoulders, a white robe flaring at the
 * hem (the back corner trailing, the front lifted by the stride), a wide sleeve to the hand on the staff, the staff
 * planted ahead, a bundle on his back. x = between his feet, s = scale (he is about 10.4 s tall to the hat's crown),
 * G(x) = the ground's y. Only the shade side (his back, the hem) gets a dark contour, broken.
 */
function traveller(env: Env, x: number, s: number, G: (x: number) => number, R: Rng) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const fb: Pt = [x - 0.95 * s, G(x - 0.95 * s)], ff: Pt = [x + 1.05 * s, G(x + 1.05 * s)];
  const by = (fb[1] + ff[1]) / 2;
  const lean = 0.13;                    // into the climb: each unit up moves him this far forward
  const j = () => (R() - 0.5) * 0.16;   // a little seeded unevenness: the brush never repeats a figure exactly
  const p = (dx: number, dy: number): Pt => [x + (dx + lean * dy + j()) * s, by - (dy + j()) * s];
  // his shadow on the path
  softWash(env, ellipse(x + 0.5 * s, by + 0.25 * s, 3.2 * s, 0.5 * s, 12), rgba(C.ink, 0.13), 0.3 * s);
  // the bundle on his back (drawn first: the robe covers its front half)
  const bc = p(-1.05, 5.5);
  const bun = ellipse(0, 0, 1.15 * s, 1.45 * s, 12).map(([u, v]): Pt => { const a = -0.35; return [bc[0] + u * Math.cos(a) - v * Math.sin(a), bc[1] + u * Math.sin(a) + v * Math.cos(a)]; });
  wash(ctx, bun, rgba(mix3(C.indigo, C.ink, 0.3), 0.9), { jit: 0.12 * s, seed: 81 });
  stroke(ctx, [p(-2.05, 5.0), p(-1.75, 6.35), p(-0.8, 6.95)], { w: 0.3 * s, col: rgba(C.ink, 0.7), tin: 0.1, tout: 0.3, seed: 82 });
  // the shoes under the hem (the robe falls to the ankles): the back one pushing off, the front one stepping up
  stroke(ctx, [[fb[0] - 0.7 * s, fb[1] + 0.05 * s], [fb[0] + 0.35 * s, fb[1] - 0.25 * s]], { w: 0.5 * s, col: rgba(C.ink, 0.85), tin: 0, tout: 0.3, seed: 85 });
  stroke(ctx, [[ff[0] - 0.35 * s, ff[1]], [ff[0] + 0.75 * s, ff[1] - 0.25 * s]], { w: 0.5 * s, col: rgba(C.ink, 0.85), tin: 0, tout: 0.3, seed: 86 });
  // the robe: sloped shoulders, a long back falling to a hem that flares and trails, the front lifted by the stride
  const BS = p(-0.2, 6.65), FS = p(1.85, 6.75), N = p(0.85, 7.4);
  const back: Pt[] = [BS, p(-0.5, 5.1), p(-0.8, 3.0), p(-1.3, 1.2), [x - 2.1 * s, fb[1] - 0.2 * s]];
  const hem: Pt[] = [back[4], p(-1.0, 0.4), p(0.2, 0.35), p(1.4, 0.7), [x + 2.4 * s, ff[1] - 0.55 * s]];
  const front = [hem[4], p(1.95, 2.9), p(1.95, 4.6), p(2.0, 5.9), FS];
  const top = [FS, p(1.35, 7.2), N, p(0.25, 7.1), BS];
  wash(ctx, [...back, ...hem.slice(1), ...front.slice(1), ...top.slice(1, -1)], rgba(C.white, 0.97), { jit: 0.1 * s, seed: 87 });
  // the robe's shade (its back half), very light
  wash(ctx, [BS, ...back.slice(1), p(-0.4, 0.75), p(0.35, 3.0), p(0.5, 5.5), p(0.3, 7.0)], rgba(mix3(C.indigoP, C.ink2, 0.3), 0.2), { jit: 0.1 * s, seed: 88 });
  // the sleeve: from the near shoulder forward to the hand on the staff, hanging below the forearm
  const H = p(3.1, 5.45);
  const sleeve = [p(1.4, 6.8), p(2.6, 6.2), H, p(2.95, 4.6), p(2.3, 3.95), p(1.6, 4.45)];
  wash(ctx, sleeve, rgba(C.white, 0.97), { jit: 0.08 * s, seed: 89 });
  // the contour, on the shade side only, broken; the lit side barely touched
  stroke(ctx, back.slice(0, 3), { w: 0.48 * s, col: rgba(C.ink, 0.8), tin: 0.1, tout: 0.2, wob: 0.5, dry: 0.15, seed: 90 });   // strong at the back
  stroke(ctx, back.slice(2), { w: 0.32 * s, col: rgba(C.ink, 0.38), tin: 0.1, tout: 0.5, wob: 0.5, dry: 0.5, seed: 89 });       // lighter as it flares
  stroke(ctx, hem, { w: 0.36 * s, col: rgba(C.ink, 0.55), tin: 0.15, tout: 0.3, wob: 0.5, dry: 0.4, seed: 91 });
  stroke(ctx, front, { w: 0.28 * s, col: rgba(C.ink, 0.36), tin: 0.2, tout: 0.3, dry: 0.5, seed: 92 });
  stroke(ctx, [FS, p(1.35, 7.2), N], { w: 0.28 * s, col: rgba(C.ink, 0.42), tin: 0.1, tout: 0.3, seed: 93 });
  stroke(ctx, sleeve.slice(2), { w: 0.38 * s, col: rgba(C.ink, 0.62), tin: 0.05, tout: 0.35, dry: 0.2, seed: 94 });
  stroke(ctx, sleeve.slice(0, 3), { w: 0.26 * s, col: rgba(C.ink, 0.38), tin: 0.1, tout: 0.2, dry: 0.3, seed: 95 });
  stroke(ctx, [p(0.6, 4.3), p(-0.1, 2.4), p(-0.9, 0.9)], { w: 0.24 * s, col: rgba(C.ink, 0.28), tin: 0.2, tout: 0.5, dry: 0.4, seed: 96 });   // a fold
  stroke(ctx, [p(-0.55, 4.5), p(1.95, 4.7)], { w: 0.34 * s, col: rgba(C.ink2, 0.55), tin: 0.1, tout: 0.2, seed: 97 });                     // the sash
  stroke(ctx, [p(-0.15, 6.8), p(0.85, 6.0), p(1.8, 5.5)], { w: 0.22 * s, col: rgba(C.ink, 0.42), tin: 0.1, tout: 0.4, seed: 98 });          // the strap
  // the staff, planted a little ahead on the rising path (its foot forward of its top), held at chest height, as
  // long as he is to the shoulder whatever the slope; drawn before the hat, which may cover its top
  const kx = H[0] + 1.2 * s;
  const K: Pt = [kx, G(kx) + 0.15 * s];
  const dl = Math.hypot(H[0] - K[0], H[1] - K[1]) || 1;
  const T: Pt = [K[0] + (H[0] - K[0]) / dl * 6.8 * s, K[1] + (H[1] - K[1]) / dl * 6.8 * s];
  stroke(ctx, [T, [mix(T[0], K[0], 0.5) + 0.1 * s, mix(T[1], K[1], 0.5)], K], { w: 0.36 * s, col: rgba(C.ink, 0.9), tin: 0.05, tout: 0.1, wob: 0.2, seed: 99 });
  ctx.fillStyle = rgba(mix3(C.white, C.ink2, 0.3), 0.95);
  ctx.beginPath(); ctx.arc(H[0], H[1], 0.36 * s, 0, Math.PI * 2); ctx.fill();
  // the head under the hat: the back of the head dark, a sliver of face toward the climb
  const hc = p(1.05, 8.1);
  ctx.fillStyle = rgba(mix3(C.white, C.ink2, 0.15), 0.96);
  ctx.beginPath(); ctx.arc(hc[0], hc[1], 0.72 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = rgba(C.ink, 0.85);
  ctx.beginPath(); ctx.arc(hc[0] - 0.25 * s, hc[1] - 0.05 * s, 0.6 * s, Math.PI * 0.5, Math.PI * 1.6); ctx.fill();
  // the hat: broad and shallow, tipped forward, its brim's underside the darkest line of the figure
  const BB = p(-1.35, 8.95), BF = p(3.5, 8.35), crown = p(0.95, 10.1);
  wash(ctx, [BB, p(-0.2, 9.5), crown, p(2.3, 9.3), BF, p(1.05, 8.45)], rgba(mix3(C.ink2, C.white, 0.2), 0.94), { jit: 0.08 * s, seed: 100 });
  stroke(ctx, [BB, p(1.05, 8.45), BF], { w: 0.5 * s, col: rgba(C.ink, 0.9), tin: 0.1, tout: 0.2, wob: 0.3, seed: 101 });
  stroke(ctx, [BB, p(-0.2, 9.5), crown, p(2.3, 9.3), BF], { w: 0.26 * s, col: rgba(C.ink, 0.5), tin: 0.1, tout: 0.1, dry: 0.3, seed: 102 });
}

/**
 * A thatched mountain hut in the Song oblique: an open front (the dark room seen between the posts) beside a short
 * wall with a small window, a shaded side wall, and a heavy thatch roof that hangs low, with rounded hips, streaks
 * of straw, a ragged eave and a bundled ridge (no lifted corners: those belong to tile). (x, y) = front-left foot,
 * b = scale. Returns { rL, rR } (the ridge's ends).
 */
function thatchedHut(env: Env, x: number, y: number, b: number, R: Rng) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const w = 19 * b, h = 7.8 * b, d = 8.5 * b, rh = 7.6 * b, ov = 3 * b;   // HW, HD in draw()
  const ox = OB[0] * d, oy = OB[1] * d;
  const ey = y - h + 0.9 * b;                          // the thatch hangs below the wall's top
  const rL: Pt = [x + w * (0.2 + R() * 0.04) + ox * 0.5, y - h - rh + oy * 0.5];
  const rR: Pt = [x + w * (0.8 - R() * 0.04) + ox * 0.5, rL[1] + (R() - 0.5) * 0.4 * b];
  const eave: Pt[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    eave.push([x - ov + (w + 2 * ov) * t, ey + Math.sin(Math.PI * t) * 0.5 * b + (R() - 0.5) * 0.35 * b]);
  }
  const eL = eave[0], eF = eave[10], eB: Pt = [x + w + ov + ox, ey + oy + 0.3 * b];
  const bulge = (a: Pt, c: Pt, k: number): Pt => [mix(a[0], c[0], 0.5) + k * b, mix(a[1], c[1], 0.5) - Math.abs(k) * 0.5 * b];
  const hipL = bulge(eL, rL, -0.9), hipR = bulge(eF, rR, 0.7), hipB = bulge(eB, rR, 0.6);
  // the paper reserve: the hut hides the crag behind it
  wash(ctx, [[x, y + 0.5], [x + w, y + 0.5], [x + w + ox, y + oy + 0.5], [x + w + ox, ey + oy], eB, hipB, rR, rL, hipL, eL, [x, ey]], rgba(C.paper, 1), { jit: 0.15 * b, seed: 110 });
  // walls: the side in shade, the front pale, the open part dark (darkest under the eave)
  wash(ctx, [[x + w, y], [x + w + ox, y + oy], [x + w + ox, y + oy - h], [x + w, y - h]], rgba(mix3(C.wall, C.ink2, 0.34), 0.95), { jit: 0.2 * b, seed: 111 });
  wash(ctx, [[x, y], [x + w, y], [x + w, y - h], [x, y - h]], rgba(mix3(C.wall, C.ink2, 0.08), 0.97), { jit: 0.2 * b, seed: 112 });
  const o0 = x + w * (0.36 + R() * 0.04), o1 = x + w * 0.95;
  wash(ctx, [[o0, y - 0.2 * b], [o1, y - 0.2 * b], [o1, y - h], [o0, y - h]], rgba(mix3(C.ink2, C.wall, 0.28), 0.74), { jit: 0.25 * b, seed: 113 });
  wash(ctx, [[o0, y - h * 0.5], [o1, y - h * 0.55], [o1, y - h], [o0, y - h]], rgba(C.ink2, 0.3), { jit: 0.25 * b, seed: 114 });
  // the small window in the short wall, a lattice of two bars
  const wx0 = x + w * 0.1, wx1 = x + w * 0.25, wy0 = y - h * 0.38, wy1 = y - h * 0.72;
  wash(ctx, [[wx0, wy0], [wx1, wy0], [wx1, wy1], [wx0, wy1]], rgba(mix3(C.ink2, C.wall, 0.45), 0.6), { jit: 0.15 * b, seed: 115 });
  stroke(ctx, [[mix(wx0, wx1, 0.5), wy0], [mix(wx0, wx1, 0.5), wy1]], { w: 0.3 * b, col: rgba(C.wall, 0.8), tin: 0, tout: 0 });
  // posts (timber, nearly ink), the sill, the side's far edge
  for (const px of [x, o0, x + w]) stroke(ctx, [[px, y + 0.3], [px + (R() - 0.5) * 0.3 * b, y - h + 0.4 * b]], { w: 0.62 * b, col: rgba(mix3(C.timber, C.ink, 0.55), 0.8), tin: 0, tout: 0.1, wob: 0.3, seed: px });
  stroke(ctx, [[x - 0.6 * b, y + 0.35], [x + w + 0.3 * b, y + 0.25], [x + w + ox, y + oy + 0.25]], { w: 0.8 * b, col: rgba(C.ink, 0.5), tin: 0.05, tout: 0.15, dry: 0.25, seed: 116 });
  stroke(ctx, [[x + w + ox, y + oy], [x + w + ox, y + oy - h + 0.6 * b]], { w: 0.5 * b, col: rgba(C.ink, 0.42), tin: 0, tout: 0.2, seed: 117 });
  // the thatch: grey straw, barely brown, the hip in shade
  const th = mix3(mix3(C.timberM, C.tile, 0.55), C.ink2, 0.25);
  wash(ctx, [eF, eB, hipB, rR, hipR], rgba(mix3(th, C.ink, 0.32), 0.9), { jit: 0.25 * b, seed: 119 });
  const slope = [...eave, hipR, rR, rL, hipL];
  wash(ctx, slope, rgba(th, 0.86), { jit: 0.25 * b, seed: 120 });
  // straw: streaks from the ridge down to the eave, clipped to the slope
  ctx.save();
  ctx.beginPath(); ctx.moveTo(slope[0][0], slope[0][1]); for (const q of slope) ctx.lineTo(q[0], q[1]); ctx.closePath(); ctx.clip();
  const n = 6 + Math.round(w / (2.2 * b));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const top: Pt = [mix(rL[0] - 2 * b, rR[0] + 2 * b, t), rL[1] - 0.5 * b];
    const bot: Pt = [mix(eL[0], eF[0], t) + (R() - 0.5) * 0.6 * b, ey + 1 * b];
    const from = 0.15 + R() * 0.35;
    stroke(ctx, [[mix(top[0], bot[0], from), mix(top[1], bot[1], from)], bot], { w: 0.34 * b, col: rgba(C.ink, 0.16 + R() * 0.16), tin: 0.3, tout: 0.1, dry: 0.35, seed: 130 + i });
  }
  ctx.restore();
  // the roof's lines: a ragged eave (the cut edge of the straw), soft hips, the bundled ridge (the strongest line)
  stroke(ctx, eave, { w: 1.0 * b, col: rgba(C.ink, 0.72), tin: 0.08, tout: 0.1, wob: 0.6, dry: 0.18, seed: 121 });
  for (let i = 1; i < 10; i += 2) stroke(ctx, [eave[i], [eave[i][0] - 0.15 * b, eave[i][1] + (0.6 + R() * 0.5) * b]], { w: 0.4 * b, col: rgba(C.ink, 0.4), tin: 0, tout: 0.6, seed: 140 + i });
  stroke(ctx, [eF, eB], { w: 0.75 * b, col: rgba(C.ink, 0.62), tin: 0.05, tout: 0.2, dry: 0.2, seed: 122 });
  stroke(ctx, [eF, hipR, rR], { w: 0.55 * b, col: rgba(C.ink, 0.5), tin: 0.1, tout: 0.15, dry: 0.25, seed: 123 });
  stroke(ctx, [eL, hipL, rL], { w: 0.5 * b, col: rgba(C.ink, 0.42), tin: 0.1, tout: 0.15, dry: 0.3, seed: 124 });
  stroke(ctx, [[rL[0] - 0.9 * b, rL[1] + 0.35 * b], rL, rR, [rR[0] + 0.9 * b, rR[1] + 0.3 * b]], { w: 1.35 * b, col: rgba(C.ink, 0.86), tin: 0.12, tout: 0.12, wob: 0.35, seed: 125 });
  ctx.fillStyle = rgba(C.ink, 0.8);
  for (const e of [rL, rR]) { ctx.beginPath(); ctx.ellipse(e[0], e[1] - 0.1 * b, 0.75 * b, 0.6 * b, 0, 0, Math.PI * 2); ctx.fill(); }
  return { rL, rR };
}

/** A low brushwood fence from x0 to x1 along y(x): uneven posts, two broken rails, a few crossed sticks. */
function fence(env: Env, x0: number, x1: number, yAt: (x: number) => number, b: number, R: Rng) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const posts: [x: number, y: number, tx: number, ty: number][] = [];
  for (let x = x0; x <= x1; x += (2.3 + R() * 1.1) * b) {
    const y = yAt(x), hgt = (2.5 + R() * 0.8) * b, lean = (R() - 0.5) * 0.5 * b;
    posts.push([x, y, x + lean, y - hgt]);
    stroke(ctx, [[x, y + 0.2 * b], [x + lean, y - hgt]], { w: 0.45 * b, col: rgba(C.ink, 0.55 + R() * 0.2), tin: 0, tout: 0.15, seed: x });
  }
  if (posts.length < 2) return;
  for (const f of [0.78, 0.38]) {
    const rail = posts.map(([x, y, tx, ty]): Pt => [mix(x, tx, f), mix(y, ty, f)]);
    stroke(ctx, rail, { w: 0.36 * b, col: rgba(C.ink, f > 0.5 ? 0.55 : 0.38), tin: 0.05, tout: 0.1, wob: 0.4, dry: 0.3, seed: f * 100 + x0 });
  }
  for (let i = 0; i + 1 < posts.length; i++) {
    if (R() < 0.5) continue;
    const [ax, ay, atx, aty] = posts[i], [bx, by, btx, bty] = posts[i + 1];
    stroke(ctx, [[mix(ax, atx, 0.15), mix(ay, aty, 0.15)], [mix(bx, btx, 0.85), mix(by, bty, 0.85)]], { w: 0.28 * b, col: rgba(C.ink, 0.35), tin: 0, tout: 0.2, seed: i + 150 });
  }
}

/**
 * A pine leaning a known way (figures.ts pine() picks its lean at random; this one must lean over the hut): a
 * crooked trunk and flat needle tiers, wider on the side it leans to. (x, y) = the foot; lean in units of s.
 */
function pineOver(env: Env, x: number, y: number, s: number, lean: number, R: Rng) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const H = 24 * s;
  const L = lean * s;
  const at = (t: number): Pt => [x + L * Math.pow(t, 1.6) + Math.sin(t * 7) * 0.5 * s, y - H * t];
  stroke(ctx, [[x, y + 0.5], at(0.3), at(0.55), at(0.8), at(1)], { w: 1.6 * s, col: rgba(C.ink, 0.9), tin: 0, tout: 0.5, wob: 0.45, seed: x * 3 });
  stroke(ctx, [at(0.55), [at(0.55)[0] + 4.5 * s, at(0.55)[1] - 1.2 * s]], { w: 0.8 * s, col: rgba(C.ink, 0.8), tin: 0, tout: 0.6, seed: x * 3 + 1 });   // a bough reaching out
  const needle = ink.strength > 0 ? mix3(C.ink, C.malD, 0.22) : C.ink;
  for (let i = 0; i < 5; i++) {
    const t = 0.48 + i * 0.12;
    const [bx, by] = at(Math.min(1, t));
    const wl = (5 - i * 0.8) * s, wr = (7.5 - i * 1.1) * s;   // wider toward the lean
    for (let k = 0; k < 8; k++) {
      const px = bx - wl + R() * (wl + wr), py = by + (R() - 0.5) * 1.5 * s;
      stroke(ctx, [[px - 1.6 * s, py + 0.5 * s], [px, py - 0.7 * s], [px + 1.6 * s, py + 0.5 * s]], { w: 0.75 * s, col: rgba(needle, 0.4 + R() * 0.35), tin: 0.1, tout: 0.4, seed: k + i * 11 });
    }
  }
}

/** The runs of a polyline where keep(x) holds (two or more points each). */
function gated(pts: Pt[], keep: (x: number) => boolean) {
  const out: Pt[][] = [];
  let cur: Pt[] = [];
  for (const q of pts) {
    if (keep(q[0])) cur.push(q);
    else { if (cur.length > 1) out.push(cur); cur = []; }
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

// PINS: seed data. In 4a each element's place in the set's single stream was pinned here; every element of this scene
// has since been repainted, so none is pinned and each draws from stream(SEED, ...key).
const PINS: Record<string, number> = {};
