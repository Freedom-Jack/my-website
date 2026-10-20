// sets/pavilion.ts — Writing and the Note (stretch 2): the still lake. One corner, in the manner of Ma Yuan and Xia
// Gui: at the lower right a low rocky spit runs out from the shore (lost in mist) into the still water; on it an
// open pavilion, four posts under one low pyramidal roof whose eave corners lift only a little (Song restraint: one
// storey, one eave, never tiered); inside it one scholar in a plain white robe sits looking out over the water to
// the far peak; a pine grows from the rock behind and leans out over the roof and the water. Everything else is
// empty water and mist. The pavilion, the rocks and the pine stand faint and broken in the water below (the scene
// shader mirrors only the far shore: the reflection is drawn here). Ink only: ink greys on every palette.
// Life: the faintest shimmer in the reflection.
//
// A figure set (figures.ts, THE SET API; guide: README "Figure sets and small life"): meta + draw(env), in world
// px. Painted after plane 2's mist band and the water (phase 1), so the lake lies under the spit.
//
// Where: the spit's waterline at scene height 0.214, in open water in front of the far shore (its waterline is
// 0.284 on Writing, 0.259 on the Note, whose layer is drawn for its own composition; open water either way, so
// the spit sits on the lake on both pages, 0.025 scene heights nearer the far shore's reflection on the Note).
// The pavilion at K + 0.925: right of the far peak's reflection at every width, clear of the text on wide screens
// (keep-out edge K + 0.59 at 1440), and above the strip's "Draft art" note on phones (its guard starts at y 0.19
// there). The spit's tail runs on to K + 1.215, into the layer's melting end, so on wide screens it leaves the frame
// at the right edge.

import { REF_PX, VH_PX, streams, vnoise, mix, mix3, wash, softWash, stroke, dryBrush, runs, ellipse, anchor, bounds, type Env, type FigureMeta, type Pt, type RGB } from '../figures';

/** The set's stretch: every world x below is K + its offset (move the place by changing K). */
const K = 2;
export const meta: FigureMeta = { rect: [K + 0.78, K + 1.22, 0.10, 0.37], plane: 2, phase: 1 };
interface Rock { key: string; top: Pt[]; k: number; P: Pt[] }

const SEED = 31;
const DP: Pt = [0.72, -0.48];   // Song oblique depth (as figures.ts D, which a set may not read at its top level)

