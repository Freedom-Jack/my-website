// sets/market.ts — Work (stretch 1): the river market at the rainbow bridge, in the manner of the Qingming scroll.
// The town faces the river from the far bank: houses of many sizes and kinds (hip-gable and plain gable roofs in grey
// tile, a few thatched, some turned gable-end to the street, courtyard walls with their trees, lanes running back),
// one larger two-storey house near the bridge with blank signboards, and the back rows lost in mist (the scene
// shader dissolves them). The heavy rainbow bridge of woven timber beams crosses on a long diagonal, its crowd
// standing still, a knot of them at the near rail watching the boat below: it comes up to the bridge bow first, its
// A-frame mast being let down toward the stern, the ropes slack, the crew at the bow hauling, a man on the cabin roof
// calling up. Boats moored along the embankment; pollarded willows, a road, a cook stall, travellers and a laden
// donkey on the near bank.
// Life (anchors only): the three near-bank willows sway, the small punt drifts, the river shimmers, the stall smokes.
//
// A figure set (figures.ts, THE SET API): meta + draw(env), in world px. Painted after plane 2's mist band and the
// water (phase 1), so the river runs under the boats and the bridge.
//
// Cost (budget: 15 ms a layer). The 4a market spent about 11 ms of script on 6,089 strokes, each resampled every
// 0.5-1.6 px with three value-noise lookups a point, and about 10 ms rasterising them. This set carries its own kit
// (below): ribbons resampled every 1-3 px on a noise table, each figure a handful of shapes, back rows simplified
// (the shader dissolves them anyway), and a layer rect cut to what any window can see.

import { willowTip, swallowInk, reflectIn, ripples } from './young';
import {
  REF_PX, VH_PX, SCENE_FIELDS, sceneField, streams, rng, vnoise, resample, mix, mix3, smooth, D, anchor, bounds, ownSprite,
  stroke, wash, ellipse,
  type Ctx2D, type Env, type FigureMeta, type Inks, type Pt, type RGB, type Rng, type StrokeOptions,
} from '../figures';

// The rect: the river and its town from u 1.0 to 2.12 (both ends melt into mist over 13 %: round 5, the town grows out
// of the countryside under his mountain's foot and goes back into it before the lake), and from scene height 0.10 (the
// near bank's land fades out above it) up to 0.42 (above the back rows' roofs and the masts; the town's highest point
// is about 0.38).
export const meta: FigureMeta = { rect: [1.0, 2.12, 0.10, 0.95], plane: 2, phase: 1 };   // (up into the sky for the willow and the swallows)

const SEED = 11;

interface InkItem { layer: number; f: boolean; col: string; w: number; pts: Pt[] }
interface FolkOptions {
  flip?: boolean;
  pose?: 'stand' | 'bend' | 'sit';
  lean?: number;
  robe?: RGB;
  robes?: [RGB, number][];
  shadow?: boolean;
  arm?: 'up' | 'rail' | 'haul' | 'sleeve' | 'none';
  hat?: 'cone' | 'cap';
  load?: 'pole' | 'pack' | 'punt' | 'staff';
  rope?: Pt;
}
interface BuildingOptions { far?: number; wall?: number; thatch?: boolean; k?: number }
interface HallOptions extends BuildingOptions {
  d?: number;
  rh?: number;
  ov?: number;
  roof?: 'hip' | 'gable';
  front?: 'shop' | 'window' | 'door' | 'blank';
  wideShop?: boolean;
  storey?: boolean;
  awning?: boolean;
}
interface GableEndOptions extends BuildingOptions { d?: number; rh?: number; front?: 'shop' | 'door' }
interface CraftOptions {
  s?: number;
  dir?: number;
  beam?: number;
  hull?: number;
  cabin?: boolean;
  c0?: number;
  c1?: number;
  ch?: number;
  mast?: 'up' | 'aframe' | 'down' | 'none';
  mastAngle?: number;
  mastLen?: number;
}
interface RainbowOptions {
  dir?: Pt;
  bw?: number;
  ramp?: number;
  T?: number;
  skew?: number;
  people?: number;
  fs?: number;
  railKnot?: [t: number, w: number][];
  stalls?: [t: number, w: number][];
}
interface MooredBoat { key: string; x: number; y: number; L: number; o: CraftOptions & { s: number; crew?: [u: number, w: number, opt: FolkOptions][] } }

// ------------------------------------------------------------------------------------------------ the set's own kit
// An element's brushwork in layers: shapes are collected with a layer number (the wall before its shopfront, the
// robes before the heads) and laid down layer by layer, in the order they were made inside a layer. Each shape keeps
// its own fill, so where strokes cross the ink darkens, as it does on paper. (Measured, 2026-10-15: joining shapes
// into shared paths saved nothing in Chrome's canvas, whose cost here is the points and the pixels, not the calls;
// what made this set cheaper than 4a is fewer, coarser strokes and a cheaper noise.)
class Ink {
  declare ctx: Ctx2D;
  declare items: InkItem[];
  constructor(ctx: Ctx2D) { this.ctx = ctx; this.items = []; }
  fill(col: string, pts: Pt[], layer = 0) { if (pts.length > 2) this.items.push({ layer, f: true, col, w: 0, pts }); }
  line(col: string, w: number, pts: Pt[], layer = 0) { if (pts.length > 1) this.items.push({ layer, f: false, col, w: Math.max(0.2, w), pts }); }
  flush() {
    const { ctx } = this;
    const list = this.items.sort((a, b) => a.layer - b.layer);   // stable: the order made inside a layer
    let fs = '', ss = '', lw = -1;
    for (const { f, col, w, pts } of list) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      if (f) {
        ctx.closePath();
        if (col !== fs) { ctx.fillStyle = col; fs = col; }
        ctx.fill();
      } else {
        if (col !== ss) { ctx.strokeStyle = col; ss = col; }
        if (w !== lw) { ctx.lineWidth = w; lw = w; }
        ctx.stroke();
      }
    }
    this.items = [];
  }
}

// cheap 1D noise (a table, smoothly read): the brush's breathing, jitter and dry breaks, 1 lookup instead of 4 hashes
let NT: Float32Array | null = null;
function noiseTable() {
  if (NT) return;
  const R = rng(4111);
  NT = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) NT[i] = R();
}
function nz(x: number) {
  const j = Math.floor(x), t = x - j, a = NT![j & 1023], b = NT![(j + 1) & 1023];
  return a + (b - a) * t * t * (3 - 2 * t);
}

/**
 * A tree as the painters set one small in a far village (round 5; after the terraces' field tree): a short trunk,
 * most of it hidden by a broad, domed crown of horizontal dots over a faint wash, darkest on its shaded lower right, so
 * it reads as a tree at a few px. (x, y) the foot; s the scale (1 ~ 16 world px tall).
 */
function villageTree(env: Env, x: number, y: number, s: number, R: Rng, pale = false) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  // a short trunk under a domed crown that sits low on it (at a few px a long stem under a flat crown reads as a palm)
  const H = 8 * s * (0.85 + R() * 0.3);
  const lean = (R() - 0.5) * 1.6 * s;
  const rx = (6 + R() * 2) * s, ry = (4.4 + R() * 1) * s;
  const cx = x + lean, cy = y - H - ry * 0.25;
  stroke(ctx, [[x, y + 0.4], [x + lean * 0.5 + (R() - 0.5) * 0.6 * s, y - H * 0.5], [cx, cy + ry * 0.3]], { w: 1.3 * s, col: rgba(C.ink, 0.75), tin: 0, tout: 0.4, wob: 0.5, seed: x });
  const leaf = ink.strength > 0 ? mix3(C.ink, C.malD, pale ? 0.32 : 0.18) : (pale ? mix3(C.ink, C.white, 0.28) : C.ink);
  const body = ink.strength > 0 ? mix3(C.ink2, C.malD, pale ? 0.42 : 0.3) : mix3(C.ink2, C.white, pale ? 0.5 : 0.3);
  const j = () => (R() - 0.5) * 1.4 * s;
  // the dome: two clusters low and wide, one high, one in front low
  const B: [x: number, y: number, rx: number, ry: number][] = [
    [cx - rx * 0.5 + j(), cy + ry * 0.2 + j(), rx * 0.62, ry * 0.7],
    [cx + rx * 0.48 + j(), cy + ry * 0.25 + j(), rx * 0.6, ry * 0.68],
    [cx + j(), cy - ry * 0.4 + j(), rx * 0.66, ry * 0.75],
    [cx + rx * 0.05 + j(), cy + ry * 0.5, rx * 0.55, ry * 0.5],
  ];
  for (const [bx, by, bx2, by2] of B) wash(ctx, ellipse(bx, by, bx2, by2, 12), rgba(body, pale ? 0.3 : 0.4), { jit: 0.5 * s, seed: bx });
  for (const [bx, by, brx, bry] of B) {
    for (let i = 0, n = 12 + Math.floor(R() * 5); i < n; i++) {
      const ang = R() * Math.PI * 2, rr = Math.sqrt(R());
      const px = bx + Math.cos(ang) * brx * rr * 0.92, py = by + Math.sin(ang) * bry * rr * 0.92;
      const shade = Math.min(1, Math.max(0, 0.45 + (py - by) / (bry * 2) + (px - bx) / (brx * 3)));
      const L = (1.3 + R() * 0.8) * s;
      stroke(ctx, [[px - L * 0.5, py + 0.15 * s], [px + L * 0.5, py - 0.15 * s]], { w: (1.0 + R() * 0.45) * s, col: rgba(leaf, (pale ? 0.3 : 0.4) + shade * 0.36), tin: 0.2, tout: 0.5, wob: 0.3, seed: i + bx });
    }
  }
}

/** A soft patch of wash (an ellipse fading out from its middle): grass, a field, a bank of mist. */
function softPatch(ctx: Ctx2D, cx: number, cy: number, rx: number, ry: number, col: string) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, col);
  g.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** A brush ribbon into the batch: loaded start, thinning tail, breathing width, never on a ruler, dry breaks. */
