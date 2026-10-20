// sets/terraces.ts — Résumé (stretch 3): the terraced fields of his record, stepping down to the shore. The two low
// hills of plane 2 (the shader's tech.terr bands give them their pale malachite body) are cut into terraces, in rows
// like a record. Each terrace wall is a level line (a field is flat: the water in it lies level), so its dry-brush lip
// runs across the hill's face, sagging a little where the hill swells toward us, bending down over each spur and back
// into each gully, and meeting the hill's outline at its ends; the walls nest, never cross. Under each lip the
// wall's face in shade; on each tread a field: flooded (paper, holding the sky), young rice (pale malachite), ripe
// (a little darker) or bare, a long band softly pinched where it meets the next. A path comes up from the shore at
// the right foot and zig-zags up the right hill's face, each leg cutting across two or three walls (a few steps where
// it does), then over to a small thatched farmhouse on the hill's shoulder under its crown: Song form, plain clay
// walls, a heavy grey thatch, a wattle fence, two trees by it. A small grove on the left hill's crown, two trees in
// the saddle, one on the right shoulder, two where the path leaves the shore. Mist takes the left flank's foot, a
// wisp across it, every foot and the shore end. Life: smoke from the farmhouse (one anchor).
//
// A figure set (figures.ts, THE SET API): meta + draw(env), in world px. Painted on plane 2 after its ink and before
// its mist band (phase 0): plane 2's mist softens the lowest terraces, and plane 3's hills in front cover the rest.
// Ground: plane 2's crest from planeTop, rounded here the way ridges.ts rounds terraced planes (the engine
// rounds per view, by 3.5 % of the view's width; this uses a fixed radius between the wide and phone views, within
// ~0.004 scene heights of both), so the lips stop a few px inside the outline, and the trees on the crowns stand a
// little under it. No shader change: the walls are drawn here, not registered to the shader's lips (those follow
// the crest; these are level), which stay underneath as a faint texture.

import {
  REF_PX, VH_PX, SCENE_FIELDS, planeTop, sceneField, streams, vnoise, mix, mix3, clamp01, smooth, stroke, wash, softWash,
  runs, ellipse, anchor, D, type Env, type FigureMeta, type Pt, type Rng,
} from '../figures';
import type { Resolved } from '../compose';

/** The set's stretch: every world x below is K + its offset (move the place by changing K). */
const K = 3;
export const meta: FigureMeta = { rect: [K + 0.16, K + 1, 0.2, 0.5], plane: 2, phase: 0 };
type PtData = [x: number, y: number, ...data: number[]];
interface TreeOptions { pale?: boolean; upright?: boolean }

const SEED = 11;

// ---------------------------------------------------------------- the ground (plane 2, as the engine rounds it)
const DU = 0.002;          // ground samples, in stretches
const ROUND_R = 0.033;     // the terraced planes' rounding radius, in stretches (ridges.ts: 3.5 % of the view)
function boxBlur(src: Float32Array, r: number) {
  const n = src.length, out = new Float32Array(n);
  let sum = 0, cnt = 0;
  for (let j = 0; j <= r && j < n; j++) { sum += src[j]; cnt++; }
  for (let c = 0; c < n; c++) {
    out[c] = sum / cnt;
    const add = c + r + 1, sub = c - r;
    if (add < n) { sum += src[add]; cnt++; }
    if (sub >= 0) { sum -= src[sub]; cnt--; }
  }
  return out;
}
function groundModel(P: Resolved, ua: number, ub: number) {
  const n = Math.round((ub - ua) / DU) + 1;
  const raw = new Float32Array(n), terr = new Float32Array(n), f = new Float32Array(SCENE_FIELDS);
  for (let i = 0; i < n; i++) {
    const u = ua + i * DU;
    raw[i] = planeTop(2, u, P);
    sceneField(u, P, f);
    terr[i] = f[9];
  }
  const r = Math.max(3, Math.round(ROUND_R / DU));
  const b = boxBlur(boxBlur(raw, r), r);
  const crest = raw.map((h, i) => h + (b[i] - h) * terr[i] * 0.75);
  const b2 = boxBlur(boxBlur(crest, r), r);
  const broad = crest.map((h, i) => Math.max(b2[i], h - 0.25));
  const at = (A: Float32Array) => (u: number) => {
    const x = (u - ua) / DU, i = Math.max(0, Math.min(n - 2, Math.floor(x))), t = Math.min(1, Math.max(0, x - i));
    return A[i] + (A[i + 1] - A[i]) * t;
  };
  return { crestAt: at(crest), broadAt: at(broad) };
}

