// sets/path.js — the 404 (stretch 6): the lone peak, and the path running into mist. Off the road entirely: a narrow
// mountain path comes up out of the mist at the peak's foot and climbs the face under the summit in a few switchbacks
// (a pale strip the brush left bare, the shade of its bank below it, broken dry edges, a few stone steps where it is
// steep, a rock or a tuft beside it), past one bare winter tree leaning out from a turn, fainter as it goes; partway
// up, a cloud rises off the right flank and the path goes into it and does not come out. The summit stands clear above
// the cloud. Nobody on it. Ink only (DESIGN §7: the lone peak takes no pigment).
//
// Painted with the host's plane (2) before its own mist band (phase 0), so the plane's band softens the path's foot;
// the cloud it ends in is this layer's own (soft gradient washes in the shader's mist colour). At wide sizes the
// strip's bottom feather and the "Draft art" note keep its lower switchbacks (y < 0.33) out of sight: the wide picture is
// the upper three legs, the tree and the cloud; phones and tablets see the whole climb. No life anchor (the engine's
// own drifting mist already passes over the cloud).
// A figure set (figures.js, THE SET API; guide: README "Figure sets and small life"): meta + draw(env), in world px.

import { REF_PX, VH_PX, planeTop, streams, vnoise, mix, smooth, stroke, wash } from '../figures.js';

export const meta = { rect: [6.6, 7.1, 0.12, 0.54], plane: 2, phase: 0 };

const SEED = 11;

// The path's centre line, (u, y): stretch units and scene heights (y up), from the near end (in the foot mist) to where
// it goes into the cloud, under the summit (u 6.80, y 0.584) and right of it. Every point lies >= 0.02 scene heights
// under the host's crest (draw() checks it against planeTop, so a change to compose.js can never lift the path into
// the sky). Bends are where the direction turns; the tree leans out from bend D.
const LINE = [
  [6.884, 0.13], [6.864, 0.168], [6.84, 0.203], [6.812, 0.226],     // the approach, out of the foot mist; bend A
  [6.84, 0.248], [6.868, 0.27],                                      // B, the widest turn (the slope is gentlest here)
  [6.846, 0.29], [6.82, 0.31],                                       // C
  [6.832, 0.336], [6.85, 0.355],                                     // D (stone steps up C-D; the bare tree)
  [6.834, 0.372], [6.822, 0.388],                                    // E, a short leg
  [6.83, 0.41], [6.84, 0.424],                                       // F (a few more steps on E-F)
  [6.829, 0.442], [6.83, 0.456],                                     // into the cloud
];

