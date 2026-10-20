// sets/young.ts — d5 lab ("Jade interface", refinement): the young painted elements, drawn with the kit so they take
// the layer's bleed, the plane's mist, the grain and the drifting mist like every other figure.
//
// Refinement (after the judges called round 1's bough "a sticker of ~25 identical pink stamps"): the plum is painted
// the way a plum spray is painted, boneless (mogu). Limbs in segments, each a wet mid-ink body with a darker bone on
// its shadow side, broken by flying white, knots and a few ink dots at the joints; straight young whips rising from
// it. Blossoms in clusters at the nodes, every one different (size, tilt, how open: full face, three-quarter, cup,
// half-open, bud, a dot of a bud), petals as overlapping translucent washes with a pooled edge, stamens on the near
// open ones only; detail is lost toward the tips; some behind the limb and soft in the mist, some loose petals
// falling. The swallow got swept scythe wings and a deep forked tail; the Work willow hangs from a tapering bough
// that comes in from off-frame, its strands in irregular groups of different lengths, not a curtain on a rod.
// World px (figures.ts): x right, y down.

import { mix3, stroke, dryBrush, wash, resample, type Env, type Pt, type Rng, type RGB } from '../figures';

const AIRC: RGB = [206, 224, 234];   // the far air the misted elements fade toward

/** Blur what `paint` draws by r world px where the context can (softWash's rule), else draw it as it is. */
function soft(env: Env, r: number, paint: () => void) {
  if (env.softOK && r > 0.05) {
    env.ctx.save();
    env.ctx.filter = `blur(${(r * env.k).toFixed(2)}px)`;
    paint();
    env.ctx.restore();
  } else if (r > 0.3) {
    // (A r2: no filter in the worker: the same paint laid seven times round a small circle at a third of its
    // strength, so its edges go soft as an out-of-focus thing's do; the core keeps most of its value)
    const ctx = env.ctx;
    ctx.save();
    ctx.globalAlpha *= 0.3;   // (M: times the caller's alpha)
    const taps: Pt[] = [[0, 0]];
    for (let i = 0; i < 6; i++) taps.push([Math.cos(i * 1.047 + 0.3) * r * 0.75, Math.sin(i * 1.047 + 0.3) * r * 0.75]);
    for (const [dx, dy] of taps) { ctx.save(); ctx.translate(dx, dy); paint(); ctx.restore(); }
    ctx.restore();
  } else paint();
}

/** A polyline through control points, each segment bent a little (plum limbs are angular, never smooth curves). */
function limbPts(ctl: Pt[], R: Rng, wob: number, step = 5): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < ctl.length - 1; i++) {
    const [x0, y0] = ctl[i], [x1, y1] = ctl[i + 1];
    const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(3, Math.round(L / step));
    const nx = -(y1 - y0) / (L || 1), ny = (x1 - x0) / (L || 1);
    const bend = (R() - 0.5) * wob * L * 0.12;
    for (let k = 0; k < n; k++) {
      const t = k / n, b = Math.sin(t * Math.PI) * bend;
      out.push([x0 + (x1 - x0) * t + nx * b, y0 + (y1 - y0) * t + ny * b]);
    }
  }
  out.push(ctl[ctl.length - 1]);
  return out;
}
const pointAt = (pts: Pt[], t: number): Pt => pts[Math.min(pts.length - 1, Math.max(0, Math.round(t * (pts.length - 1))))];
const dirAt = (pts: Pt[], t: number): number => {
  const i = Math.min(pts.length - 2, Math.max(0, Math.round(t * (pts.length - 1))));
  return Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]);
};
/** The polyline offset sideways by d (positive: to the left of travel, which is up for a limb running leftward). */
function offsetPts(pts: Pt[], d: (t: number) => number): Pt[] {
  return pts.map(([x, y], i): Pt => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    const k = d(i / (pts.length - 1));
    return [x + nx * k, y + ny * k];
  });
}

interface LimbStyle {
  /** 0: the near ink; 1: lost in the far air */
  mist?: number;
  /** a light rim on the side facing the light */
  rim?: boolean;
  /** knots and ink dots at the joints */
  dots?: number;
  alpha?: number;
}
/**
 * A plum limb painted in segments (one stroke per joint-to-joint run, as the brush is lifted at each knot): a wet
 * mid-ink body, a darker bone along its shadow side that breaks into flying white, dry-brush bark on the thick runs,
 * a knot and a few ink dots at the joints. ctl = the joints; w0 -> w1 = its width at the base and at the tip.
 */
function plumLimb(env: Env, ctl: Pt[], w0: number, w1: number, R: Rng, o: LimbStyle = {}) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const mk = o.mist ?? 0, al = o.alpha ?? 1;
  const bodyC = mix3(mix3(C.navy, [96, 116, 136], 0.42), AIRC, mk);
  const boneC = mix3(mix3(C.navy, C.ink, 0.45), AIRC, mk * 0.92);
  // total length, for the taper
  const seg: { a: Pt; b: Pt; L: number }[] = [];
  let tot = 0;
  for (let i = 0; i < ctl.length - 1; i++) { const L = Math.hypot(ctl[i + 1][0] - ctl[i][0], ctl[i + 1][1] - ctl[i][1]); seg.push({ a: ctl[i], b: ctl[i + 1], L }); tot += L; }
  let run = 0;
  seg.forEach((sg, i) => {
    const t0 = run / tot, t1 = (run + sg.L) / tot;
    run += sg.L;
    const w = w0 + (w1 - w0) * Math.pow((t0 + t1) / 2, 0.8);
    // (each run reaches a hair into the next: the knot, where the brush pressed and lifted)
    const ext = Math.min(sg.L * 0.08, w * 0.5);
    const ux = (sg.b[0] - sg.a[0]) / (sg.L || 1), uy = (sg.b[1] - sg.a[1]) / (sg.L || 1);
    const pts = limbPts([[sg.a[0] - ux * ext * 0.3, sg.a[1] - uy * ext * 0.3], [sg.b[0] + ux * ext, sg.b[1] + uy * ext]], R, 1.6, 3);
    stroke(ctx, pts, { w: w * 1.05, col: rgba(bodyC, 0.8 * al), tin: 0.1, tout: 0.14, min: 0.62, wob: 0.3, dry: 0.03 + 0.05 * R(), seed: R() * 99 });
    // the bone: darker, along the shadow (lower) side, breaking up
    const bone = offsetPts(pts, () => -w * 0.2);
    stroke(ctx, bone, { w: w * 0.62, col: rgba(boneC, 0.92 * al), tin: 0.06, tout: 0.32, min: 0.35, wob: 0.4, dry: 0.22 + 0.2 * R(), seed: R() * 99 });
    if (w > 5 && mk < 0.5) dryBrush(ctx, pts, { w: w * 0.85, col: rgba(boneC, 0.42 * al), bristles: 6, seed: Math.round(R() * 50), thr: 0.56 });
    if (o.rim && mk < 0.5 && w > 3) {
      const rim = offsetPts(pts.slice(0, Math.max(2, Math.round(pts.length * 0.8))), () => w * 0.36);
      stroke(ctx, rim, { w: Math.max(0.7, w * 0.11), col: rgba(C.light, 0.5 * al), tin: 0.2, tout: 0.5, min: 0.2, dry: 0.5, seed: R() * 77 });
    }
    // the knot at the joint and its ink dots (dian): a few, of different sizes, never evenly spaced
    if (i > 0 && (o.dots ?? 1) > 0) {
      const [kx, ky] = sg.a;
      ctx.fillStyle = rgba(boneC, 0.9 * al);
      ctx.beginPath(); ctx.ellipse(kx, ky, w * 0.5, w * 0.36, Math.atan2(uy, ux), 0, Math.PI * 2); ctx.fill();
      const nd = Math.round((o.dots ?? 1) * (R() < 0.5 ? 1 : 2 + R() * 2));
      for (let d = 0; d < nd; d++) {
        const a = Math.atan2(uy, ux) - Math.PI / 2 + (R() - 0.5) * 1.6, rr = w * (0.55 + R() * 0.5);
        const ds = (0.7 + R() * 1.4) * Math.max(1, w / 9);
        ctx.fillStyle = rgba(mix3(boneC, C.ink, 0.4), 0.88 * al);
        ctx.beginPath(); ctx.ellipse(kx + Math.cos(a) * rr + ux * (R() - 0.5) * w * 2, ky + Math.sin(a) * rr + uy * (R() - 0.5) * w * 2, ds, ds * (0.5 + R() * 0.4), a + R(), 0, Math.PI * 2); ctx.fill();
      }
    }
  });
}