export function* draw(env: Env) {
  const { ctx, P, ink } = env;
  const { C, rgba } = ink;
  const own = streams(SEED, {});
  const X = (u: number) => u * REF_PX, Y = (y: number) => (1 - y) * VH_PX;
  // phones see this place from further away: the walls a little further apart and heavier, the house and the trees
  // larger (a painter's licence: they are drawn to be read)
  const big = Math.max(1, 0.7 * REF_PX / env.scale);
  const wk = Math.pow(big, 0.6), fk = Math.pow(big, 0.8);
  const colour = ink.strength > 0;

  const G = groundModel(P, env.rect[0] - 0.14, env.rect[1] + 0.14);
  const crest = G.crestAt, broad = G.broadAt;
  // (round 5) the hills stand on the river's far bank: their foot is the far shore's, at the waterline, as the shader
  // paints a far-shore plane over water (shaders.ts: footY = wY - 0.012, fade 0.07); off the water, the plane's own
  const fw = new Float32Array(SCENE_FIELDS);
  sceneField(K + 0.6, P, fw);
  const onWater = smooth(0, 0.3, fw[0] * fw[8]);
  const foot = mix(P.foot[2], fw[1] - 0.012, onWater), fade = mix(P.fade[2], 0.07, onWater);
  const footK = (y: number) => smooth(foot + 0.02, foot + fade * 0.95, y);         // the plane's ink dissolving into its foot
  // mist: a wisp across the left hill's face, the left flank's foot lost in it; the terraces end at the shore (heights
  // above the foot)
  const mistK = (u: number, y: number) => {
    const w1 = Math.exp(-Math.pow((y - foot - 0.09 + (u - (K + 0.36)) * 0.06) / 0.008, 2)) * smooth(K + 0.31, K + 0.34, u) * (1 - smooth(K + 0.37, K + 0.41, u));
    const w2 = (1 - smooth(K + 0.29, K + 0.36, u)) * (1 - smooth(foot + 0.078, foot + 0.11, y));
    const n = vnoise(u * 60, y * 140, 31);
    return clamp01(Math.max(w1 * (0.5 + 0.7 * n), w2 * 0.85, smooth(K + 0.845, K + 0.9, u)));
  };

  // the hill's face: a level line z seen from a little above sags by KAP of the ground standing over it, and bends
  // down over the spurs and back into the gullies (sp), more the further down the face it runs
  const uA = K + 0.27, uB = K + 0.9;
  const KAP = 0.3, SPUR = 0.26;
  const sp = (u: number) => (vnoise(u * 26, 0.5, 41) - 0.5) * 2 + (vnoise(u * 61, 1.5, 43) - 0.5) * 0.4;
  const levelY = (u: number, z: number) => { const dz = Math.max(0, broad(u) - z); return z - dz * (KAP + SPUR * sp(u)); };
  const M0 = 0.0065;                                                            // the lips stop this far inside the outline

  // the terrace levels, from just under the crowns down into the mist: ordered, a little uneven
  const Rl = own('levels');
  let zTop = 0;
  for (let u = uA; u <= uB; u += DU) zTop = Math.max(zTop, crest(u));
  const S = 0.0128 * Math.min(1.5, Math.pow(big, 0.45));
  const levels: number[] = [];
  for (let z = zTop - 0.018; z > foot + 0.045; z -= S * (0.86 + 0.28 * Rl())) levels.push(z);

  // each level: its runs across the hill (where the ground stands above it), as [x, y, u, ysc] in world px
  const walls = levels.map((z, k) => {
    const out: PtData[][] = [];
    let cur: PtData[] | null = null;
    for (let u = uA; u <= uB + 1e-9; u += DU) {
      const c = crest(u);
      if (c - z > M0) {
        const y = Math.min(c - M0 * 0.7, levelY(u, z) + (vnoise(u * 90, k * 3.7, 17) - 0.5) * 0.0014);
        (cur ||= []).push([X(u), Y(y), u, y]);
      } else if (cur) { if (cur.length > 4) out.push(cur); cur = null; }
    }
    if (cur && cur.length > 4) out.push(cur);
    return { z, k, runs: out };
  });
  // where a wall runs at u: its point, or null
  const wallAt = (k: number, u: number) => {
    if (k < 0 || k >= walls.length) return null;
    for (const run of walls[k].runs) if (u >= run[0][2] - 1e-9 && u <= run[run.length - 1][2] + 1e-9) {
      return run[Math.min(run.length - 1, Math.max(0, Math.round((u - run[0][2]) / DU)))];
    }
    return null;
  };
  const rh = 2.3 * wk;                                                          // a wall's face, seen from above
  const fade2 = (u: number, y: number) => footK(y) * (1 - 0.9 * mistK(u, y));
  yield;

  // the fields on the treads, between a wall's lip and the foot of the wall above: each a long band, pinched a little at
  // its ends where it meets the next field (a low dike) or runs out against the hill's outline. Flooded fields hold
  // the sky (paper), young rice is pale, ripe rice a little darker; some lie bare
  const flood = colour ? mix3(C.white, C.az, 0.08) : C.white;
  const young = colour ? mix3(C.mal, C.white, 0.5) : mix3(C.ink2, C.white, 0.78);
  const ripe = colour ? mix3(C.malD, C.ink2, 0.25) : C.ink2;
  for (const w of walls) {
    if (w.k === 0) continue;
    const R = own('fields', w.k);
    for (const run of w.runs) {
      let i0 = Math.floor(R() * 6);
      while (i0 < run.length - 4) {
        const len = Math.max(4, Math.round((30 + R() * 70) * big / (DU * REF_PX)));
        const i1 = Math.min(run.length - 1, i0 + len);
        const seg = run.slice(i0, i1 + 1);
        const n = seg.length;
        let open = false;                                       // a field against the outline: dry, never flooded
        const pr = Math.min(0.3, (6 * big) / (n * DU * REF_PX));
        const top = seg.map(([x, y, u], j): Pt => {
          const up = wallAt(w.k - 1, u);
          if (!up) open = true;
          // (where no wall runs above, the tread reaches toward the outline, but never deeper than one step)
          const ty = Math.min(up ? up[1] + rh : Math.max(Y(crest(u) - M0 * 1.3), y - S * VH_PX * 1.1), y - 0.8);
          const t = j / (n - 1), e = smooth(0, pr, t) * smooth(1, 1 - pr, t);   // a long band, softly pinched at its ends
          return [x, mix(y - 0.8, ty, 0.45 + 0.55 * e)];
        });
        const kind = R();
        const m = seg[n >> 1];
        const a = fade2(m[2], m[3]);
        const poly = [...seg.map(([x, y]): Pt => [x, y - 0.5]), ...top.slice().reverse()];
        const seed = w.k * 13 + i0;
        if (kind < 0.26 && !open && w.k > 1 && n * DU * REF_PX < 70 * big) wash(ctx, poly, rgba(flood, (0.44 + R() * 0.2) * a), { jit: 0.4, seed });
        else if (kind < 0.6) wash(ctx, poly, rgba(young, (0.26 + R() * 0.2) * a), { jit: 0.4, seed });
        else if (kind < 0.8) wash(ctx, poly, rgba(ripe, (0.08 + R() * 0.08) * a), { jit: 0.4, seed });
        i0 = i1 + (R() < 0.5 ? 1 : 0);
      }
    }
  }
  yield;

  // the walls: a shade under each lip, then the lip itself, a dry, broken line; darker where the hill turns from the
  // light (slopes falling to the right), paler on its lit side, lost in the mist and at the feet
  for (const w of walls) {
    const R = own('wall', w.k);
    const wf = 0.82 + 0.3 * R() + (w.k % 3 === 1 ? 0.18 : 0);                // a rhythm: some walls heavier
    for (const run of w.runs) {
      for (const seg of runs(run as Pt[], R, 70 * big, 300 * big, 3.5 * big)) {
        const m: PtData = seg[seg.length >> 1];
        const sl = (crest(m[2] + 0.012) - crest(m[2] - 0.012)) / 0.024;
        const shadeK = smooth(0.05, -0.6, sl);
        const a = fade2(m[2], m[3]);
        if (a < 0.04) continue;
        const pts = seg.map(([x, y]): Pt => [x, y]);
        softWash(env, [...pts, ...pts.slice().reverse().map(([x, y]): Pt => [x, y + rh])], rgba(mix3(C.ink2, C.malD, colour ? 0.3 : 0), (0.09 + 0.09 * shadeK) * a), 0.6);
        stroke(ctx, pts, {
          w: (1.1 + 0.4 * R()) * wk * wf, col: rgba(C.ink, (0.46 + 0.22 * shadeK + R() * 0.1) * a * Math.min(1.15, wf)),
          tin: 0.08, tout: 0.25, wob: 0.6, dry: 0.24, seed: seg[0][0] * 0.37 + w.k,
        });
        // here and there the brush went back over the wall: a second, fainter line along part of it
        if (R() < 0.3 && pts.length > 30) {
          const i0 = Math.floor(R() * pts.length * 0.4), i1 = Math.min(pts.length - 1, i0 + 15 + Math.floor(R() * pts.length * 0.5));
          stroke(ctx, pts.slice(i0, i1).map(([x, y]): Pt => [x, y + 0.9 * wk]), { w: 0.7 * wk, col: rgba(C.ink, 0.3 * a), tin: 0.2, tout: 0.4, wob: 0.6, dry: 0.4, seed: i0 + w.k });
        }
      }
    }
  }
  yield;

  // ---- where the farmhouse stands: high on the terraces, on the right hill's shoulder under its crown, on the lip
  // of the tread nearest the shoulder
  const uh = K + 0.633;
  const yT = crest(uh) - 0.01;
  let kh = -1, dBest = 9;
  for (let k = 0; k < walls.length; k++) {
    const p = wallAt(k, uh);
    if (p && p[3] < yT + 0.003 && yT - p[3] < dBest) { dBest = yT - p[3]; kh = k; }
  }
  const lipH = wallAt(kh, uh);
  const hx = X(uh), hy = lipH ? lipH[1] - 0.6 * wk : Y(yT);
  const hs = 1.4 * Math.pow(big, 0.6);

  // ---- the path: up from the shore at the right foot, zig-zagging up the right hill's face, each leg climbing
  // across two or three terraces (cutting their walls, a few steps where it does), then over to the farmhouse's door.
  // Its height is read off the walls themselves (q: a fractional wall index, 0 at the top), so it lies on the steps.
  const Rp = own('path');
  const qY = (u: number, q: number) => {
    const k0 = Math.floor(q), a = wallAt(k0, u), b = wallAt(k0 + 1, u);
    if (!a || !b) return null;
    return mix(a[1], b[1], q - k0) - 1.3 * wk;
  };
  const uL = K + 0.676, uR = K + 0.8;
  let q = walls.length - 1.6;
  while (q > kh + 1 && qY(uR, q) == null) q -= 0.25;
  let u = uR, dir = -1;
  const legs: PtData[][] = [];
  const leg = (u0: number, q0: number, u1: number, q1: number) => {
    const pts: PtData[] = [];
    const nn = Math.max(2, Math.round(Math.abs(u1 - u0) / 0.003));
    for (let j = 0; j <= nn; j++) { const uu = mix(u0, u1, j / nn), y = qY(uu, mix(q0, q1, j / nn)); if (y != null) pts.push([X(uu), y, mix(q0, q1, j / nn)]); }
    if (pts.length > 1) legs.push(pts);
  };
  const start: Pt | null = qY(u, q) != null ? [X(u), qY(u, q)!] : null;
  while (q > kh + 2.2) {
    const qn = Math.max(kh + 1.2, q - (1.7 + Rp() * 0.9));
    let un = dir < 0 ? uL + Rp() * 0.02 : uR - Rp() * 0.025;
    while (qY(un, qn) == null && Math.abs(un - u) > 0.006) un -= dir * 0.003;
    leg(u, q, un, qn);
    u = un; q = qn; dir = -dir;
    if (legs.length > 12) break;
  }
  leg(u, q, uh + 0.013, kh + 0.25);                                     // over to the door
  for (const pts of legs) {
    const m = pts[pts.length >> 1];
    const a = fade2(m[0] / REF_PX, 1 - m[1] / VH_PX);
    if (a < 0.04) continue;
    // a pale band of trodden earth (it cuts the walls it crosses), its lower edge a faint broken line
    stroke(ctx, pts as Pt[], { w: 2.3 * fk, col: rgba(C.white, 0.8 * a), tin: 0.05, tout: 0.05, wob: 0.4, dry: 0.08, seed: pts[0][0] });
    stroke(ctx, pts.map(([x, y]): Pt => [x, y + 1.25 * wk]), { w: 0.45 * wk, col: rgba(C.ink, 0.3 * a), tin: 0.15, tout: 0.25, dry: 0.45, seed: pts[0][1] });
    // steps where it crosses a wall
    for (let j = 1; j < pts.length; j++) {
      if (Math.floor(pts[j - 1][2]) === Math.floor(pts[j][2])) continue;
      const [x, y] = pts[j];
      for (let s2 = 0; s2 < 2; s2++) stroke(ctx, [[x - 1.1 * wk, y + s2 * 1.6 * wk - 0.8 * wk], [x + 1.1 * wk, y + s2 * 1.6 * wk - 1.0 * wk]], { w: 0.42 * wk, col: rgba(C.ink, 0.42 * a), tin: 0, tout: 0.3 });
    }
  }
  yield;

  // ---- the farmhouse with a wattle fence along its tread, and two trees by it (drawn first, so it stands in front):
  // one behind its hip, rising over the thatch, one behind the fence
  fieldTree(env, hx + 12.5 * hs, hy - 4 * hs, 1.05 * fk, own('tree', 'behind', 1), {});
  fieldTree(env, hx - 11 * hs, hy - 1.5 * hs, 0.85 * fk, own('tree', 'behind', 2), { pale: true });
  yield;
  const roofTop = farmhouse(env, hx - 7.5 * hs, hy, hs, own('farmhouse'));
  // life: a thread of smoke from the thatch
  anchor(env, 'smoke', { x: roofTop[0] - 8 * hs, y: roofTop[1] - 30 * hs, w: 22 * hs, h: 30 * hs }, { src: roofTop });
  const Rf = own('fence');
  const fx0 = hx - 9.2 * hs, fy = hy + 0.2;
  const fence: Pt[] = [];
  for (let i = 0; i <= 4; i++) fence.push([fx0 - i * 2.1 * hs, fy + Math.sin(i * 0.8) * 0.25 * hs + i * 0.12 * hs]);
  stroke(ctx, fence.map(([x, y]): Pt => [x, y - 1.6 * hs]), { w: 0.42 * wk, col: rgba(C.ink, 0.55), tin: 0.1, tout: 0.4, dry: 0.25, seed: 3 });
  stroke(ctx, fence.map(([x, y]): Pt => [x, y - 0.7 * hs]), { w: 0.36 * wk, col: rgba(C.ink, 0.4), tin: 0.1, tout: 0.5, dry: 0.35, seed: 4 });
  for (const [x, y] of fence) if (Rf() < 0.85) stroke(ctx, [[x, y + 0.2], [x + (Rf() - 0.5) * 0.4, y - 2.1 * hs]], { w: 0.42 * wk, col: rgba(C.ink, 0.6), tin: 0, tout: 0.2 });
  yield;

  // ---- trees: a small grove on the left hill's crown, two in the saddle, a field-edge tree on the right hill's
  // shoulder (their feet a little under the outline: the engine rounds the crest per view, so a foot drawn on it
  // could float), and a pair where the path leaves the shore, fading with the hill's foot
  const onCrest = (u: number, dz: number, s: number, key: string, o: TreeOptions = {}) => {
    const y = crest(u) - dz;
    if (fade2(u, y) < 0.3) return;
    fieldTree(env, X(u), Y(y), s * fk, own('tree', key), o);
  };
  onCrest(K + 0.392, 0.012, 0.66, 'crown2', { pale: true });
  onCrest(K + 0.405, 0.011, 0.7, 'crown', { upright: true });
  onCrest(K + 0.418, 0.011, 0.9, 'crown3', {});
  onCrest(K + 0.432, 0.013, 0.62, 'crown4', {});
  onCrest(K + 0.525, 0.012, 0.75, 'saddle', { pale: true });
  onCrest(K + 0.539, 0.014, 0.6, 'saddle2', {});
  onCrest(K + 0.772, 0.012, 0.6, 'shoulder', {});
  if (start) {
    ctx.globalAlpha = clamp01(fade2(start[0] / REF_PX, 1 - start[1] / VH_PX) * 1.3);
    fieldTree(env, start[0] + 9 * wk, start[1] + 1.5 * wk, 0.8 * fk, own('tree', 'shore', 1), {});
    fieldTree(env, start[0] + 17 * wk, start[1] + 2.5 * wk, 0.6 * fk, own('tree', 'shore', 2), { pale: true });
    ctx.globalAlpha = 1;
  }
  yield;
}