export function* draw(env) {
  const { ctx, P, ink } = env;
  const { C, rgba } = ink;
  const own = streams(SEED, {});
  const X = (u) => u * REF_PX, Y = (y) => (1 - y) * VH_PX;
  // the phone sees this place from further away (scale 450): marks are drawn heavier there, so the path and the tree
  // still read; their places never move (the path is registered to the flank, not to the screen)
  const big = Math.max(1, 0.5 * REF_PX / env.scale);
  // ...but the path's own width grows less: its switchbacks lie only ~18 world px apart, and a wider band would fill them
  const bw = Math.max(1, 0.38 * REF_PX / env.scale);
  // the line on the mountain: never closer than 0.02 scene heights under the host plane's crest
  const line = LINE.map(([u, y]) => [u, Math.min(y, planeTop(2, u, P) - 0.02)]);

  // the line as a smooth curve in world px, with t = 0 (near) .. 1 (into the cloud)
  const pts = catmull(line.map(([u, y]) => [X(u), Y(y)]), 8);
  const n = pts.length;
  const tAt = (i) => i / (n - 1);
  // how much of the path is left to see: full, then thinning over its last fifth, gone in the cloud
  const fade = (t) => 1 - smooth(0.8, 1, t);
  const width = (t) => mix(7.5, 3.2, Math.pow(t, 0.8)) * bw;

  // the path's two sides: `dn` the downhill one (screen-down; on a near-vertical leg, the outer, right-hand one), `up`
  // the uphill one. A flip marks where a bend swaps them (an edge stroke never runs across a flip).
  const dn = [], up = [], flip = [];
  for (let i = 0; i < n; i++) {
    const t = tAt(i);
    let [nx, ny] = normal(pts, i);
    if (ny < -0.3 || (ny < 0.3 && nx < 0)) { nx = -nx; ny = -ny; }
    const hw = width(t) * 0.5 * (0.85 + 0.3 * vnoise(i * 0.35, 3, 101));
    dn.push([pts[i][0] + nx * hw, pts[i][1] + ny * hw, nx, ny]);
    up.push([pts[i][0] - nx * hw, pts[i][1] - ny * hw]);
    flip.push(i > 0 && nx * dn[i - 1][2] + ny * dn[i - 1][3] < 0);
  }
  const runOf = (i, j) => { for (let q = i + 1; q <= j; q++) if (flip[q]) return q - 1; return j; };

  // 1. the bank under it: the shelf the path cuts into the slope throws a little shade below it, so the bare path
  //    reads by its pallor against it (a soft grey band under the downhill edge, in pieces)
  const Rb = own('bank');
  for (let s0 = 0; s0 < n - 1; s0 += 5) {
    const e = runOf(s0, Math.min(n - 1, s0 + 6));
    if (e <= s0) continue;
    const t = tAt(s0);
    const a = (env.k < 0.8 ? 0.12 : 0.16) * fade(t) * (0.6 + 0.4 * Rb());   // lighter where the layer is coarse (phones)
    if (a < 0.02) continue;
    const seg = dn.slice(s0, e + 1);
    const deep = width(t) * (1.1 + 0.5 * Rb());
    // two passes, the outer one wider and fainter, so the shade's far edge feathers into the slope
    for (const [d, k] of [[deep * 0.55, 0.6], [deep, 0.5]]) {
      wash(ctx, [...seg.map(([x, y]) => [x, y]), ...seg.slice().reverse().map(([x, y, nx, ny]) => [x + nx * d, y + ny * d])], rgba(C.ink2, a * k), { jit: 0.6 * big, seed: s0 + d });
    }
  }

  // 2. the path itself: paper the brush left bare (a pale wash over the flank's ink), wider and fuller near; in pieces,
  //    so its pallor fades along it, and where a fold of the slope hides it the pallor lapses for a few samples, so it
  //    never reads as a ruled white line
  const Rr = own('reserve');
  for (let s0 = 0; s0 < n - 1; s0 += 4) {
    const e = Math.min(n - 1, s0 + 5);
    const t = tAt(s0);
    const lapse = smooth(0.62, 0.78, vnoise(s0 * 0.11, 9, 103));
    const a = 0.8 * fade(t) * (0.75 + 0.25 * Rr()) * (1 - 0.7 * lapse);
    if (a < 0.03) continue;
    // (a ribbon between the two sides; where they swap at a bend, the pieces overlap instead of twisting)
    const A = [], B = [];
    for (let i = s0; i <= e; i++) {
      const [nx, ny] = normal(pts, i);
      const hw = Math.hypot(dn[i][0] - up[i][0], dn[i][1] - up[i][1]) * 0.5;
      A.push([pts[i][0] + nx * hw, pts[i][1] + ny * hw]);
      B.push([pts[i][0] - nx * hw, pts[i][1] - ny * hw]);
    }
    wash(ctx, [...A, ...B.reverse()], rgba(C.paper, a), { jit: 0.5 * big, seed: s0 + 3 });
  }
  yield;

  // 3. its edges in dry, broken strokes: the downhill edge long and steady (the shelf's lip), the uphill one only in
  //    fragments (the slope comes down onto the path); both go drier and fainter as the path recedes
  const Re = own('edges');
  const coarse = env.k < 0.8;   // a phone's layer: the lip carries the path there (its pallor barely shows on the pale foot)
  for (const [edge, keep, a0, minL, spanL, gap] of [[dn, 0.92, coarse ? 0.8 : 0.62, 9, 14, 3], [up, 0.32, 0.34, 3, 5, 6]]) {
    let i = 0;
    while (i < n - 2) {
      const j = runOf(i, Math.min(n - 1, i + minL + Math.floor(Re() * spanL)));
      const t = tAt(i);
      if (j > i + 1 && Re() < keep && fade(t) > 0.04) {
        const seg = edge.slice(i, j + 1).map(([x, y]) => [x + (Re() - 0.5) * 0.5, y + (Re() - 0.5) * 0.5]);
        const a = a0 * fade(t) * (0.75 + 0.25 * Re());
        stroke(ctx, seg, { w: mix(2.0, 0.9, t) * big, col: rgba(mixC(C.ink, C.ink2, 0.4), a), tin: 0.2, tout: 0.45, wob: 0.6, dry: 0.22 + 0.4 * t, seed: i * 7 + j });
      }
      i = j + 1 + Math.floor(Re() * (1 + gap * (0.4 + t)));
    }
  }
  yield;

  // 4. a few stone steps where it climbs steeply (C-D, then smaller on E-F): level slabs, a dark lip under a pale tread
  const Rs = own('steps');
  for (const [s0, s1, k] of [[segIndex(7, 8) + 3, segIndex(9, 8) - 2, 5], [segIndex(11, 8) + 3, segIndex(13, 8) - 2, 3]]) {
    for (let q = 0; q < k; q++) {
      const i = Math.round(mix(s0, s1, (q + 0.5) / k));
      const t = tAt(i);
      const hw = width(t) * (0.62 + 0.15 * Rs());
      const [x, y] = pts[i];
      const tilt = (Rs() - 0.5) * 0.9;
      wash(ctx, [[x - hw, y - 0.9 * big + tilt], [x + hw, y - 0.9 * big - tilt], [x + hw * 0.9, y + 0.2], [x - hw * 0.9, y + 0.2]], rgba(C.paper, 0.75 * fade(t)), { jit: 0.2 * big, seed: i });
      stroke(ctx, [[x - hw, y + tilt * 0.6], [x + hw, y - tilt * 0.6]], {
        w: mix(1.4, 0.85, t) * big, col: rgba(C.ink, (0.6 + Rs() * 0.2) * fade(t)), tin: 0.15, tout: 0.4, wob: 0.4, dry: 0.15, seed: i,
      });
    }
  }
  yield;

  // 5. the ground it crosses: a few rocks and grass tufts, moss dots, thicker near, sparse higher up
  const Rg = own('ground');
  for (let i = 4; i < n - 6; i += 3) {
    const t = tAt(i);
    if (Rg() > 0.34 * fade(t) * (1 - 0.5 * t)) continue;
    const side = Rg() < 0.62 ? 1 : -1;            // mostly on the downhill side
    const [, , nx, ny] = dn[i];
    const off = width(t) * (1.0 + Rg() * 1.6);
    const x = pts[i][0] + side * nx * off, y = pts[i][1] + side * ny * off;
    const sz = mix(1.3, 0.7, t) * big;
    const kind = Rg();
    if (kind < 0.42) rock(env, x, y, sz, own('rock', i));
    else if (kind < 0.85) tuft(env, x, y, sz, own('tuft', i));
    else dots(env, x, y, sz, own('moss', i));
  }
  yield;

  // 6. the bare tree at bend D: a winter tree with crab-claw branches (the Song manner), on the outside of the turn,
  //    leaning out over the slope toward the empty sky on the right
  const [ex, ey] = pts[segIndex(9, 8)];
  bareTree(env, ex + 9 * big, ey + 3, Math.min(big, 1.35), own('tree'));
  yield;

  // 7. the cloud the path goes into: it rises off the right flank over the path's end, densest there, and drifts up
  //    and to the left, thinning, so the peak's west face shows through it; the summit stands clear above
  const [cx, cy] = pts[n - 1];
  cloud(env, cx + 16, cy - 2, 66, 14, 0.86, own('cloud', 1));          // over the path's end
  cloud(env, cx + 50, cy + 12, 44, 11, 0.62, own('cloud', 2));         // hugging the flank below it
  cloud(env, cx - 22, cy - 16, 44, 9, 0.45, own('cloud', 3));          // drifting up-left over the face
  cloud(env, cx - 60, cy - 28, 36, 6, 0.25, own('cloud', 4));          // a thin trailing wisp
  cloud(env, cx - 2, cy + 12, 28, 6, 0.42, own('cloud', 5));           // the fringe the path goes in under
  // and a thin wisp lower down, across the approach, so the path is half lost below as well
  const [wx, wy] = pts[segIndex(5, 8)];
  cloud(env, wx - 8, wy + 2, 46, 5, 0.4, own('wisp'));
  yield;
}