function rib(B: Ink, col: string, pts: Pt[], o: StrokeOptions = {}, layer = 0) {
  const w = o.w ?? 1, tin = Math.max(1e-3, o.tin ?? 0.12), tout = Math.max(1e-3, o.tout ?? 0.4), mn = o.min ?? 0.3;
  const wob = o.wob ?? 0.3, dry = o.dry ?? 0, sd = (Math.abs(o.seed ?? 1) * 13.7) % 900;
  // points every 1-3 world px (the shared stroke() takes 0.5-1.6): the noise runs on the arc length, so the brush
  // breathes at the same rate along the stroke whatever the spacing
  const st = Math.max(1.0, Math.min(3.0, w * 1.7));
  const Q = resample(pts, st);
  const n = Q.length;
  if (n < 2) return;
  let L: Pt[] = [], Rr: Pt[] = [];
  const emit = () => { if (L.length > 1) B.fill(col, L.concat(Rr.reverse()), layer); L = []; Rr = []; };
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), q = i * st;
    const a = Q[i > 0 ? i - 1 : 0], b = Q[i < n - 1 ? i + 1 : n - 1];
    let nx = a[1] - b[1], ny = b[0] - a[0];
    const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    let tw = Math.min(1, mn + (1 - mn) * smooth(0, tin, t)) * Math.min(1, mn + (1 - mn) * (1 - smooth(1 - tout, 1, t)));
    tw *= 1 + wob * (nz(q * 0.33 + sd) - 0.5) * 2;
    const hw = Math.max(0.14, w * tw * 0.5), j = (nz(q * 0.26 + sd + 333) - 0.5) * w * 0.25;
    if (dry <= 0 || nz(q * 0.2 + sd + 666) > dry * (0.45 + 0.55 * t)) {
      L.push([Q[i][0] + nx * (hw + j), Q[i][1] + ny * (hw + j)]);
      Rr.push([Q[i][0] - nx * (hw - j), Q[i][1] - ny * (hw - j)]);
    } else emit();
  }
  emit();
}
/** A wash shape whose edge wanders a little. */
function wsh(B: Ink, col: string, pts: Pt[], jit = 0.35, seed = 7, layer = 0) {
  B.fill(col, jit > 0 ? pts.map(([x, y], i) => [x + (nz(i * 1.7 + seed) - 0.5) * jit * 2, y + (nz(i * 2.3 + seed + 50) - 0.5) * jit * 2]) : pts, layer);
}
function oval(cx: number, cy: number, rx: number, ry: number, n = 8, rot = 0) {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + rot; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  return pts;
}
/** Split a polyline into broken runs (minLen..maxLen) with gaps of about `gap`. */
function brokenRuns(pts: Pt[], R: Rng, minLen: number, maxLen: number, gap: number) {
  const out: Pt[][] = [];
  let cur: Pt[] = [], len = 0, want = minLen + R() * (maxLen - minLen), skip = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (skip > 0) { skip -= d; continue; }
    cur.push(pts[i - 1]);
    len += d;
    if (len >= want) { cur.push(pts[i]); if (cur.length > 1) out.push(cur); cur = []; len = 0; want = minLen + R() * (maxLen - minLen); skip = gap * (0.4 + R() * 1.2); }
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

// ------------------------------------------------------------------------------------------------ people
// Small Song figures, 8-11 px: what makes them read as people at that size is a dark head over a robe that has a
// shape (narrow shoulders, a flared hem, a sleeve on one side) and a pose. Robes are light and mid (white, pale and
// mid indigo, grey, a few dark jackets); heads are always ink. Poses: standing, bent (carrying, peering), at a rail,
// pointing, hauling, sitting, a carrying pole, a pack. Nobody walks.
function robesOf(C: Inks['C']): [RGB, number][] {
  return [[C.white, 0.24], [mix3(C.white, C.indigoP, 0.5), 0.22], [mix3(C.indigoP, C.indigo, 0.35), 0.2], [mix3(C.ink2, C.white, 0.5), 0.2], [mix3(C.ink2, C.indigo, 0.3), 0.14]];
}
function pick(list: [RGB, number][], r: number) {
  let a = 0;
  for (const [v, p] of list) { a += p; if (r < a) return v; }
  return list[list.length - 1][0];
}
function folk(B: Ink, env: Env, x: number, y: number, s: number, R: Rng, o: FolkOptions = {}) {
  const { C, rgba } = env.ink;
  const dir = o.flip ? -1 : 1;
  const pose = o.pose || 'stand';
  const h = 10 * s;
  const lean = o.lean ?? (R() - 0.5) * 0.16;
  let sx: number, sy: number;
  if (pose === 'sit') { sx = x + dir * 0.3 * s; sy = y - 0.4 * h; }
  else if (pose === 'bend') { sx = x + dir * 1.9 * s; sy = y - 0.55 * h; }
  else { sx = x + lean * 0.7 * h; sy = y - (0.66 + R() * 0.05) * h; }
  const robe = o.robe || pick(o.robes || robesOf(C), R());
  const hw = (pose === 'sit' ? 2.5 : 1.7 + R() * 0.5) * s;
  const hemY = y - 0.2 * s, sk = (R() - 0.5) * 0.7 * s;
  const shL: Pt = [sx - 0.95 * s, sy + 0.3 * s], shR: Pt = [sx + 1.0 * s, sy + 0.15 * s];
  const hemL: Pt = [x - hw + sk, hemY], hemR: Pt = [x + hw * 0.92 + sk, hemY - 0.2 * s];
  const midL: Pt = [mix(shL[0], hemL[0], 0.45) - 0.25 * s, mix(shL[1], hemL[1], 0.45)];
  const midR: Pt = [mix(shR[0], hemR[0], 0.45) + 0.3 * s, mix(shR[1], hemR[1], 0.45)];
  const hemC: Pt = [x + sk * 0.6 + dir * 0.3 * s, hemY + 0.3 * s];
  if (o.shadow !== false) B.line(rgba(C.ink, 0.1), 0.9 * s, [[x - 2 * s, y + 0.4], [x + 2.8 * s, y + 0.5]], 0);
  B.fill(rgba(robe, 0.95), [shL, shR, midR, hemR, hemC, hemL, midL], 1);
  // the robe's edge: the shade side and the hem in ink, the lit side faint (a white robe needs both to exist)
  B.line(rgba(C.ink, 0.5), 0.3 * s, [shR, midR, hemR, hemC, hemL], 2);
  B.line(rgba(C.ink, 0.3), 0.26 * s, [shL, midL, hemL], 2);
  // arms
  const arm = o.arm || (R() < 0.25 ? 'sleeve' : 'none');
  const armC = rgba(C.ink, 0.6), aw = 0.42 * s;
  if (arm === 'up') B.line(armC, aw, [[sx + dir * 0.8 * s, sy + 0.7 * s], [sx + dir * 2.0 * s, sy - 0.6 * s], [sx + dir * 2.7 * s, sy - 1.8 * s]], 2);
  else if (arm === 'rail') B.line(armC, aw, [[sx + dir * 0.8 * s, sy + 0.7 * s], [sx + dir * 2.2 * s, sy + 1.6 * s], [sx + dir * 3.0 * s, sy + 2.4 * s]], 2);
  else if (arm === 'haul') { B.line(armC, aw, [[sx + dir * 0.6 * s, sy + 0.8 * s], [sx + dir * 2.6 * s, sy + 0.2 * s]], 2); B.line(armC, aw, [[sx + dir * 0.2 * s, sy + 1.2 * s], [sx + dir * 2.4 * s, sy + 0.9 * s]], 2); }
  else if (arm === 'sleeve') B.line(rgba(C.ink, 0.42), 0.36 * s, [[sx + dir * 0.9 * s, sy + 0.6 * s], [sx + dir * 1.4 * s, sy + 3.2 * s]], 2);
  // head: always ink (hair, a soft cap); a cone hat for labourers and boatmen
  const hx = sx + lean * 1.8 * s + (pose === 'bend' ? dir * 1.1 * s : 0);
  const hy = sy - (pose === 'bend' ? 0.7 : 1.25) * s;
  B.fill(rgba(C.ink, 0.86), oval(hx, hy, 0.95 * s, 1.0 * s, 7), 3);
  if (o.hat === 'cone') {
    B.fill(rgba(mix3(C.white, C.ink2, 0.3), 0.96), [[hx - 2.5 * s, hy + 0.05 * s], [hx + 2.5 * s, hy - 0.15 * s], [hx + 0.15 * s, hy - 1.9 * s]], 4);
    B.line(rgba(C.ink, 0.62), 0.28 * s, [[hx - 2.5 * s, hy + 0.05 * s], [hx + 0.15 * s, hy - 1.9 * s], [hx + 2.5 * s, hy - 0.15 * s]], 5);
  } else if (o.hat !== 'cap') B.fill(rgba(C.ink, 0.86), oval(hx + dir * 0.1 * s, hy - 1.05 * s, 0.45 * s, 0.42 * s, 5), 3);
  // what they carry
  if (o.load === 'pole') {
    const a: Pt = [sx - 5.2 * s, sy + 0.4 * s], b: Pt = [sx + 5.2 * s, sy - 0.3 * s];
    B.line(rgba(C.ink, 0.82), 0.45 * s, [a, b], 2);
    for (const p of [a, b]) {
      B.line(rgba(C.ink, 0.45), 0.25 * s, [p, [p[0], p[1] + 2.8 * s]], 2);
      B.fill(rgba(mix3(C.ink2, C.timber, 0.45), 0.85), [[p[0] - 1.3 * s, p[1] + 2.8 * s], [p[0] + 1.3 * s, p[1] + 2.8 * s], [p[0] + 1.0 * s, p[1] + 4.7 * s], [p[0] - 1.0 * s, p[1] + 4.7 * s]], 4);
    }
  } else if (o.load === 'pack') {
    B.fill(rgba(mix3(C.ink2, C.white, 0.3), 0.92), oval(sx - dir * 1.5 * s, sy + 1.4 * s, 1.3 * s, 1.6 * s, 7), 4);
  } else if (o.load === 'punt') {
    B.line(rgba(C.ink, 0.88), 0.45 * s, [[sx + dir * 1.4 * s, sy - 3.4 * s], [sx - dir * 6.5 * s, y + 8.5 * s]], 5);
  } else if (o.load === 'staff') {
    B.line(rgba(C.ink, 0.85), 0.4 * s, [[sx + dir * 1.7 * s, sy - 0.6 * s], [x + dir * 2.4 * s, y + 0.2 * s]], 5);
  }
  if (o.rope) B.line(rgba(C.ink, 0.5), 0.26 * s, [[sx + dir * 2.5 * s, sy + 0.5 * s], o.rope], 5);
}
/** A laden donkey (the scroll's beasts of burden), facing dir; (x, y) its hind feet. */
function donkey(B: Ink, env: Env, x: number, y: number, s: number, R: Rng, o: { flip?: boolean; load?: boolean } = {}) {
  const { C, rgba } = env.ink;
  const dir = o.flip ? -1 : 1;
  const coat = rgba(mix3(C.ink2, C.white, 0.42), 0.95);
  const bx = x + dir * 3.6 * s, by = y - 4.4 * s;
  B.fill(coat, oval(bx, by, 3.7 * s, 1.75 * s, 9, (R() - 0.5) * 0.1), 1);
  const head: Pt[] = [[bx + dir * 3.0 * s, by - 0.6 * s], [bx + dir * 4.6 * s, by - 3.0 * s], [bx + dir * 6.0 * s, by - 2.2 * s], [bx + dir * 5.0 * s, by - 1.4 * s], [bx + dir * 3.6 * s, by + 0.6 * s]];
  B.fill(coat, head, 1);
  B.line(rgba(C.ink, 0.7), 0.32 * s, [[bx + dir * 4.5 * s, by - 3.0 * s], [bx + dir * 4.2 * s, by - 4.3 * s]], 2);   // an ear
  for (const lx of [-2.6, -1.6, 2.0, 2.9]) B.line(rgba(C.ink, 0.72), 0.42 * s, [[bx + dir * lx * s, by + 1.2 * s], [bx + dir * (lx + (R() - 0.5) * 0.6) * s, y]], 2);
  B.line(rgba(C.ink, 0.5), 0.3 * s, [[bx - dir * 3.2 * s, by - 0.8 * s], [bx + dir * 2.0 * s, by - 1.7 * s], [bx + dir * 4.8 * s, by - 3.0 * s]], 2);
  B.line(rgba(C.ink, 0.42), 0.3 * s, [[bx - dir * 3.7 * s, by - 0.2 * s], [bx - dir * 4.4 * s, by + 1.8 * s]], 2);   // the tail
  if (o.load !== false) {   // two bundles across its back
    B.fill(rgba(mix3(C.white, C.ink2, 0.22), 0.96), [[bx - 2.6 * s, by - 1.2 * s], [bx + 2.2 * s, by - 1.6 * s], [bx + 2.6 * s, by + 0.9 * s], [bx - 2.4 * s, by + 1.2 * s]], 3);
    B.line(rgba(C.ink, 0.55), 0.3 * s, [[bx - 2.6 * s, by - 1.2 * s], [bx + 2.2 * s, by - 1.6 * s], [bx + 2.6 * s, by + 0.9 * s]], 4);
  }
}

// ------------------------------------------------------------------------------------------------ buildings
// Song oblique projection (figures.ts D): fronts, tops and right-hand sides. Every house is its own batch; the town is
// painted back row first and each row left to right, so a house covers the right side of the one before it.

/** Paleness and the colours a house uses at depth `far` (0 front .. 1 back row). o.k (round 5): the town's key there,
 *  1 at the focus (the bridge, the landmark, the big boat), lighter away from it: the town stands on the far bank, so
 *  away from the focus its line and tile step back a breath (the paper reserve stays whole). */
function houseInk(env: Env, far: number, R: Rng, o: BuildingOptions, x = 0) {
  const { C, rgba } = env.ink;
  const A = 1 - 0.45 * far;
  const kk = o.k ?? 1;
  const wall = mix3(C.wall, C.ink2, (o.wall ?? 0) + 0.04 + R() * 0.12 + far * 0.08);
  // (atmospheric perspective toward ice: the front row crisp slate-blue, the back rows dissolving into the air)
  const ICE: RGB = [206, 226, 238];
  const tile0 = o.thatch ? mix3(mix3(C.timber, C.ink2, 0.5), C.white, 0.15 + far * 0.2) : mix3(C.tile, C.white, 0.02 + R() * 0.12);
  // (glazed jade-slate roofs, gathered in one or two groups along the front rows (by x, no extra random draws, so the
  // town's streams and the bridge's identity hold): the young colour in the town itself)
  const gl = o.thatch ? 0 : Math.pow(Math.max(0, Math.sin(x * 0.0041 + 4.69)), 2.5) * (1 - far * 0.7) * 0.85;
  const tile = mix3(mix3(mix3(tile0, [52, 122, 128], gl), ICE, far * 0.62), C.paper, (1 - kk) * 0.8);
  const lineC = mix3(mix3(C.navy, C.ink, 0.4), [120, 150, 172], far * 0.8);
  return { C, rgba, A, wall: mix3(wall, ICE, far * 0.3), tile, side: mix3(mix3(mix3(wall, C.ink2, 0.26), ICE, far * 0.4), C.paper, (1 - kk) * 0.6), line: (a: number) => rgba(lineC, a * A * kk), far };
}

/**
 * A house facing the street: (x, y) the front-left foot, w wide, h to the eaves. o.roof: 'hip' (hip-gable, the town's
 * usual), 'gable' (a plain overhanging gable, ridge the whole width), o.thatch; o.front: 'shop' | 'window' | 'door' |
 * 'blank'; o.storey (a balcony and a pent eave), o.awning. Returns { top } (the ridge's height, world px).
 */
function hall(env: Env, x: number, y: number, w: number, h: number, R: Rng, o: HallOptions = {}) {
  const B = new Ink(env.ctx);
  const far = o.far ?? 0;
  const K = houseInk(env, far, R, o, x);
  const { C, rgba, A } = K;
  const d = o.d ?? w * (0.4 + R() * 0.25);
  const ox = D[0] * d, oy = D[1] * d;
  const rh = o.rh ?? h * (0.5 + R() * 0.35);
  const ov = o.ov ?? Math.min(4, w * (0.08 + R() * 0.05));
  const sk = (R() - 0.5) * 0.5;
  const gable = o.roof === 'gable';
  const rLx = x + w * (gable ? 0.02 : 0.14 + R() * 0.05) + ox * 0.5 + sk, rRx = x + w * (gable ? 0.98 : 0.86 - R() * 0.05) + ox * 0.5 + sk;
  const ry = y - h - rh + oy * 0.5;
  // the paper reserve: a nearer house hides what is behind it
  B.fill(rgba(C.paper, A), [[x - ov, y + 0.6], [x + w, y + 0.6], [x + w + ox, y + oy + 0.6], [x + w + ov + ox, y - h + oy], [rRx + (gable ? ov : 0), ry], [rLx, ry], [x - ov, y - h]], 0);
  // walls: the right side in shade, the lime-washed front
  wsh(B, rgba(K.side, 0.95 * A), [[x + w, y], [x + w + ox, y + oy], [x + w + ox, y + oy - h], [x + w, y - h]], 0.3, x, 1);
  wsh(B, rgba(K.wall, 0.97 * A), [[x, y], [x + w, y], [x + w + sk, y - h], [x + sk, y - h]], 0.3, x + 1, 1);
  const front = o.front ?? (far < 0.6 ? 'shop' : 'blank');
  if (front === 'shop' && far < 0.6) {   // an open shopfront: the dark interior, a counter, the goods
    const s0 = x + w * (0.08 + R() * 0.08), s1 = x + w * (o.wideShop ? 0.92 : 0.55 + R() * 0.15);
    wsh(B, rgba(mix3(C.ink2, C.wall, 0.3), 0.66 * A), [[s0, y - h * 0.12], [s1, y - h * 0.12], [s1, y - h * 0.88], [s0, y - h * 0.88]], 0.4, x + 2, 2);
    B.line(rgba(mix3(C.timber, C.ink, 0.35), 0.8 * A), 0.9, [[s0 - 0.6, y - h * 0.36], [s1 + 0.6, y - h * 0.38]], 3);
    for (let i = 0; i < 4; i++) if (R() > 0.45) B.fill(rgba(i % 2 ? C.ink2 : C.indigoP, 0.6 * A), oval(mix(s0, s1, 0.15 + i * 0.22), y - h * 0.45, 0.75, 0.6, 5), 3);
  } else if (front === 'window' && far < 0.8) {
    const wx = x + w * (0.25 + R() * 0.3), ww = w * 0.22;
    wsh(B, rgba(mix3(C.ink2, C.wall, 0.5), 0.5 * A), [[wx, y - h * 0.4], [wx + ww, y - h * 0.4], [wx + ww, y - h * 0.74], [wx, y - h * 0.74]], 0.3, x + 3, 2);
    for (let i = 1; i < 4; i++) B.line(K.line(0.3), 0.3, [[wx + ww * i / 4, y - h * 0.4], [wx + ww * i / 4, y - h * 0.74]], 3);
  } else if (front === 'door' && far < 0.8) {
    const dx = x + w * (0.4 + R() * 0.2);
    wsh(B, rgba(mix3(C.ink2, C.wall, 0.25), 0.7 * A), [[dx, y], [dx + 3.2, y], [dx + 3.2, y - h * 0.62], [dx, y - h * 0.62]], 0.2, x + 4, 2);
  }
  if (far < 0.35) {   // posts and the wall's edges: broken lines, never a clean box
    const posts = Math.max(2, Math.round(w / 12) + 1), pc = rgba(mix3(C.timber, C.ink, 0.45), 0.72 * A);
    for (let i = 0; i < posts; i++) { const px = x + (w * i) / (posts - 1) + (R() - 0.5) * 0.5; B.line(pc, 0.7, [[px, y + 0.3], [px + sk, y - h]], 3); }
    B.line(K.line(0.5), 0.55, [[x + w + ox, y + oy], [x + w + ox, y + oy - h]], 3);
  }
  if (far < 0.6) rib(B, K.line(0.45), [[x - 0.6, y + 0.4], [x + w + 0.5, y + 0.3], [x + w + ox, y + oy + 0.3]], { w: 0.8, tin: 0.05, tout: 0.1, dry: 0.2, seed: x }, 3);
  if (o.storey && far < 0.5) {   // an upper floor: a pent eave and a balcony rail
    const my = y - h * 0.52;
    wsh(B, rgba(K.tile, 0.7 * A), [[x - w * 0.07, my + 0.8], [x + w * 1.07, my + 0.8], [x + w * 1.0, my - h * 0.09], [x, my - h * 0.09]], 0.2, x + 5, 4);
    rib(B, K.line(0.85), [[x - w * 0.07, my + 0.8], [x + w * 1.07, my + 0.6]], { w: 1.0, tin: 0.05, tout: 0.05, seed: x + 5 }, 6);
    const ry2 = my - h * 0.14;
    B.line(K.line(0.7), 0.5, [[x + 0.5, ry2 - h * 0.12], [x + w - 0.5, ry2 - h * 0.12]], 6);
    for (let i = 0; i <= 8; i++) B.line(K.line(0.45), 0.35, [[x + 0.5 + (w - 1) * i / 8, ry2], [x + 0.5 + (w - 1) * i / 8, ry2 - h * 0.12]], 6);
  }
  // the roof: the eave (lifted at the corners), the right end (a hip, or a gable wall under its barge board)
  const ey = y - h + 0.6;
  const lift = Math.max(0.8, w * (0.025 + R() * 0.02)) * (o.thatch ? 0.4 : 1);
  const eave: Pt[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    eave.push([x - ov + sk + (w + 2 * ov) * t, ey + Math.sin(Math.PI * t) * lift * 0.45 - Math.pow(Math.abs(t * 2 - 1), 6) * lift]);
  }
  const eF = eave[10], eB: Pt = [x + w + ov + ox + sk, ey + oy - lift];
  const rL: Pt = [rLx, ry], rR: Pt = [rRx, ry];
  if (gable) {
    wsh(B, rgba(mix3(K.side, C.wall, 0.3), 0.95 * A), [[x + w + sk, y - h], [x + w + ox, y - h + oy], [rRx + 0.4, ry + 1.2]], 0.2, x + 6, 4);
  } else wsh(B, rgba(mix3(K.tile, C.ink, 0.3), 0.86 * A), [eF, eB, rR], 0.3, x + 6, 4);
  wsh(B, rgba(K.tile, (o.thatch ? 0.75 : 0.7) * A), [...eave, rR, rL], 0.3, x + 7, 4);
  if (far < 0.35) {   // tile rows down the slope from the eave (a few, broken); thatch: streaks
    const rows = Math.max(4, Math.round(w / 2.6));
    const tc = K.line(o.thatch ? 0.26 : 0.3);
    for (let i = 1; i < rows; i++) {
      if (nz(i * 0.7 + x * 0.1) < 0.34) continue;
      const t = i / rows, ex = eave[0][0] + (eF[0] - eave[0][0]) * t, eyy = ey + 0.5;
      const tx = mix(rL[0], rR[0], t), len = 0.32 + 0.4 * nz(i * 1.3 + x);
      B.line(tc, 0.4, [[ex, eyy], [mix(ex, tx, len), mix(eyy, ry, len)]], 5);
    }
  }
  rib(B, K.line(0.88), eave, { w: 1.05, tin: 0.06, tout: 0.08, wob: 0.3, seed: x * 0.1 }, 6);
  rib(B, K.line(0.75), gable ? [eF, [rR[0] + ov * 0.6, rR[1]]] : [eF, eB], { w: 0.75, tin: 0.05, tout: 0.2, seed: x + 8 }, 6);
  if (far < 0.6) {   // the hips' lines (the back rows, lost in mist, keep only eave and ridge)
    if (!gable) rib(B, K.line(0.55), [eF, rR], { w: 0.6, tin: 0.05, tout: 0.1, dry: 0.15, seed: x + 9 }, 6);
    else rib(B, K.line(0.5), [[rR[0] + ov * 0.6, rR[1]], eB], { w: 0.55, tin: 0.05, tout: 0.15, dry: 0.2, seed: x + 9 }, 6);
    rib(B, K.line(0.5), [eave[0], rL], { w: 0.55, tin: 0.05, tout: 0.1, dry: 0.2, seed: x + 10 }, 6);
  }
  const rr: Pt[] = gable ? [[rL[0] - 1.0, rL[1] - 0.6], rL, [rR[0] + ov * 0.6, rR[1]], [rR[0] + ov * 0.6 + 1.0, rR[1] - 0.6]] : [[rL[0] - 1.3, rL[1] - 1.1], rL, rR, [rR[0] + 1.3, rR[1] - 1.1]];
  rib(B, K.line(o.thatch ? 0.7 : 0.9), rr, { w: o.thatch ? 1.2 : 1.6, tin: 0.12, tout: 0.12, wob: 0.25, seed: x + 11 }, 6);
  if (!o.thatch && far < 0.5) {
    // the light catches the ridge and the upper slope: a white line just over the ridge, a pale band under it
    wsh(B, rgba(C.light, 0.28 * A), [rL, rR, [mix(rR[0], eF[0], 0.22), mix(rR[1], eF[1], 0.22)], [mix(rL[0], eave[0][0], 0.22), mix(rL[1], eave[0][1], 0.22)]], 0.2, x + 12, 6);
    rib(B, rgba(C.light, 0.9 * A), rr.map(([px, py]): Pt => [px, py - 1.15]), { w: 0.7, tin: 0.15, tout: 0.15, wob: 0.15, dry: 0.15, seed: x + 13 }, 6);
  }
  if (far < 0.5 && R() < 0.3) {   // a lit window or two, pale cyan
    const nw = 1 + Math.floor(R() * 2);
    for (let i = 0; i < nw; i++) { const lx = x + w * (0.2 + R() * 0.6), ly = y - h * (0.5 + R() * 0.2); B.fill(rgba([196, 238, 246], 0.92 * A), oval(lx, ly, 1.1, 0.9, 6), 7); }
  }
  if (o.awning && far < 0.4) {   // a cloth shade on two poles over the street
    const a0 = x + w * 0.08, a1 = x + w * 0.8, ay = y - h * 0.8, fy = y + h * 0.42, fx = -w * 0.03;
    const cl = R() < 0.5 ? C.white : mix3(C.indigoP, C.white, 0.3);
    B.fill(rgba(cl, 0.93), [[a0, ay], [a1, ay], [a1 + fx, fy - h * 0.6], [a0 + fx, fy - h * 0.6]], 7);
    B.line(rgba(C.ink, 0.75), 0.6, [[a0 + fx, fy - h * 0.6], [a1 + fx, fy - h * 0.6]], 7);
    B.line(rgba(C.ink, 0.75), 0.5, [[a0 + fx, fy - h * 0.6], [a0 + fx, fy]], 7);
    B.line(rgba(C.ink, 0.75), 0.5, [[a1 + fx, fy - h * 0.6], [a1 + fx, fy]], 7);
  }
  B.flush();
  return { top: ry };
}

/**
 * A house turned gable-end to the street, its ridge running back into the town: the gable wall (a pentagon) with a
 * door or a shopfront, the long side wall in shade, both slopes of the roof (the far one a sliver above the ridge).
 * (x, y) the front-left foot; w the gable's width; d its depth.
 */
function gableEnd(env: Env, x: number, y: number, w: number, h: number, R: Rng, o: GableEndOptions = {}) {
  const B = new Ink(env.ctx);
  const far = o.far ?? 0;
  const K = houseInk(env, far, R, o, x);
  const { C, rgba, A } = K;
  const d = o.d ?? w * (1.1 + R() * 0.6);
  const ox = D[0] * d, oy = D[1] * d;
  const rh = o.rh ?? w * (0.36 + R() * 0.22);
  const ov = Math.min(3, w * 0.12);
  const ap: Pt = [x + w * 0.5, y - h - rh];
  const eL: Pt = [x - ov, y - h + 0.8 + ov * 0.5], eR: Pt = [x + w + ov, y - h + 0.8 + ov * 0.5];
  const sh = (p: Pt): Pt => [p[0] + ox, p[1] + oy];
  B.fill(rgba(C.paper, A), [[x - ov, y + 0.6], [x + w, y + 0.6], [x + w + ox, y + oy + 0.6], sh(eR), sh(ap), sh(eL), eL, ap], 0);
  wsh(B, rgba(mix3(K.tile, C.white, 0.15), 0.62 * A), [eL, ap, sh(ap), sh(eL)], 0.25, x, 1);   // the far slope, mostly hidden
  wsh(B, rgba(K.side, 0.95 * A), [[x + w, y], [x + w + ox, y + oy], [x + w + ox, y + oy - h], [x + w, y - h]], 0.3, x + 1, 1);
  wsh(B, rgba(K.tile, 0.72 * A), [ap, eR, sh(eR), sh(ap)], 0.3, x + 2, 2);   // the near slope
  wsh(B, rgba(K.wall, 0.97 * A), [[x, y], [x + w, y], [x + w, y - h], [ap[0], ap[1] + 1.4], [x, y - h]], 0.3, x + 3, 3);   // the gable wall
  if (far < 0.6) {
    const front = o.front ?? (R() < 0.6 ? 'shop' : 'door');
    if (front === 'shop') wsh(B, rgba(mix3(C.ink2, C.wall, 0.3), 0.66 * A), [[x + w * 0.15, y - h * 0.1], [x + w * 0.85, y - h * 0.1], [x + w * 0.85, y - h * 0.82], [x + w * 0.15, y - h * 0.82]], 0.3, x + 4, 4);
    else wsh(B, rgba(mix3(C.ink2, C.wall, 0.25), 0.7 * A), [[x + w * 0.4, y], [x + w * 0.62, y], [x + w * 0.62, y - h * 0.66], [x + w * 0.4, y - h * 0.66]], 0.2, x + 4, 4);
    if (R() < 0.5) wsh(B, rgba(mix3(C.ink2, C.wall, 0.45), 0.5 * A), oval(ap[0], ap[1] + rh * 0.55, w * 0.07, rh * 0.12, 6), 0, x, 4);   // a vent in the gable
    const tc = K.line(0.3);   // tile rows on the near slope, running down from the ridge
    const rows = Math.max(3, Math.round(d / 3));
    for (let i = 1; i < rows; i++) {
      if (nz(i * 0.8 + x * 0.13) < 0.35) continue;
      const t = i / rows, a: Pt = [ap[0] + ox * t, ap[1] + oy * t], b: Pt = [eR[0] + ox * t, eR[1] + oy * t];
      B.line(tc, 0.38, [[mix(a[0], b[0], 0.3), mix(a[1], b[1], 0.3)], b], 5);
    }
    B.line(K.line(0.45), 0.5, [[x + w + ox, y + oy], [x + w + ox, y + oy - h]], 5);
    rib(B, K.line(0.42), [[x, y - h], [x, y]], { w: 0.55, tin: 0.05, tout: 0.2, dry: 0.3, seed: x + 5 }, 5);
    rib(B, K.line(0.4), [[x + w, y - h], [x + w, y]], { w: 0.5, tin: 0.05, tout: 0.2, dry: 0.3, seed: x + 6 }, 5);
  }
  rib(B, K.line(0.45), [[x - 0.6, y + 0.4], [x + w + 0.5, y + 0.3], [x + w + ox, y + oy + 0.3]], { w: 0.8, tin: 0.05, tout: 0.1, dry: 0.2, seed: x + 7 }, 5);
  // the barge boards (lifted a little at the eaves), the ridge running back, the near eave
  rib(B, K.line(0.88), [[eL[0] - 0.8, eL[1] - 0.8], eL, ap, eR, [eR[0] + 0.8, eR[1] - 0.8]], { w: 1.05, tin: 0.06, tout: 0.06, wob: 0.25, seed: x + 8 }, 6);
  rib(B, K.line(0.88), [ap, sh(ap)], { w: 1.4, tin: 0.1, tout: 0.15, wob: 0.25, seed: x + 9 }, 6);
  rib(B, K.line(0.65), [eR, sh(eR)], { w: 0.75, tin: 0.05, tout: 0.2, dry: 0.15, seed: x + 10 }, 6);
  B.flush();
  return { top: Math.min(ap[1], ap[1] + oy) };
}

/**
 * A courtyard wall: lime-washed, a thin tile coping, a gate (closed, blank) under its own little gabled roof, and the
 * courtyard's tree showing over it. (x, y) the front-left foot.
 */
function wallGate(env: Env, x: number, y: number, w: number, h: number, R: Rng, o: BuildingOptions = {}) {
  const far = o.far ?? 0;
  if (far < 0.6) dotTreeT(env, x + w * (0.3 + R() * 0.4), y - 1 + D[1] * 8, 0.62 + R() * 0.2, R, { green: true, clusters: 4 });   // the courtyard's tree
  const B = new Ink(env.ctx);
  const K = houseInk(env, far, R, o, x);
  const { C, rgba, A } = K;
  const d = 2.4;
  B.fill(rgba(C.paper, A), [[x, y + 0.5], [x + w, y + 0.5], [x + w + D[0] * d, y + D[1] * d], [x + w + D[0] * d, y - h - 1 + D[1] * d], [x, y - h - 1]], 0);
  wsh(B, rgba(K.wall, 0.96 * A), [[x, y], [x + w, y], [x + w, y - h], [x, y - h]], 0.3, x, 1);
  wsh(B, rgba(K.side, 0.95 * A), [[x + w, y], [x + w + D[0] * d, y + D[1] * d], [x + w + D[0] * d, y - h + D[1] * d], [x + w, y - h]], 0.2, x + 1, 1);
  wsh(B, rgba(K.tile, 0.85 * A), [[x - 0.5, y - h + 0.3], [x + w + 0.5, y - h + 0.3], [x + w + 0.5 + D[0] * d, y - h - 0.6 + D[1] * d], [x - 0.5 + D[0] * d, y - h - 0.6 + D[1] * d]], 0.15, x + 2, 2);
  rib(B, K.line(0.75), [[x - 0.6, y - h + 0.3], [x + w + 0.6, y - h + 0.2]], { w: 0.7, tin: 0.05, tout: 0.05, seed: x }, 3);
  const gx = x + w * (0.25 + R() * 0.4), gw = Math.min(6.5, w * 0.3), gh = h * 0.78;
  wsh(B, rgba(mix3(C.timber, C.ink2, 0.5), 0.75 * A), [[gx, y], [gx + gw, y], [gx + gw, y - gh], [gx, y - gh]], 0.2, x + 3, 2);   // the gate, closed
  B.line(K.line(0.45), 0.35, [[gx + gw / 2, y], [gx + gw / 2, y - gh]], 3);
  const gy = y - h - 0.2, gc = gx + gw / 2;   // its little roof: a short ridge, the eaves lifted
  wsh(B, rgba(K.tile, 0.88 * A), [[gx - 2.2, gy + 0.6], [gx + gw + 2.2, gy + 0.6], [gc + gw * 0.3, gy - 2.6], [gc - gw * 0.3, gy - 2.6]], 0.15, x + 4, 3);
  rib(B, K.line(0.88), [[gx - 2.6, gy], [gx - 2.0, gy + 0.6], [gx + gw + 2.0, gy + 0.6], [gx + gw + 2.6, gy]], { w: 0.75, tin: 0.05, tout: 0.05, seed: x + 4 }, 4);
  rib(B, K.line(0.85), [[gc - gw * 0.3 - 0.8, gy - 3.2], [gc - gw * 0.3, gy - 2.6], [gc + gw * 0.3, gy - 2.6], [gc + gw * 0.3 + 0.8, gy - 3.2]], { w: 0.9, tin: 0.1, tout: 0.1, seed: x + 5 }, 4);
  rib(B, K.line(0.45), [[x, y + 0.4], [x + w, y + 0.3]], { w: 0.7, tin: 0.05, tout: 0.1, dry: 0.2, seed: x + 6 }, 4);
  B.flush();
}

/**
 * The town's landmark: a large two-storey house by the bridge (in the scroll, the great wine house), an open hall
 * below, a balcony above, a big hip-gable roof; a tall signboard on a post at the street and a board under the upper
 * eave, both BLANK (kitsch guard: no characters). (x, y) the front-left foot.
 */
function landmark(env: Env, x: number, y: number, w: number, _R: Rng) {
  const B = new Ink(env.ctx);
  const { C, rgba } = env.ink;
  const h1 = 12, h2 = 10, d = w * 0.42, ox = D[0] * d, oy = D[1] * d;
  const wall = mix3(C.wall, C.ink2, 0.06), side = mix3(wall, C.ink2, 0.26), tile = mix3(C.tile, C.white, 0.05);
  const L = (a: number) => rgba(C.ink, a);
  const y2 = y - h1 - 2.4, x2 = x + 2.5, w2 = w - 5;   // the upper floor sits back a little
  const ry = y2 - h2 - 11 + oy * 0.5, ov = 5.5;
  B.fill(rgba(C.paper, 1), [[x - 4, y + 0.6], [x + w, y + 0.6], [x + w + ox, y + oy], [x + w + ox + ov, y2 - h2 + oy], [x + w * 0.82 + ox * 0.5, ry], [x + w * 0.18 + ox * 0.5, ry], [x2 - ov, y2 - h2], [x - 4, y - h1]], 0);
  // the lower hall: open, deep in shadow, posts; the side wall
  wsh(B, rgba(side, 0.95), [[x + w, y], [x + w + ox, y + oy], [x + w + ox, y + oy - h1 - h2 - 2.4], [x + w, y - h1 - h2 - 2.4]], 0.3, x, 1);
  wsh(B, rgba(wall, 0.97), [[x, y], [x + w, y], [x + w, y - h1], [x, y - h1]], 0.3, x + 1, 1);
  wsh(B, rgba(mix3(C.ink2, C.wall, 0.28), 0.7), [[x + 2, y - 0.8], [x + w - 2, y - 0.8], [x + w - 2, y - h1 + 1], [x + 2, y - h1 + 1]], 0.4, x + 2, 2);
  for (let i = 0; i <= 6; i++) B.line(rgba(mix3(C.timber, C.ink, 0.45), 0.8), 0.85, [[x + 1 + (w - 2) * i / 6, y + 0.3], [x + 1 + (w - 2) * i / 6, y - h1]], 3);
  B.line(rgba(mix3(C.timber, C.ink, 0.3), 0.8), 1.0, [[x + 3, y - h1 * 0.36], [x + w - 3, y - h1 * 0.38]], 3);   // the counter
  // the pent eave over the hall
  const py = y - h1 + 0.6;
  wsh(B, rgba(tile, 0.78), [[x - 4, py + 1.2], [x + w + 4, py + 1.2], [x + w + 1.5, py - 3.6], [x + 1.5, py - 3.6]], 0.3, x + 3, 4);
  rib(B, L(0.88), [[x - 5, py + 0.4], [x - 3.6, py + 1.3], [x + w + 3.6, py + 1.3], [x + w + 5, py + 0.4]], { w: 1.15, tin: 0.05, tout: 0.05, seed: x + 4 }, 5);
  // the upper floor: wall, lattice windows, the balcony rail in front
  wsh(B, rgba(wall, 0.97), [[x2, y2], [x2 + w2, y2], [x2 + w2, y2 - h2], [x2, y2 - h2]], 0.3, x + 5, 4);
  for (let i = 0; i < 4; i++) {
    const wx = x2 + 3 + i * (w2 - 6) / 4, ww = (w2 - 6) / 4 - 2.4;
    wsh(B, rgba(mix3(C.ink2, C.wall, 0.48), 0.55), [[wx, y2 - h2 * 0.2], [wx + ww, y2 - h2 * 0.2], [wx + ww, y2 - h2 * 0.8], [wx, y2 - h2 * 0.8]], 0.2, x + 6 + i, 5);
  }
  B.line(L(0.75), 0.55, [[x2 - 1, y2 - 3.2], [x2 + w2 + 1, y2 - 3.2]], 6);
  for (let i = 0; i <= 14; i++) B.line(L(0.5), 0.35, [[x2 - 1 + (w2 + 2) * i / 14, y2 - 0.2], [x2 - 1 + (w2 + 2) * i / 14, y2 - 3.2]], 6);
  rib(B, L(0.7), [[x2 - 1, y2], [x2 + w2 + 1, y2]], { w: 0.8, tin: 0.05, tout: 0.05, seed: x + 7 }, 6);
  // the blank board under the upper eave
  const bx = x2 + w2 * 0.36, bw2 = w2 * 0.28;
  B.fill(rgba(mix3(C.white, C.ink2, 0.08), 0.98), [[bx, y2 - h2 + 0.6], [bx + bw2, y2 - h2 + 0.6], [bx + bw2, y2 - h2 + 3.2], [bx, y2 - h2 + 3.2]], 6);
  B.line(L(0.7), 0.4, [[bx, y2 - h2 + 0.6], [bx + bw2, y2 - h2 + 0.6], [bx + bw2, y2 - h2 + 3.2], [bx, y2 - h2 + 3.2], [bx, y2 - h2 + 0.6]], 7);
  // the big roof
  const ey = y2 - h2 + 0.6, lift = 2.4;
  const eave: Pt[] = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; eave.push([x2 - ov + (w2 + 2 * ov) * t, ey + Math.sin(Math.PI * t) * lift * 0.4 - Math.pow(Math.abs(t * 2 - 1), 5) * lift]); }
  const eF = eave[12], eB: Pt = [x2 + w2 + ov + ox, ey + oy - lift];
  const rL: Pt = [x + w * 0.2 + ox * 0.5, ry], rR: Pt = [x + w * 0.8 + ox * 0.5, ry];
  wsh(B, rgba(mix3(tile, C.ink, 0.3), 0.88), [eF, eB, rR], 0.3, x + 8, 7);
  wsh(B, rgba(tile, 0.74), [...eave, rR, rL], 0.3, x + 9, 7);
  for (let i = 1; i < 24; i++) {
    if (nz(i * 0.7 + 3) < 0.3) continue;
    const t = i / 24, ex = mix(eave[0][0], eF[0], t), tx = mix(rL[0], rR[0], t), len = 0.35 + 0.35 * nz(i * 1.3 + 9);
    B.line(L(0.3), 0.42, [[ex, ey + 0.4], [mix(ex, tx, len), mix(ey, ry, len)]], 8);
  }
  rib(B, L(0.92), eave, { w: 1.3, tin: 0.05, tout: 0.05, wob: 0.3, seed: x + 12 }, 9);
  rib(B, L(0.8), [eF, eB], { w: 0.9, tin: 0.05, tout: 0.2, seed: x + 13 }, 9);
  rib(B, L(0.6), [eF, rR], { w: 0.7, tin: 0.05, tout: 0.1, dry: 0.15, seed: x + 14 }, 9);
  rib(B, L(0.55), [eave[0], rL], { w: 0.65, tin: 0.05, tout: 0.1, dry: 0.2, seed: x + 15 }, 9);
  rib(B, L(0.92), [[rL[0] - 2, rL[1] - 1.8], rL, rR, [rR[0] + 2, rR[1] - 1.8]], { w: 1.9, tin: 0.12, tout: 0.12, wob: 0.25, seed: x + 16 }, 9);
  // the tall signboard on its post at the street (blank)
  const sx = x - 7, sy = y + 6;
  B.line(L(0.85), 0.7, [[sx, sy], [sx, sy - 25]], 9);
  B.fill(rgba(mix3(C.white, C.ink2, 0.06), 0.98), [[sx - 2.1, sy - 24], [sx + 2.1, sy - 24], [sx + 2.1, sy - 12], [sx - 2.1, sy - 12]], 9);
  B.line(L(0.75), 0.42, [[sx - 2.1, sy - 24], [sx + 2.1, sy - 24], [sx + 2.1, sy - 12], [sx - 2.1, sy - 12], [sx - 2.1, sy - 24]], 10);
  B.line(L(0.7), 0.5, [[sx - 3, sy - 24.6], [sx + 3, sy - 24.8]], 10);
  B.flush();
  return { top: ry, sign: [sx, sy] };
}