// ---------------------------------------------------------------- blossoms
type BlossomKind = 'open' | 'tq' | 'cup' | 'half' | 'bud' | 'dot';
interface Blossom {
  x: number; y: number; r: number; kind: BlossomKind;
  /** where its stalk (the twig) lies, rad: the cup and the calyx turn toward it */
  toward: number;
  /** 0 near and crisp .. 1 lost in the mist */
  mist: number;
  /** a soft (out of focus / wet) blossom: blur radius, world px */
  blur: number;
  stamens: boolean;
  seed: number;
  /** f1: how many petals (4-6; 5 by default) */
  np?: number;
  /** q2: its colour family (0..0.4 white plum, ..0.8 shell pink, ..1 deep rose); random when absent */
  tone?: number;
}
/** A petal outline in the blossom's face plane: obovate (wider toward its rim) with a faint notch at the rim. */
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
function paintBlossom(env: Env, b: Blossom, R: Rng) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  // its own colour: from a white with a blush at the heart to a full pink, then misted toward the air
  // (f1: white-pink #FCE9EF to peach-pink #F4A8B8, a deeper heart)
  const pinkW: RGB = [252, 233, 239], pink: RGB = [244, 168, 184], rose: RGB = [226, 128, 152];
  const pick = b.tone ?? R();
  // (A: half of them white plum with a blush, so the pink is an accent inside the spray, not a sugar coat)
  // (q2, BRIEF3 #1 "one pink": three families, really apart: white plum (a cool white, the blush only at its heart),
  // a pale shell pink, and a few deep rose; each blossom its own shade inside its family)
  const white = pick < 0.34;
  const base0 = white ? mix3([255, 254, 255], [250, 238, 243], R() * 0.35) : pick < 0.8 ? mix3(pink, pinkW, 0.35 + R() * 0.45) : mix3(rose, pink, R() * 0.45);
  const base = mix3(base0, AIRC, b.mist * 0.75);
  const deep = mix3(white ? mix3(rose, pinkW, 0.25) : pick > 0.8 ? mix3([200, 92, 122], [176, 64, 100], 0.5) : mix3(rose, [200, 92, 122], 0.5), AIRC, b.mist * 0.7);
  const rimC = mix3(mix3(base0, [255, 255, 255], 0.45), AIRC, b.mist * 0.6);
  const A = 1 - 0.55 * b.mist;
  const { x, y, r } = b;
  const paint = () => {
    if (b.kind === 'dot' || b.kind === 'bud') {
      const rr = b.kind === 'dot' ? r * 0.24 : r * 0.4;   // (f1: small, never round beads)
      const g = ctx.createRadialGradient(x - rr * 0.3, y - rr * 0.35, rr * 0.1, x, y, rr * 1.1);
      g.addColorStop(0, rgba(mix3(base, [255, 255, 255], 0.4), 0.95 * A));
      g.addColorStop(1, rgba(b.kind === 'dot' ? mix3(deep, base, 0.25) : mix3(deep, base, 0.5), 0.95 * A));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(x, y, rr * 0.7, rr * 1.18, b.toward + Math.PI / 2, 0, Math.PI * 2); ctx.fill();
      // the calyx: two or three dark sepals where it meets the twig
      const cx = x + Math.cos(b.toward) * rr * 0.85, cy = y + Math.sin(b.toward) * rr * 0.85;
      ctx.fillStyle = rgba(mix3(mix3(C.navy, [120, 70, 90], 0.5), AIRC, b.mist * 0.8), 0.6 * A);
      for (let k = -1; k <= 1; k++) {
        const a = b.toward + Math.PI + k * 0.7;
        ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * rr * 0.2, cy + Math.sin(a) * rr * 0.2, rr * 0.28, rr * 0.12, a, 0, Math.PI * 2); ctx.fill();
      }
      return;
    }
    // the face's tilt: a rotation and a squash (foreshortening) of the face plane
    const tilt = b.toward + Math.PI / 2 + (R() - 0.5) * 1.3;   // (q2: wider turns)
    const sq = b.kind === 'open' ? 0.66 + R() * 0.34 : b.kind === 'tq' ? 0.4 + R() * 0.2 : b.kind === 'half' ? 0.52 + R() * 0.15 : 0.3 + R() * 0.1;
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    // (a cup sits pushed away from its stalk: its heart is low in the bowl, toward the twig)
    const hx = x + (b.kind === 'cup' ? Math.cos(b.toward) * r * 0.25 : 0), hy = y + (b.kind === 'cup' ? Math.sin(b.toward) * r * 0.25 : 0);
    const T = (p: Pt): Pt => {
      const u = p[0] * ct + p[1] * st, v = -p[0] * st + p[1] * ct;      // into the tilt frame
      const v2 = v * sq;
      return [hx + u * ct - v2 * st, hy + u * st + v2 * ct];
    };
    const n = b.np ?? 5, rot = R() * Math.PI * 2;
    // (q2: an open blossom now and then has lost a petal; its gap is where the next one would be)
    const lost = (b.kind === 'open' || b.kind === 'tq') && R() < 0.2 ? Math.floor(R() * n) : -1;
    const open = b.kind === 'half' ? 0.68 : b.kind === 'cup' ? 0.85 : 1;
    // the petals, back ones first (those whose rim points away from the viewer, i.e. toward the stalk in a cup)
    const order = [...Array(n).keys()].map((k) => {
      const a = rot + (k / n) * Math.PI * 2 * open + (R() - 0.5) * 0.22;
      return { a, back: Math.cos(a - b.toward) };
    }).sort((p, q) => q.back - p.back);
    let pi = -1;
    for (const { a, back } of order) {
      pi++;
      if (pi === lost) continue;
      if (b.kind === 'cup' && back > 0.55) continue;   // (a cup's far petals are hidden in the bowl)
      const len = r * (b.kind === 'half' ? 0.78 : 1) * (0.8 + R() * 0.32);
      const wid = len * (0.9 + R() * 0.18);
      const pts = petal(len, wid, 0.06 + R() * 0.06, R).map(([u, v]): Pt => T([u * Math.cos(a) - v * Math.sin(a), u * Math.sin(a) + v * Math.cos(a)]));
      const tip = T([Math.cos(a) * len, Math.sin(a) * len]);
      const g = ctx.createLinearGradient(hx, hy, tip[0], tip[1]);
      const kd = (b.kind === 'half' || b.kind === 'cup' ? 0.75 : 0.5) * (white ? 0.55 : 1);   // a closed blossom keeps more colour
      const op = b.mist < 0.2 && b.blur === 0 ? 1.06 : 1;   // (q2: a near blossom is opaque: the limb never shows through it)
      g.addColorStop(0, rgba(mix3(base, deep, kd), Math.min(1, 0.92 * op) * A));
      // (q2: a white petal is painted with a cool shadow in its middle and its rim left white, so it reads as white
      // on the pale sky rather than as a hole in it)
      g.addColorStop(0.45, rgba(white ? mix3(base, [206, 212, 228], 0.42) : base, Math.min(1, (white ? 0.92 : 0.86) * op * op) * A));
      g.addColorStop(1, rgba(white ? [255, 255, 255] : rimC, Math.min(1, (white ? 0.96 : 0.88) * op * op) * A));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fill();
      // M n1 (the critic: "emoji rosettes with a pink outline"): a soft wash, deeper at its base, a faint wet-edge
      // darkening INSIDE the rim (clipped to the petal, wide and pale: where the wash dried), no outline stroke, no vein;
      // a breath of white lifted along one side
      if (b.mist < 0.6) {
        ctx.save();
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath(); ctx.clip();
        ctx.strokeStyle = rgba(mix3(deep, base, 0.45), (white ? 0.2 : 0.13) * A);
        ctx.lineWidth = Math.max(0.8, len * 0.2);
        ctx.stroke();
        // (q2: a white petal on the pale sky needs its edge: a hair of rose-grey inside the rim, broken, on the near
        // blossoms only, as a painter outlines white plum)
        if (white && b.mist < 0.4 && b.blur === 0 && R() < 0.9) {
          ctx.strokeStyle = rgba(mix3([196, 132, 150], [120, 130, 150], 0.4), 0.55 * A);
          ctx.lineWidth = Math.max(0.5, r * 0.035);
          const i0 = 3 + Math.floor(R() * 4), i1 = Math.min(pts.length - 1, i0 + 9 + Math.floor(R() * 8));
          ctx.beginPath(); ctx.moveTo(pts[i0][0], pts[i0][1]);
          for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(pts[i][0], pts[i][1]);
          ctx.stroke();
        }
        if (r > 5) {
          const sideP = T([Math.cos(a + 0.35) * len * 0.55, Math.sin(a + 0.35) * len * 0.55]);
          ctx.strokeStyle = rgba([255, 255, 255], 0.3 * A);
          ctx.lineWidth = Math.max(0.6, len * 0.26);
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(...T([Math.cos(a + 0.2) * len * 0.3, Math.sin(a + 0.2) * len * 0.3])); ctx.lineTo(sideP[0], sideP[1]); ctx.stroke();
        }
        ctx.restore();
      }
    }
    if (b.blur > 0) return;   // (A r2: an out-of-focus blossom keeps only its petals' light: no dark heart, no calyx)
    // the heart
    // (q2: a soft blush at the heart, never a dark stain; the calyx shows only on a blossom seen from the side)
    { const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 0.32);
      hg.addColorStop(0, rgba(mix3(deep, [170, 84, 120], 0.3), 0.5 * A));
      hg.addColorStop(1, rgba(deep, 0));
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.ellipse(hx, hy, r * 0.32, r * 0.32 * sq, tilt, 0, Math.PI * 2); ctx.fill(); }
    // a cup and a half-open blossom show their calyx toward the twig
    if (b.kind === 'cup' || b.kind === 'half') {
      const cx = hx + Math.cos(b.toward) * r * 0.42, cy = hy + Math.sin(b.toward) * r * 0.42;
      ctx.fillStyle = rgba(mix3(mix3(C.navy, [120, 70, 90], 0.5), AIRC, b.mist * 0.8), 0.55 * A);
      for (let k = -1; k <= 1; k++) {
        const a = b.toward + Math.PI + k * 0.85;
        ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * r * 0.12, cy + Math.sin(a) * r * 0.12, r * 0.2, r * 0.09, a, 0, Math.PI * 2); ctx.fill();
      }
    }
    // stamens (n1: 5-9, short and uneven, gathered in a loose tuft rather than an even fan; some filaments without an
    // anther, some anthers fallen loose; irregular dots)
    if (b.stamens && (b.kind === 'open' || b.kind === 'tq')) {
      const ns = 6 + Math.floor(R() * 6);
      const a0 = R() * Math.PI * 2;
      for (let k = 0; k < ns; k++) {
        const a = a0 + (R() - 0.5) * 4.2, l = r * (0.24 + 0.3 * R() * R() + 0.1 * R());   // (q2: longer, a fuller tuft)
        const e = T([Math.cos(a) * l, Math.sin(a) * l]);
        const m = T([Math.cos(a + (R() - 0.5) * 0.6) * l * 0.5, Math.sin(a + (R() - 0.5) * 0.6) * l * 0.5]);
        ctx.lineWidth = Math.max(0.25, r * (0.016 + 0.014 * R()));
        ctx.strokeStyle = rgba(white ? [176, 120, 136] : [156, 92, 116], 0.4 + R() * 0.25);
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(m[0], m[1], e[0], e[1]); ctx.stroke();
        if (R() < 0.22) continue;   // (no anther on this one)
        ctx.fillStyle = rgba(mix3([150, 74, 70], [96, 50, 60], R()), 0.6 + R() * 0.3);   // (q2: small rose-brown anthers, never dark blobs)
        const ds = Math.max(0.35, r * (0.024 + 0.022 * R()));
        ctx.beginPath(); ctx.ellipse(e[0] + (R() - 0.5) * ds, e[1] + (R() - 0.5) * ds, ds, ds * (0.55 + R() * 0.45), R() * 3, 0, Math.PI * 2); ctx.fill();
      }
    }
  };
  if (b.blur > 0) soft(env, b.blur, paint); else paint();
}

/** A loose petal, falling: a curled petal (turned: squashed along a random axis), pale, with its pooled edge. */
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

/** A cluster of blossoms at a node: the sizes, kinds and tilts all differ; toward the tips only buds. */
function cluster(_env: Env, list: Blossom[], x: number, y: number, along: number, size: number, n: number, ripe: number, R: Rng, o: { mist?: number; blur?: number; stamens?: boolean } = {}) {
  for (let i = 0; i < n; i++) {
    // they sit close round the twig, on both sides, a little more on the upper side
    const side = R() < 0.62 ? -1 : 1;
    const off = size * (0.35 + R() * 0.75);
    const sl = (R() - 0.5) * size * 2.2;
    const nx = Math.cos(along + side * Math.PI / 2), ny = Math.sin(along + side * Math.PI / 2);
    const bx = x + Math.cos(along) * sl + nx * off, by = y + Math.sin(along) * sl + ny * off;
    const q = ripe * (0.3 + 0.7 * R());   // ripe: 0 only buds .. 1 mostly open
    const kind: BlossomKind = q > 0.62 ? (R() < 0.6 ? 'open' : 'tq') : q > 0.42 ? (R() < 0.55 ? 'cup' : 'half') : q > 0.2 ? 'bud' : 'dot';
    const r = size * (kind === 'open' || kind === 'tq' ? 0.8 + R() * 0.45 : kind === 'cup' || kind === 'half' ? 0.65 + R() * 0.3 : 0.7 + R() * 0.4);
    list.push({ x: bx, y: by, r, kind, toward: Math.atan2(y - by, x - bx), mist: o.mist ?? 0, blur: o.blur ?? 0, stamens: o.stamens ?? true, seed: R() });
  }
}

/**
 * A plum spray entering from (x0, y0) (beyond the scene's edge, top right) toward the left and down. s = scale (1: ~360
 * world px across). Returns where its loose petals start (for the falling ones the caller makes life of).
 */