/**
 * A tree as the painters set one small in a far landscape: a short trunk (most of it hidden by its crown) under a
 * broad, dense crown of horizontal dots over a faint wash, darkest on its shaded lower right, so it reads as a tree
 * at a few px. (x, y) = the foot; s = scale (1 ~ 14 world px tall). o.pale: a lighter crown; o.upright: a narrow,
 * tall crown of upright dabs (a cypress-like tree for a row along a crest).
 */
function fieldTree(env: Env, x: number, y: number, s: number, R: Rng, o: TreeOptions = {}) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const up = !!o.upright;
  const H = (up ? 15 : 12) * s * (0.85 + R() * 0.3);
  const lean = (R() - 0.5) * 2.4 * s;
  const rx = (up ? 3.0 : 4.6 + R() * 1.6) * s, ry = (up ? 5.4 : 3.2 + R() * 0.8) * s;
  const cx = x + lean, cy = y - H + ry;
  stroke(ctx, [[x, y + 0.4], [x + lean * 0.5 + (R() - 0.5) * 0.8 * s, y - H * 0.35], [cx, cy]], { w: 1.15 * s, col: rgba(C.ink, 0.85), tin: 0, tout: 0.5, wob: 0.5, seed: x });
  const leaf = ink.strength > 0 ? mix3(C.ink, C.malD, o.pale ? 0.45 : 0.25) : (o.pale ? mix3(C.ink, C.white, 0.28) : C.ink);
  const body = ink.strength > 0 ? mix3(C.malD, C.ink2, o.pale ? 0.2 : 0.45) : mix3(C.ink2, C.white, o.pale ? 0.5 : 0.3);
  const blobs: number = up ? 2 : 3;
  const B: [x: number, y: number, rx: number, ry: number][] = [];
  for (let i = 0; i < blobs; i++) {
    const t = blobs === 1 ? 0 : i / (blobs - 1) - 0.5;
    B.push(up ? [cx + (R() - 0.5) * 1.2 * s, cy + t * ry * 0.9, rx, ry * 0.7] : [cx + t * rx * 1.1 + (R() - 0.5) * 1.5 * s, cy + (R() - 0.5) * 1.6 * s - (i === 1 ? ry * 0.35 : 0), rx * (0.6 + R() * 0.2), ry * (0.75 + R() * 0.2)]);
  }
  for (const [bx, by, bx2, by2] of B) wash(ctx, ellipse(bx, by, bx2, by2, 12), rgba(body, o.pale ? 0.3 : 0.42), { jit: 0.5 * s, seed: bx });
  for (const [bx, by, brx, bry] of B) {
    const n = up ? 12 : 14 + Math.floor(R() * 5);
    for (let i = 0; i < n; i++) {
      const ang = R() * Math.PI * 2, rr = Math.sqrt(R());
      const px = bx + Math.cos(ang) * brx * rr * 0.92, py = by + Math.sin(ang) * bry * rr * 0.92;
      const shade = clamp01(0.45 + (py - by) / (bry * 2) + (px - bx) / (brx * 3));
      const L = (1.4 + R() * 0.9) * s;
      const d = up ? [0.25 * s, L * 0.5] : [L * 0.5, 0.15 * s];
      stroke(ctx, [[px - d[0], py + d[1]], [px + d[0], py - d[1]]], { w: (1.05 + R() * 0.5) * s, col: rgba(leaf, (o.pale ? 0.3 : 0.42) + shade * 0.38), tin: 0.2, tout: 0.5, wob: 0.3, seed: i + bx });
    }
  }
}