// ------------------------------------------------------------------------------------------------ trees, stalls
/**
 * A willow as the scroll paints them: a gnarled, leaning trunk forking low, boughs arching up and out, long cascades
 * of strands from their outer halves. Toned toward ink (misted malachite with ink in it, never mint), fewer and longer
 * strands than 4a's, the crown shaped per tree (o.form: 'tall' | 'wide' | 'lean'). Returns { box } (a willow anchor).
 */
function willowT(env: Env, x: number, y: number, s: number, R: Rng, o: { form?: 'tall' | 'wide' | 'lean'; lean?: number; sway?: number } = {}) {
  const B = new Ink(env.ctx);
  const { C, rgba, strength } = env.ink;
  const form = o.form || 'wide';
  const lean = o.lean ?? (R() < 0.5 ? -1 : 1) * (form === 'lean' ? 0.5 + R() * 0.25 : 0.12 + R() * 0.25);
  const H = (form === 'tall' ? 26 : 21) * s;
  const trunk: Pt[] = [];
  for (let i = 0; i <= 7; i++) { const t = i / 7; trunk.push([x + lean * H * 0.6 * t * t + (vnoise(t * 3, x, 4) - 0.5) * 3.4 * s, y - H * t]); }
  const fork = trunk[4];
  const limbs: Pt[][] = [trunk.slice(4), [fork, [fork[0] - lean * 5 * s - 3 * s, fork[1] - H * 0.25], [fork[0] - lean * 7 * s - 6 * s, fork[1] - H * 0.4]]];
  const spread = form === 'tall' ? 0.7 : form === 'lean' ? 1.1 : 1.2;
  const boughs: { pts: Pt[]; side: number }[] = [];
  for (const limb of limbs) {
    const top = limb[limb.length - 1];
    const nb = 2 + Math.floor(R() * 2.4);
    for (let b = 0; b < nb; b++) {
      const side = (b / Math.max(1, nb - 1) - 0.5) * 2 + (R() - 0.5) * 0.6 + lean * 0.4;
      const reach = (8 + R() * 12) * s * spread;
      const up = (1.5 + R() * 6.5) * s * (1 - 0.45 * Math.abs(side));   // some arch up, some droop at once
      boughs.push({ pts: [top, [top[0] + side * reach * 0.45, top[1] - up], [top[0] + side * reach, top[1] - up * 0.35 + 2.5 * s]], side });
    }
  }
  const leaf = strength > 0 ? mix3(mix3(C.mal, C.malD, 0.25), C.ink2, 0.38) : mix3(C.ink2, C.white, 0.45);
  const leafD = strength > 0 ? mix3(C.malD, C.ink, 0.55) : C.ink2;
  const crownX = mix(limbs[0][limbs[0].length - 1][0], limbs[1][2][0], 0.5), crownY = Math.min(limbs[0][limbs[0].length - 1][1], limbs[1][2][1]);
  const cw = 16 * s * spread;
  wsh(B, rgba(leaf, 0.07), [[crownX - cw, crownY + 5 * s], [crownX, crownY - 6 * s], [crownX + cw, crownY + 5 * s], [crownX + cw * 1.2, crownY + 24 * s], [crownX - cw * 1.2, crownY + 24 * s]], 1.5 * s, x, 0);
  const sway = (o.sway ?? 1) * s * 0.6;
  const strands: Pt[][] = [];
  const tones = [rgba(leaf, 0.3), rgba(leaf, 0.42), rgba(leaf, 0.56), rgba(leafD, 0.5)];
  for (const { pts: [a, m, b], side } of boughs) {
    const n = Math.max(3, Math.round((8 + R() * 5) * Math.min(1, 0.25 + s * 0.6)));   // a small town willow needs few strands
    for (let k = 0; k < n; k++) {
      const t = 0.12 + 0.88 * Math.pow(R(), 0.8);   // the curtain starts near the fork, so the crown is strands, not ribs
      const p: Pt = t < 0.5 ? [mix(a[0], m[0], t * 2), mix(a[1], m[1], t * 2)] : [mix(m[0], b[0], t * 2 - 1), mix(m[1], b[1], t * 2 - 1)];
      const len = (24 + 18 * Math.abs(side)) * s * (0.4 + 0.6 * R()) * (0.55 + 0.45 * t) * (form === 'tall' ? 1.15 : 1);
      const out = side * (0.6 + R() * 0.8) * s;
      const strand: Pt[] = [p, [p[0] + out * 1.5, p[1] + len * 0.18], [p[0] + out * 2 + sway * 0.3, p[1] + len * 0.6], [p[0] + out * 2.1 + sway, p[1] + len]];
      strands.push(strand);
      const r = R();
      rib(B, tones[r < 0.2 ? 3 : r < 0.47 ? 0 : r < 0.77 ? 1 : 2], strand, { w: (r < 0.2 ? 0.5 : 0.66) * s, tin: 0.04, tout: 0.9, wob: 0.3, min: 0.1, seed: k * 7 + x }, 1);
    }
  }
  for (const { pts } of boughs) rib(B, rgba(C.ink, 0.42), pts, { w: 0.8 * s, tin: 0.02, tout: 0.85, wob: 0.45, seed: pts[2][0] }, 2);
  rib(B, rgba(C.ink, 0.8), limbs[1], { w: 1.9 * s, tin: 0.01, tout: 0.6, wob: 0.4, seed: x + 1 }, 2);
  rib(B, rgba(C.ink, 0.82), trunk, { w: 4.0 * s, tin: 0.01, tout: 0.55, wob: 0.55, seed: x }, 2);
  for (let b = 0; b < 2; b++) {   // the bark's flying white: two pale bristle runs down the trunk
    const off = (b - 0.5) * 1.6 * s;
    B.line(rgba(mix3(C.ink, C.white, 0.4), 0.5), 0.5 * s, trunk.slice(0, 5).filter((_p, i) => nz(i * 1.9 + b * 5 + x) > 0.35).map(([px, py]): Pt => [px + off + 0.6 * s, py]), 3);
  }
  B.line(rgba(C.ink, 0.35), 1.3 * s, [[x - 5 * s, y + 0.8], [x + 6 * s, y + 0.3]], 0);
  B.flush();
  return { box: bounds([trunk, limbs[1], ...boughs.map((b) => b.pts), ...strands], 1.5 * s) };
}
/**
 * A pollarded willow, the riverside willow of the Qingming scroll: a short, thick, gnarled trunk cut back to a knob,
 * from which whip-like shoots rise, arch over and hang to the ground as long strands, so the crown is a fountain of
 * lines, never a dome. Leaves toned toward ink (misted malachite with ink in it). Returns { box } (a willow anchor).
 */