export function plumBough(env: Env, x0: number, y0: number, s: number, R: Rng): Pt {
  const S = (dx: number, dy: number): Pt => [x0 + dx * s, y0 + dy * s];
  const back: Blossom[] = [], mid: Blossom[] = [], front: Blossom[] = [];
  // ---- the main limb: angular, segment by segment; a hanging limb; young whips rising straight; short spurs
  const main = [S(26, -16), S(-40, 20), S(-94, 10), S(-138, 56), S(-206, 66), S(-252, 112), S(-296, 122), S(-336, 160), S(-352, 184)];
  const hang = [S(-94, 10), S(-86, 58), S(-112, 98), S(-104, 140), S(-118, 168)];
  const whip1 = [S(-40, 20), S(-52, -12), S(-68, -40)];
  const whip2 = [S(-206, 66), S(-220, 40), S(-238, 24)];
  const spurs: [Pt, Pt][] = [
    [S(-138, 56), S(-150, 30)], [S(-252, 112), S(-262, 86)], [S(-296, 122), S(-318, 108)], [S(-112, 98), S(-136, 104)], [S(-170, 61), S(-180, 82)],
  ];
  const mainP = limbPts(main, R, 1), hangP = limbPts(hang, R, 1), w1P = limbPts(whip1, R, 0.3), w2P = limbPts(whip2, R, 0.3);
  // blossoms that sit behind the limb (on its far side): softened a little, a breath of mist
  for (const t of [0.14, 0.36, 0.5, 0.66, 0.8]) {
    const [x, y] = pointAt(mainP, t);
    cluster(env, back, x, y, dirAt(mainP, t), 11 * s, 3, 1, R, { mist: 0.25, blur: 0.6, stamens: false });
  }
  // ...and a few beyond it, lost in the mist: soft, pale, drawn first
  for (const t of [0.3, 0.58, 0.9]) {
    const [x, y] = pointAt(mainP, t);
    cluster(env, back, x - 6 * s, y - 16 * s, dirAt(mainP, t), 10 * s, 2, 0.9, R, { mist: 0.62, blur: 1.6, stamens: false });
  }
  back.reverse();
  for (const b of back) paintBlossom(env, b, R);
  plumLimb(env, main, 19 * s, 2.6 * s, R, { rim: true, dots: 1 });
  plumLimb(env, hang, 7 * s, 1.8 * s, R, { rim: true, dots: 1 });
  // the whips: one stroke each, straight and thin, lighter ink, rising
  for (const w of [w1P, w2P]) stroke(env.ctx, w, { w: 2.4 * s, col: env.ink.rgba(mix3(mix3(env.ink.C.navy, [96, 116, 136], 0.5), AIRC, 0.1), 0.85), tin: 0.05, tout: 0.85, min: 0.12, wob: 0.15, seed: R() * 50 });
  for (const [a, b] of spurs) stroke(env.ctx, limbPts([a, b], R, 0.4, 2), { w: 2.6 * s, col: env.ink.rgba(mix3(env.ink.C.navy, env.ink.C.ink, 0.4), 0.9), tin: 0.05, tout: 0.7, min: 0.2, seed: R() * 40 });
  // ---- the blossoms on the near limbs: a focal cluster at the elbow, others smaller and fewer toward the tips
  const nodes: { P: Pt[]; t: number; size: number; n: number; ripe: number; front?: boolean }[] = [
    { P: mainP, t: 0.06, size: 12, n: 4, ripe: 1 },
    { P: mainP, t: 0.2, size: 12.5, n: 3, ripe: 1 },
    { P: mainP, t: 0.33, size: 13, n: 3, ripe: 0.95 },
    { P: mainP, t: 0.44, size: 16, n: 6, ripe: 1.05, front: true },    // the focal cluster
    { P: mainP, t: 0.56, size: 12.5, n: 4, ripe: 1 },
    { P: mainP, t: 0.68, size: 11, n: 4, ripe: 0.9 },
    { P: mainP, t: 0.8, size: 9, n: 3, ripe: 0.7 },
    { P: mainP, t: 0.91, size: 7.5, n: 3, ripe: 0.5 },
    { P: mainP, t: 1, size: 6, n: 2, ripe: 0.3 },
    { P: hangP, t: 0.3, size: 13, n: 4, ripe: 1, front: true },
    { P: hangP, t: 0.62, size: 10, n: 3, ripe: 0.85 },
    { P: hangP, t: 0.88, size: 7.5, n: 2, ripe: 0.55 },
    { P: hangP, t: 1, size: 6, n: 2, ripe: 0.3 },
    { P: w1P, t: 0.5, size: 7, n: 2, ripe: 0.6 },
    { P: w1P, t: 1, size: 5.5, n: 1, ripe: 0.3 },
    { P: w2P, t: 0.55, size: 6.5, n: 2, ripe: 0.55 },
    { P: w2P, t: 1, size: 5, n: 1, ripe: 0.25 },
  ];
  for (const nd of nodes) {
    const [x, y] = pointAt(nd.P, nd.t);
    cluster(env, nd.front ? front : mid, x, y, dirAt(nd.P, nd.t), nd.size * s, nd.n, nd.ripe, R);
  }
  for (const [, b] of spurs) cluster(env, mid, b[0], b[1], 0, 10 * s, 2 + Math.floor(R() * 2), 0.95, R);
  // (the larger ones last, so the focal blossoms overlap their neighbours)
  mid.sort((p, q) => p.r - q.r).forEach((b) => paintBlossom(env, b, R));
  front.sort((p, q) => p.r - q.r).forEach((b) => paintBlossom(env, b, R));
  // a twig end crossing in front of the focal cluster (it sits IN the spray, not on top of it)
  const [fx, fy] = pointAt(mainP, 0.42);
  stroke(env.ctx, limbPts([[fx + 4 * s, fy - 2 * s], [fx - 8 * s, fy + 22 * s]], R, 0.5, 2), { w: 2.2 * s, col: env.ink.rgba(mix3(env.ink.C.navy, env.ink.C.ink, 0.4), 0.9), tin: 0.05, tout: 0.8, min: 0.2, seed: 7 });
  // ---- loose petals drifting down and to the left off the spray, nearer ones larger, the far ones soft
  const [px, py] = pointAt(mainP, 0.62);
  const drift: [number, number, number, number][] = [[-30, 40, 6.2, 0], [-64, 96, 5.2, 0.1], [-22, 138, 4.4, 0.4], [-110, 156, 3.8, 0.55], [14, 82, 5.4, 0.05], [-136, 70, 3.4, 0.65]];
  for (const [dx, dy, r, m] of drift) loosePetal(env, px + dx * s, py + dy * s, r * s, R, m);
  return [px, py];
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

/**
 * A swallow gliding (KEY frame): two long scythe wings (bent forward at the wrist, swept back to needle tips), a
 * slim body, a deep forked tail with long streamers; navy ink on top, the underwing a shade paler, the belly left
 * as paper. (x, y) = its body's centre; span = wingspan (world px); ang = heading (rad, 0 = right); mistK 0..1 greys
 * and softens it toward the far air.
 */
export function swallow(env: Env, x: number, y: number, span: number, ang: number, mistK: number, R: Rng) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const col = mix3(mix3(C.navy, C.ink, 0.2), [168, 190, 204], mistK);
  const under = mix3(mix3(C.navy, [110, 130, 156], 0.45), [190, 206, 216], mistK);
  const a = 1 - 0.35 * mistK;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const P = (u: number, v: number): Pt => [x + u * ca - v * sa, y + u * sa + v * ca];   // u forward, v toward the wing
  const h = span / 2;
  const paint = () => {
    for (const side of [-1, 1]) {
      const L = side < 0 ? 1 : 0.86;   // the far wing a little foreshortened
      const lead = spline([[0.06, 0.03], [0.2, 0.3 * L], [0.1, 0.62 * L], [-0.12, 0.86 * L], [-0.4, 1.0 * L]].map(([u, v]): Pt => P(u * h, side * v * h)), 7);
      const trail = spline([[-0.4, 1.0 * L], [-0.22, 0.72 * L], [-0.13, 0.42 * L], [-0.12, 0.16 * L], [-0.16, 0.03]].map(([u, v]): Pt => P(u * h, side * v * h)), 7);
      const g = ctx.createLinearGradient(...P(0.18 * h, 0), ...P(-0.2 * h, 0));
      g.addColorStop(0, rgba(col, 0.95 * a));
      g.addColorStop(0.55, rgba(col, 0.92 * a));
      g.addColorStop(1, rgba(under, 0.88 * a));
      wash(ctx, [...lead, ...trail], g, { jit: 0 });
      stroke(ctx, lead, { w: Math.max(0.7, span * 0.03), col: rgba(col, 0.92 * a), tin: 0.05, tout: 0.8, min: 0.1, wob: 0.1 });
    }
    // body: a slim spindle, the head forward
    const body = spline([[0.34, 0], [0.24, -0.06], [-0.05, -0.065], [-0.3, -0.03], [-0.36, 0], [-0.3, 0.03], [-0.05, 0.065], [0.24, 0.06], [0.34, 0]].map(([u, v]): Pt => P(u * h, v * h)), 4);
    wash(ctx, body, rgba(col, 0.97 * a), { jit: 0 });
    if (mistK < 0.5) wash(ctx, spline([[0.16, 0.035], [-0.06, 0.05], [-0.26, 0.022], [-0.04, 0.012], [0.16, 0.035]].map(([u, v]): Pt => P(u * h, v * h)), 4), rgba(C.light, 0.9), { jit: 0 });
    // the forked tail: two long streamers, splayed
    for (const side of [-1, 1]) {
      stroke(ctx, spline([[-0.3, side * 0.02], [-0.5, side * 0.06], [-0.72, side * 0.13], [-0.9, side * 0.2]].map(([u, v]): Pt => P(u * h, v * h)), 5), { w: Math.max(0.6, span * 0.034), col: rgba(col, 0.92 * a), tin: 0.02, tout: 0.92, min: 0.05 });
    }
  };
  if (mistK > 0.35) soft(env, 0.4 + mistK * 0.8, paint); else paint();
  void R;
}

/**
 * Willow framing a scene from the top right (the KEY frame's fresh willow): a real bough that comes in from beyond
 * the frame, tapering and arching down, two side branches; from all of them the strands fall in irregular groups of
 * very different lengths (long from the middle of the bough, short near its tip), bowing with the breeze, each in
 * lanceolate two-tone leaves that grow smaller toward the strand's end; the strands behind the bough misted and soft.
 * (x0, y0) = where the bough enters (world px, beyond the scene's edge); s = scale.
 */