// ---------------------------------------------------------------- the set's own brushes
// index of control point c in the catmull output (seg points per span)
function segIndex(c, seg) { return c * seg; }

// a Catmull-Rom curve through the points, `seg` samples per span
function catmull(P, seg) {
  const out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let s = 0; s < seg; s++) {
      const t = s / seg, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(P[P.length - 1].slice());
  return out;
}
function normal(pts, i) {
  const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
  let nx = -(b[1] - a[1]), ny = b[0] - a[0];
  const l = Math.hypot(nx, ny) || 1;
  return [nx / l, ny / l];
}

/** Mist: a soft elongated wash (a radial gradient: a true soft edge in one fill, at any resolution). */
function mist(env, x, y, rx, ry, a, col) {
  const { ctx, ink } = env;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, ink.rgba(col, a));
  g.addColorStop(0.45, ink.rgba(col, a * 0.8));
  g.addColorStop(0.75, ink.rgba(col, a * 0.35));
  g.addColorStop(1, ink.rgba(col, 0));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(rx, ry);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/**
 * A cloud: a flat soft base with a few soft lumps along its top (the billows), all in the mist colour, so the edge is
 * never an ellipse. (x, y) = the base's centre; w, h = its half-width and half-height; a = the densest alpha.
 */
function cloud(env, x, y, w, h, a, R) {
  const { C } = env.ink;
  mist(env, x, y, w, h, a, C.mist);
  const k = 3 + Math.floor(R() * 3);
  for (let i = 0; i < k; i++) {
    const t = (i + 0.5) / k - 0.5;
    const r = h * (0.8 + R() * 0.7) * (1 - 0.6 * Math.abs(t));
    mist(env, x + t * w * 1.3 + (R() - 0.5) * w * 0.2, y - h * (0.35 + R() * 0.45), r * (1.4 + R() * 0.8), r, a * (0.55 + R() * 0.35), C.mist);
  }
}