function pollard(env: Env, x: number, y: number, s: number, R: Rng, o: { lean?: number; sway?: number } = {}) {
  const B = new Ink(env.ctx);
  const { C, rgba, strength } = env.ink;
  const lean = o.lean ?? (R() < 0.5 ? -1 : 1) * (0.15 + R() * 0.3);
  const H = (15 + R() * 5) * s;
  const trunk: Pt[] = [];
  for (let i = 0; i <= 6; i++) { const t = i / 6; trunk.push([x + lean * H * 0.7 * t * t + (vnoise(t * 3, x, 4) - 0.5) * 3.6 * s, y - H * t]); }
  const knob = trunk[6];
  const leaf = strength > 0 ? mix3(mix3(C.mal, C.malD, 0.3), C.ink2, 0.36) : mix3(C.ink2, C.white, 0.45);
  const leafD = strength > 0 ? mix3(C.malD, C.ink, 0.55) : C.ink2;
  const tones = [rgba(leaf, 0.32), rgba(leaf, 0.46), rgba(leaf, 0.6), rgba(leafD, 0.55)];
  const sway = (o.sway ?? 1) * s * 0.6;
  const lines = [trunk];
  const nS = 12 + Math.floor(R() * 5);
  for (let k = 0; k < nS; k++) {
    const side = ((k + 0.5) / nS - 0.5) * 2 + (R() - 0.5) * 0.35 + lean * 0.5;   // -1 .. 1, leaning with the trunk
    const up = (8 + R() * 10) * s * (1 - 0.3 * Math.abs(side));
    const out = side * (7 + R() * 10) * s;
    const p0: Pt = [knob[0] + (R() - 0.5) * 3 * s, knob[1] + R() * 1.5 * s];
    const p1: Pt = [p0[0] + out * 0.55, p0[1] - up];
    const p2: Pt = [p0[0] + out * 1.05, p0[1] - up * 0.78];
    const len = (20 + R() * 24) * s * (0.6 + 0.4 * Math.abs(side));
    const p3: Pt = [p2[0] + side * 1.5 * s + sway * 0.4, Math.min(y - 1.5 * s, p2[1] + len * 0.55)];
    const p4: Pt = [p2[0] + side * 2.0 * s + sway, Math.min(y - 1 * s, p2[1] + len)];   // the strands stop at the ground
    const shoot = [p0, p1, p2, p3, p4];
    lines.push(shoot);
    const r = R();
    rib(B, tones[r < 0.18 ? 3 : r < 0.5 ? 1 : 2], shoot, { w: 0.62 * s, tin: 0.03, tout: 0.75, wob: 0.3, min: 0.12, seed: k * 5 + x }, 1);
    for (let j = 0; j < 2 + Math.floor(R() * 3); j++) {   // strands dripping from the arch of the shoot
      const t = 0.25 + R() * 0.75;
      const a: Pt = [mix(p1[0], p2[0], t), mix(p1[1], p2[1], t)];
      const l2 = len * (0.35 + R() * 0.55);
      const strand: Pt[] = [a, [a[0] + side * 0.6 * s, Math.min(y - 1.5 * s, a[1] + l2 * 0.45)], [a[0] + side * 0.9 * s + sway, Math.min(y - 1 * s, a[1] + l2)]];
      lines.push(strand);
      rib(B, tones[R() < 0.5 ? 0 : 1], strand, { w: 0.5 * s, tin: 0.04, tout: 0.85, wob: 0.3, min: 0.1, seed: k * 7 + j + x }, 1);
    }
  }
  rib(B, rgba(mix3(C.ink, C.ink2, 0.4), 0.6), trunk, { w: 3.2 * s, tin: 0.01, tout: 0.25, wob: 0.6, dry: 0.12, seed: x }, 2);
  B.fill(rgba(C.ink, 0.55), oval(knob[0], knob[1] + 0.5 * s, 2.2 * s, 1.5 * s, 7), 2);   // the knob where it was cut back
  for (let b = 0; b < 2; b++) {   // the bark's flying white
    const off = (b - 0.5) * 1.8 * s;
    B.line(rgba(mix3(C.ink, C.white, 0.45), 0.5), 0.5 * s, trunk.slice(0, 6).filter((_p, i) => nz(i * 1.9 + b * 5 + x) > 0.3).map(([px, py]): Pt => [px + off + 0.5 * s, py]), 3);
  }
  // rooted, not stood on a plate: a few short ticks of grass at its foot
  for (let i = 0; i < 5; i++) { const gx = x + (i - 2) * 2.2 * s + (R() - 0.5) * s; B.line(rgba(C.ink, 0.28), 0.5 * s, [[gx, y + 0.6], [gx + (R() - 0.4) * 1.5 * s, y - (1.5 + R() * 2) * s]], 0); }
  B.flush();
  return { box: bounds(lines, 1.5 * s) };
}
/** A tree in dots: a crooked trunk and clusters of short dabs (green-ink or ink). (x, y) the foot. */
function dotTreeT(env: Env, x: number, y: number, s: number, R: Rng, o: { green?: boolean; clusters?: number } = {}) {
  const B = new Ink(env.ctx);
  const { C, rgba, strength } = env.ink;
  const H = 20 * s;
  const lean = (R() - 0.5) * 5 * s;
  rib(B, rgba(C.ink, 0.85), [[x, y + 0.5], [x + lean * 0.4 + (R() - 0.5) * 2 * s, y - H * 0.5], [x + lean, y - H * 0.85]], { w: 1.6 * s, tin: 0.01, tout: 0.7, wob: 0.5, seed: x }, 0);
  const leaf = o.green && strength > 0 ? mix3(C.ink, C.malD, 0.32) : C.ink;
  const tones = [rgba(leaf, 0.34), rgba(leaf, 0.55)];
  const clusters = o.clusters ?? 4;
  for (let c = 0; c < clusters; c++) {
    const cx = x + lean * 0.8 + (R() - 0.5) * 12 * s, cy = y - H * (0.62 + R() * 0.4);
    for (let i = 0; i < 12; i++) {
      const px = cx + (R() - 0.5) * 10 * s, py = cy + (R() - 0.5) * 5.5 * s, a = (R() - 0.5) * 0.6;
      B.line(tones[R() < 0.55 ? 0 : 1], 1.05 * s, [[px - 1.0 * s, py + a], [px + 1.0 * s, py - a - 0.3 * s]], 1);
    }
  }
  B.flush();
}
/** A market parasol over a little stall. (x, y) the pole's foot. */
function parasolT(B: Ink, env: Env, x: number, y: number, s: number, R: Rng) {
  const { C, rgba } = env.ink;
  const lean = (R() - 0.5) * 2 * s;
  const top: Pt = [x + lean, y - 13 * s];
  const rx = (8.5 + R() * 3) * s, ry = 2.6 * s;
  B.line(rgba(C.ink, 0.85), 0.6 * s, [[x, y], top], 2);
  B.fill(rgba(mix3(C.timber, C.ink2, 0.35), 0.8), [[x - 5.5 * s, y - 3.4 * s], [x + 5.5 * s, y - 3.4 * s], [x + 6.2 * s, y - 2.4 * s], [x - 4.8 * s, y - 2.4 * s]], 1);
  for (let i = 0; i < 5; i++) if (R() < 0.7) B.fill(rgba(i % 2 ? C.ink2 : C.indigoP, 0.7), oval(x - 4 * s + i * 2 * s, y - 4 * s, 0.7 * s, 0.6 * s, 5), 2);
  const cc = R() < 0.6 ? C.white : mix3(C.indigoP, C.white, 0.3);
  const dome: Pt[] = [], rim: Pt[] = [];
  for (let i = 0; i <= 12; i++) { const a = Math.PI * (1 + i / 12); dome.push([top[0] + Math.cos(a) * rx, top[1] + 1.5 * s + Math.sin(a) * ry]); }
  for (let i = 12; i >= 0; i--) { const a = Math.PI * (i / 12); rim.push([top[0] + Math.cos(a) * rx, top[1] + 1.5 * s + Math.sin(a) * ry * 0.35]); }
  B.fill(rgba(cc, 0.95), [...dome, ...rim], 3);
  for (let i = 1; i < 6; i++) B.line(rgba(C.ink, 0.3), 0.3 * s, [top, dome[i * 2]], 4);
  B.line(rgba(C.ink, 0.82), 0.65 * s, dome, 4);
  B.line(rgba(C.ink, 0.5), 0.45 * s, rim, 4);
}