export function willowFrame(env: Env, x0: number, y0: number, s: number, R: Rng, dir = -1) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  // (f1: two-tone: fresh #8FD16A on the near leaves over a deeper green at their base, misted #BFE3C8 on the back)
  const fresh: RGB = [143, 209, 106], deepG: RGB = [60, 140, 74], pale: RGB = [191, 227, 200];
  const S = (dx: number, dy: number): Pt => [x0 + dir * -dx * s, y0 + dy * s];
  const bough = [S(50, -24), S(-10, -2), S(-70, 12), S(-140, 22), S(-206, 46), S(-262, 88)];
  const side1 = [S(-70, 6), S(-104, -14), S(-150, -16)];
  const side2 = [S(-140, 18), S(-170, 52), S(-182, 84)];
  const bP = limbPts(bough, R, 0.8), s1P = limbPts(side1, R, 0.8), s2P = limbPts(side2, R, 0.8);
  // where strands hang from: (polyline, t range, how many, length scale)
  const sources: [Pt[], number, number, number, number][] = [[bP, 0.12, 1, 11, 1], [s1P, 0.2, 1, 5, 0.6], [s2P, 0.3, 1, 4, 0.55]];
  interface Strand { pts: Pt[]; back: boolean; w: number }
  const strands: Strand[] = [];
  for (const [P, t0, t1, n, ls] of sources) {
    let t = t0;
    for (let i = 0; i < n && t <= t1; i++) {
      // groups: two to four strands close together, then a gap
      const grp = 2 + Math.floor(R() * 3);
      for (let g = 0; g < grp; g++) {
        const tt = Math.min(t1, t + g * 0.012);
        const [bx, by] = pointAt(P, tt);
        const mid = 1 - Math.abs(tt - 0.4) * 1.1;
        // (f1: lengths from short tufts to long falls, each its own curve: a catenary bow out and back, a taper)
        const len = (30 + R() * R() * 300 * Math.max(0.3, mid)) * s * ls;
        const sway = (4 + R() * 26) * s * (len / (240 * s));
        const bow = (R() - 0.35) * 16 * s * (len / (200 * s));
        const pts: Pt[] = [];
        const k0 = R() * 0.3;
        for (let k = 0; k <= 30; k++) {
          const u = k / 30;
          const cat = Math.cosh((u - 0.5) * 2.2) - Math.cosh(1.1);
          pts.push([bx + dir * (sway * Math.pow(u, 1.8) - Math.sin(u * Math.PI * (1 + k0)) * 3 * s - bow * cat), by + len * u * (1 - 0.05 * u)]);
        }
        strands.push({ pts, back: R() < 0.33, w: (R() < 0.5 ? 0.7 : 1.0) * s });
      }
      t += 0.04 + R() * 0.07;
    }
  }
  const leafRow = (st: Strand) => {
    const mk = st.back ? 0.6 : 0;
    const stemC = mix3(mix3(C.jadeD, C.ink, 0.2), AIRC, mk);
    stroke(ctx, st.pts, { w: st.w, col: rgba(stemC, st.back ? 0.5 : 0.85), tin: 0.02, tout: 0.5, min: 0.25, seed: R() * 60 });
    const n = st.pts.length - 1;
    for (let k = 1; k < n; k += R() < 0.7 ? 1 : 2) {
      if (R() < 0.3) continue;   // gaps along the strand
      const u = k / n, [px, py] = st.pts[k];
      const nxt = st.pts[Math.min(n, k + 1)];
      const sa = Math.atan2(nxt[1] - py, nxt[0] - px);   // the strand's direction (down)
      const side = R() < 0.5 ? -1 : 1;
      // (A: willow leaves are long and narrow, set close along the strand, each its own length and angle)
      const L = (13 + R() * 15) * s * (1 - 0.5 * u), W = L * (0.12 + R() * 0.07);
      const a = sa + side * (0.22 + R() * 0.38);
      const tip: Pt = [px + Math.cos(a) * L, py + Math.sin(a) * L];
      const nx = -Math.sin(a) * W, ny = Math.cos(a) * W;
      const m: Pt = [(px + tip[0]) / 2, (py + tip[1]) / 2];
      const tone = R();
      const c0 = st.back ? mix3(pale, AIRC, 0.3) : mix3(fresh, deepG, 0.15 + 0.45 * (1 - u) * tone);
      const g = ctx.createLinearGradient(px, py, tip[0], tip[1]);
      g.addColorStop(0, rgba(st.back ? c0 : mix3(c0, deepG, 0.5), st.back ? 0.55 : 0.98));
      g.addColorStop(1, rgba(st.back ? mix3(c0, [255, 255, 255], 0.2) : mix3(c0, [214, 244, 190], 0.3), st.back ? 0.45 : 0.95));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(m[0] + nx, m[1] + ny, tip[0], tip[1]);
      ctx.quadraticCurveTo(m[0] - nx * 0.6, m[1] - ny * 0.6, px, py);
      ctx.fill();
    }
  };
  // the back strands, soft in the mist; then the bough; then the near strands, crisp
  soft(env, 1.2, () => strands.filter((t) => t.back).forEach(leafRow));
  // (f1: the bough in a green-ink, so it stands with its strands nearest the camera: shaders.ts frameKey)
  inkLimb(env, bough, 10 * s, 1.8 * s, R, WILLOW_INK, { dots: 0.8 });
  inkLimb(env, side1, 4 * s, 1.1 * s, R, WILLOW_INK, { dots: 0.3, rim: false });
  inkLimb(env, side2, 4 * s, 1.1 * s, R, WILLOW_INK, { dots: 0.3, rim: false });
  strands.filter((t) => !t.back).forEach(leafRow);
}

// ---------------------------------------------------------------- f1: the framing bough (round 3)
/**
 * A branch painted with pressure: one thick-thin run per joint-to-joint segment (pressed at the knot, lifted along
 * the run), navy ink at its core, a darker bone on the shadow side breaking into dry-brush, and a lit cyan rim along
 * the side facing the light (light from the left: `lit` = -1 rim on the upper-left).
 */
/** f1: a green-ink for the framing branches (bark that reads as ink, keyed as a framing element: shaders.ts frameKey). */
export const GREEN_INK = { body: [34, 92, 50] as RGB, bone: [20, 62, 32] as RGB, rim: [190, 236, 180] as RGB };
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function framingLimb(env: Env, ctl: Pt[], w0: number, w1: number, R: Rng, mk = 0, inkC: { body: RGB; bone: RGB; rim: RGB } | null = null) {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const bodyC = inkC ? inkC.body : mix3(mix3(C.navy, [58, 84, 116], 0.35), AIRC, mk);
  const boneC = inkC ? inkC.bone : mix3(mix3(C.navy, C.ink, 0.55), AIRC, mk * 0.9);
  const rimC: RGB = inkC ? inkC.rim : mix3([178, 232, 242], AIRC, mk);
  let tot = 0;
  const seg: { a: Pt; b: Pt; L: number }[] = [];
  for (let i = 0; i < ctl.length - 1; i++) { const L = Math.hypot(ctl[i + 1][0] - ctl[i][0], ctl[i + 1][1] - ctl[i][1]); seg.push({ a: ctl[i], b: ctl[i + 1], L }); tot += L; }
  let run = 0;
  seg.forEach((sg, i) => {
    const t0 = run / tot, t1 = (run + sg.L) / tot;
    run += sg.L;
    const wa = w0 + (w1 - w0) * Math.pow(t0, 0.75), wb = w0 + (w1 - w0) * Math.pow(t1, 0.75);
    const w = (wa + wb) / 2;
    const ux = (sg.b[0] - sg.a[0]) / (sg.L || 1), uy = (sg.b[1] - sg.a[1]) / (sg.L || 1);
    const ext = Math.min(sg.L * 0.1, w * 0.4);
    const pts = limbPts([[sg.a[0] - ux * ext * 0.3, sg.a[1] - uy * ext * 0.3], [sg.b[0] + ux * ext, sg.b[1] + uy * ext]], R, 1.4, 3);
    // the run's pressure: full at the knot, thinning toward the next
    stroke(ctx, pts, { w: wa * 1.08, col: rgba(bodyC, 0.94), tin: 0.04, tout: 0.2, min: Math.max(0.35, wb / wa * 0.9), wob: 0.25, dry: 0.02 + 0.04 * R(), seed: R() * 99 });
    const bone = offsetPts(pts, () => -w * 0.22);
    stroke(ctx, bone, { w: w * 0.6, col: rgba(boneC, 0.95), tin: 0.05, tout: 0.3, min: 0.4, wob: 0.35, dry: 0.28 + 0.2 * R(), seed: R() * 99 });
    if (w > 4) dryBrush(ctx, pts, { w: w * 0.9, col: rgba(inkC ? boneC : mix3(boneC, C.ink, 0.3), 0.5), bristles: 7, seed: Math.round(R() * 50), thr: 0.5 });
    // the lit rim: on the upper side (toward the light, up-left), a crisp cyan-white line 2-3 px, broken
    if (w > 2.2) {
      const rim = offsetPts(pts, () => w * 0.42);
      stroke(ctx, rim, { w: Math.max(1.2, w * 0.16), col: rgba(rimC, 0.85), tin: 0.12, tout: 0.4, min: 0.3, dry: 0.3, seed: R() * 77 });
    }
    if (i > 0 && w > 3) {
      const [kx, ky] = sg.a;
      ctx.fillStyle = rgba(boneC, 0.92);
      ctx.beginPath(); ctx.ellipse(kx, ky, w * 0.55, w * 0.4, Math.atan2(uy, ux), 0, Math.PI * 2); ctx.fill();
      for (let d = 0; d < 2; d++) {
        const a = Math.atan2(uy, ux) - Math.PI / 2 + (R() - 0.5) * 1.4, rr = w * (0.6 + R() * 0.4), ds = (0.8 + R() * 1.2) * Math.max(1, w / 10);
        ctx.fillStyle = rgba(inkC ? boneC : mix3(boneC, C.ink, 0.4), 0.9);
        ctx.beginPath(); ctx.ellipse(kx + Math.cos(a) * rr, ky + Math.sin(a) * rr, ds, ds * 0.6, a, 0, Math.PI * 2); ctx.fill();
      }
    }
  });
}

/**
 * A round 2: a limb painted as ONE smoothed brush stroke (the critic: "a slate-blue faceted tube with polygon kinks").
 * The path is a Catmull-Rom spline through the jittered joints (never straight runs between knots); the width tapers
 * from w0 to w1 over the whole run, with only a slight swelling at the knots and the hand's unevenness; brown-black
 * ink (INK_N toward umber) with a darker bone along the shadow side; flying white in two or three irregular skips
 * that follow the stroke; a few moss dots on top. Returns the path, its half widths and its upper edge (for twigs).
 */