/**
 * A small farmhouse in the Song manner: a low house of pale clay walls under a heavy thatched hip-gable roof, its
 * eaves straight and thick (thatch never lifts at the corners like tile), a dark doorway, the side wall in shade.
 * (x, y) = front-left foot; s = scale (1 ~ 16 world px wide). Returns the middle of the roof's ridge (the smoke).
 */
function farmhouse(env: Env, x: number, y: number, s: number, R: Rng): Pt {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const w = 15 * s, h = 4.6 * s, d = 7 * s, rh = 5.6 * s, ov = 2.2 * s;
  const ox = D[0] * d, oy = D[1] * d;
  // the paper it stands on: the terraces behind never show through it
  wash(ctx, [[x - ov, y + 0.6], [x + w, y + 0.6], [x + w + ox, y + oy + 0.6], [x + w + ov + ox, y - h + oy], [x + w * 0.8 + ox * 0.5, y - h - rh + oy * 0.5], [x + w * 0.2 + ox * 0.5, y - h - rh + oy * 0.5], [x - ov, y - h]], rgba(C.paper, 0.97), { jit: 0.3 });
  // walls: the front lime-washed clay, the right side in shade
  const wallC = mix3(C.wall, C.ink2, 0.1 + R() * 0.06);
  wash(ctx, [[x + w, y], [x + w + ox, y + oy], [x + w + ox, y + oy - h], [x + w, y - h]], rgba(mix3(wallC, C.ink2, 0.42), 0.95), { jit: 0.3 });
  wash(ctx, [[x, y], [x + w, y], [x + w, y - h], [x, y - h]], rgba(wallC, 0.97), { jit: 0.3 });
  // the doorway and a small window
  const dx = x + w * (0.38 + R() * 0.08);
  wash(ctx, [[dx, y], [dx + 2.4 * s, y], [dx + 2.4 * s, y - h * 0.72], [dx, y - h * 0.72]], rgba(mix3(C.ink2, C.ink, 0.3), 0.7), { jit: 0.2 });
  wash(ctx, [[x + w * 0.72, y - h * 0.38], [x + w * 0.86, y - h * 0.38], [x + w * 0.86, y - h * 0.68], [x + w * 0.72, y - h * 0.68]], rgba(mix3(C.ink2, C.wall, 0.45), 0.6));
  // corner posts and the sill: the walls drawn, so a white house still stands out on a pale hill (and in ink)
  for (const px of [x + 0.3, x + w - 0.3]) stroke(ctx, [[px, y + 0.3], [px, y - h]], { w: 0.75 * s, col: rgba(mix3(C.timber, C.ink, 0.55), 0.85), tin: 0, tout: 0.1 });
  stroke(ctx, [[x + w + ox, y + oy], [x + w + ox, y + oy - h]], { w: 0.5 * s, col: rgba(C.ink, 0.45), tin: 0, tout: 0 });
  stroke(ctx, [[x - 0.6, y + 0.4], [x + w + 0.5, y + 0.3], [x + w + ox, y + oy + 0.3]], { w: 0.75 * s, col: rgba(C.ink, 0.6), tin: 0.05, tout: 0.1, dry: 0.2 });
  // the thatch: a heavy roof, its front slope and the hip on the right, a rounded ridge
  const ey = y - h + 0.4 * s;
  const eave: Pt[] = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; eave.push([x - ov + (w + 2 * ov) * t, ey + Math.sin(Math.PI * t) * 0.35 * s + 0.5 * s * Math.pow(Math.abs(t * 2 - 1), 3)]); }
  const rL: Pt = [x + w * 0.2 + ox * 0.5, y - h - rh + oy * 0.5], rR: Pt = [x + w * 0.8 + ox * 0.5, y - h - rh + oy * 0.5];
  const eF = eave[eave.length - 1], eB: Pt = [x + w + ov + ox, ey + oy + 0.3 * s];
  // straw gone grey: cool, never beige; a breath of green so the grey does not turn pink against the malachite
  const thatch = ink.strength > 0 ? mix3(mix3(C.earth, C.ink2, 0.4), C.malD, 0.22) : mix3(C.earth, C.ink2, 0.4);
  wash(ctx, [eF, eB, rR], rgba(mix3(thatch, C.ink, 0.3), 0.9), { jit: 0.3 });
  wash(ctx, [...eave, rR, rL], rgba(thatch, 0.88), { jit: 0.35 });
  // straw streaks down the slope, and the thick eave's shadow on the wall
  for (let i = 1; i < 9; i++) {
    const t = i / 9, ex = mix(eave[0][0], eF[0], t) + (R() - 0.5) * 0.6, rx = mix(rL[0], rR[0], t);
    stroke(ctx, [[mix(rx, ex, 0.15), mix(rL[1], ey, 0.15)], [ex, ey - 0.4]], { w: 0.32 * s, col: rgba(C.ink, 0.22 + R() * 0.12), tin: 0.2, tout: 0.3, dry: 0.3, seed: i });
  }
  stroke(ctx, eave.map(([ex, eyy]): Pt => [ex, eyy + 0.7 * s]).slice(1, 10), { w: 0.9 * s, col: rgba(C.ink2, 0.35), tin: 0.1, tout: 0.1 });
  stroke(ctx, eave, { w: 1.0 * s, col: rgba(C.ink, 0.8), tin: 0.08, tout: 0.08, wob: 0.4, seed: x });
  stroke(ctx, [eF, eB], { w: 0.7 * s, col: rgba(C.ink, 0.7), tin: 0.05, tout: 0.2 });
  stroke(ctx, [eave[0], rL], { w: 0.55 * s, col: rgba(C.ink, 0.55), tin: 0.05, tout: 0.15, dry: 0.2 });
  stroke(ctx, [eF, rR], { w: 0.5 * s, col: rgba(C.ink, 0.5), tin: 0.05, tout: 0.15, dry: 0.2 });
  stroke(ctx, [[rL[0] - 0.4 * s, rL[1] + 0.5 * s], rL, rR, [rR[0] + 0.4 * s, rR[1] + 0.5 * s]], { w: 1.5 * s, col: rgba(C.ink, 0.82), tin: 0.15, tout: 0.15, wob: 0.3 });
  return [(rL[0] + rR[0]) / 2, (rL[1] + rR[1]) / 2 - 0.6 * s];
}