/** A street stall under a flat cloth shade on poles (the scroll's commonest stall), a table of goods below. */
function shade(B: Ink, env: Env, x: number, y: number, s: number, R: Rng) {
  const { C, rgba } = env.ink;
  const w = (9 + R() * 4) * s, h = (8 + R() * 2) * s, dp = 4 * s;
  const cl = R() < 0.55 ? C.white : mix3(C.indigoP, C.white, 0.35);
  const a: Pt = [x - w / 2, y - h], b: Pt = [x + w / 2, y - h - 1.2 * s];   // the front edge, sloping a little
  B.fill(rgba(mix3(C.timber, C.ink2, 0.4), 0.85), [[x - w * 0.42, y - 3.4 * s], [x + w * 0.42, y - 3.4 * s], [x + w * 0.46, y - 2.4 * s], [x - w * 0.38, y - 2.4 * s]], 1);   // the table
  for (let i = 0; i < 4; i++) if (R() < 0.75) B.fill(rgba(i % 2 ? C.ink2 : C.indigoP, 0.7), oval(x - w * 0.3 + i * w * 0.2, y - 4 * s, 0.7 * s, 0.6 * s, 5), 2);
  for (const px of [a[0] + 0.6 * s, b[0] - 0.6 * s]) B.line(rgba(C.ink, 0.8), 0.5 * s, [[px, y], [px, y - h + 0.3]], 2);
  B.fill(rgba(cl, 0.94), [a, b, [b[0] + D[0] * dp, b[1] + D[1] * dp - 1.2 * s], [a[0] + D[0] * dp, a[1] + D[1] * dp - 1.2 * s]], 3);   // the cloth, sloping back
  B.line(rgba(C.ink, 0.75), 0.5 * s, [[a[0] - 0.4 * s, a[1] + 0.2 * s], [b[0] + 0.4 * s, b[1] + 0.2 * s]], 4);
  B.line(rgba(C.ink, 0.4), 0.35 * s, [b, [b[0] + D[0] * dp, b[1] + D[1] * dp - 1.2 * s]], 4);
}

// ------------------------------------------------------------------------------------------------ boats
/**
 * A boat lying along the river: (x, y) the waterline at the stern; L long; o.dir 1 (bow to the right) or -1 (bow to
 * the left). Its beam runs into depth (we see the near side, the deck from above, a barrel-mat cabin). o.mast: 'up'
 * (moored), 'aframe' (the scroll's two-legged mast, being let down toward the stern: the crew haul on slack ropes
 * from the bow), 'down' (laid along the cabin), 'none'. Returns { box } and the crew's places.
 */
function craft(env: Env, x: number, y: number, L: number, R: Rng, o: CraftOptions = {}) {
  const B = new Ink(env.ctx);
  const { C, rgba } = env.ink;
  const s = o.s ?? 1, dir = o.dir ?? 1;
  const beam = o.beam ?? L * 0.15;
  const DB = [0.66, -0.42];
  const P = (u: number, v: number, w = 0): Pt => [x + dir * u + DB[0] * w, y - v + DB[1] * w];   // u along from the stern, v up, w across
  const hh = o.hull ?? 4.4 * s;
  const sheer = (t: number) => hh * (1 + 0.6 * Math.pow(Math.abs(t * 2 - 1), 2.6)) + (t > 0.5 ? (t - 0.5) * hh * 0.5 : 0);
  const N = 14;
  const pinch = (t: number) => Math.pow(Math.sin(Math.PI * (0.04 + 0.92 * t)), 0.45);
  const gN: Pt[] = [], gF: Pt[] = [];
  for (let i = 0; i <= N; i++) { const t = i / N, p = pinch(t); gN.push(P(L * t, sheer(t), beam * 0.5 * (1 - p))); gF.push(P(L * t, sheer(t), beam * 0.5 * (1 + p))); }
  const xa = Math.min(x, x + dir * L), xb = Math.max(x, x + dir * L);
  for (let k = 0; k < 5; k++) {   // its reflection: darker smears torn by the ripples
    const yy = 1.4 + k * 1.5 * s;
    rib(B, rgba(C.ink2, 0.15 - k * 0.022), [[xa + L * (0.06 + R() * 0.08), y + yy], [xa + L * (0.5 + R() * 0.1), y + yy + 0.3], [xa + L * (0.86 + R() * 0.1), y + yy]], { w: (1.6 - k * 0.2) * s, tin: 0.25, tout: 0.5, wob: 0.7, dry: 0.3, seed: k + x }, 0);
  }
  const hullC = mix3(mix3(C.timber, C.ink2, 0.45), C.indigoP, 0.28);   // timber, greyed and cooled: never a large warm area,
  // and lighter than the bridge (round 5: the bridge is the town's darkest ink)
  wsh(B, rgba(mix3(C.timberM, C.white, 0.35), 0.95), [...gN, ...gF.slice().reverse()], 0.2, x, 1);
  const side = [...gN];
  for (let i = N; i >= 0; i--) { const t = i / N; side.push(P(L * (0.06 + 0.88 * t), 0, 0)); }
  wsh(B, rgba(hullC, 0.92), side, 0.2, x + 1, 1);
  rib(B, rgba(C.ink, 0.85), side.slice(N + 1), { w: 0.8 * s, tin: 0.1, tout: 0.2, seed: x + 2 }, 2);
  rib(B, rgba(C.ink, 0.88), gN, { w: 0.95 * s, tin: 0.04, tout: 0.08, wob: 0.25, seed: x + 3 }, 2);
  B.line(rgba(C.ink, 0.5), 0.45 * s, gF, 2);
  B.line(rgba(C.ink, 0.32), 0.4 * s, gN.map((p): Pt => [p[0], p[1] + hh * 0.5]).slice(2, N - 1), 2);
  const reach: Pt[] = [[xa, y + 1.4 + 7.5 * s + 1], [xb, y]];
  if (o.cabin !== false) {   // the barrel-mat cabin (grey mats, never beige)
    const u0 = L * (o.c0 ?? 0.3), u1 = L * (o.c1 ?? 0.7);
    const ch = o.ch ?? 5 * s, wallH = 2.1 * s;
    const base = (u: number) => sheer(u / L);
    const arch = (u: number) => { const pts: Pt[] = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(P(u, base(u) + wallH + Math.sin(Math.PI * t) * ch, beam * (0.06 + 0.88 * t))); } return pts; };
    const A0 = arch(u0), A1 = arch(u1);
    const mat = mix3(C.tile, C.white, 0.5);
    const near = dir > 0 ? A1 : A0;   // the cabin's end we see
    wsh(B, rgba(mix3(C.timber, C.ink2, 0.4), 0.92), [P(u0, base(u0), beam * 0.06), P(u1, base(u1), beam * 0.06), A1[0], A0[0]], 0.2, x + 4, 3);
    wsh(B, rgba(mat, 0.95), [...A0, ...A1.slice().reverse()], 0.2, x + 5, 3);
    const nu = dir > 0 ? u1 : u0;
    wsh(B, rgba(mix3(mat, C.ink, 0.35), 0.95), [...near, P(nu, base(nu), beam * 0.94), P(nu, base(nu), beam * 0.06)], 0.2, x + 6, 3);
    const ribs = Math.max(3, Math.round((u1 - u0) / (3.2 * s)));
    for (let i = 1; i < ribs; i++) B.line(rgba(C.ink, 0.36), 0.36 * s, arch(mix(u0, u1, i / ribs)).slice(0, 7), 4);
    rib(B, rgba(C.ink, 0.85), near, { w: 0.7 * s, tin: 0.05, tout: 0.05, seed: x + 7 }, 4);
    rib(B, rgba(C.ink, 0.8), [A0[0], A1[0]], { w: 0.65 * s, tin: 0.05, tout: 0.1, seed: x + 8 }, 4);
    B.line(rgba(C.ink, 0.48), 0.42 * s, [A0[4], A1[4]], 4);
    reach.push(A0[4]);
  }
  const masthead: Pt[] = [];
  if (o.mast === 'up') {
    const m0 = P(L * 0.62, sheer(0.62), beam * 0.5);
    const m1: Pt = [m0[0] + 1.1 * s, m0[1] - L * 0.58];
    reach.push(m1);
    rib(B, rgba(C.ink, 0.9), [m0, m1], { w: 1.0 * s, tin: 0.01, tout: 0.25, seed: x + 9 }, 5);
    B.line(rgba(C.ink, 0.4), 0.28 * s, [m1, P(L * 0.02, sheer(0) + 1, beam * 0.5)], 5);
    B.line(rgba(C.ink, 0.4), 0.28 * s, [m1, P(L * 0.98, sheer(1) + 1, beam * 0.5)], 5);
  } else if (o.mast === 'aframe') {
    // two legs stepped on the gunwales, pivoting back toward the stern; a slight bow in each, a dry break
    const ang = (o.mastAngle ?? 40) * Math.PI / 180, ml = L * (o.mastLen ?? 0.38);
    const uF = L * 0.6;
    const feet = [P(uF, sheer(0.6) + 0.5, beam * 0.12), P(uF, sheer(0.6) + 0.5, beam * 0.88)];
    const apex: Pt = [mix(feet[0][0], feet[1][0], 0.5) - dir * Math.cos(ang) * ml, mix(feet[0][1], feet[1][1], 0.5) - Math.sin(ang) * ml];
    reach.push(apex);
    feet.forEach((f, i) => {
      const mid: Pt = [mix(f[0], apex[0], 0.5) + dir * 1.2 * s, mix(f[1], apex[1], 0.5) - 0.9 * s];   // bowed under the strain
      rib(B, rgba(C.ink, i ? 0.92 : 0.6), [f, mid, apex], { w: (i ? 1.15 : 0.9) * s, tin: 0.01, tout: 0.15, dry: 0.12, seed: x + 10 + i }, 5);
    });
    B.line(rgba(C.ink, 0.7), 0.45 * s, [[mix(feet[0][0], apex[0], 0.3), mix(feet[0][1], apex[1], 0.3)], [mix(feet[1][0], apex[0], 0.3), mix(feet[1][1], apex[1], 0.3)]], 5);
    masthead.push(apex);
  } else if (o.mast === 'down') {   // laid along the cabin roof
    const a = P(L * 0.12, sheer(0.12) + 2.1 * s + 1, beam * 0.5), b = P(L * 0.96, sheer(0.96) + 2.1 * s + (o.ch ?? 5 * s) * 0.5, beam * 0.5);
    rib(B, rgba(C.ink, 0.85), [a, b], { w: 0.95 * s, tin: 0.02, tout: 0.2, seed: x + 12 }, 5);
  }
  B.flush();
  return { box: bounds([gN, gF, side, reach], 1), P, sheer, masthead: masthead[0], beam };
}

// ------------------------------------------------------------------------------------------------ the bridge
/**
 * The rainbow bridge: a heavy arch of woven timber beams spanning the river into depth, from the near bank at A,
 * `span` world px along o.dir to the far bank, its deck across x (bw). On the face we see the two interlocked beam
 * systems the type is named for, straight beams bundled in pairs between the cross-beams, whose dark ends stand out
 * in rows; the deck's joists end in a row of small dark ends under its edge; heavy rails; stone abutments. Greyed
 * timber, never a brown ribbon. Returns { deckAt, base } (a walker's path, if Jack ever wants one).
 */