interface InkC { body: RGB; bone: RGB; rim: RGB; dot: RGB }
const INK_NB: RGB = [12, 21, 28], UMBER: RGB = [120, 80, 50];
/** brown-black ink: INK_N moved ~15 % toward umber (and its wet, paler body a breath lighter) */
const BROWN_INK: InkC = { body: mix3(mix3(INK_NB, UMBER, 0.2), [236, 238, 234], 0.1), bone: mix3(INK_NB, UMBER, 0.12), rim: [214, 226, 230], dot: mix3(INK_NB, UMBER, 0.1) };
const PLUM_INK = BROWN_INK;
/** the willow's bough: the same brown ink, a little paler (it hangs in the air, further off than the plum) */
const WILLOW_INK: InkC = { body: mix3(BROWN_INK.body, [150, 150, 140], 0.28), bone: mix3(BROWN_INK.bone, [110, 108, 100], 0.25), rim: BROWN_INK.rim, dot: BROWN_INK.dot };
const PINE_INK = BROWN_INK;
export const WOOD_GREEN = BROWN_INK;
interface LimbOut { P: Pt[]; hw: number[]; up: Pt[]; nrm: Pt[] }
function inkLimb(env: Env, ctl: Pt[], w0: number, w1: number, R: Rng, c: InkC = PLUM_INK, o: { rim?: boolean; dots?: number; alpha?: number; white?: boolean; jit?: number; angular?: boolean; press?: number; bark?: boolean } = {}): LimbOut {
  const { ctx, ink } = env;
  const { rgba } = ink;
  const al = o.alpha ?? 1;
  const jk = o.jit ?? 0.22;
  const K = ctl.map(([x, y], i): Pt => (i === 0 || i === ctl.length - 1 ? [x, y] : [x + (R() - 0.5) * w0 * jk, y + (R() - 0.5) * w0 * jk]));
  // (n1: a plum limb is angular: straight runs between knots, a kink at each, never a smooth spline)
  const P = resample(o.angular ? K : spline(K, 12), Math.max(0.7, Math.min(2, w1 * 0.7)));
  const n = P.length;
  if (n < 3) return { P, hw: [], up: [], nrm: [] };
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
    // (M: the brush pressed at the start and lifting toward the tip: thick-thin, never an even tube)
    let w = w1 + (w0 - w1) * Math.pow(1 - t, o.press ?? 1.5) * (1 + 0.12 * Math.exp(-Math.pow(t / 0.06, 2)));
    for (const j of joints) w *= 1 + 0.16 * Math.exp(-Math.pow((t - j) / 0.022, 2)) - 0.07 * Math.exp(-Math.pow((t - j - 0.05) / 0.03, 2));   // pressed at the knot, thinner just past it
    w *= 1 + 0.09 * Math.sin(t * 23 + ph) * Math.sin(t * 7.3 + ph * 0.7);                 // the hand's unevenness
    if (o.bark) {
      // q2 (BRIEF3 #1: "a fairly smooth even stroke"): the brush is pressed down after every knot and lifted as it runs
      // on to the next (each run thick to thin), swelling again into the knot; a sudden lift once or twice per run
      let a = 0, b = 1;
      for (const j of joints) { if (j <= t) a = j; else { b = j; break; } }
      const rt = (t - a) / Math.max(1e-3, b - a);
      w *= 1.22 - 0.42 * Math.pow(rt, 0.65) + 0.26 * Math.exp(-Math.pow((rt - 1) / 0.07, 2));
      w *= 1 - 0.16 * Math.exp(-Math.pow((rt - 0.55 - 0.1 * Math.sin(a * 40 + ph)) / 0.05, 2));
    }
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
    const rag = (k: number) => 1 + (vn(cum[i] * 0.09 + k) - 0.5) * 0.12 + (vn(cum[i] * 0.37 + k * 3) - 0.5) * 0.08 + (o.bark ? (vn(cum[i] * 1.1 + k * 7) - 0.5) * 0.16 * (k > 2 ? 1 : 0.5) : 0);   // (M: a ragged, bitten edge; q2: a finer dry bite, most on the shadow side)
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
  // the body: the wet stroke, one fill (M: deeper at the root, a little paler and drier toward the tip)
  const bg = ctx.createLinearGradient(P[0][0], P[0][1], P[n - 1][0], P[n - 1][1]);
  // (the wet body a mid ink, so the dry bristle strokes over it read: a dark loaded brush over a paler wet one)
  bg.addColorStop(0, rgba(mix3(c.body, [120, 116, 112], 0.3), 0.95 * al));
  bg.addColorStop(0.55, rgba(mix3(c.body, [130, 128, 124], 0.36), 0.92 * al));
  bg.addColorStop(1, rgba(mix3(c.body, [150, 156, 160], 0.3), 0.88 * al));
  ctx.fillStyle = bg;
  poly(U, D, 0, n - 1);
  // M: bristle tracks: long dry strokes of deeper ink along the limb at different offsets across it, broken where the
  // brush ran dry, so the limb reads as one dry-brush stroke with texture (feibai), not a smooth tube
  if (w0 > 5) {
    const nt = 3 + (R() < 0.5 ? 1 : 0);
    for (let k = 0; k < nt; k++) {
      const off = -0.65 + (1.2 * (k + R() * 0.6)) / nt;
      const s0 = Math.floor(R() * 0.12 * n), s1 = Math.min(n - 1, Math.floor((0.55 + R() * 0.4) * n));
      const pts: Pt[] = [];
      for (let i = s0; i <= s1; i++) pts.push([P[i][0] + nrm[i][0] * hw[i] * off, P[i][1] + nrm[i][1] * hw[i] * off]);
      if (pts.length > 3) stroke(ctx, pts, { w: Math.max(0.5, hw[s0] * (0.16 + R() * 0.14)), col: rgba(c.bone, (0.7 + R() * 0.25) * al), tin: 0.1, tout: 0.6, min: 0.1, wob: 0.4, dry: 0.4, seed: R() * 99 });
    }
  }
  // the bone: a darker band along the shadow (lower) side, in two or three long runs that come and go
  const inner = P.map(([x, y], i): Pt => [x - nrm[i][0] * hw[i] * 0.05, y - nrm[i][1] * hw[i] * 0.05]);
  for (const [s0, s1] of runIdx(n, R, 0.3, 0.62, 0.06)) {
    ctx.fillStyle = rgba(c.bone, 0.78 * al);
    const mid: Pt[] = [];
    for (let i = s0; i <= s1; i++) { const k = Math.sin(Math.PI * (i - s0) / Math.max(1, s1 - s0)); mid.push([D[i][0] + (inner[i][0] - D[i][0]) * k, D[i][1] + (inner[i][1] - D[i][1]) * k]); }
    ctx.beginPath(); ctx.moveTo(mid[0][0], mid[0][1]);
    for (let i = 1; i < mid.length; i++) ctx.lineTo(mid[i][0], mid[i][1]);
    for (let i = s1; i >= s0; i--) ctx.lineTo(D[i][0], D[i][1]);
    ctx.closePath(); ctx.fill();
  }
  if (o.bark) {
    // q2: where the loaded brush pressed, the ink pooled near-black on the shadow half (two or three wet patches per
    // limb, their edges soft), so the limb has a dark-to-mid value story instead of one even grey
    for (const [s0, s1] of runIdx(n, R, 0.08, 0.2, 0.25)) {
      const mid: Pt[] = [];
      for (let i = s0; i <= s1; i++) { const k = Math.sin(Math.PI * (i - s0) / Math.max(1, s1 - s0)); mid.push([P[i][0] + nrm[i][0] * hw[i] * (0.35 * k - 0.1), P[i][1] + nrm[i][1] * hw[i] * (0.35 * k - 0.1)]); }
      ctx.fillStyle = rgba(mix3(c.bone, [0, 0, 0], 0.45), 0.7 * al);
      ctx.beginPath(); ctx.moveTo(mid[0][0], mid[0][1]);
      for (let i = 1; i < mid.length; i++) ctx.lineTo(mid[i][0], mid[i][1]);
      for (let i = s1; i >= s0; i--) ctx.lineTo(D[i][0] + nrm[i][0] * hw[i] * 0.08, D[i][1] + nrm[i][1] * hw[i] * 0.08);
      ctx.closePath(); ctx.fill();
    }
  }
  // flying white: two or three irregular skips along the stroke where the dry brush lifted (cut out of the layer)
  if ((o.white ?? true) && w0 > 6) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const nk = 3 + (R() < 0.5 ? 1 : 0);
    const cs = [0.06 + R() * 0.1, 0.22 + R() * 0.1, 0.4 + R() * 0.12, 0.6 + R() * 0.12].slice(0, nk);
    for (const c0 of cs) {
      const len = Math.round((o.bark ? 0.14 + R() * 0.16 : 0.1 + R() * 0.14) * n), s0 = Math.floor(c0 * n), s1 = Math.min(n - 2, s0 + len);   // (m5: longer dry runs)
      if (s1 - s0 < 3 || hw[s0] < 2.5) continue;
      const cuts = o.bark ? 3 + Math.floor(R() * 2) : 2 + (R() < 0.5 ? 1 : 0);
      const offB = -0.3 + R() * 0.5;   // (q2: the bristles of one skip lie side by side, as one dry brush drags them)
      for (let b = 0; b < cuts; b++) {
        const off = o.bark ? offB + (b - cuts / 2) * 0.2 + (R() - 0.5) * 0.08 : -0.45 + R() * 1.0, a0 = s0 + Math.floor(R() * (s1 - s0) * 0.3);
        const pts: Pt[] = [];
        for (let i = a0; i <= s1; i++) pts.push([P[i][0] + nrm[i][0] * hw[i] * off, P[i][1] + nrm[i][1] * hw[i] * off]);
        if (pts.length < 3) continue;
        stroke(ctx, pts, { w: Math.max(0.5, hw[s0] * (o.bark ? 0.07 + R() * 0.09 : 0.08 + R() * 0.14)), col: `rgba(0,0,0,${(0.62 + R() * 0.3).toFixed(2)})`, tin: 0.4, tout: 0.5, min: 0.05, dry: o.bark ? 0.62 : 0.45, seed: R() * 90 });
      }
    }
    ctx.restore();
  }
  // a breath of light along part of the upper edge (no hairline: a broken, thin, pale lift)
  if (o.rim) {
    for (const [s0, s1] of runIdx(n, R, 0.12, 0.3, 0.2)) {
      if (hw[s0] < 3) continue;
      const pts: Pt[] = [];
      for (let i = s0; i <= s1; i++) pts.push([U[i][0] - nrm[i][0] * hw[i] * 0.16, U[i][1] - nrm[i][1] * hw[i] * 0.16]);
      stroke(ctx, pts, { w: Math.max(0.5, hw[s0] * 0.12), col: rgba(c.rim, 0.28 * al), tin: 0.3, tout: 0.5, min: 0.15, dry: 0.3, seed: R() * 77 });
    }
  }
  if (o.bark) {
    // q2: bark. Short broken dry strokes laid ACROSS the limb on its shadow half (the rough skin of an old plum), a few
    // per run and never evenly spaced, and at each joint a knot: a dark eye with a pale lift inside it and the stub of
    // an old twig broken off above it
    let i = Math.floor(n * (0.03 + R() * 0.04));
    while (i < n * 0.8) {
      const h = hw[i];
      if (h > 2.4) {
        const a = Math.atan2(P[Math.min(n - 1, i + 1)][1] - P[i][1], P[Math.min(n - 1, i + 1)][0] - P[i][0]);
        const ux = Math.cos(a), uy = Math.sin(a), [nx, ny] = nrm[i];
        const t0 = -0.95 + R() * 0.25, t1 = t0 + 0.55 + R() * 0.5, lean = (R() - 0.3) * h * 0.9;
        const pts: Pt[] = [];
        for (let k = 0; k <= 4; k++) {
          const v = t0 + (t1 - t0) * (k / 4), bow = Math.sin((k / 4) * Math.PI) * h * 0.12;
          pts.push([P[i][0] + nx * h * v + ux * (lean * (k / 4) + bow), P[i][1] + ny * h * v + uy * (lean * (k / 4) + bow)]);
        }
        stroke(ctx, pts, { w: Math.max(0.6, h * (0.1 + R() * 0.12)), col: rgba(c.bone, (0.55 + R() * 0.3) * al), tin: 0.2, tout: 0.6, min: 0.15, wob: 0.5, dry: 0.35, seed: R() * 90 });
      }
      i += Math.max(3, Math.round((5 + R() * 11) * Math.max(1, h * 0.35) / Math.max(0.7, Math.min(2, w1 * 0.7))));
    }
    for (const j of joints) {
      const ji = Math.min(n - 1, Math.round(j * (n - 1)));
      const h = hw[ji];
      if (h < 2.5) continue;
      const [nx, ny] = nrm[ji];
      const a = Math.atan2(P[Math.min(n - 1, ji + 1)][1] - P[Math.max(0, ji - 1)][1], P[Math.min(n - 1, ji + 1)][0] - P[Math.max(0, ji - 1)][0]);
      const kx = P[ji][0] - nx * h * 0.15, ky = P[ji][1] - ny * h * 0.15;
      // (a knot is where the brush stopped and pressed: a darker, wetter blot on the shadow side, ragged, and a
      // pale lift on the upper side; never a ring, which reads as a bolt)
      ctx.save();
      ctx.translate(kx, ky); ctx.rotate(a);
      // (a short dark crescent on the shadow edge, where the knot's swelling turns away)
      ctx.strokeStyle = rgba(mix3(c.bone, [0, 0, 0], 0.4), 0.85 * al);
      ctx.lineWidth = Math.max(0.8, h * 0.28); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.ellipse(0, h * 0.1, h * (0.8 + R() * 0.3), h * 0.85, 0, 0.35 * Math.PI + R() * 0.15, 0.75 * Math.PI - R() * 0.15); ctx.stroke();
      ctx.fillStyle = rgba(c.rim, 0.18 * al);
      ctx.beginPath(); ctx.ellipse(h * 0.1, -h * 0.42, h * 0.32, h * 0.09, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (R() < 0.45) {
        // the stub of a broken twig, out of the limb's upper edge just past the knot, cut off square
        const ui = Math.min(n - 1, ji + 2), ang = a - Math.PI / 2 * Math.sign(-ny || 1) * 0.7 + (R() - 0.5) * 0.5;
        const sx = U[ui][0] - nx * h * 0.15, sy = U[ui][1] - ny * h * 0.15, Ls = h * (0.5 + R() * 0.45);
        stroke(ctx, [[sx, sy], [sx + Math.cos(ang) * Ls * 0.5 + nx * Ls * 0.3, sy + Math.sin(ang) * Ls * 0.5 + ny * Ls * 0.3], [sx + Math.cos(ang) * Ls + nx * Ls * 0.55, sy + Math.sin(ang) * Ls + ny * Ls * 0.55]], { w: h * 0.6, col: rgba(c.bone, 0.92 * al), tin: 0.02, tout: 0.1, min: 0.7, wob: 0.2, seed: R() * 40 });
      }
    }
  }
  // moss dots: at most five small ones on the top of the limb, 2-4 px, never in a row
  // (q2, bark: up to twelve, in loose twos and threes, of different sizes, a few near-black)
  if (o.bark) {
    const ng = 5 + Math.floor(R() * 2);
    for (let g = 0; g < ng; g++) {
      const i0 = Math.floor((0.04 + 0.78 * R()) * (n - 1));
      if (hw[i0] < 3) continue;
      const k = 1 + Math.floor(R() * 3);
      for (let d = 0; d < k; d++) {
        const i = Math.min(n - 1, i0 + Math.floor((R() - 0.3) * 6));
        const ds = (0.7 + R() * R() * 2.6) * Math.max(1, env.scale / 1440);
        const lift = (0.5 + R() * 0.8) * ds;   // (on the edge, half out of it: never a hole in the limb)
        const px = U[i][0] + nrm[i][0] * lift, py = U[i][1] + nrm[i][1] * lift;
        ctx.fillStyle = rgba(R() < 0.4 ? mix3(c.dot, [0, 0, 0], 0.4) : c.dot, (0.7 + R() * 0.28) * al);
        ctx.beginPath(); ctx.ellipse(px, py, ds, ds * (0.45 + R() * 0.4), Math.atan2(nrm[i][1], nrm[i][0]) + (R() - 0.5) * 0.8, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  const nd = o.bark ? 0 : Math.min(5, Math.round(o.dots ?? 0));
  for (let d = 0; d < nd; d++) {
    const i = Math.floor((0.08 + 0.6 * R()) * (n - 1));
    if (hw[i] < 3) continue;
    const ds = (1 + R() * 1) * Math.max(1, env.scale / 1440);
    const px = U[i][0] + nrm[i][0] * ds * 0.4, py = U[i][1] + nrm[i][1] * ds * 0.4;
    ctx.fillStyle = rgba(c.dot, (0.75 + R() * 0.2) * al);
    ctx.beginPath(); ctx.ellipse(px, py, ds, ds * (0.6 + R() * 0.3), R() * 3, 0, Math.PI * 2); ctx.fill();
  }
  return { P, hw, up: U, nrm };
}
/** A twig: a short, curved, tapered stroke off a limb (never a straight stick, never a spike). Returns its path. */
function twig(env: Env, from: Pt, ang: number, len: number, w: number, bend: number, R: Rng, c: InkC = PLUM_INK, al = 1): Pt[] {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const mid: Pt = [from[0] + ca * len * 0.5 - sa * bend * len * 0.18, from[1] + sa * len * 0.5 + ca * bend * len * 0.18];
  const end: Pt = [from[0] + Math.cos(ang + bend * 0.35) * len, from[1] + Math.sin(ang + bend * 0.35) * len];
  const pts = spline([from, mid, end], 10);
  stroke(env.ctx, pts, { w, col: env.ink.rgba(c.body, 0.92 * al), tin: 0.02, tout: 0.9, min: 0.1, wob: 0.12, seed: R() * 90 });
  return pts;
}
/** What lies along a limb: the point at t and the side "up" there. */
function onLimb(L: LimbOut, t: number, side: number): { p: Pt; up: Pt; along: number; hw: number } {
  const i = Math.min(L.P.length - 1, Math.max(0, Math.round(t * (L.P.length - 1))));
  const j = Math.min(L.P.length - 1, i + 1), k = Math.max(0, i - 1);
  const along = Math.atan2(L.P[j][1] - L.P[k][1], L.P[j][0] - L.P[k][0]);
  const n = L.nrm[i] ?? [0, -1];
  return { p: L.P[i], up: [n[0] * side, n[1] * side], along, hw: L.hw[i] ?? 1 };
}

/**
 * A round 2: the plum bough (the critic: clip-art, the loudest thing, cutting the peak). It enters from the top-right
 * corner (out of the paper under the header) and arcs down and left across the sky, its lowest blossom above the right
 * crag's shoulder and right of the waterfall, its tip reaching toward the light. Blossoms in three sizes (1 : 0.65 :
 * 0.35), open, three-quarter, cup, half-open, buds; a few behind the limb; the nearest one soft (near focus), the far
 * twig ends hazed. (ex, ey) = where it enters (world px); s = scale. Returns the box its petals fall from.
 */
/** P3 (elements.ts plumGust): the plum's main limb as plumFrame lays it (its control points before the brush's
 *  jitter), world px: where the pointer may touch the bough. */
export function plumLine(ex: number, ey: number, s: number, trim = 1): Pt[] {
  return [[52, 104], [-30, 70], [-104, 56], [-170, 66], [-226, 92], [-276 * trim, 110], [-322 * trim, 104], [-350 * trim, 90]].map(([dx, dy]): Pt => [ex + dx * s, ey + dy * s]);
}
export function plumFrame(env: Env, ex: number, ey: number, s: number, R: Rng, o: { trim?: number } = {}): { box: { x: number; y: number; w: number; h: number } } {
  const S = (dx: number, dy: number): Pt => [ex + dx * s, ey + dy * s];
  const trim = o.trim ?? 1;   // (phones: the tip is shorter)
  const jit = (c: Pt[], k: number) => c.map(([x, y], i): Pt => (i === 0 || i === c.length - 1 ? [x, y] : [x + (R() - 0.5) * k * s, y + (R() - 0.5) * k * s]));
  const mainC = [S(52, 104), S(-30, 70), S(-104, 56), S(-170, 66), S(-226, 92), S(-276 * trim, 110), S(-322 * trim, 104), S(-350 * trim, 90)];
  const subC = [S(-104, 52), S(-108, 84), S(-124, 112), S(-146, 128), S(-158, 140)];
  const whipC = [S(-170, 66), S(-180, 50), S(-192, 40), S(-206, 36)];
  const whip2C = [S(-226, 92), S(-236, 78), S(-248, 70), S(-258, 68)];
  const upC = [S(-30, 68), S(-46, 30), S(-56, -10), S(-68, -18)];   // (n1: a short rising shoot that ends in a bud, never run up into the header's paper as a grey fade)
  [mainC, subC, whipC, whip2C, upC].forEach((c, i) => c.splice(0, c.length, ...jit(c, i === 0 ? 6 : 3)));
  const back: Blossom[] = [], mid: Blossom[] = [], front: Blossom[] = [];
  const LB = 27 * s, MB = 16 * s, SB = 9.5 * s;   // (M: a wider spread of sizes)
  const kindOf = (r: number, q: number): BlossomKind => (r >= LB * 0.9 ? (q < 0.55 ? 'open' : q < 0.85 ? 'tq' : 'cup') : r >= MB * 0.85 ? (q < 0.3 ? 'open' : q < 0.6 ? 'tq' : q < 0.82 ? 'cup' : 'half') : q < 0.45 ? 'half' : q < 0.9 ? 'bud' : 'dot');   // (M: few dots: they read as flat beads)
  // (n1: blossoms gather at the nodes of a limb, never spaced evenly along it)
  const NODES = [0.08, 0.3, 0.5, 0.7, 0.88];
  let nPut = 0;   // (q2: the colour families dealt in turn (a golden-ratio walk), so every spray has its whites and roses)
  const put = (list: Blossom[], L: LimbOut, t0: number, r: number, side: number, off: number, extra: Partial<Blossom> = {}) => {
    const tone = (0.11 + 0.618034 * nPut++) % 1;
    const nd = NODES.reduce((p, q) => (Math.abs(q - t0) < Math.abs(p - t0) ? q : p), NODES[0]);
    const t = L === mainL ? nd + (t0 - nd) * 0.35 : t0;
    const { p, up, along, hw } = onLimb(L, t, side);
    const jx = (R() - 0.5) * r * 0.6, jy = (R() - 0.5) * r * 0.6;
    const d = hw + r * off;
    const x = p[0] + up[0] * d + jx, y = p[1] + up[1] * d + jy;
    const rr = r * (0.7 + R() * 0.58);   // (q2: one continuous spread of sizes, not three stamped classes)
    const b: Blossom = { x, y, r: rr, kind: kindOf(rr, R()), toward: Math.atan2(p[1] - y, p[0] - x), mist: 0, blur: 0, stamens: true, seed: R(), np: 5, tone, ...extra };
    void along;
    list.push(b);
  };
  // the limbs (painted after the blossoms that sit behind them)
  // (placement needs the limb paths: a probe that draws nothing gives the same spline the brush will follow)
  const probe = (ctl: Pt[], w0: number, w1: number, ang = false): LimbOut => {
    const K = ctl;
    const P = resample(ang ? K : spline(K, 12), 1.5);
    const n = P.length;
    const nrm: Pt[] = [], hw: number[] = [];
    let sy = 0;
    const raw: Pt[] = [];
    for (let i = 0; i < n; i++) { const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)]; let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l; raw.push([nx, ny]); sy += ny; }
    const sg = sy > 0 ? -1 : 1;
    for (let i = 0; i < n; i++) { nrm.push([raw[i][0] * sg, raw[i][1] * sg]); hw.push((w0 + (w1 - w0) * Math.pow(i / (n - 1), 1.05)) * 0.5); }
    return { P, hw, up: [], nrm };
  };
  const mainL = probe(mainC, 22 * s, 6 * s, true), subL = probe(subC, 10 * s, 2.6 * s, true), whipL = probe(whipC, 4.2 * s, 1 * s), whip2L = probe(whip2C, 3.6 * s, 0.9 * s), upL = probe(upC, 8 * s, 1.4 * s);
  // behind the limb: three, a breath of mist on them
  put(back, mainL, 0.24, MB, -1, -0.1, { mist: 0.28, stamens: false });
  put(back, mainL, 0.5, MB * 0.95, -1, -0.2, { mist: 0.3, stamens: false });
  put(back, mainL, 0.66, SB * 1.3, 1, -0.6, { mist: 0.35, stamens: false });
  // (q2: and a few beyond the limb, out of focus: soft, paler, the light through them)
  put(back, mainL, 0.76, MB * 0.95, -1, 0.5, { mist: 0.5, blur: 1.3 * s, stamens: false, kind: 'tq', tone: 0.6 });
  put(back, mainL, 0.92, SB * 1.2, -1, 0.4, { mist: 0.55, blur: 1.1 * s, stamens: false, kind: 'open', tone: 0.5 });
  // on and before the limb: the focal pair near the elbow, others smaller toward the tips
  put(mid, mainL, 0.13, MB, 1, 0.1);
  put(mid, mainL, 0.17, SB, 1, 0.5);
  put(front, mainL, 0.33, LB, 1, -0.15);
  put(mid, mainL, 0.38, MB * 0.9, -1, 0.0);
  put(mid, mainL, 0.36, SB, 1, 1.4);
  put(front, mainL, 0.52, LB * 0.92, 1, 0.05);
  put(mid, mainL, 0.57, MB * 0.85, 1, 1.0);
  put(mid, mainL, 0.6, SB, -1, 0.4);
  put(mid, mainL, 0.72, MB * 0.8, 1, 0.2);
  put(mid, mainL, 0.8, SB * 1.1, -1, 0.1, { mist: 0.18 });
  put(mid, mainL, 0.9, SB, 1, 0.3, { mist: 0.4, stamens: false });
  put(mid, mainL, 0.99, SB * 0.8, 1, 0.0, { mist: 0.5, stamens: false, kind: 'bud' });
  put(mid, subL, 0.3, MB, -1, 0.0);
  put(front, subL, 0.62, LB * 1.12, -1, -0.1, { kind: 'open' });   // (M: the nearest is crisp and open, the biggest: no blurry blob)
  put(mid, subL, 0.96, SB, -1, 0.0, { kind: 'bud' });
  put(mid, whipL, 0.55, SB * 1.1, 1, 0.1, { mist: 0.25 });
  put(mid, whipL, 1, SB * 0.8, 1, 0.0, { mist: 0.45, kind: 'dot', stamens: false });
  put(mid, whip2L, 0.6, SB, 1, 0.2, { mist: 0.35 });
  put(mid, whip2L, 1, SB * 0.75, 1, 0.0, { mist: 0.55, kind: 'dot', stamens: false });
  // ...and on the limb near its root a pair of blossoms seen side-on (profile cups)
  put(mid, mainL, 0.06, MB * 0.9, 1, 0.2, { kind: 'cup' });
  put(mid, mainL, 0.09, SB * 1.2, -1, 0.3);
  put(mid, mainL, 0.24, MB * 0.75, 1, 0.6);
  put(mid, mainL, 0.27, SB, -1, 0.2, { kind: 'bud' });
  put(front, mainL, 0.46, MB * 1.05, -1, 0.05);
  put(mid, mainL, 0.49, SB * 1.15, 1, 1.6);
  put(mid, mainL, 0.66, MB * 0.7, -1, 0.3, { mist: 0.12 });
  put(mid, mainL, 0.85, SB * 0.9, 1, 0.6, { mist: 0.3, kind: 'bud' });
  put(mid, subL, 0.12, SB * 1.2, 1, 0.3);
  put(mid, subL, 0.45, MB * 0.8, 1, 0.1);
  put(mid, subL, 0.8, SB * 1.1, 1, 0.2, { kind: 'half' });
  put(mid, upL, 0.4, MB * 0.85, -1, 0.1);
  put(mid, upL, 0.7, SB, 1, 0.2, { kind: 'half' });
  put(mid, upL, 1, SB * 0.8, 1, 0.0, { kind: 'bud' });
  put(mid, whipL, 0.25, SB * 0.9, -1, 0.2, { kind: 'half', mist: 0.2 });
  // (q2: two nodes where the blossoms crowd and overlap, a white one over a pink one, as a real spray bunches)
  put(mid, mainL, 0.29, MB * 1.1, 1, 0.45, { tone: 0.2 });
  put(mid, mainL, 0.31, MB * 0.85, 1, 0.95, { tone: 0.65 });
  put(mid, mainL, 0.69, MB, -1, 0.25, { tone: 0.15 });
  put(mid, mainL, 0.71, SB * 1.2, 1, 0.6, { tone: 0.9, kind: 'half' });
  for (const b of [...back].reverse()) paintBlossom(env, b, R);
  // the limbs: the main limb, the hanging sub-limb, two whips; then the short curved twigs off their upper side
  inkLimb(env, upC, 8 * s, 1.4 * s, R, PLUM_INK, { white: false, jit: 0 });
  const subP = inkLimb(env, subC, 10 * s, 2.6 * s, R, PLUM_INK, { dots: 1, jit: 0, angular: true, press: 0.9, bark: true });
  const mainP = inkLimb(env, mainC, 22 * s, 6 * s, R, PLUM_INK, { dots: 3, rim: true, jit: 0, angular: true, press: 0.75, bark: true });
  inkLimb(env, whipC, 4.2 * s, 1 * s, R, PLUM_INK, { white: false, jit: 0 });
  inkLimb(env, whip2C, 3.6 * s, 0.9 * s, R, PLUM_INK, { white: false, jit: 0 });
  for (const [t, a, len, b] of [[0.2, -1.75, 15, 0.9], [0.4, -2.35, 12, -0.9], [0.6, -1.95, 11, 0.8], [0.78, 2.7, 9, -0.9]] as const) {
    const { p, up, hw } = onLimb(mainP, t, 1);
    const tp = twig(env, [p[0] + up[0] * hw * 0.6, p[1] + up[1] * hw * 0.6], a + (R() - 0.5) * 0.3, len * s, 2.2 * s, b, R);
    const e = tp[tp.length - 1];
    paintBlossom(env, { x: e[0], y: e[1], r: SB * 0.9, kind: R() < 0.5 ? 'bud' : 'half', toward: a + Math.PI, mist: 0.1, blur: 0, stamens: false, seed: R(), np: 5 }, R);
  }
  { const { p, up, hw } = onLimb(subP, 0.5, -1); twig(env, [p[0] + up[0] * hw * 0.5, p[1] + up[1] * hw * 0.5], 2.5, 14 * s, 1.8 * s, 0.5, R); }
  mid.sort((p, q) => p.r - q.r).forEach((b) => paintBlossom(env, b, R));
  front.sort((p, q) => (p.blur > 0 ? 1 : 0) - (q.blur > 0 ? 1 : 0) || p.r - q.r).forEach((b) => paintBlossom(env, b, R));
  const [bx, by] = onLimb(mainP, 0.55, 1).p;
  return { box: { x: bx - 200 * s, y: by - 10 * s, w: 300 * s, h: 220 * s } };
}

/**
 * A round 2: a swallow painted with the brush (the critic: "two symmetric dark-blue crescents, a logo bird"). An
 * ink-black back and wings laid in two strokes each (the leading edge loaded, the trailing feathers dragged out dry),
 * the near wing raised and longer, the far wing foreshortened and lower (it banks), a white belly, a long, unequally
 * forked tail. (x, y) = its body; span = wingspan; ang = heading; bank: -1..1 (which wing is raised); mist: 0..1.
 */
export function swallowInk(env: Env, x: number, y: number, span: number, ang: number, R: Rng, o: { bank?: number; mist?: number; lift?: number } = {}) {
  // M "Spring ink" (the judges: "a solid black cut-out that reads like an icon"): the swallow painted as a bird, not a
  // glyph. Each wing is a long scythe that tapers from the wrist to a fine point, laid as a wash that is deep indigo-ink
  // at the shoulder and goes paler and thinner toward the tip, its primaries dragged out as separate dry strokes (a
  // fingered tip), the leading edge one loaded thick-thin stroke; the near wing raised and long, the far one
  // foreshortened and swept back (it banks). An indigo back, a white belly, a breath of rust at the throat, two unequal
  // tail streamers. The whole bird is laid with a soft edge (the seven-tap soft()), so it sits in the air.
  const { ctx, ink } = env;
  const { rgba } = ink;
  const mk = o.mist ?? 0, bank = o.bank ?? 0.6, lift = o.lift ?? 0.3;
  const air: RGB = [186, 204, 216];
  const backC = mix3([18, 26, 42], air, mk), midC = mix3([50, 72, 106], air, mk), tipC = mix3([118, 140, 166], air, mk);
  const sheenC = mix3([112, 146, 190], air, mk);
  const belly: RGB = mix3([250, 252, 252], [226, 236, 240], mk);
  const A = 1 - 0.4 * mk;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const h = span / 2;
  const P = (u: number, v: number): Pt => [x + (u * ca - v * sa) * h, y + (u * sa + v * ca) * h];   // u forward, v to the wing's side
  const paint = () => {
    for (const side of [1, -1]) {   // the far wing first, the near (raised) one over the body
      const near = side < 0;
      const Lw = near ? 1 : 0.52 + 0.12 * (1 - bank);
      const rise = near ? lift : -lift * 0.4;
      const sw = near ? 0.0 : 0.22;                     // the far wing swept further back
      // the wing's spine: shoulder, wrist (forward), then sweeping back to the tip
      const spine = spline([[0.06, 0.03], [0.2 - sw * 0.3, (0.3 + rise * 0.15) * Lw], [0.12 - sw * 0.7, (0.58 + rise * 0.12) * Lw], [-0.16 - sw, 0.84 * Lw], [-0.58 - sw * 1.3, 1.02 * Lw]].map(([u, v]): Pt => [u, side * v]), 10);
      const n = spine.length;
      const Ld: Pt[] = [], Tr: Pt[] = [];
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const a = spine[Math.max(0, i - 1)], b = spine[Math.min(n - 1, i + 1)];
        let nx = -(b[1] - a[1]), ny = b[0] - a[0];
        const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
        if (nx < 0) { nx = -nx; ny = -ny; }             // the normal toward the head (forward)
        // (m3: broad over the arm, a notch in the trailing edge just past the wrist, then the long narrow hand)
        const w = (0.16 * (1 - Math.pow(t, 1.4)) + 0.012) * (near ? 1 : 0.85) * (1 - 0.22 * Math.exp(-Math.pow((t - 0.42) / 0.1, 2))) * (1 + 0.06 * Math.sin(t * 9 + R()));
        Ld.push([spine[i][0] + nx * w * 0.3, spine[i][1] + ny * w * 0.3]);
        Tr.push([spine[i][0] - nx * w * 0.7, spine[i][1] - ny * w * 0.7]);
      }
      const poly = [...Ld, ...Tr.slice().reverse()].map(([u, v]) => P(u, v));
      const g = ctx.createLinearGradient(...P(spine[0][0], spine[0][1]), ...P(spine[n - 1][0], spine[n - 1][1]));
      g.addColorStop(0, rgba(backC, 0.95 * A));
      g.addColorStop(0.45, rgba(midC, 0.86 * A));
      g.addColorStop(1, rgba(tipC, 0.5 * A));
      wash(ctx, poly, g, { jit: 0 });
      // (m3) the blue sheen of a swallow's back along the arm, a pale wash stroke between the coverts and the primaries
      stroke(ctx, spine.slice(1, Math.floor(n * 0.62)).map(([u, v]) => P(u, v)), { w: Math.max(0.6, span * 0.03), col: rgba(sheenC, (near ? 0.42 : 0.28) * A), tin: 0.3, tout: 0.6, min: 0.1, dry: 0.2, seed: R() * 70 });
      // the primaries: separate dry strokes off the trailing edge of the hand, splayed a little, paler outward
      for (let k = 0; k < 4; k++) {
        const t0 = 0.5 + k * 0.1 + R() * 0.03;
        const i0 = Math.floor(t0 * (n - 1));
        const a = Tr[i0], e = spine[Math.min(n - 1, i0 + Math.floor((0.35 - k * 0.05) * n))];
        const spread = (k - 1.5) * 0.025 * side;
        stroke(ctx, [P(a[0], a[1]), P(mix(a[0], e[0], 0.5), mix(a[1], e[1], 0.5) + spread), P(e[0] - 0.04, e[1] + spread * 2)], { w: Math.max(0.5, span * 0.022), col: rgba(mix3(midC, tipC, 0.3 + k * 0.15), (0.55 - k * 0.06) * A), tin: 0.15, tout: 0.85, min: 0.05, dry: 0.3, seed: R() * 60 });
      }
      // the loaded leading edge: thick at the wrist, running out to the tip
      stroke(ctx, Ld.map(([u, v]) => P(u, v)), { w: Math.max(0.8, span * (near ? 0.045 : 0.034)), col: rgba(backC, 0.9 * A), tin: 0.25, tout: 0.8, min: 0.06, wob: 0.3, dry: 0.12, seed: R() * 50 });
    }
    // the body: a short loaded teardrop, head forward, the back indigo; the white belly under it; rust at the throat
    const body = spline([[0.38, -0.004], [0.22, -0.05], [-0.06, -0.06], [-0.34, -0.022]].map(([u, v]): Pt => P(u, v)), 6);
    stroke(ctx, body, { w: Math.max(1.4, span * 0.105), col: rgba(backC, 0.95 * A), tin: 0.4, tout: 0.55, min: 0.3, wob: 0.15, seed: R() * 40 });
    // (m3, KEY's swallow: a big white belly with a fine ink line under it, a round dark head, a chestnut face)
    const bellyP = spline([[0.27, 0.02], [0.12, 0.09], [-0.12, 0.085], [-0.3, 0.03], [-0.1, 0.012], [0.27, 0.02]].map(([u, v]): Pt => P(u, v)), 5);
    wash(ctx, bellyP, rgba(belly, 0.95 * A), { jit: 0 });
    stroke(ctx, spline([[0.24, 0.05], [0.1, 0.095], [-0.12, 0.088], [-0.28, 0.04]].map(([u, v]): Pt => P(u, v)), 6), { w: Math.max(0.5, span * 0.012), col: rgba(backC, 0.55 * A), tin: 0.3, tout: 0.5, min: 0.2, seed: R() * 20 });
    ctx.fillStyle = rgba(backC, 0.96 * A); { const [hx, hy] = P(0.34, -0.02); ctx.beginPath(); ctx.ellipse(hx, hy, span * 0.045, span * 0.037, ang, 0, Math.PI * 2); ctx.fill(); }
    if (mk < 0.4) { ctx.fillStyle = rgba([176, 86, 60], 0.85); const [tx, ty] = P(0.36, 0.022); ctx.beginPath(); ctx.ellipse(tx, ty, span * 0.03, span * 0.02, ang, 0, Math.PI * 2); ctx.fill(); }
    // the forked tail: two long streamers, unequal, splayed and curving, tapering to a hair
    for (const [sd, Lt] of [[-1, 1], [1, 0.8]] as const) {
      const tl = spline([[-0.3, sd * 0.01], [-0.5, sd * 0.05], [-0.74 * Lt, sd * 0.12], [-0.98 * Lt, sd * (0.17 + 0.05 * Lt)]].map(([u, v]): Pt => P(u, v)), 6);
      stroke(ctx, tl, { w: Math.max(0.6, span * 0.034), col: rgba(mix3(backC, midC, 0.3), 0.9 * A), tin: 0.02, tout: 0.96, min: 0.03, seed: R() * 30 });
    }
  };
  soft(env, Math.max(0.3, span * 0.006) + mk * 0.9, paint);
}
/** The old names (kept for callers that still use them). */
export function swallow2(env: Env, x: number, y: number, span: number, ang: number, R: Rng) { swallowInk(env, x, y, span, ang, R); }

/** Index runs [s0, s1] covering about `fill` of 0..n-1 in pieces of minF..maxF of its length, gaps between. */
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
 * A round 2: the willow tip over the town (the critic: "neon lime, a uniform pipe, combs of identical drops, hangs
 * through the roofs"). A brown-ink bough that comes down out of the top edge (out of the paper under the header) and
 * tapers to a twig; the strands hang from it in groups with gaps, their lengths 3 : 1, all bent by one wind; each
 * strand's leaves follow it, turned along it with a little jitter, smaller toward the tip; spring yellow-green near
 * (#9DC77A), misted far (#BFD9B0), the far strands hazed. No tip hangs below `floorY` (the town's roofline).
 * ctl = the bough's joints (world px); s = scale; wind = sideways push at a strand's tip per px of its length.
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
  let sP: Pt[] | null = null;
  if (side) { sP = resample(spline(side, 8), 2); hang(sP, 0.2, 1, 9, 80); }
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
  void sP;
}

/**
 * A round 2: rushes at a landing (Contact; Writing's water's edge): thin, tapered, ink-grey-green strokes, bowing,
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

// ---------------------------------------------------------------- f1: one framing element per place (same kit)
/** A lanceolate leaf from p along angle a, length L, two-tone (deep at its base, fresh toward its tip). */
function leaf(env: Env, p: Pt, a: number, L: number, W: number, c0: RGB, c1: RGB, al: number) {
  const { ctx, ink } = env;
  const tip: Pt = [p[0] + Math.cos(a) * L, p[1] + Math.sin(a) * L];
  const nx = -Math.sin(a) * W, ny = Math.cos(a) * W;
  const m: Pt = [p[0] + Math.cos(a) * L * 0.42, p[1] + Math.sin(a) * L * 0.42];
  const g = ctx.createLinearGradient(p[0], p[1], tip[0], tip[1]);
  g.addColorStop(0, ink.rgba(c0, al));
  g.addColorStop(1, ink.rgba(c1, al * 0.95));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  ctx.quadraticCurveTo(m[0] + nx, m[1] + ny, tip[0], tip[1]);
  ctx.quadraticCurveTo(m[0] - nx * 0.7, m[1] - ny * 0.7, p[0], p[1]);
  ctx.fill();
  // the midrib, a breath lighter
  ctx.strokeStyle = ink.rgba(mix3(c1, [235, 250, 225], 0.4), al * 0.5);
  ctx.lineWidth = Math.max(0.4, W * 0.12);
  ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(m[0] + Math.cos(a) * L * 0.4, m[1] + Math.sin(a) * L * 0.4); ctx.stroke();
}

/** Writing: a pine bough coming in from the top-right (qingxiao 1m08), its needles in fans of fine strokes. */
export function pineFrame(env: Env, x0: number, y0: number, s: number, R: Rng) {
  const { ctx, ink } = env;
  const S = (dx: number, dy: number): Pt => [x0 + dx * s, y0 + dy * s];
  const limb = [S(60, -30), S(0, 0), S(-70, 22), S(-130, 18), S(-190, 44), S(-236, 40)];
  const twig = [S(-70, 22), S(-96, 58), S(-140, 76)];
  inkLimb(env, limb, 17 * s, 3 * s, R, PINE_INK, { dots: 1.4 });
  inkLimb(env, twig, 6 * s, 1.8 * s, R, PINE_INK, { dots: 0.5 });
  const lP = limbPts(limb, R, 0.6), tP = limbPts(twig, R, 0.6);
  const fans: [Pt[], number, number][] = [[lP, 0.22, 1.15], [lP, 0.4, 0.9], [lP, 0.58, 1.1], [lP, 0.77, 0.85], [lP, 0.97, 0.7], [tP, 0.55, 0.95], [tP, 1, 0.65]];
  for (const [P, t, k] of fans) {
    const [cx, cy] = pointAt(P, t);
    // A: a pine tuft as the painters make it (the critics: "green asterisks"): first a soft boneless wash of the mass,
    // then the needles as a half fan rising from the twig's end, fine dark-green strokes of uneven length, a few short
    // ones drooping under it; every tuft its own size, tilt and opening
    const r = (22 + R() * 12) * s * k;
    const tilt = (R() - 0.5) * 0.5, open = 1.6 + R() * 0.9;
    // (the back needles first, paler and soft in the air: the tuft has depth without a wash under it)
    soft(env, 0.8 * s, () => {
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + tilt + (R() - 0.5) * open * 1.1, L = r * (0.5 + R() * 0.45);
        stroke(ctx, [[cx, cy], [cx + Math.cos(a) * L, cy + Math.sin(a) * L * 0.7]], { w: 1.0 * s, col: ink.rgba([120, 178, 140], 0.55), tin: 0.05, tout: 0.9, min: 0.1, seed: R() * 90 });
      }
    });
    const n = 16 + Math.floor(R() * 9);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + tilt + (i / (n - 1) - 0.5) * open + (R() - 0.5) * 0.1;
      const L = r * (0.55 + R() * 0.5) * (1 - 0.25 * Math.abs(i / (n - 1) - 0.5));
      const e: Pt = [cx + Math.cos(a) * L, cy + Math.sin(a) * L * 0.7];
      const c = mix3([22, 64, 42], [70, 130, 80], R() * 0.6);
      stroke(ctx, [[cx + (R() - 0.5) * 2 * s, cy], [mix(cx, e[0], 0.55), mix(cy, e[1], 0.55) - 1.2 * s], e], { w: (0.9 + R() * 0.6) * s, col: ink.rgba(c, 0.82), tin: 0.05, tout: 0.9, min: 0.08, seed: R() * 90 });
    }
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 2 + (R() - 0.5) * 1.6, L = r * (0.25 + R() * 0.25);
      stroke(ctx, [[cx, cy], [cx + Math.cos(a) * L, cy + Math.sin(a) * L * 0.6]], { w: 0.9 * s, col: ink.rgba([30, 76, 50], 0.6), tin: 0.05, tout: 0.9, min: 0.1, seed: R() * 90 });
    }
  }
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Writing: a tuft of reeds at the water's edge (lower right), their blades bowing, pale seed heads. */
export function reedsFrame(env: Env, x0: number, y0: number, s: number, R: Rng) {
  const { ctx, ink } = env;
  for (let i = 0; i < 16; i++) {
    const bx = x0 + (R() - 0.5) * 60 * s, H = (70 + R() * 90) * s, lean = (R() - 0.65) * 50 * s;
    const pts: Pt[] = [];
    for (let k = 0; k <= 12; k++) { const u = k / 12; pts.push([bx + lean * u * u, y0 - H * u]); }
    const c = mix3([40, 110, 60], [150, 206, 120], R() * 0.7);
    stroke(ctx, pts, { w: (1.6 + R() * 1.4) * s, col: ink.rgba(c, 0.9), tin: 0.02, tout: 0.9, min: 0.08, seed: R() * 50 });
    if (R() < 0.4) {   // a seed head: a soft plume
      const [hx, hy] = pts[12];
      for (let k = 0; k < 6; k++) stroke(ctx, [[hx, hy], [hx + (lean > 0 ? 1 : -1) * (6 + R() * 8) * s, hy + (4 + R() * 10) * s]], { w: 1.2 * s, col: ink.rgba([176, 214, 160], 0.75), tin: 0.1, tout: 0.9, min: 0.1, seed: R() * 40 });
    }
    if (R() < 0.5) {   // a long blade arching off the stem
      const [mx, my] = pts[5];
      const d = lean >= 0 ? 1 : -1;
      stroke(ctx, [[mx, my], [mx + d * 20 * s, my - 18 * s], [mx + d * 42 * s, my - 8 * s]], { w: 2.2 * s, col: ink.rgba(mix3([46, 120, 64], [143, 209, 106], R()), 0.88), tin: 0.05, tout: 0.9, min: 0.08, seed: R() * 50 });
    }
  }
}