export function* draw(env: Env) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const own = streams(SEED, PINS);
  // a phone's album leaf sees the lake from further away: the spit, the pavilion and the pine are drawn larger there
  // (as Home does), so the roof's lifted corners and the seated figure still read at 390
  const b = Math.max(1, 0.7 * REF_PX / env.scale);
  const X = (u: number) => u * REF_PX, Y = (y: number) => (1 - y) * VH_PX;
  const cx = X(K + 0.925), wy = Y(0.214);
  const at = (p: Pt): Pt => [cx + p[0] * b, wy + p[1] * b];     // local (pavilion units) -> world px
  const pts = (list: Pt[]) => list.map(at);
  // ink only: every colour here is an ink grey (the palette's ink and ink2, the paper's whites); a breath of indigo in
  // the shade, which 'ink' turns grey with the rest
  const INK = C.ink, INK2 = C.ink2, PAL = mix3(C.ink2, C.white, 0.62), SHADE = mix3(C.ink2, C.indigo, 0.3);
  const xEnd = X(K + 1.215);                               // the shore the spit leaves from: into the layer's melting end

  // ---- the ground: the spit's tip (a low ledge and a stone), the rock under the pavilion, the taller rock the pine
  // grows from, and the tail running back to the shore, lost in the mist (local units, y up is negative)
  const ROCKS = [
    { key: 'stone', top: [[-56, 0.5], [-55, -0.7], [-53.2, -1.2], [-51.4, -0.6], [-50.4, 0.5]], k: 0.8 },
    { key: 'ledge', top: [[-49, 0.5], [-47.6, -1.4], [-44.5, -2.3], [-42, -1.9], [-39.5, -3.5], [-36.5, -4.2], [-33.5, -3.4], [-32, 0.2]], k: 0.9 },
    { key: 'pavilion rock', top: [[-34, 0.4], [-32.5, -3.4], [-30, -6.2], [-27.4, -7.8], [-24.6, -7.3], [-21.5, -9.8], [-16, -10.5], [-6, -10.7], [4, -10.9], [11.5, -10.7], [15, -11.6]], k: 1 },
    { key: 'pine rock', top: [[11, -10.8], [13.4, -14.6], [16.6, -16.8], [19.4, -16.1], [22.2, -19.4], [26.2, -20.6], [29.4, -19.2], [31.6, -16.6], [34.2, -15.8], [37.2, -12.6], [41, -11.3], [46, -10.4]], k: 0.95 },
  ] as Rock[];
  for (const R of ROCKS) R.P = pts(R.top);
  const tailL: Pt[] = [[44, -10.4], [49, -8.8], [55, -7.4], [64, -5.8], [77, -4.4], [93, -3.1]];
  const tail = pts(tailL);
  for (let x = tail[tail.length - 1][0] + 5, x0 = x; x <= xEnd; x += 5) {   // low rocks, lower as they go, to the shore
    const t = (x - x0) / Math.max(1, xEnd - x0);
    tail.push([x, wy - b * (1.3 + 1.5 * vnoise(x / 34, 1.7, 21) + 1.1 * vnoise(x / 11, 2.3, 22)) * (1 - 0.4 * t)]);
  }
  const shore = (top: Pt[]): Pt[] => [...top, [top[top.length - 1][0], wy + 0.6], [top[0][0], wy + 0.8]];
  const bodyT = shore(tail);
  const A = ROCKS[2].P;

  // ---- the pavilion: a square of four posts on a low stone plinth, seen from the front and its right side
  const w = 26 * b, d = 13 * b, h = 13 * b, ov = 5.2 * b, rh = 9.6 * b, lift = 1.5 * b;
  const o: Pt = [DP[0] * d, DP[1] * d];
  const FL = at([-13, -12.4]), FR: Pt = [FL[0] + w, FL[1]], BR: Pt = [FR[0] + o[0], FR[1] + o[1]], BL: Pt = [FL[0] + o[0], FL[1] + o[1]];
  const ey = FL[1] - h;                                   // the front eave's height
  const apex: Pt = [FL[0] + w / 2 + o[0] / 2, ey + o[1] / 2 - rh];
  const eave: Pt[] = [];                                  // the front eave: a long, gentle line, its ends lifted a little
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const sag = Math.sin(Math.PI * t) * lift * 0.35 - Math.pow(Math.abs(t * 2 - 1), 5) * lift;
    eave.push([FL[0] - ov + (w + 2 * ov) * t, ey + 0.6 * b + sag]);
  }
  const eF = eave[eave.length - 1];
  const side: Pt[] = [];                                  // the right eave, running back into depth
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const sag = Math.sin(Math.PI * t) * lift * 0.3 - Math.pow(Math.abs(t * 2 - 1), 5) * lift * 0.8;
    side.push([eF[0] + (o[0] + ov * 0.25) * t, eF[1] + lift + (o[1] - ov * 0.1) * t + sag]);
  }
  const eB = side[side.length - 1];
  // the scholar sits on the floor near the open water side, toward the front (his head clear of the eave), facing left
  const seat: Pt = [mix(FL[0], BL[0], 0.3) + 3.2 * b, mix(FL[1], BL[1], 0.3) + 0.2 * b];

  // ---- the pine: from the rock behind the pavilion it rises, twists, and leans out over the roof and the water
  const root = at([24, -19]);
  const trunkL: Pt[] = [[0, 0], [-2.2, -6.5], [0.6, -13], [-1.8, -20], [0.2, -24.5], [-6, -30.5], [-12.5, -33.6], [-20.5, -36.8], [-28.5, -36], [-36, -33.4]];
  const trunk = trunkL.map(([x, y]): Pt => [root[0] + x * b, root[1] + y * b]);
  const T = (i: number) => trunk[i];
  const boughs: Pt[][] = [
    [T(3), [T(3)[0] + 5 * b, T(3)[1] - 6 * b], [T(3)[0] + 9.5 * b, T(3)[1] - 7.4 * b]],
    [T(5), [T(5)[0] - 1.5 * b, T(5)[1] - 6 * b], [T(5)[0] - 4.5 * b, T(5)[1] - 9.5 * b]],
    [T(7), [T(7)[0] - 3 * b, T(7)[1] - 4.2 * b], [T(7)[0] - 6 * b, T(7)[1] - 5.6 * b]],
    [T(8), [T(8)[0] - 5 * b, T(8)[1] + 1.2 * b], [T(8)[0] - 9.5 * b, T(8)[1] + 3.6 * b]],
  ];
  // needle masses: flat, layered, darkest in the middle of the tree (centre, half-width, rows)
  const masses: [c: Pt, hw: number, rows: number][] = [
    [boughs[0][2], 8.5, 2], [[T(4)[0] + 1 * b, T(4)[1] - 2.5 * b], 7, 2], [boughs[1][2], 9, 3],
    [[T(6)[0] - 1 * b, T(6)[1] - 2.6 * b], 9.5, 2], [boughs[2][2], 8.5, 2], [boughs[3][2], 8, 2],
  ];

  // ---------------------------------------------------------------- painters (each takes `r`: the reflection pass)
  const paintRocks = (r: boolean) => {
    const fade = ctx.createLinearGradient(tail[0][0], 0, xEnd, 0);   // the tail pales as it goes into the mist
    fade.addColorStop(0, rgba(PAL, r ? 0.5 : 0.62));
    fade.addColorStop(0.35, rgba(PAL, r ? 0.3 : 0.4));
    fade.addColorStop(1, rgba(PAL, r ? 0.1 : 0.16));
    wash(ctx, bodyT, fade, { jit: 0.4 * b, seed: 2 });
    // each rock: a pale body that hides the water behind it, then (not in the water) its faces cut by the axe: a dark
    // wedge under every edge of its top, broad slanting side strokes, a crack or two, a dry broken contour
    for (const R of [...ROCKS].reverse()) {
      // the body: darkest just under the top, paling toward the water, where the mist takes its foot
      const hi = Math.min(...R.P.map((q) => q[1]));
      const body = ctx.createLinearGradient(0, hi, 0, wy);
      body.addColorStop(0, rgba(mix3(INK2, C.white, 0.42), 0.92));
      body.addColorStop(0.55, rgba(mix3(INK2, C.white, 0.6), 0.9));
      body.addColorStop(1, rgba(mix3(INK2, C.white, 0.78), 0.82));
      wash(ctx, shore(R.P), body, { jit: 0.35 * b, seed: R.top.length * 7 });
      if (r) { wash(ctx, shore(R.P), rgba(INK2, 0.22 * R.k), { jit: 0.35 * b, seed: 5 }); continue; }
      const Ra = own('axe', R.key);
      const top = R.P;
      for (let i = 0; i < top.length - 1; i++) {
        const p = top[i], q = top[i + 1];
        const room = wy - Math.max(p[1], q[1]) - 0.6 * b;
        if (room < 1.2 * b) continue;
        const dd = Math.min(room, (2.2 + Ra() * 2.6) * b), sh = (0.8 + Ra() * 1.4) * b;
        wash(ctx, [[p[0], p[1] + 0.2 * b], [q[0], q[1] + 0.2 * b], [q[0] - sh, q[1] + dd * (0.6 + Ra() * 0.4)], [p[0] - sh, p[1] + dd]], rgba(INK2, (0.3 + Ra() * 0.25) * R.k), { jit: 0.4 * b, seed: i * 3 + R.top.length });
        const n = Math.floor(Math.hypot(q[0] - p[0], q[1] - p[1]) / (4 * b));
        for (let j = 0; j < n; j++) {   // broad side strokes, set into the face below the edge and dragged down-left
          const t = (j + 0.2 + Ra() * 0.6) / n;
          const s0: Pt = [mix(p[0], q[0], t), mix(p[1], q[1], t) + (0.9 + Ra() * 0.8) * b];
          const len = Math.min(wy - s0[1] - 0.8 * b, (2.4 + Ra() * 2.4) * b);
          if (len < 1.2 * b) continue;
          const s1: Pt = [s0[0] - len * (0.7 + Ra() * 0.4), s0[1] + len];
          stroke(ctx, [s0, s1], { w: (2 + Ra() * 1) * b, col: rgba(INK2, (0.2 + Ra() * 0.16) * R.k), tin: 0.1, tout: 0.7, wob: 0.6, dry: 0.55, seed: i * 11 + j });
        }
      }
      // cracks: from a few of the top's corners down and to the left, toward the water
      for (let i = 3; i < top.length - 1; i += 3 + Math.floor(Ra() * 3)) {
        const p = top[i];
        const len = (wy - p[1]) * (0.45 + Ra() * 0.3);
        if (len < 3 * b) continue;
        stroke(ctx, [[p[0], p[1] + 0.3 * b], [p[0] - 1.2 * b, p[1] + len * 0.5], [p[0] - 2.6 * b - Ra() * b, p[1] + len]], { w: 0.7 * b, col: rgba(INK, 0.4 * R.k), tin: 0.05, tout: 0.8, dry: 0.35, seed: i + 40 });
      }
      for (const seg of runs(resampled(top, 1.5), Ra, 8 * b, 30 * b, 1.6 * b)) stroke(ctx, seg, { w: 1.25 * b, col: rgba(INK, 0.78 * R.k), tin: 0.08, tout: 0.3, wob: 0.6, dry: 0.25, seed: seg[0][0] });
    }
    if (r) return;
    const Rc = own('contour');
    for (const seg of runs(resampled(tail, 2), Rc, 10 * b, 34 * b, 7 * b)) {
      const t = (seg[0][0] - tail[0][0]) / (xEnd - tail[0][0]);
      stroke(ctx, seg, { w: (1 - 0.3 * t) * b, col: rgba(INK, 0.5 - 0.36 * t), tin: 0.15, tout: 0.5, wob: 0.6, dry: 0.35 + 0.2 * t, seed: seg[0][0] + 2 });
    }
    // moss dots on the rock tops
    const Rm = own('moss');
    for (const top of [A.slice(3), ROCKS[3].P.slice(1, 7)]) {
      for (let i = 0; i < top.length - 1; i++) {
        if (Rm() < 0.45) continue;
        const f = Rm();
        const p: Pt = [mix(top[i][0], top[i + 1][0], f), mix(top[i][1], top[i + 1][1], f) - 0.3 * b];
        ctx.fillStyle = rgba(INK, 0.6 + Rm() * 0.3);
        ctx.beginPath(); ctx.ellipse(p[0], p[1], (0.7 + Rm() * 0.5) * b, 0.45 * b, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    // the feet in the water: a wet, broken line, and mist rising off the water over the lowest stones
    const foot = [at([-54, 0.6]), at([-30, 0.9]), at([0, 0.7]), at([30, 0.8]), at([55, 0.6])];
    for (const seg of runs(resampled(foot, 2), Rc, 8 * b, 26 * b, 5 * b)) stroke(ctx, seg, { w: 0.8 * b, col: rgba(INK, 0.4), tin: 0.2, tout: 0.4, wob: 0.5, dry: 0.2, seed: seg[0][0] + 3 });
    softWash(env, [at([-56, 1.2]), at([-40, -1.0]), at([-10, -1.6]), at([20, -1.4]), at([44, -2]), at([60, 1.4]), at([20, 2.2]), at([-30, 2.4])], rgba(C.mist, 0.5), 1.6 * b);
  };

  const paintPavilion = (r: boolean) => {
    // the plinth: a low stone base; its top, the floor, a pale stone grey (never a white box: the pavilion is open,
    // and through its posts we see the rock and the water behind it)
    const ph = 2.4 * b;
    wash(ctx, [FL, FR, BR, BL], rgba(mix3(PAL, C.white, 0.35), r ? 0.5 : 0.8), { jit: 0.2 * b, seed: 21 });
    wash(ctx, [FL, FR, [FR[0], FR[1] + ph], [FL[0], FL[1] + ph]], rgba(mix3(INK2, C.white, 0.5), r ? 0.7 : 0.88), { jit: 0.25 * b, seed: 22 });
    wash(ctx, [FR, BR, [BR[0], BR[1] + ph], [FR[0], FR[1] + ph]], rgba(mix3(INK2, C.white, 0.3), r ? 0.7 : 0.92), { jit: 0.25 * b, seed: 23 });
    if (!r) {
      stroke(ctx, [[FL[0] - 0.4 * b, FL[1]], FR, BR], { w: 0.7 * b, col: rgba(INK, 0.6), tin: 0.05, tout: 0.15, dry: 0.2, seed: 24 });
      stroke(ctx, [[FL[0], FL[1] + ph], [FR[0], FR[1] + ph + 0.2 * b], [BR[0], BR[1] + ph]], { w: 0.65 * b, col: rgba(INK, 0.5), tin: 0.05, tout: 0.2, dry: 0.3, seed: 25 });
      // the shade under the roof: dark just under the eaves, thinning toward the floor; the lower half stays open
      const shadeTop = (t: number): Pt[] => [[FL[0] + t * o[0], ey + t * o[1] + 0.8 * b], [FR[0] + t * o[0] + 0.5 * b, ey + t * o[1] + 0.8 * b]];
      softWash(env, [...shadeTop(0.9), [BR[0] + 0.5 * b, BR[1] - h * 0.45], [FL[0], FL[1] - h * 0.55]], rgba(SHADE, 0.3), 1.0 * b);
      softWash(env, [...shadeTop(1), [BR[0], BR[1] - 0.6 * b], [FR[0], FR[1] - 0.6 * b], [FL[0], FL[1] - 0.6 * b]], rgba(SHADE, 0.16), 1.0 * b);
    }
    // posts: the back two through the open sides, thinner and paler; a low rail along the back and the right side
    const post = (p: Pt, k: number, s: number) => stroke(ctx, [[p[0], p[1] + 0.3 * b], [p[0] + 0.12 * b, p[1] - h]], { w: 1.15 * b * k, col: rgba(INK, (r ? 0.75 : 0.92) * k), tin: 0, tout: 0.08, wob: 0.15, seed: s });
    post(BL, 0.62, 31); post(BR, 0.7, 32);
    if (!r) {
      const rail = 3.4 * b;
      stroke(ctx, [[BL[0], BL[1] - rail], [BR[0], BR[1] - rail]], { w: 0.6 * b, col: rgba(INK, 0.55), tin: 0.05, tout: 0.1, dry: 0.15, seed: 33 });
      scholar(env, seat[0], seat[1], 1.12 * b, INK, PAL);
      stroke(ctx, [[FR[0], FR[1] - rail], [BR[0], BR[1] - rail]], { w: 0.7 * b, col: rgba(INK, 0.65), tin: 0.05, tout: 0.1, seed: 34 });
      for (const t of [0.33, 0.66]) {
        const p: Pt = [mix(FR[0], BR[0], t), mix(FR[1], BR[1], t)];
        stroke(ctx, [p, [p[0], p[1] - rail]], { w: 0.42 * b, col: rgba(INK, 0.5), tin: 0, tout: 0, seed: 35 + t });
      }
    }
    post(FL, 1, 36); post(FR, 1, 37);
    // the roof: the front face, the right face in shade, the hips meeting at a small finial; the eaves' dark undersides
    const tile = mix3(C.tile, C.white, 0.14);
    wash(ctx, [eF, ...side, apex], rgba(mix3(tile, INK, 0.38), r ? 0.8 : 0.92), { jit: 0.3 * b, seed: 41 });
    wash(ctx, [...eave, apex], rgba(tile, r ? 0.8 : 0.82), { jit: 0.3 * b, seed: 42 });
    if (r) return;
    // the rafters' shadow under the eaves (a thin dark band: the roof hovers over the open posts)
    wash(ctx, [...eave.slice(1, -1), ...eave.slice(1, -1).reverse().map(([x, y]): Pt => [x, y + 1.3 * b])], rgba(INK2, 0.55), { jit: 0.15 * b, seed: 43 });
    wash(ctx, [...side.slice(1), ...side.slice(1).reverse().map(([x, y]): Pt => [x, y + 1.1 * b])], rgba(INK2, 0.5), { jit: 0.15 * b, seed: 44 });
    // tile rows near the eave, a few and broken
    ctx.save();
    ctx.beginPath(); ctx.moveTo(eave[0][0], eave[0][1]); for (const p of eave) ctx.lineTo(p[0], p[1]); ctx.lineTo(apex[0], apex[1]); ctx.closePath(); ctx.clip();
    const Rt = own('tiles');
    for (let i = 1; i < 12; i++) {
      if (Rt() < 0.3) continue;
      const t = i / 12, e = eave[Math.round(t * 16)];
      const len = 0.25 + 0.35 * Rt();
      stroke(ctx, [[e[0], e[1] - 0.2 * b], [mix(e[0], apex[0], len), mix(e[1], apex[1], len)]], { w: 0.42 * b, col: rgba(INK, 0.32), tin: 0, tout: 0.6, seed: i });
    }
    ctx.restore();
    stroke(ctx, eave, { w: 1.2 * b, col: rgba(INK, 0.9), tin: 0.05, tout: 0.06, wob: 0.3, seed: 45 });
    stroke(ctx, side, { w: 0.85 * b, col: rgba(INK, 0.78), tin: 0.05, tout: 0.15, wob: 0.3, seed: 46 });
    stroke(ctx, [eF, apex], { w: 0.95 * b, col: rgba(INK, 0.82), tin: 0.05, tout: 0.1, dry: 0.1, seed: 47 });
    stroke(ctx, [eave[0], apex], { w: 0.7 * b, col: rgba(INK, 0.6), tin: 0.05, tout: 0.1, dry: 0.25, seed: 48 });
    stroke(ctx, [eB, apex], { w: 0.55 * b, col: rgba(INK, 0.45), tin: 0.1, tout: 0.1, dry: 0.3, seed: 49 });
    ctx.fillStyle = rgba(INK, 0.9);   // the finial: a small knob, nothing more
    ctx.beginPath(); ctx.ellipse(apex[0], apex[1] - 0.5 * b, 0.75 * b, 0.6 * b, 0, 0, Math.PI * 2); ctx.fill();
    stroke(ctx, [[apex[0], apex[1] - 0.6 * b], [apex[0] + 0.1 * b, apex[1] - 2.2 * b]], { w: 0.55 * b, col: rgba(INK, 0.85), tin: 0, tout: 0.5, seed: 50 });
  };

  const paintPine = (r: boolean) => {
    // the needle masses behind the trunk first (a soft dark bed), the trunk, then the needles over it
    for (const [c, hw, rows] of masses) softWash(env, ellipse(c[0], c[1] - (rows - 1) * 0.7 * b, hw * 0.9 * b, (1.2 + rows * 0.7) * b, 12), rgba(INK2, r ? 0.3 : 0.2), 1.0 * b);
    stroke(ctx, trunk, { w: 3.9 * b, col: rgba(INK, r ? 0.7 : 0.9), tin: 0, tout: 0.75, min: 0.3, wob: 0.45, seed: 61 });
    for (const bg of boughs) stroke(ctx, bg, { w: 1.3 * b, col: rgba(INK, r ? 0.6 : 0.85), tin: 0.02, tout: 0.8, wob: 0.4, seed: bg[2][0] });
    if (r) return;
    // bark: a pale dry streak down the lit side, and a few scale marks
    dryBrush(ctx, trunk.slice(0, 6).map(([x, y]): Pt => [x + 0.8 * b, y]), { w: 1.6 * b, col: rgba(C.white, 0.5), bristles: 3, seed: 62, thr: 0.45 });
    const Rb = own('bark');
    for (let i = 0; i < 7; i++) {
      const j = Math.floor(Rb() * 6), f = Rb();
      const p: Pt = [mix(trunk[j][0], trunk[j + 1][0], f), mix(trunk[j][1], trunk[j + 1][1], f)];
      stroke(ctx, [[p[0] - 0.9 * b, p[1] - 0.3 * b], [p[0], p[1] + 0.4 * b], [p[0] + 0.9 * b, p[1] - 0.2 * b]], { w: 0.4 * b, col: rgba(INK, 0.5), tin: 0.1, tout: 0.4, seed: i });
    }
    // needles: each mass a few flat rows of short strokes fanning out from its bough, the rows' undersides darker
    const Rn = own('needles');
    for (const [c, hw, rows] of masses) {
      for (let row = 0; row < rows; row++) {
        const ry = c[1] - row * 1.5 * b + (Rn() - 0.5) * 0.6 * b;
        const half = hw * b * (1 - row * 0.22);
        const n = Math.round(10 + 1.4 * half / b);
        for (let i = 0; i < n; i++) {
          const t = (i + Rn() * 0.8) / n * 2 - 1;
          const x = c[0] + t * half, y = ry + Math.abs(t) * 0.8 * b + (Rn() - 0.5) * 0.5 * b;
          const ang = -Math.PI / 2 + t * 1.1 + (Rn() - 0.5) * 0.35;
          const L = (1.3 + Rn() * 0.9) * b;
          stroke(ctx, [[x, y + 0.6 * b], [x + Math.cos(ang) * L, y + 0.6 * b + Math.sin(ang) * L * 0.75]], { w: 0.55 * b, col: rgba(INK, 0.5 + Rn() * 0.3), tin: 0.1, tout: 0.6, min: 0.2, seed: i + row * 17 });
        }
        stroke(ctx, [[c[0] - half * 0.9, ry + 1.0 * b], [c[0], ry + 1.3 * b], [c[0] + half * 0.9, ry + 1.0 * b]], { w: 0.75 * b, col: rgba(INK, 0.55), tin: 0.2, tout: 0.3, dry: 0.35, seed: row + c[0] });
      }
    }
  };

  // ---------------------------------------------------------------- the reflection, faint and broken
  // the spit, the pavilion and the pine upside down in the water (simplified, faint), then torn by the lake's few
  // ripples: thin gaps across it, more of them deeper down, and it fades out with depth
  ctx.save();
  ctx.translate(0, 2 * wy + 1.4 * b);
  ctx.scale(1, -1);
  ctx.globalAlpha = 0.3;
  paintRocks(true);
  paintPavilion(true);
  paintPine(true);
  ctx.restore();
  const reflBox = bounds([[[A[0][0] - 2 * b, wy], [xEnd, wy]], trunk.map(([x, y]): Pt => [x, 2 * wy - y]), [[apex[0], 2 * wy - apex[1] + 3 * b]]], 2 * b);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  const g = ctx.createLinearGradient(0, wy + 4 * b, 0, wy + 48 * b);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = g;
  ctx.fillRect(reflBox.x - 4 * b, wy + 4 * b, reflBox.w + 8 * b, 140 * b);
  const Rr = own('ripples');
  for (let yy = wy + (2.6 + Rr() * 1.2) * b; yy < wy + 50 * b; yy += (1.2 + Rr() * 2.6) * b * (1 + (yy - wy) / (36 * b))) {
    const deep = Math.min(1, (yy - wy) / (30 * b));   // near the waterline the mirror is nearly whole; deeper, torn
    const line: Pt[] = [];
    for (let x = reflBox.x - 4 * b; x <= reflBox.x + reflBox.w + 4 * b; x += 5 * b) line.push([x, yy + (Rr() - 0.5) * 0.4 * b]);
    for (const seg of runs(line, Rr, (8 + 14 * deep) * b, (30 + 50 * deep) * b, (14 - 8 * deep) * b)) {
      stroke(ctx, seg, { w: (0.3 + Rr() * (0.4 + 0.6 * deep)) * b, col: 'rgba(0,0,0,0.9)', tin: 0.3, tout: 0.3, wob: 0.6, seed: seg[0][0] + yy });
    }
  }
  ctx.restore();
  // life: the faintest shimmer, in the reflection only (open water below the spit's waterline)
  anchor(env, 'shimmer', { x: reflBox.x, y: wy, w: reflBox.w, h: 46 * b }, { waterline: [at([-41, 0.5]), at([0, 0.8]), at([52, 0.6]), [xEnd, wy + 0.6]] });
  yield;

  // ---------------------------------------------------------------- the painting
  paintRocks(false);
  yield;
  // the pine stands behind the pavilion: its trunk and its lower masses first, the roof over them
  paintPine(false);
  yield;
  paintPavilion(false);
  yield;
  // mist: a long pale bank across the spit's root and the tail, so the shore it comes from is lost
  softWash(env, [at([34, -4]), at([62, -8]), [mix(at([62, 0])[0], xEnd, 0.5), wy - 7 * b], [xEnd, wy - 5 * b], [xEnd, wy + 1.5 * b], at([70, 1.2]), at([40, -0.8])], rgba(C.mist, 0.5), 3 * b);
  softWash(env, [at([-46, 0.2]), at([-30, -1.4]), at([-10, -0.6]), at([10, 0.3]), at([-8, 2.6]), at([-36, 2.4])], rgba(C.mist, 0.4), 1.6 * b);
  // a few long, faint strokes on the still water off the spit's tip
  const Rw = own('water');
  for (let i = 0; i < 3; i++) {
    const y = wy + (3 + i * 3.6 + Rw() * 1.5) * b, x0 = cx - (62 + Rw() * 30) * b, L = (22 + Rw() * 26) * b;
    stroke(ctx, [[x0, y], [x0 + L * 0.5, y + 0.2 * b], [x0 + L, y]], { w: 0.55 * b, col: rgba(INK2, 0.14 + Rw() * 0.08), tin: 0.3, tout: 0.5, wob: 0.5, dry: 0.3, seed: i + 70 });
  }
  yield;
}

// a polyline resampled every `step` world px (for broken contours)
function resampled(list: Pt[], step: number): Pt[] {
  const out: Pt[] = [list[0]];
  for (let i = 1; i < list.length; i++) {
    const [x0, y0] = list[i - 1], [x1, y1] = list[i];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 1; k <= n; k++) out.push([x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n]);
  }
  return out;
}

/**
 * The scholar, seated in profile and facing left (out over the water): a plain white robe gathered into a low mound,
 * a broken ink line on his back, a pale sleeve over the knees, dark hair with a small topknot, the face a pale sliver.
 * (x, y) = where he sits; s = size (about 8 world px from the floor to the topknot at s = 1).
 */
function scholar(env: Env, x: number, y: number, s: number, INK: RGB, PAL: RGB) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const robe: Pt[] = [[x + 2.4 * s, y + 0.2 * s], [x + 2.2 * s, y - 2.4 * s], [x + 1.3 * s, y - 5.2 * s], [x - 0.6 * s, y - 5.5 * s], [x - 1.5 * s, y - 3.6 * s], [x - 3.6 * s, y - 1.9 * s], [x - 4.1 * s, y + 0.2 * s]];
  wash(ctx, robe, rgba(C.white, 0.97), { jit: 0.15 * s, seed: 81 });
  // the back: one line, broken; the hem on the floor; the sleeve (a pale grey fold) resting over the knees
  stroke(ctx, [robe[0], robe[1], robe[2], robe[3]], { w: 0.55 * s, col: rgba(INK, 0.8), tin: 0.1, tout: 0.3, dry: 0.15, seed: 82 });
  stroke(ctx, [[x - 4.1 * s, y + 0.2 * s], [x + 2.4 * s, y + 0.3 * s]], { w: 0.45 * s, col: rgba(INK, 0.55), tin: 0.1, tout: 0.2, seed: 83 });
  stroke(ctx, [robe[4], robe[5], robe[6]], { w: 0.42 * s, col: rgba(INK, 0.55), tin: 0.1, tout: 0.3, dry: 0.2, seed: 86 });
  wash(ctx, [[x - 0.2 * s, y - 5.0 * s], [x - 2.7 * s, y - 2.3 * s], [x - 3.3 * s, y - 1.4 * s], [x - 1.4 * s, y - 1.5 * s], [x + 0.6 * s, y - 3.7 * s]], rgba(PAL, 0.7), { jit: 0.1 * s, seed: 87 });
  stroke(ctx, [[x - 0.2 * s, y - 5.0 * s], [x - 2.7 * s, y - 2.3 * s], [x - 3.3 * s, y - 1.4 * s]], { w: 0.4 * s, col: rgba(INK, 0.6), tin: 0.1, tout: 0.3, seed: 84 });
  // the head, in profile toward the water: dark hair and a small topknot, the face a pale sliver on the left
  const hx = x - 0.3 * s, hy = y - 6.7 * s;
  ctx.fillStyle = rgba(INK, 0.92);
  ctx.beginPath(); ctx.arc(hx, hy, 1.12 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(hx + 0.35 * s, hy - 1.2 * s, 0.5 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = rgba(mix3(C.white, PAL, 0.3), 0.95);
  ctx.beginPath(); ctx.ellipse(hx - 0.62 * s, hy + 0.2 * s, 0.48 * s, 0.75 * s, 0.2, 0, Math.PI * 2); ctx.fill();
}

// PINS: none (a new set; every element draws from stream(SEED, ...key)).
const PINS: Record<string, number> = {};