/** A rock beside the path: a small lump, its top left pale, a dark broken contour on the shaded side, a dot of moss. */
function rock(env, x, y, s, R) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const w = (4 + R() * 3) * s, h = (2.4 + R() * 1.6) * s;
  const lump = [[x - w * 0.5, y], [x - w * 0.42, y - h * 0.7], [x - w * 0.1, y - h], [x + w * 0.3, y - h * 0.85], [x + w * 0.5, y - h * 0.3], [x + w * 0.48, y]];
  wash(ctx, lump, rgba(mixC(C.ink2, C.paper, 0.55), 0.55), { jit: 0.3 * s, seed: x });
  stroke(ctx, [lump[2], lump[3], lump[4], lump[5]], { w: 0.9 * s, col: rgba(C.ink, 0.6), tin: 0.1, tout: 0.4, wob: 0.5, dry: 0.3, seed: y });
  stroke(ctx, [[x - w * 0.5, y + 0.2], [x + w * 0.5, y + 0.3]], { w: 0.7 * s, col: rgba(C.ink, 0.4), tin: 0.2, tout: 0.5, dry: 0.4, seed: x + 1 });
  if (R() < 0.6) dots(env, x - w * 0.1, y - h * 0.95, s * 0.7, R);
}
/** A grass tuft: three or four short strokes fanning up from one root. */
function tuft(env, x, y, s, R) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const k = 3 + Math.floor(R() * 2);
  for (let i = 0; i < k; i++) {
    const a = -Math.PI / 2 + (i / (k - 1) - 0.5) * 1.3 + (R() - 0.5) * 0.3;
    const l = (2.6 + R() * 2.2) * s;
    stroke(ctx, [[x, y], [x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.55], [x + Math.cos(a) * l, y + Math.sin(a) * l]], {
      w: 0.55 * s, col: rgba(C.ink, 0.45 + R() * 0.25), tin: 0.05, tout: 0.7, wob: 0.3, seed: i + x,
    });
  }
}
/** Moss dots (dian): a few dark dabs. */
function dots(env, x, y, s, R) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const k = 2 + Math.floor(R() * 3);
  for (let i = 0; i < k; i++) {
    ctx.fillStyle = rgba(C.ink, 0.5 + R() * 0.35);
    ctx.beginPath();
    ctx.ellipse(x + (R() - 0.5) * 4 * s, y + (R() - 0.5) * 1.6 * s, (0.6 + R() * 0.4) * s, (0.45 + R() * 0.25) * s, (R() - 0.5) * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}
/**
 * A bare winter tree, crab-claw branches (Li Cheng, Guo Xi): a short dark trunk that leans out and kinks, three or
 * four limbs forking up and outward into a crown wider than the tree is tall, each limb forking again, every twig end
 * hooked down like a claw. (x, y) = the foot; s = scale (1 ~ 40 world px tall); lean > 0 leans right.
 */
function bareTree(env, x, y, s, R, lean = 1) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const H = 40 * s;
  const L = lean * (4 + R() * 3) * s;   // the trunk's lean, world px
  const kink = (R() - 0.5) * 4 * s;
  const trunk = [[x, y + 1], [x + L * 0.15 + kink, y - H * 0.22], [x + L * 0.55 - kink * 0.5, y - H * 0.4], [x + L, y - H * 0.52]];
  stroke(ctx, trunk, { w: 3.0 * s, col: rgba(C.ink, 0.92), tin: 0, tout: 0.5, min: 0.4, wob: 0.55, dry: 0.1, seed: x });
  // a knot and the bark's shade side: one short dry stroke down the trunk
  stroke(ctx, [[trunk[1][0] + 1.1 * s, trunk[1][1] - 2 * s], [trunk[0][0] + 1.2 * s, y - 2 * s]], { w: 0.8 * s, col: rgba(C.paper, 0.5), tin: 0.2, tout: 0.4, dry: 0.4, seed: x + 9 });
  // roots gripping the slope
  stroke(ctx, [[x - 5 * s, y + 1.8], [x - 1.5 * s, y + 0.6], [x + 0.8 * s, y - 2.4 * s]], { w: 1.3 * s, col: rgba(C.ink, 0.6), tin: 0.3, tout: 0.4, seed: x + 2 });
  stroke(ctx, [[x + 5 * s, y + 1.4], [x + 1.2 * s, y]], { w: 1.1 * s, col: rgba(C.ink, 0.5), tin: 0.3, tout: 0.5, seed: x + 3 });
  // limbs at different heights up the trunk: a low one reaching out nearly level against the lean, two rising and
  // spreading, the longest on the leaning side, and the trunk's own top; the crown ends wider than the tree is tall
  const at = (f) => { const q = f * 3, k = Math.min(2, Math.floor(q)), r = q - k; return [mix(trunk[k][0], trunk[k + 1][0], r), mix(trunk[k][1], trunk[k + 1][1], r)]; };
  const LIMBS = [   // [where on the trunk 0..1, side -1..1 (x lean), reach, rise]
    [0.5 + 0.1 * R(), -lean * (0.95 + 0.1 * R()), 14 + R() * 5, 6 + R() * 4],
    [0.7 + 0.1 * R(), -lean * (0.4 + 0.2 * R()), 11 + R() * 5, 15 + R() * 5],
    [0.78 + 0.1 * R(), lean * (0.55 + 0.3 * R()), 15 + R() * 6, 13 + R() * 6],
    [1, lean * (0.15 + 0.2 * R()), 8 + R() * 4, 15 + R() * 5],
  ];
  const limbs = [];
  for (const [f, side, reach, rise] of LIMBS) {
    const from = at(f);
    const end = [from[0] + side * reach * s, from[1] - rise * s];
    const mid = [mix(from[0], end[0], 0.45) + (R() - 0.5) * 2.5 * s, mix(from[1], end[1], 0.6) - 1.2 * s];
    limbs.push([from, mid, end, side]);
    stroke(ctx, [from, mid, end], { w: (f < 0.6 ? 1.9 : 1.6) * s, col: rgba(C.ink, 0.86), tin: 0, tout: 0.65, min: 0.22, wob: 0.45, dry: 0.12, seed: f * 97 + x });
  }
  // twigs off each limb, forking, with claw-hooked tips
  for (const [a, b, c, side] of limbs) {
    // (fewer twigs where the layer is coarse, k < 0.8 device px per world px: there they would only merge into a blot)
    const twigs = env.k < 0.5 ? 1 : env.k < 0.8 ? 2 : 3;
    for (let j = 0; j < twigs; j++) {
      const t = 0.3 + j * (0.81 / twigs) + (R() - 0.5) * 0.1;
      const p = t < 0.5 ? [mix(a[0], b[0], t * 2), mix(a[1], b[1], t * 2)] : [mix(b[0], c[0], t * 2 - 1), mix(b[1], c[1], t * 2 - 1)];
      const dir = R() < 0.35 ? -Math.sign(side || 1) : Math.sign(side || 1);
      const l = (5 + R() * 5) * s * (1.15 - t * 0.45);
      const q = [p[0] + dir * l * 0.75, p[1] - l * 0.75];
      const hook = [q[0] + dir * 1.5 * s, q[1] + 2.0 * s];   // the claw: the tip turns down
      stroke(ctx, [p, [mix(p[0], q[0], 0.5) - dir * 0.6 * s, mix(p[1], q[1], 0.5) - 0.5 * s], q, hook], { w: 0.85 * s, col: rgba(C.ink, 0.8), tin: 0, tout: 0.75, min: 0.2, wob: 0.3, seed: j + p[0] });
      if (R() < 0.75) {
        const r = [q[0] - dir * 2.2 * s, q[1] - 2.8 * s];
        stroke(ctx, [q, r, [r[0] - dir * 1.1 * s, r[1] + 1.5 * s]], { w: 0.6 * s, col: rgba(C.ink, 0.72), tin: 0, tout: 0.8, min: 0.2, seed: j + q[0] });
      }
    }
    for (const d of [-1, 1]) {   // the limb's own end splits into two claws
      const q = [c[0] + d * 2.8 * s, c[1] - 3 * s];
      stroke(ctx, [c, q, [q[0] + d * 1.3 * s, q[1] + 1.7 * s]], { w: 0.6 * s, col: rgba(C.ink, 0.74), tin: 0, tout: 0.8, min: 0.2, seed: d + c[0] });
    }
  }
}
function mixC(A, B, t) { return [mix(A[0], B[0], t), mix(A[1], B[1], t), mix(A[2], B[2], t)]; }