function rainbow(env: Env, A: Pt, span: number, Hb: number, R: Rng, o: RainbowOptions = {}) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const bw = o.bw ?? 20, ramp = o.ramp ?? 0.12, T = o.T ?? 11;
  const Db = o.dir!;
  const N = 40;
  const base = (t: number): Pt => [A[0] + Db[0] * span * t, A[1] + Db[1] * span * t];
  const K = [0, 0.16, 0.36, 0.64, 0.84, 1], KH = [0, 0.66, 0.97, 0.97, 0.66, 0];
  // the arch's crown sits a little toward the near bank (o.skew < 1): seen from the front with its far foot higher, a
  // true arch looks like a ramp; skewed, its highest point on screen comes back toward the middle (a painter's licence)
  const skew = o.skew ?? 1;
  const lift = (t0: number) => {
    if (t0 <= 0 || t0 >= 1) return 0;
    const t = Math.pow(t0, skew);
    let poly = 0;
    for (let i = 0; i < K.length - 1; i++) if (t <= K[i + 1]) { poly = mix(KH[i], KH[i + 1], (t - K[i]) / (K[i + 1] - K[i])); break; }
    return Hb * mix(poly, Math.pow(Math.sin(Math.PI * t), 0.6), 0.5);
  };
  const deckLift = (t: number) => (t < 0 ? Math.max(0, 4 + (t / ramp) * 4) : t > 1 ? Math.max(0, 4 - ((t - 1) / ramp) * 4) : Math.max(4, lift(t) + 2));
  const deckAt = (t: number, w = 0): Pt => { const b = base(t); return [b[0] + w * bw, b[1] - deckLift(t)]; };
  const ts: number[] = [];
  for (let i = 0; i <= N; i++) ts.push(-ramp + (1 + 2 * ramp) * i / N);
  // (round 5: cooled toward the river's grey-blue; the bridge stays the focus by its form and its crowd, not its warmth)
  const beamC = mix3(mix3(C.timber, C.ink, 0.55), C.indigo, 0.18), timberG = mix3(mix3(C.timberM, C.ink2, 0.35), C.indigoP, 0.2);
  // 1. on the water: the arch's shadow and broken reflection; the far face glimpsed under the deck
  const B = new Ink(ctx);
  for (let k = 0; k < 8; k++) {
    const t = 0.15 + R() * 0.7, b = base(t);
    B.line(rgba(C.ink2, 0.12), 1.1, [[b[0] + bw * 0.1, b[1] + 3 + k * 1.2], [b[0] + bw * (0.9 + R() * 0.8), b[1] + 3.3 + k * 1.2]], 0);
  }
  const farLow: Pt[] = [];
  for (let i = 3; i <= N - 3; i++) { const t = i / N, b = base(t); farLow.push([b[0], b[1] - lift(t) + Math.min(T * (0.8 + 0.4 * Math.pow(Math.abs(t * 2 - 1), 2)), lift(t) + 1.2)]); }
  rib(B, rgba(beamC, 0.5), farLow, { w: 1.3, tin: 0.1, tout: 0.1, dry: 0.15, seed: 3 }, 1);
  const farTop: Pt[] = [];
  for (let i = 3; i <= N - 3; i++) { const t = i / N, b = base(t); farTop.push([b[0], b[1] - lift(t)]); }
  B.fill(rgba(mix3(C.timberM, C.ink2, 0.45), 0.28), [...farTop, ...farLow.slice().reverse()], 1);
  // 2. the deck (pale grey planks), the far rail
  wsh(B, rgba(mix3(C.timberM, C.wall, 0.25), 0.94), [...ts.map((t) => deckAt(t, 0)), ...ts.slice().reverse().map((t) => deckAt(t, 1))], 0.2, 5, 2);
  for (let i = 1; i < N; i += 2) B.line(rgba(C.ink, 0.22), 0.32, [deckAt(ts[i], 0.04), deckAt(ts[i], 0.96)], 3);
  const farRail = ts.map((t): Pt => { const p = deckAt(t, 0); return [p[0], p[1] - 4.6]; });
  rib(B, rgba(C.ink, 0.6), farRail, { w: 0.7, tin: 0.04, tout: 0.04, seed: 9 }, 3);
  for (let i = 0; i <= N; i++) B.line(rgba(C.ink, 0.42), 0.4, [deckAt(ts[i], 0), farRail[i]], 3);
  B.line(rgba(C.ink, 0.3), 0.35, ts.map((t) => { const p = deckAt(t, 0); return [p[0], p[1] - 2.2]; }), 3);
  B.flush();
  // 3. the crowd, standing still: thickest on the crown, a knot at the near rail over the boat, stalls at the ends
  const crowd = new Ink(ctx);
  const people: { t: number; w: number; o: FolkOptions }[] = [];
  const nP = o.people ?? 34;
  for (let i = 0; i < nP; i++) {   // a third gathered on the crown, the rest up both flights (the near one is steep)
    const r = R();
    const t = r < 0.34 ? 0.45 + R() * 0.24 : r < 0.68 ? -0.04 + R() * 0.42 : 0.72 + R() * 0.34;
    people.push({ t, w: 0.14 + 0.66 * R(), o: {} });
  }
  for (const [t, w] of o.railKnot ?? []) people.push({ t, w, o: { pose: R() < 0.5 ? 'bend' : 'stand', arm: R() < 0.45 ? 'up' : 'rail', flip: false, lean: 0.12 } });
  people.sort((a, b) => deckAt(a.t, a.w)[1] - deckAt(b.t, b.w)[1]);
  for (const p of people) {
    const [px, py] = deckAt(p.t, p.w);
    const r = R();
    const opt: FolkOptions = { pose: r < 0.12 ? 'bend' : 'stand', arm: r < 0.3 ? 'up' : undefined, load: r > 0.93 ? 'pole' : r > 0.86 ? 'pack' : undefined, hat: r > 0.8 && r < 0.86 ? 'cone' : undefined, flip: R() < 0.5, shadow: false, ...p.o };
    folk(crowd, env, px, py, o.fs ?? 0.84, R, opt);
  }
  for (const [t, w] of o.stalls ?? []) { const [px, py] = deckAt(t, w); parasolT(crowd, env, px, py, 0.75, R); }
  crowd.flush();
  // 4. the near face: a light backing in greyed timber, then the woven beams. Its depth is greatest at the haunches and
  // runs out at the feet, where every beam comes down onto the abutment at the waterline (never a blade in the air).
  const F = new Ink(ctx);
  const thick = (t: number) => { return Math.max(0.8, Math.min(T * (0.8 + 0.4 * Math.pow(Math.abs(t * 2 - 1), 2)), lift(t) + 1.2)); };
  const at = (t: number, f: number): Pt => { const b = base(t); return [b[0] + bw, b[1] - lift(t) + f * thick(t)]; };
  const top: Pt[] = [];
  for (let i = 0; i <= N; i++) top.push(at(i / N, 0));
  // the face's lower edge follows the lower beam system's chords (straight beams: the arch is built, not bent)
  const unwarp = (u: number) => Math.pow(u, 1 / skew);   // beam nodes evenly spaced along the arch as built
  const sysA = [0, 0.25, 0.5, 0.75, 1].map(unwarp), sysB = [0.07, 0.36, 0.64, 0.93].map(unwarp);
  const low = [at(0, 1), ...sysB.map((t) => at(t, 1)), at(1, 1)];
  const lowFine: Pt[] = [];
  for (let i = 0; i < low.length - 1; i++) for (let k = 0; k < 4; k++) lowFine.push([mix(low[i][0], low[i + 1][0], k / 4), mix(low[i][1], low[i + 1][1], k / 4)]);
  lowFine.push(low[low.length - 1]);
  wsh(F, rgba(timberG, 0.42), [...top, ...lowFine.slice().reverse()], 0.25, 11, 0);
  // the two beam systems: straight members between the cross-beams, each a pair of beams with light between them
  const beamCol = rgba(beamC, 0.88);
  const bundle = (nodes: number[], f: number, wd: number, seed: number) => {
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = at(nodes[i], f), b = at(nodes[i + 1], f);
      for (const off of [-0.9, 0.9]) rib(F, beamCol, [[a[0], a[1] + off], [b[0], b[1] + off]], { w: wd, tin: 0.02, tout: 0.02, wob: 0.15, dry: 0.06, seed: seed + i * 3 + off }, 1);
    }
  };
  bundle(sysA, 0.28, 0.95, 20);
  bundle([0, ...sysB, 1], 0.74, 1.05, 40);
  // the cross-beams' ends where the systems meet them: dark squares in rows
  const endC = rgba(C.ink, 0.88);
  for (const [nodes, fy] of [[sysA.slice(1, -1), 0.28], [sysB, 0.74]] as const) for (const t of nodes) { const p = at(t, fy); F.fill(endC, [[p[0] - 1.2, p[1] - 1.6], [p[0] + 1.3, p[1] - 1.5], [p[0] + 1.2, p[1] + 1.7], [p[0] - 1.3, p[1] + 1.6]], 2); }
  // the deck's joists ending under its edge: a row of small dark ends
  for (let i = 2; i < N - 1; i++) { const p = top[i]; if (nz(i * 1.1) < 0.12) continue; F.fill(rgba(C.ink, 0.6), [[p[0] - 0.6, p[1] + 0.5], [p[0] + 0.6, p[1] + 0.5], [p[0] + 0.6, p[1] + 1.8], [p[0] - 0.6, p[1] + 1.8]], 2); }
  rib(F, rgba(C.ink, 0.88), top, { w: 1.25, tin: 0.03, tout: 0.03, wob: 0.2, seed: 70 }, 2);
  rib(F, rgba(C.ink, 0.82), lowFine, { w: 1.1, tin: 0.03, tout: 0.03, wob: 0.2, dry: 0.1, seed: 71 }, 2);
  // abutments: stone, set into the banks, the beams' feet on them
  for (const t of [0, 1]) {
    const b = base(t), bx = b[0] + bw * 0.5;
    wsh(F, rgba(mix3(C.ink2, C.white, 0.55), 0.8), [[bx - 13, b[1] + 1.8], [bx + bw * 0.5 + 9, b[1] + 1.8], [bx + bw * 0.5 + 7, b[1] - 7], [bx - 10, b[1] - 6]], 0.8, 80 + t, 0);
    for (const jy of [-2.2, -4.6]) B.line(rgba(C.ink, 0.28), 0.4, [[bx - 11, b[1] + jy], [bx + bw * 0.5 + 7, b[1] + jy - 0.3]], 0);
    rib(F, rgba(C.ink, 0.55), [[bx - 14, b[1] + 1.8], [bx + bw * 0.5 + 10, b[1] + 2]], { w: 1.5, tin: 0.1, tout: 0.3, dry: 0.3, seed: 90 + t }, 3);
  }
  F.flush();
  B.flush();   // the abutments' joints
  // 5. the near rail in front of the crowd's feet: posts, a mid rail, a heavy top rail
  const N2 = new Ink(ctx);
  const deckN = ts.map((t) => deckAt(t, 1));
  const rail = deckN.map(([px, py]): Pt => [px, py - 5]);
  for (let i = 0; i <= N; i++) N2.line(rgba(C.ink, 0.7), 0.5, [deckN[i], rail[i]], 0);
  for (let i = 0; i < N; i++) for (const f of [0.33, 0.66]) {   // fine balusters between the posts, as on a long bridge
    const a = deckN[i], b = deckN[i + 1], px = mix(a[0], b[0], f), py = mix(a[1], b[1], f);
    N2.line(rgba(C.ink, 0.45), 0.3, [[px, py - 0.4], [px, py - 4.6]], 0);
  }
  N2.line(rgba(C.ink, 0.45), 0.4, deckN.map(([px, py]) => [px, py - 2.4]), 0);
  rib(N2, rgba(C.ink, 0.86), rail, { w: 0.9, tin: 0.04, tout: 0.04, wob: 0.15, seed: 51 }, 1);
  for (const i of [0, N]) N2.line(rgba(C.ink, 0.85), 1.1, [[deckN[i][0], deckN[i][1]], [rail[i][0], rail[i][1] - 1.4]], 1);   // the rail's end posts
  N2.flush();
  return { deckAt, base };
}