/** Résumé: bamboo coming in from the top-right edge: two stalks with nodes, and sprays of leaves hanging from them. */
export function bambooFrame(env: Env, x0: number, y0: number, s: number, R: Rng) {
  const { ctx, ink } = env;
  for (const [dx, w, len, lean] of [[0, 9, 420, -0.12], [34, 7, 360, -0.05]] as const) {
    const bx = x0 + dx * s, top = y0 - 60 * s;
    // segments between nodes, each a slightly separated stroke, deep green with a fresh lit edge
    let y = top, k = 0;
    while (y < y0 + len * s && k < 9) {
      const L = (44 + R() * 16) * s;
      const xa = bx + lean * (y - top), xb = bx + lean * (y + L - top);
      stroke(ctx, [[xa, y + 1.5 * s], [xb, y + L - 1.5 * s]], { w: w * s, col: ink.rgba(mix3([44, 120, 70], [96, 170, 96], R() * 0.4), 0.95), tin: 0.04, tout: 0.04, min: 0.85, seed: R() * 60 });
      stroke(ctx, [[xa - w * 0.3 * s, y + 3 * s], [xb - w * 0.3 * s, y + L - 3 * s]], { w: 1.4 * s, col: ink.rgba([190, 236, 180], 0.7), tin: 0.2, tout: 0.2, min: 0.4, seed: R() * 60 });
      // the node: a dark ring
      stroke(ctx, [[xb - w * 0.6 * s, y + L], [xb + w * 0.6 * s, y + L - 0.6 * s]], { w: 2 * s, col: ink.rgba([20, 62, 32], 0.95), tin: 0.2, tout: 0.2, min: 0.5, seed: R() * 60 });
      y += L; k++;
    }
  }
  // sprays: from nodes, thin twigs fanning down-left, each with 3-6 leaves
  for (const [ox, oy, sc] of [[-6, 40, 1], [-4, 120, 1.15], [30, 70, 0.85], [-8, 200, 0.95], [28, 170, 0.8]] as const) {
    const px = x0 + ox * s, py = y0 + oy * s;
    const tw: Pt = [px - (40 + R() * 30) * s * sc, py + (20 + R() * 20) * s * sc];
    stroke(ctx, [[px, py], tw], { w: 1.6 * s, col: ink.rgba([30, 84, 46], 0.9), tin: 0.05, tout: 0.6, min: 0.3, seed: R() * 40 });
    const n = 3 + Math.floor(R() * 4);
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.55 + R() * 0.45), L = (38 + R() * 26) * s * sc;
      leaf(env, [mix(px, tw[0], 0.4 + 0.6 * (i / n)), mix(py, tw[1], 0.4 + 0.6 * (i / n))], a, L, L * 0.13, [32, 98, 54], mix3([143, 209, 106], [96, 176, 96], R()), 0.94);
    }
  }
  void ctx;
}

// ---------------------------------------------------------------- M "Spring ink": the river (from B, re-tuned)

/**
 * M (from B 2b): a reflection on the river, broken by the ripples. `draw` paints the thing again, mirrored about the
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
 * M (from B 2b, qingxiao 0m49): a few broken ripple rings on the river at (x, y), painted, never UI circles: 2-3 rings
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
 * M n1: a far bird gliding (the critic: the misted swallows read as nail clippings): an open V of two tapered strokes,
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