// ------------------------------------------------------------------------------------------------ the scene
export function* draw(env: Env) {
  const { ctx, P, ink } = env;
  const { C, rgba } = ink;
  noiseTable();
  // Randomness: one stream per element, own('house', row, slot) (figures.ts streams), so adding or removing a draw in
  // one element never re-rolls another; a row's layout stream places that row only.
  const own = streams(SEED);
  const X = (u: number) => u * REF_PX, Y = (y: number) => (1 - y) * VH_PX, Ux = (x: number) => x / REF_PX;
  const f = new Float32Array(SCENE_FIELDS);
  const banks = (x: number) => { sceneField(Ux(x), P, f); return [Y(f[1]), Y(f[7])]; };   // [far bank, near bank], world px
  // (round 5) the far bank is the scroll's horizon: level, in stone, along the town proper (the quay); beyond it, earth
  // banks in short stretches at their own heights, and past the reed hut it bends up and back as the river opens into
  // the lake. The near bank has its points and bays, but stands where it always has within 180 px of the bridge's
  // crown, so the bridge, its crowd and the road keep their places.
  const quay = (x: number) => smooth(X(1.22), X(1.3), x) * (1 - smooth(X(1.84), X(1.9), x));
  const gauss = (x: number, u: number, w: number) => Math.exp(-(((x - X(u)) / w) ** 2));
  const farB = (x: number) => banks(x)[0] + (vnoise(x / 60, 0.2, 5) - 0.5) * 2.5
    + (1 - quay(x)) * ((vnoise(x / 64, 3.3, 12) - 0.5) * 9 + (vnoise(x / 21, 1.1, 13) - 0.5) * 3)
    - 16 * smooth(X(1.95), X(2.08), x);
  const pin = (x: number) => smooth(180, 330, Math.abs(x - X(1.565)));
  const nearB = (x: number) => banks(x)[1] + (vnoise(x / 55, 0.8, 6) - 0.5) * 3
    + pin(x) * ((vnoise(x / 260, 2.7, 9) - 0.5) * 12 - 20 * gauss(x, 1.27, 46) + 18 * gauss(x, 1.79, 58) - 12 * gauss(x, 1.13, 40));
  const x0 = X(1.12), x1 = X(2.0);
  // (round 5, the town in the scroll) the river's banks run on past the town: from under his mountain's foot (u 1.03) to
  // where the river opens into the lake (u 2.06); the layer's ends melt them into the mist
  const xb0 = X(1.03), xb1 = X(2.06);
  // the town proper, and how much of it stands at x: the town grows out of the countryside and goes back into it (the
  // Qingming manner), full between the landing and the east moorings, thinning to fields, groves and a farmhouse at
  // the west end, to reeds and a fisherman's hut at the east
  const core0 = X(1.27), core1 = X(1.87);
  const taper = (x: number) => smooth(X(1.12), X(1.4), x) * (1 - smooth(X(1.78), X(2.0), x));

  // ---- the far bank: the street's paper, a stone embankment along the water (the town proper only; earth banks and
  // reeds beyond it), stairs down to the boats
  const top: Pt[] = [], bot: Pt[] = [];
  for (let x = xb0; x <= xb1; x += 6) { top.push([x, farB(x)]); bot.push([x, nearB(x)]); }
  const G = new Ink(ctx);
  // the street's paper: the town's own ground, thinning with the town (it never runs as a band past the houses)
  const street = top.filter((p) => p[0] > x0 && p[0] < x1);
  G.fill(rgba(C.paper, 0.6), [...street.map(([x, y]): Pt => [x, y - 3 - 10 * taper(x) - 2 * nz(x * 0.05)]), ...street.slice().reverse()], 0);
  const emb = top.filter((p) => p[0] > core0 && p[0] < core1);
  const Remb = own('embankment');
  for (let k = 0; k < 3; k++) G.fill(rgba(mix3(C.ink2, C.white, 0.55), 0.2), [...emb.map(([x, y]): Pt => [x + (k - 1) * 0.5, y - 0.5 + (k - 1) * 0.4]), ...emb.slice().reverse().map(([x, y]): Pt => [x + (k - 1) * 0.5, y + 3.2 + (k - 1) * 0.4])], 0);
  for (const seg of brokenRuns(emb, Remb, 90, 260, 14)) rib(G, rgba(C.ink, 0.5), seg, { w: 1.1, tin: 0.15, tout: 0.2, wob: 0.6, dry: 0.15, seed: seg[0][0] }, 1);
  for (const seg of brokenRuns(emb, Remb, 40, 140, 30)) rib(G, rgba(C.ink, 0.26), seg.map(([x, y]) => [x, y + 3.4]), { w: 0.8, tin: 0.2, tout: 0.3, wob: 0.6, dry: 0.3, seed: seg[0][0] + 1 }, 1);
  // beyond the embankment, earth banks: a broken, softer line, and reeds where the land meets the water
  const Rearth = own('far earth bank');
  for (const side of [top.filter((p) => p[0] < core0 + 20), top.filter((p) => p[0] > core1 - 20)]) {
    for (const seg of brokenRuns(side, Rearth, 40, 150, 18)) rib(G, rgba(C.ink, 0.3), seg.map(([x, y]) => [x, y + 0.6]), { w: 0.9, tin: 0.3, tout: 0.4, wob: 0.8, dry: 0.35, seed: seg[0][0] + 3 }, 1);
    for (let i = 0; i < side.length; i += 2) {
      if (Rearth() < 0.55) continue;
      const [rx, ry] = side[i], hgt = 3 + Rearth() * 5;
      G.line(rgba(C.ink, 0.32), 0.45, [[rx, ry + 1], [rx + (Rearth() - 0.4) * 2.4, ry + 1 - hgt]], 2);
    }
  }
  for (const u of [1.3, 1.83]) {   // stone stairs down to the moorings
    const sx = X(u), sy = farB(sx);
    G.fill(rgba(mix3(C.ink2, C.white, 0.5), 0.55), [[sx - 6, sy - 0.5], [sx + 6, sy - 0.5], [sx + 4.5, sy + 4], [sx - 4.5, sy + 4]], 1);
    for (let i = 1; i < 4; i++) G.line(rgba(C.ink, 0.35), 0.4, [[sx - 6 + i * 0.4, sy + i * 1.1], [sx + 6 - i * 0.4, sy + i * 1.1]], 2);
  }
  // mooring posts along the embankment
  const Rp = own('mooring posts');
  for (let i = 0; i < 9; i++) { const px = x0 + 90 + Rp() * (x1 - x0 - 180), py = farB(px); if (px > core0 && px < core1) G.line(rgba(C.ink, 0.65), 0.7, [[px, py + 2.5], [px + 0.2, py - 3.5]], 2); }
  G.flush();
  // life: the open river between the two banks shimmers (the far bank's line is its top)
  anchor(env, 'shimmer', bounds([top, bot]), { waterline: top.filter((_p, i) => i % 7 === 0) });
  yield;

  // ---- the bridge's place: from the near bank, crossing on a long diagonal into depth
  const BD: Pt = [0.95, -0.3];
  const bc = X(1.565);
  const span = (nearB(bc) - farB(bc) + 4) / -BD[1];
  const bA: Pt = [bc - BD[0] * span * 0.5, nearB(bc - BD[0] * span * 0.5) + 1.5];
  const BRIDGE_O: RainbowOptions = {
    dir: BD, bw: 17, ramp: 0.12, T: 11, people: 30, fs: 0.84, skew: 0.75,
    railKnot: [[0.7, 0.9], [0.74, 0.93], [0.77, 0.88], [0.8, 0.92], [0.84, 0.9], [0.88, 0.93], [0.66, 0.91]],
    stalls: [[-0.08, 0.5], [1.08, 0.5]],
  };
  const bB: Pt = [bA[0] + BD[0] * span, bA[1] + BD[1] * span];

  // ---- the town. Rows back to front, each left to right (a house covers the right side of the one before it).
  // Row 1 faces the water; rows 2 and 3 stand behind it up the bank (the shader dissolves them into the mist).
  // Houses of many kinds and sizes; lanes run back into the town between groups; one landmark by the bridge.
  // (Round 5: toward both ends the town thins. Every slot draws its layout from the row's stream exactly as before, so
  // the town near the bridge is unchanged; whether a slot is built, and how, at the thinning ends comes from its own
  // stream: the back rows go first, the front row's houses grow smaller and thatched and give way to clumps of trees.)
  const streetY = (x: number) => farB(x) - 13;
  const LM = { x: X(1.786), w: 62 };   // the landmark's place (in the wide strip and the phone's closing)
  // the town's key (round 5): full at its focus (the bridge's crown and the big boat, the landmark), a breath lighter
  // away from it, as far-bank ink should be
  const keyAt = (x: number) => (0.8 + 0.2 * Math.max(Math.exp(-(((x - bc) / (0.17 * REF_PX)) ** 2)), Math.exp(-(((x - LM.x - LM.w * 0.5) / (0.07 * REF_PX)) ** 2)))) * (0.6 + 0.4 * taper(x));
  const phone = (x: number) => x > X(1.44) && x < X(1.745);   // the phone strip's view: keep the front row low there
  const folkPlaces: [a: number, b: number, y: number, d: number][] = [];
  /** A clump of trees in a slot the town has given up (the thinning ends): a willow or two, a leafy tree. */
  const clump = (cx: number, cy: number, w: number, sc: number, Tt: Rng) => {
    // leafy village trees of two or three sizes, broad crowns on short trunks (a thin stalk with a tuft read as a palm)
    const nT = 1 + Math.floor(Tt() * 2.4);
    for (let i = 0; i < nT; i++) {
      const tx = cx + (i - (nT - 1) / 2) * w * 0.32 + (Tt() - 0.5) * 6, ty = cy + 2 + Tt() * 2;
      villageTree(env, tx, ty, (0.75 + Tt() * 0.45) * sc, Tt, Tt() < 0.35);
    }
  };
  let n = 0, lmDone = false;
  for (const [row, depth, sc, far] of [[3, 62, 0.8, 0.82], [2, 31, 0.9, 0.42], [1, 0, 1, 0]]) {
    const R = own('row', row);
    let slot = 0, group = 0, groupLen = 2 + Math.floor(R() * 4);
    for (let x = x0 + 10 + R() * 26; x < x1 - 24;) {
      const k = slot++;
      const s = sc * (0.85 + R() * 0.3);
      const xx = x + D[0] * depth;
      const y = streetY(x) + D[1] * depth + (R() - 0.5) * (row === 1 ? 2.5 : 6) + (row === 1 && R() < 0.18 ? -3 : 0);
      if (row === 1 && !lmDone && xx + 26 > LM.x - 8) {   // the landmark, with a lane each side
        landmark(env, LM.x, streetY(LM.x) + 0.5, LM.w, own('landmark'));
        folkPlaces.push([LM.x - 4, LM.x + LM.w + 4, streetY(LM.x), 1]);
        lmDone = true;
        x = LM.x + LM.w + 10;
        continue;
      }
      if (row === 1 && xx + 30 > bB[0] - 28 && xx < bB[0] + 44) { x += 12; continue; }   // the bridge lands here
      if (row === 2 && Math.abs(xx - LM.x - 20) < 46) { x += 14; continue; }   // behind the landmark: its own roof
      // the town's thinning: how much of it stands here (1 in the town proper), and this slot's own say
      const tp = taper(xx);
      const Tt = own('taper', row, k);
      const built = Tt() < (row === 3 ? tp * tp : row === 2 ? tp : 0.35 + 0.65 * tp);
      // a lane running back into the town between groups of houses
      if (++group > groupLen) {
        group = 0; groupLen = 2 + Math.floor(R() * 4);
        const lw = (6 + R() * 7) * s;
        if (row === 1) {
          const lx = xx + lw * 0.5;
          if (built) {
            const Bl = new Ink(ctx);
            Bl.fill(rgba(mix3(C.paper, C.ink2, 0.06), 0.9), [[xx - 1, y + 1], [xx + lw + 1, y + 1], [xx + lw + 1 + D[0] * 40, y + 1 + D[1] * 40], [xx - 1 + D[0] * 40, y + 1 + D[1] * 40]], 0);
            Bl.flush();
          }
          if (R() < 0.6) folkPlaces.push([lx - 2, lx + 2, y - 4, tp]);
        }
        x += lw;
        continue;
      }
      const r = R();
      const keep = row === 3 ? 0.55 : row === 2 ? 0.78 : 0.94;
      if (R() > keep) {   // a gap: trees, or nothing (mist)
        const w = (14 + R() * 18) * s;
        if (row <= 2 && R() < 0.75) {
          const tx = xx + w * 0.5, ty = y + 2;
          const T = own('gap tree', row, k);
          // (where the town thins, village trees: a small willow standing alone up the bank reads as a palm)
          if (tp < 0.95) villageTree(env, tx, ty, (0.8 + T() * 0.35) * s, T, T() < 0.4);
          else if (T() < 0.55) willowT(env, tx, ty, 0.55 * s, T, { form: T() < 0.5 ? 'tall' : 'wide' }); else dotTreeT(env, tx, ty, 0.62 * s, T, { green: true });
        }
        x += w + (2 + R() * 6) * s;
        continue;
      }
      const lowRow = row === 1 && phone(xx);
      const T = own('house', row, k);
      // at the thinning ends a front-row house is smaller and thatched: a village, not a street
      const small = row === 1 ? 1 - 0.35 * (1 - tp) : 1, rustic = row === 1 && Tt() < (1 - tp) * 0.85;
      let w: number;
      if (r < 0.3) {   // gable end to the street
        w = (14 + R() * 10) * s;
        const h = (8.5 + R() * 3.5) * s;
        const o: GableEndOptions = { far, d: w * (1.1 + R() * 0.7), rh: w * (lowRow ? 0.32 + R() * 0.08 : 0.36 + R() * 0.22) };
        if (built) gableEnd(env, xx, y, w * small, h * small, T, { ...o, thatch: rustic, k: keyAt(xx) });
      } else if (r < 0.37 && row < 3) {   // a courtyard wall and its gate
        w = (18 + R() * 16) * s;
        const h = (7 + R() * 2) * s;
        if (built) wallGate(env, xx, y, w * small, h, T, { far, k: keyAt(xx) });
      } else {   // a house facing the street
        w = (22 + R() * 30) * s;
        const thatch = R() < 0.08;
        const storey = row === 1 && !lowRow && !thatch && R() < 0.16 && Math.abs(xx - LM.x - LM.w * 0.5) > 130;   // the landmark stays the tallest near it
        const h = (storey ? 1.55 : 1) * (lowRow ? 8.5 + R() * 2.5 : 9 + R() * 4.5) * s;
        const o: HallOptions = {
          far, thatch, storey, roof: thatch || R() < 0.62 ? 'hip' : 'gable', awning: row === 1 && !storey && R() < 0.22,
          wideShop: R() < 0.4, front: row === 1 ? (R() < 0.78 ? 'shop' : 'door') : R() < 0.4 ? 'window' : 'blank',
          rh: h * (lowRow ? 0.45 + R() * 0.12 : 0.48 + R() * 0.4), d: w * (0.36 + R() * 0.3),
        };
        const tall = storey && tp > 0.85;   // (a two-storey house only in the town proper)
        if (built) hall(env, xx, y, w * small, (storey && !tall ? h / 1.55 : h) * small, T, { ...(rustic ? { ...o, thatch: true, storey: false, awning: false, front: 'door' as const, roof: 'hip' as const } : { ...o, storey: tall }), k: keyAt(xx) });
      }
      if (!built && row === 1) clump(xx + w * 0.5, y, w, s, Tt);   // the town gives way to trees
      if (row === 1) folkPlaces.push([xx + 1, xx + w - 1, y, built ? tp : 0]);
      if (row > 1 && R() < (row === 3 ? 0.15 : 0.22)) {
        const tx = xx + w * (0.2 + R() * 0.6), ty = y + 2, Tt2 = own('tree', row, k);
        if (tp < 0.95) villageTree(env, tx, ty, 0.75 + Tt2() * 0.3, Tt2, Tt2() < 0.4);
        else if (Tt2() < 0.5) willowT(env, tx, ty, 0.5, Tt2, { form: 'tall' }); else dotTreeT(env, tx, ty, 0.55, Tt2, { green: true });
      }
      x += w + (row === 1 ? 1.5 + R() * 6 : 2 + R() * 10) * s;
      if (++n % 6 === 0) yield;
    }
    if (row === 3) {   // old trees among the houses, behind the second row: their crowns break the roofline
      ([[1.34, 1.3, 'willow'], [1.71, 1.25, 'willow'], [1.93, 1.3, 'dots']] as const).forEach(([u, sz, kind], i) => {
        const tx = X(u), ty = streetY(tx) + D[1] * 46, T = own('old tree', i);
        if (kind === 'willow') willowT(env, tx, ty, sz * 0.8, T, { form: 'tall' }); else villageTree(env, tx, ty, sz * 1.1, T);   // (round 5: the east end's tree, a village tree)
      });
    }
    yield;
  }

  // ---- the countryside at the town's ends (round 5): at the west, under his mountain's foot, a farmhouse in a grove
  // on the far bank, its fields falling to the water; at the east, before the river opens into the lake, a fisherman's
  // hut on posts among the reeds
  {
    const Rc = own('countryside');
    const fx = X(1.145), fy = streetY(fx) + 2;
    willowT(env, fx - 26, fy + 1, 0.85, own('grove', 1), { form: 'wide' });
    dotTreeT(env, fx + 30, fy, 0.8, own('grove', 2), { green: true, clusters: 6 });
    hall(env, fx - 12, fy, 26, 9.5, own('farmhouse'), { far: 0.15, thatch: true, roof: 'hip', front: 'door', d: 11, k: 0.7 });
    willowT(env, fx + 52, fy + 2, 0.6, own('grove', 3), { form: 'tall' });
    const Bf = new Ink(ctx);   // the fields below it: a few level lines down to the water
    for (let i = 0; i < 3; i++) {
      const y0 = fy + 4 + i * 3.2, xa = fx - 40 + Rc() * 10, xb = fx + 70 - Rc() * 14;
      rib(Bf, rgba(C.ink, 0.22), [[xa, y0], [mix(xa, xb, 0.5), y0 + 0.4], [xb, y0 + 0.2]], { w: 0.6, tin: 0.2, tout: 0.3, dry: 0.4, seed: 70 + i }, 1);
    }
    const hx = X(1.958), hy = farB(hx) - 2;
    for (let i = 0; i < 4; i++) Bf.line(rgba(C.ink, 0.55), 0.6, [[hx - 2 + i * 6, hy + 4], [hx - 2 + i * 6 + 0.3, hy - 1]], 2);   // its posts
    Bf.flush();
    hall(env, hx - 4, hy - 1, 22, 7.5, own('reed hut'), { far: 0.2, thatch: true, roof: 'hip', front: 'door', d: 8, k: 0.6 });
    const Br = new Ink(ctx);
    for (let i = 0; i < 26; i++) {   // the reeds round it
      const rx = hx - 50 + Rc() * 110, ry = farB(rx) + 1 + Rc() * 2, hgt = 4 + Rc() * 7;
      Br.line(rgba(C.ink, 0.3 + Rc() * 0.15), 0.45, [[rx, ry], [rx + (Rc() - 0.3) * 2.6, ry - hgt]], 2);
    }
    Br.flush();
  }
  yield;

  // ---- street life in front of the front row: people standing, talking, carrying; stalls; nobody walks
  {
    const Bs = new Ink(ctx);
    const Rs = own('street places');
    const stalls: Pt[] = [];
    for (const [a, b, y, d] of folkPlaces) {
      const nF = Math.max(0, Math.round((b - a) / 16 + Rs() * 1.6 - 0.5));
      for (let i = 0; i < nF; i++) {
        const fx = mix(a, b, Rs()), fy = y + 4 + Rs() * 7.5;
        if (own('street keep', Math.round(fx), i)() > d) continue;   // (round 5) fewer people where the town thins
        const T = own('street', Math.round(fx), i);
        const r = T();
        folk(Bs, env, fx, fy, 0.95 + T() * 0.12, T, { pose: r < 0.1 ? 'bend' : r < 0.14 ? 'sit' : 'stand', load: r > 0.86 ? 'pole' : r > 0.8 ? 'pack' : undefined, arm: r > 0.7 && r < 0.78 ? 'up' : undefined, hat: r > 0.8 ? 'cone' : undefined, flip: T() < 0.5 });
      }
      if (b - a > 24 && Rs() < 0.22) { const sp: Pt = [mix(a, b, 0.3 + Rs() * 0.4), y + 10]; if (d > 0.8) stalls.push(sp); }
    }
    for (const [sx, sy] of stalls) { const T = own('stall', Math.round(sx)); if (T() < 0.5) parasolT(Bs, env, sx, sy, 0.9, T); else shade(Bs, env, sx, sy, 0.9, T); }
    Bs.flush();
  }
  yield;

  // ---- boats moored along the embankment (masts up, one laid down), and the big boat coming up to the bridge bow first, its
  // A-frame mast being let down toward the stern: the crew at the bow haul on slack ropes, one on the cabin roof
  // calls up, the people on the bridge lean over to watch
  const fb = (u: number) => farB(X(u));
  const hulls: { x: number; y: number; w: number; h: number }[] = [];
  const BOATS = [
    { key: 'moored 1', x: X(1.205), y: fb(1.22) + 12, L: 74, o: { s: 0.9, mast: 'up', crew: [[0.9, 0.4, { flip: true, hat: 'cone' }]] } },
    { key: 'moored 2', x: X(1.33), y: fb(1.35) + 15, L: 90, o: { s: 0.95, mast: 'up', c0: 0.22, c1: 0.62, dir: -1 } },
    { key: 'moored 3', x: X(1.832), y: fb(1.84) + 12, L: 60, o: { s: 0.82, mast: 'down' } },
    { key: 'moored 4', x: X(1.885), y: fb(1.9) + 13, L: 70, o: { s: 0.86, mast: 'up', c0: 0.3, c1: 0.66 } },
  ] satisfies MooredBoat[];
  const BIG_L = 136, BIG_X = X(1.645) + BIG_L, BIG_Y = mix(fb(1.69), nearB(X(1.69)), 0.6);
  const BIG_O = { s: 1.1, dir: -1 as const, mast: 'aframe' as const, mastAngle: 38, mastLen: 0.4, c0: 0.2, c1: 0.5 };
  // glassy water: the bridge's arch and the boats mirrored in the river first, softened, torn by the ripples into level
  // rows and fading with depth, so they stand on the water
  {
    const river: Pt[] = [];
    for (let x = x0; x <= x1; x += 6) river.push([x, farB(x) + 1.2]);
    for (let x = x1; x >= x0; x -= 6) river.push([x, nearB(x) - 1]);
    const Rm = own('reflections');
    // (the arch is mirrored per column about the water under it, the line through its two feet (y' = 2 wl(x) - y), so
    // the arch mirrors as an arch: a level copy of a diagonal span reads as wrong-way diagonal stripes; reflectIn still
    // tears it into level ripple rows)
    const mB = BD[1] / (Math.abs(BD[0]) > 1e-3 ? BD[0] : 1e-3);
    reflectIn(env, river, [bA[0], bA[1] + 1.5], () => { rainbow(env, bA, span, 74, own('bridge'), BRIDGE_O); }, Rm, { alpha: 0.5, blur: 2.0, fade: 70, m: mB });
    for (const b of BOATS) reflectIn(env, river, [b.x, b.y + 0.8], () => { craft(env, b.x, b.y, b.L, own('boat', b.key), b.o); }, Rm, { alpha: 0.85, blur: 0.9, fade: 50, box: [b.x - b.L * 1.2, b.y, b.x + b.L * 1.2, b.y + 60] });
    reflectIn(env, river, [BIG_X, BIG_Y + 0.8], () => { craft(env, BIG_X, BIG_Y, BIG_L, own('boat', 'lowering'), BIG_O); }, Rm, { alpha: 0.9, blur: 1.0, fade: 70, box: [BIG_X - BIG_L * 1.3, BIG_Y, BIG_X + 20, BIG_Y + 80] });
  }
  yield;
  for (const b of BOATS) {
    const r = craft(env, b.x, b.y, b.L, own('boat', b.key), b.o);
    hulls.push(r.box);
    if (b.o.crew) { const Bc = new Ink(ctx); b.o.crew.forEach(([u, w, opt], i) => { const p = r.P(b.L * u, r.sheer(u), r.beam * w); folk(Bc, env, p[0], p[1], b.o.s * 0.92, own('crew', b.key, i), { ...opt, shadow: false }); }); Bc.flush(); }
  }
  yield;
  {
    const L = BIG_L, bx = BIG_X, by = BIG_Y;
    const r = craft(env, bx, by, L, own('boat', 'lowering'), BIG_O);
    hulls.push(r.box);
    const Bc = new Ink(ctx);
    const at = (u: number, w: number) => r.P(L * u, r.sheer(u), r.beam * w);
    // ropes from the apex forward to the haulers at the bow, sagging
    const haul = [at(0.86, 0.3), at(0.93, 0.55)];
    for (const [i, h] of haul.entries()) {
      const a = r.masthead, b: Pt = [h[0] + 3.5, h[1] - 6.5];
      const mid: Pt = [mix(a[0], b[0], 0.5), mix(a[1], b[1], 0.5) + 4 + i * 1.5];
      Bc.line(rgba(C.ink, 0.5), 0.3, [a, [mix(a[0], mid[0], 0.5), mix(a[1], mid[1], 0.5) + 1.2], mid, [mix(mid[0], b[0], 0.5), mix(mid[1], b[1], 0.5) + 0.8], b], 0);
    }
    const crew: [u: number, w: number, opt: FolkOptions][] = [
      [0.86, 0.3, { pose: 'stand', arm: 'haul', flip: true, lean: 0.22 }], [0.93, 0.55, { pose: 'stand', arm: 'haul', flip: true, lean: 0.2, hat: 'cone' }],
      [0.04, 0.35, { load: 'punt', hat: 'cone' }], [0.12, 0.65, { arm: 'up', flip: true }],
    ];
    crew.forEach(([u, w, opt], i) => { const p = at(u, w); folk(Bc, env, p[0], p[1], 1.0, own('crew', 'lowering', i), { ...opt, shadow: false }); });
    // a man up on the cabin roof, calling to the bridge
    const roof = at(0.36, 0.5);
    const rp = [roof[0], roof[1] - 6.6];
    folk(Bc, env, rp[0], rp[1], 1.0, own('crew', 'lowering', 'roof'), { arm: 'up', flip: true, shadow: false, lean: -0.1 });
    Bc.flush();
  }
  yield;

  // ---- the river's surface (round 5: blank paper between two lines read as a canal): fine ripple lines gathered round
  // the bridge and the big boat, fading away from them; under each hull a faint, torn reflection; a timber landing
  // stage on the far bank
  {
    const Bw = new Ink(ctx);
    const Rr = own('ripples');
    for (let i = 0; i < 110; i++) {
      // drawn round the focus (the bridge's crown), thinning out with distance along the river
      const fx = bc + (Rr() - 0.5) * 2 * (60 + Rr() * Rr() * 520);
      if (fx < x0 || fx > x1) continue;
      const yA = farB(fx) + 4, yB = nearB(fx) - 3;
      if (yB - yA < 8) continue;
      const fy = mix(yA, yB, 0.15 + Rr() * 0.75), len = 8 + Rr() * 20;
      const a = (0.2 + Rr() * 0.16) * Math.exp(-(((fx - bc) / (0.32 * REF_PX)) ** 2) * 0.8);
      if (a < 0.03) continue;
      Bw.line(rgba(C.ink2, a), 0.7, [[fx - len * 0.5, fy], [fx, fy + (Rr() - 0.5) * 0.6], [fx + len * 0.5, fy + (Rr() - 0.5) * 0.4]], 0);
    }
    const reflC = mix3(C.ink2, C.indigoP, 0.35);
    for (const h of hulls) {   // the reflections: broken dabs under the waterline, about a third of the hull's tone, fading down
      const wl = h.y + h.h * 0.94;
      for (let j = 0; j < 3; j++) {
        const y = wl + 1.6 + j * 2.4, k = 1 - j / 3;
        for (let x = h.x + 3; x < h.x + h.w - 3;) {
          const len = 4 + Rr() * 9;
          if (Rr() < 0.72) Bw.line(rgba(reflC, 0.3 * k), 1.4, [[x, y], [Math.min(h.x + h.w - 3, x + len), y + (Rr() - 0.5) * 0.5]], 0);
          x += len + 2 + Rr() * 4;
        }
      }
    }
    // the river carried on past the hut toward the lake: a few long, faint strokes, longer and lighter as it opens
    for (let i = 0; i < 6; i++) {
      const sx = X(1.93 + i * 0.028 + Rr() * 0.01), sy = mix(farB(sx), nearB(sx), 0.3 + Rr() * 0.5), len = 18 + i * 6 + Rr() * 10;
      Bw.line(rgba(C.ink2, 0.2 - i * 0.025), 0.7, [[sx, sy], [sx + len * 0.5, sy + (Rr() - 0.5) * 0.6], [sx + len, sy + (Rr() - 0.5) * 0.5]], 0);
    }
    // the landing stage: a platform of planks on posts, run out from the far bank between the moorings and the bridge
    const lx = X(1.43), ly = farB(lx);
    Bw.fill(rgba(mix3(C.timberM, C.ink2, 0.4), 0.7), [[lx, ly + 0.5], [lx + 30, ly + 0.5], [lx + 33, ly + 4.5], [lx + 3, ly + 4.5]], 1);
    for (const px of [lx + 4, lx + 16, lx + 29]) Bw.line(rgba(C.ink, 0.55), 0.6, [[px, ly + 4.5], [px + 0.2, ly + 9]], 1);
    Bw.line(rgba(C.ink, 0.5), 0.7, [[lx, ly + 0.5], [lx + 30, ly + 0.5], [lx + 33, ly + 4.5]], 2);
    Bw.flush();
  }
  yield;
  // a few broken ripple rings where the boats sit in the water, of unequal size, thick-thin, never closed, each with a
  // lit arc on the side toward the light (upper right, Work's glow)
  {
    const Rr = own('rain rings');
    // (rings only where a hull or a pole meets the water: never in open water under the swallows, where they read
    // as logo arcs)
    for (const b of BOATS.slice(0, 3)) ripples(env, b.x + b.L * 0.42, b.y + 2.5, 7 + Rr() * 3, Rr, { n: 2, alpha: 1.4, lightDir: Math.PI * 1.68 });
    ripples(env, BIG_X - BIG_L * 0.08, BIG_Y + 3, 11, Rr, { n: 2, alpha: 1.5, lightDir: Math.PI * 1.68 });
  }
  yield;

  // ---- the bridge
  const bridge = rainbow(env, bA, span, 74, own('bridge'), BRIDGE_O);
  yield;

  // ---- life: one slow walker crossing the bridge mid-deck, from the near bank's stall over the crown to the far one,
  // out of the mist and into it again (DESIGN §11.E answer 9: "Yes but have an option to toggle it off": "Still the
  // landscape" stops him). He is drawn on his own (ownSprite), so nothing of the bridge travels with him; mid-deck he
  // keeps clear of the near rail. Where the layer never moves its sprites he stands, still, on the near flight.
  {
    const Rw = own('walker');
    const path: Pt[] = [];
    for (let i = 0; i <= 60; i++) path.push(bridge.deckAt(-0.1 + (1.2 * i) / 60, 0.5));
    const home = bridge.deckAt(0.16, 0.5);
    ownSprite(env, 'walker', { x: home[0] - 10, y: home[1] - 18, w: 20, h: 21 }, { path, home, speed: 3.4 }, (e) => {
      const Bw = new Ink(e.ctx);
      folk(Bw, e, home[0], home[1], 0.84, Rw, { pose: 'stand', load: 'staff', flip: false, shadow: false, lean: 0.05 });
      Bw.flush();
    });
  }

  // ---- open water: the small punt (life: a slow drift; speed and range are suggestions)
  {
    // (4b: at u 1.84, not 1.905, so the box cut out for its sprite clears the near-bank willow below it, and the opening
    // at 1440 shows it; it drifts left from there, toward the big boat, and comes round again from the right)
    const L = 40, px = X(1.84), py = nearB(X(1.845)) - 24;   // mid-river: its drift lane is clear of the willows and the big boat
    const r = craft(env, px, py, L, own('boat', 'punt'), { s: 0.75, cabin: false, dir: -1 });
    const Bc = new Ink(ctx);
    const p = r.P(L * 0.15, r.sheer(0.15), r.beam * 0.4);
    folk(Bc, env, p[0], p[1], 0.75 * 0.92, own('crew', 'punt'), { load: 'punt', hat: 'cone', shadow: false, flip: true });
    Bc.flush();
    // (the box holds the hull, its reflection AND the poler, his hat and his pole: the engine cuts this box out of the
    // layer as the boat's sprite, so nothing of it may stay behind; `sprite` asks for that cut)
    const box = bounds([[[r.box.x, r.box.y], [r.box.x + r.box.w, r.box.y + r.box.h]], [[p[0] - 3.5, p[1] - 8.5], [p[0] + 6.5, p[1] + 7.5]]]);
    anchor(env, 'boat', box, { L, dir: -1, speed: 1.6, range: [X(1.76), X(1.93)], sprite: true });
  }
  yield;

  // ---- the near bank: earth feathered down into the paper, its wet edge, grass, stones, the road to the bridge, a
  // cook stall, travellers and a laden donkey at the bridge's foot, and the big willows
  {
    const Bn = new Ink(ctx);
    const nbY = banks(X(1.5))[1];   // the near bank's waterline (level along the river)
    // (round 5, the town in the scroll) the near bank is land, not a line over paper: a body of earth, toned with ink
    // (never beige), deepest at the water's edge and torn unevenly into the paper below, so the willows, the crowd and
    // the donkey stand on ground, as Home's near hills and the Résumé's near terraces do
    const earthC = mix3(C.earth, C.ink2, 0.35);
    const g = ctx.createLinearGradient(0, nbY - 2, 0, nbY + 80);
    g.addColorStop(0, rgba(earthC, 0.27));
    g.addColorStop(0.22, rgba(earthC, 0.15));
    g.addColorStop(0.55, rgba(earthC, 0.06));
    g.addColorStop(1, rgba(earthC, 0));
    // (its foot rises to the bank toward the east, where the river opens out, so the land ends blunt, not in a wedge)
    const land = bot.filter((p) => p[0] < X(1.97));
    const edge = land.map(([x, y]) => [x, y + 1]);
    const foot = land.slice().reverse().map(([x, y], i) => [x, y + (46 + 24 * nz(i * 0.13 + 40) + 9 * nz(i * 0.57 + 7)) * (1 - smooth(X(1.82), X(1.97), x))]);
    ctx.beginPath(); ctx.moveTo(edge[0][0], edge[0][1]);
    for (const p of edge) ctx.lineTo(p[0], p[1]);
    for (const p of foot) ctx.lineTo(p[0], p[1]);
    ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    // the crowd at the bridge's foot keeps its ground pale round it (the figures read against paper)
    softPatch(ctx, bA[0] - 30, nbY + 14, 110, 16, rgba(C.paper, 0.5));
    // the land's east end dissolves into the mist where the river opens
    softPatch(ctx, X(1.95), nbY + 26, 120, 40, rgba(C.paper, 0.55));
    // a little misted green in it: grass and young fields along the bank, in soft patches (none in ink)
    if (ink.strength > 0) {
      const Rpa = own('bank green');
      for (let k = 0; k < 9; k++) {
        const px = mix(x0 + 50, x1 - 50, (k + 0.2 + Rpa() * 0.6) / 9), py = nearB(px) + 12 + Rpa() * 14;
        softPatch(ctx, px, py, 40 + Rpa() * 50, 6 + Rpa() * 5, rgba(mix3(C.mal, C.white, 0.3), 0.07 + Rpa() * 0.05));
      }
    }
    const nb = bot.filter((p) => p[0] > xb0 + 40 && p[0] < X(1.93));
    const Rrd = own('near reeds');
    for (let i = 0; i < 22; i++) {   // reeds where the near bank goes into the mist
      const rx = X(1.9) + Rrd() * X(0.07), ry = nearB(rx) + 1 + Rrd() * 4, hgt = 4 + Rrd() * 7;
      Bn.line(rgba(C.ink, 0.28 + Rrd() * 0.14), 0.45, [[rx, ry], [rx + (Rrd() - 0.3) * 2.6, ry - hgt]], 2);
    }
    const Rnb = own('near bank');
    for (let k = 0; k < 3; k++) Bn.fill(rgba(C.ink2, 0.055), [...nb.map(([x, y]): Pt => [x, y + k * 0.6]), ...nb.slice().reverse().map(([x, y]): Pt => [x, y + 4.4 + k * 0.6])], 0);
    for (const seg of brokenRuns(nb, Rnb, 70, 240, 22)) rib(Bn, rgba(C.ink, 0.38 + Rnb() * 0.14), seg, { w: 1.2 + Rnb() * 0.8, tin: 0.2, tout: 0.35, wob: 0.7, dry: 0.12, seed: seg[0][0] }, 1);
    // the road along the bank to the bridge's foot: a pale band worn into the earth
    const road: Pt[] = [];
    for (let x = bA[0] - 200; x <= bA[0] + 30; x += 8) road.push([x, nearB(x) + 9 + (x - bA[0]) * -0.02]);
    Bn.fill(rgba(C.white, 0.32), [...road.map(([x, y]): Pt => [x, y - 2]), ...road.slice().reverse().map(([x, y]): Pt => [x, y + 3.5])], 0);
    const Rg = own('grass places');
    const grassC = rgba(ink.strength > 0 ? mix3(C.malD, C.ink, 0.45) : C.ink2, 0.36);
    for (let i = 0; i < 46; i++) {
      const rx = x0 + 80 + Rg() * (x1 - x0 - 160), ry = nearB(rx) + 3 + Rg() * 7;
      Bn.line(grassC, 0.7, [[rx, ry], [rx + (Rg() - 0.3) * 4, ry - 4 - Rg() * 5]], 2);
      if (Rg() < 0.5) Bn.line(grassC, 0.6, [[rx + 1, ry], [rx + 1 + (Rg() - 0.6) * 4, ry - 3 - Rg() * 3]], 2);
    }
    const Rs = own('stone places');
    for (let i = 0; i < 6; i++) {
      const rx = x0 + 120 + Rs() * (x1 - x0 - 240), ry = nearB(rx) + 6 + Rs() * 6;
      Bn.fill(rgba(mix3(C.ink2, C.white, 0.5), 0.6), oval(rx, ry, 3 + Rs() * 3, 1.5 + Rs(), 8), 1);
      Bn.line(rgba(C.ink, 0.45), 0.7, [[rx - 3, ry + 1.2], [rx + 3.5, ry + 1]], 2);
    }
    Bn.flush();
    yield;
    // the cook stall right of the bridge's foot (life: its smoke), the crowd at the foot, a porter, a donkey
    const F = new Ink(ctx);
    const cx = bA[0] + 52, cy = nearB(bA[0] + 52) + 14;
    shade(F, env, cx, cy, 1.0, own('cook stall'));
    F.fill(rgba(C.ink2, 0.75), [[cx + 5, cy - 3.6], [cx + 9, cy - 3.6], [cx + 8.4, cy], [cx + 5.6, cy]], 2);   // the stove
    anchor(env, 'smoke', { x: cx + 1, y: cy - 30, w: 16, h: 27 }, { src: [cx + 7, cy - 4] });
    folk(F, env, cx - 4, cy + 1, 1.0, own('cook'), { pose: 'bend', flip: false });
    folk(F, env, cx + 13, cy + 2, 1.0, own('cook', 'guest'), { pose: 'sit', flip: true });
    const Rf = own('foot crowd places');
    const foot2: [x: number, y: number, i: number][] = [];
    for (let i = 0; i < 9; i++) foot2.push([bA[0] - 84 + Rf() * 96, 0, i]);
    for (const p of foot2) p[1] = nearB(p[0]) + 7 + Rf() * 12;
    foot2.sort((a, b) => a[1] - b[1]);
    for (const [fx, fy, i] of foot2) {
      const T = own('foot crowd', i), r = T();
      folk(F, env, fx, fy, 1.05, T, { pose: r < 0.12 ? 'bend' : 'stand', load: i === 2 ? 'pole' : i === 5 ? 'pack' : i === 7 ? 'staff' : undefined, arm: r > 0.75 ? 'up' : undefined, hat: i === 2 || r > 0.85 ? 'cone' : undefined, flip: T() < 0.5 });
    }
    shade(F, env, bA[0] - 34, nearB(bA[0] - 34) + 15, 1.0, own('foot stall'));
    const dx = bA[0] - 118, dy = nearB(bA[0] - 118) + 15;
    donkey(F, env, dx, dy, 1.0, own('donkey'), { flip: false });
    folk(F, env, dx - 3, dy + 0.5, 1.05, own('donkey', 'driver'), { load: 'staff', hat: 'cone' });
    F.flush();
  }
  yield;
  // the near bank's willows, in groups of different sizes (round 5: three equal pollards evenly spaced read as markers):
  // a pair at the west end, a big old one leaning over the road west of the bridge's foot, and by the punt's lane one
  // with a younger one beside it. The three larger ones sway (life: the layer's life budget holds three willows).
  ([[1.215, 1.4, 1, -0.32], [1.243, 0.9, 0, 0.22], [1.345, 1.9, 1, 0.38], [1.875, 1.15, 1, -0.2], [1.902, 0.75, 0, 0.3]] as const).forEach(([u, s, sway, lean], i) => {
    const x = X(u), y = nearB(x) + 14;
    const t = pollard(env, x, y, s, own('willow', i), { sway: 1.3, lean });
    if (sway) anchor(env, 'willow', t.box, { foot: [x, y], s, sway: 1.3 });   // life: sway
  });
  yield;
  // ---- a willow tip out of the top edge (young.ts willowTip: brown-ink bough, spring yellow-green strands, their tips
  // above the roofline), and a pair of swallows low over the river (no sprite repeated from Home)
  if (!env.still) {
    // (in the windows too: the first shows its tip as the tuft by the swallow; the second window is framed west of it,
    // on the town's lower bank, so it never floats there like a sticker)
    willowTip(env, [[2672, 340], [2635, 409], [2575, 454], [2515, 479], [2458, 489]], [[2635, 411], [2685, 439], [2728, 449]], 1.1, 574, own('d5 willow'));
    yield;
    const sx = 2300, sy = 505, path: Pt[] = [];   // (in the open sky over the town, clear of the boat's mast and the willow)
    for (let k = 0; k <= 30; k++) { const u = k / 30; path.push([sx + 160 - 300 * u, sy + 6 - 22 * u + 14 * Math.sin(u * 4.2)]); }
    // (Home's painted swallow, large enough to show its white belly and paler hand; the pair apart, at different
    // headings, never two black hooks side by side)
    ownSprite(env, 'walker', { x: sx - 50, y: sy - 42, w: 100, h: 84 }, { path, home: [sx, sy], speed: 13, bird: true }, (e) => swallowInk(e, sx, sy, 58, 0.12, own('d5 swallow', 0), { bank: 0.4, lift: 0.3 }));
    swallowInk(env, 2398, 548, 40, -0.38, own('d5 swallow', 1), { bank: 0.8, lift: 0.55, mist: 0.15 });
  }
  yield;
  // (the town's mist, its back rows dissolving and the banks drifting across it, and the melting of both ends of the
  // layer, are painted by the scene shader as it lays the layer in: no per-pixel work here)
}
