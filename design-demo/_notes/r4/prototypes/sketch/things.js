// things.js: research sketch only. Procedural ink "things" for a riverside market, drawn with the brush
// helpers in ink.js, in the oblique (parallel) projection of Song handscrolls: fronts face the viewer,
// depth recedes up and to the right (D), so we see fronts, tops and right-hand sides.
'use strict';

const THINGS = (() => {
  const { stroke, dry, wash, rgba, C, mix, mix3, vnoise, smooth } = INK;
  const D = [0.70, -0.50];                 // one unit of depth on screen (foreshortened)
  const INKS = 'rgba(20,24,26,0.86)';
  const INKM = 'rgba(30,36,40,0.55)';
  const WOOD = [116, 98, 80];
  const MAT = [198, 184, 154];
  const ROOF = [78, 94, 106];

  /** A tiny figure. (x, y) = the feet. s = scale (1 ~ 10.5 px tall). */
  function figure(ctx, x, y, s, R, o = {}) {
    const lean = o.lean ?? (R() - 0.5) * 0.28;
    const h = 10.5 * s;
    const sx = x + Math.sin(lean) * h * 0.72, sy = y - h * 0.70;     // shoulders
    const wide = (o.wide ? 4.8 : 3.9) * s;
    const robes = [[244, 244, 240], [244, 244, 240], [236, 236, 230], [150, 168, 180], [178, 140, 108], [116, 136, 150]];
    const robe = o.robe || robes[Math.floor(R() * robes.length)];
    const pts = [[sx - 1.15 * s, sy], [sx + 1.15 * s, sy], [x + wide / 2 + (R() - 0.5) * s, y - 1.0 * s], [x - wide / 2 + (R() - 0.5) * s, y - 1.0 * s]];
    wash(ctx, pts, rgba(robe, 0.95), 0);
    // the robe's two edges, a hem; light, broken lines
    stroke(ctx, [pts[0], pts[3]], { w: 0.55 * s, col: INKM, wob: 0.4, seed: x });
    stroke(ctx, [pts[1], pts[2]], { w: 0.5 * s, col: INKM, wob: 0.4, seed: y });
    // legs / feet
    stroke(ctx, [[x - 0.8 * s, y - 1.1 * s], [x - 1.0 * s, y]], { w: 0.6 * s, col: INKS, tin: 0, tout: 0.2 });
    stroke(ctx, [[x + 0.7 * s, y - 1.1 * s], [x + 0.9 * s, y]], { w: 0.6 * s, col: INKS, tin: 0, tout: 0.2 });
    // an arm: hanging, gesturing or carrying
    const arm = o.arm ?? (R() < 0.35 ? 'up' : 'down');
    const dir = o.flip ? -1 : 1;
    if (arm === 'up') stroke(ctx, [[sx + dir * 0.9 * s, sy + 0.6 * s], [sx + dir * 2.6 * s, sy - 1.4 * s]], { w: 0.6 * s, col: INKM });
    else stroke(ctx, [[sx + dir * 1.0 * s, sy + 0.5 * s], [sx + dir * 1.7 * s, sy + 4.0 * s]], { w: 0.55 * s, col: INKM });
    // head: dark hair over a pale face, a top-knot
    const hx = sx + Math.sin(lean) * 2.4 * s, hy = sy - 1.75 * s;
    ctx.fillStyle = 'rgba(236,230,218,0.95)';
    ctx.beginPath(); ctx.arc(hx, hy, 1.15 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = INKS;
    ctx.beginPath(); ctx.arc(hx - dir * 0.25 * s, hy - 0.35 * s, 1.0 * s, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
    if (o.hat === 'cone') {
      wash(ctx, [[hx - 3.0 * s, hy - 0.2 * s], [hx + 3.0 * s, hy - 0.2 * s], [hx, hy - 2.1 * s]], 'rgba(196,172,128,0.95)', 0);
      stroke(ctx, [[hx - 3.0 * s, hy - 0.2 * s], [hx, hy - 2.1 * s], [hx + 3.0 * s, hy - 0.2 * s]], { w: 0.5 * s, col: INKM, tin: 0.1, tout: 0.1 });
    } else {
      ctx.beginPath(); ctx.arc(hx, hy - 1.25 * s, 0.55 * s, 0, Math.PI * 2); ctx.fill();
    }
    if (o.pole) {   // a carrying pole with two baskets
      const a = [sx - 6 * s, sy + 0.2 * s], b = [sx + 6 * s, sy - 0.4 * s];
      stroke(ctx, [a, b], { w: 0.55 * s, col: INKS, tin: 0.05, tout: 0.05 });
      for (const p of [a, b]) {
        stroke(ctx, [p, [p[0], p[1] + 3.2 * s]], { w: 0.3 * s, col: INKM, tin: 0, tout: 0 });
        wash(ctx, [[p[0] - 1.5 * s, p[1] + 3.2 * s], [p[0] + 1.5 * s, p[1] + 3.2 * s], [p[0] + 1.1 * s, p[1] + 5.2 * s], [p[0] - 1.1 * s, p[1] + 5.2 * s]], 'rgba(150,118,80,0.85)', 0);
      }
    }
    if (o.punt) {   // a punting pole, into the water
      stroke(ctx, [[sx + dir * 1.6 * s, sy - 3.5 * s], [sx - dir * 7 * s, y + 9 * s]], { w: 0.55 * s, col: INKS, tin: 0.05, tout: 0.3 });
    }
  }

  /** A house in oblique projection. (x, y) = front-left foot; w width, h wall height. */
  function house(ctx, x, y, w, h, R, o = {}) {
    const d = o.d ?? w * 0.55;
    const ox = D[0] * d, oy = D[1] * d;
    const rh = o.rh ?? h * 0.62;
    const ov = o.ov ?? w * 0.10;
    const wall = o.wall || mix3([236, 234, 226], [214, 196, 170], 0.25 + R() * 0.35);
    // reserve the paper first: a near thing hides what is behind it
    const KO = 'rgba(240,242,239,1)';
    wash(ctx, [[x - ov, y + 0.5], [x + w, y + 0.5], [x + w + ox, y + oy + 0.5], [x + w + ov + ox, y - h + oy], [x + w * 0.86 + ox * 0.5, y - h - rh + oy * 0.5], [x + w * 0.14 + ox * 0.5, y - h - rh + oy * 0.5], [x - ov, y - h]], KO, 0.4);
    // right side wall, front wall
    wash(ctx, [[x + w, y], [x + w + ox, y + oy], [x + w + ox, y + oy - h], [x + w, y - h]], rgba(mix3(wall, [120, 110, 98], 0.32), 0.95), 0.3);
    wash(ctx, [[x, y], [x + w, y], [x + w, y - h], [x, y - h]], rgba(wall, 0.96), 0.3);
    // open shop front: a dark interior, a counter, posts
    if (o.shop !== false) {
      const s0 = x + w * 0.12, s1 = x + w * (o.wideShop ? 0.92 : 0.62);
      wash(ctx, [[s0, y - h * 0.12], [s1, y - h * 0.12], [s1, y - h * 0.88], [s0, y - h * 0.88]], 'rgba(58,62,62,0.52)', 0.4);
      stroke(ctx, [[s0 - 0.5, y - h * 0.38], [s1 + 0.5, y - h * 0.38]], { w: 0.9, col: 'rgba(120,96,70,0.8)', tin: 0, tout: 0 });
    }
    const posts = Math.max(2, Math.round(w / 14) + 1);
    for (let i = 0; i < posts; i++) {
      const px = x + (w * i) / (posts - 1);
      stroke(ctx, [[px, y + 0.3], [px, y - h]], { w: 0.75, col: INKM, tin: 0, tout: 0.1, wob: 0.15 });
    }
    stroke(ctx, [[x + w + ox, y + oy], [x + w + ox, y + oy - h]], { w: 0.6, col: INKM, tin: 0, tout: 0 });
    stroke(ctx, [[x - 0.5, y + 0.4], [x + w + 0.5, y + 0.4], [x + w + ox, y + oy + 0.4]], { w: 0.7, col: 'rgba(40,40,36,0.45)', tin: 0.05, tout: 0.1 });
    if (o.storey) {   // an upper storey: a balcony rail and a lower eave across the front
      const my = y - h * 0.52;
      stroke(ctx, [[x - w * 0.06, my], [x + w * 1.06, my]], { w: 1.1, col: INKS, tin: 0.05, tout: 0.05 });
      wash(ctx, [[x - w * 0.07, my], [x + w * 1.07, my], [x + w * 1.0, my - h * 0.12], [x, my - h * 0.12]], rgba(mix3(ROOF, [150, 156, 156], 0.3), 0.6), 0.3);
      for (let i = 0; i < 8; i++) stroke(ctx, [[x + w * (0.08 + i * 0.12), my - h * 0.14], [x + w * (0.08 + i * 0.12), my - h * 0.26]], { w: 0.4, col: INKM, tin: 0, tout: 0 });
      stroke(ctx, [[x + w * 0.04, my - h * 0.26], [x + w * 0.96, my - h * 0.26]], { w: 0.5, col: INKM, tin: 0, tout: 0 });
    }
    // the roof: front slope, the hip on the right, the ridge with lifted ends; eaves lifted at the corners
    const ey = y - h + 0.6;
    const lift = Math.max(0.8, w * 0.035);
    const eave = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const ex = x - ov + (w + 2 * ov) * t;
      const sag = Math.sin(Math.PI * t) * lift * 0.5 - (Math.pow(Math.abs(t * 2 - 1), 6)) * lift;
      eave.push([ex, ey + sag]);
    }
    const rL = [x + w * 0.14 + ox * 0.5, y - h - rh + oy * 0.5];
    const rR = [x + w * 0.86 + ox * 0.5, y - h - rh + oy * 0.5];
    const eB = [x + w + ov + ox, ey + oy - lift];
    const eF = eave[eave.length - 1];
    const roofC = o.roof || (o.thatch ? mix3([178, 152, 112], [150, 134, 108], R()) : mix3(ROOF, [140, 150, 152], 0.15 + R() * 0.35));
    wash(ctx, [eF, eB, rR], rgba(mix3(roofC, [40, 48, 54], 0.22), 0.80), 0.35);
    wash(ctx, [...eave, rR, rL], rgba(roofC, 0.74), 0.35);
    // tile rows down the slope, a few, broken
    const rows = Math.max(4, Math.round(w / 3.2));
    ctx.save();
    ctx.beginPath(); ctx.moveTo(eave[0][0], eave[0][1]); for (const p of eave) ctx.lineTo(p[0], p[1]); ctx.lineTo(rR[0], rR[1]); ctx.lineTo(rL[0], rL[1]); ctx.closePath(); ctx.clip();
    for (let i = 1; i < rows; i++) {
      const t = i / rows;
      const ex = x - ov + (w + 2 * ov) * t;
      const tx = ex + (ox * 0.5) * 0.92;
      if (vnoise(i * 0.7, x, 9) < 0.3) continue;
      if (o.thatch) stroke(ctx, [[ex + (R() - 0.5) * 2, ey + 0.5], [mix(ex, tx, 0.5) + (R() - 0.5) * 3, mix(ey, rL[1], 0.5)]], { w: 0.5, col: 'rgba(70,56,36,0.35)', tin: 0, tout: 0.6 });
      else stroke(ctx, [[ex, ey + 0.5], [tx, rL[1] + 0.5]], { w: 0.45, col: 'rgba(28,34,38,0.28)', tin: 0, tout: 0.5 });
    }
    ctx.restore();
    stroke(ctx, eave, { w: 1.0, col: INKS, tin: 0.08, tout: 0.08, wob: 0.25, seed: x * 0.1 });
    stroke(ctx, [eF, eB], { w: 0.7, col: INKS, tin: 0.05, tout: 0.2 });
    stroke(ctx, [eF, rR], { w: 0.65, col: INKM, tin: 0.05, tout: 0.1 });
    stroke(ctx, [eave[0], rL], { w: 0.6, col: INKM, tin: 0.05, tout: 0.1 });
    stroke(ctx, [[rL[0] - 1.2, rL[1] - 1.0], [rL[0], rL[1]], [rR[0], rR[1]], [rR[0] + 1.2, rR[1] - 1.0]], { w: 1.5, col: INKS, tin: 0.12, tout: 0.12, wob: 0.2 });
    if (o.awning) {   // a cloth shade on two poles, projecting over the street
      const a0 = x + w * 0.08, a1 = x + w * 0.86, ay = y - h * 0.80, fy = y + h * 0.55, fx = -w * 0.04;
      const cl = rgba(o.awningCol || [226, 218, 196], 0.92);
      wash(ctx, [[a0, ay], [a1, ay], [a1 + fx, fy - h * 0.62], [a0 + fx, fy - h * 0.62]], cl, 0.2);
      stroke(ctx, [[a0 + fx, fy - h * 0.62], [a1 + fx, fy - h * 0.62]], { w: 0.7, col: INKS, tin: 0.05, tout: 0.05 });
      stroke(ctx, [[a0 + fx, fy - h * 0.62], [a0 + fx, fy]], { w: 0.55, col: INKS, tin: 0, tout: 0 });
      stroke(ctx, [[a1 + fx, fy - h * 0.62], [a1 + fx, fy]], { w: 0.55, col: INKS, tin: 0, tout: 0 });
    }
    return { eave, rL, rR };
  }

  /** A market parasol over a little stall. (x, y) = the pole's foot. */
  function parasol(ctx, x, y, s, R, o = {}) {
    const lean = (R() - 0.5) * 2 * s;
    const top = [x + lean, y - 15 * s];
    const rx = (10 + R() * 3) * s, ry = 3.0 * s;
    stroke(ctx, [[x, y], top], { w: 0.7 * s, col: INKS, tin: 0, tout: 0 });
    // table and goods
    wash(ctx, [[x - 6 * s, y - 3.6 * s], [x + 6 * s, y - 3.6 * s], [x + 6.8 * s, y - 2.6 * s], [x - 5.2 * s, y - 2.6 * s]], 'rgba(150,118,84,0.85)', 0);
    for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? 'rgba(40,44,44,0.7)' : 'rgba(186,150,100,0.9)'; ctx.beginPath(); ctx.arc(x - 4.5 * s + i * 2.2 * s, y - 4.3 * s, 0.75 * s, 0, Math.PI * 2); ctx.fill(); }
    // canopy: a flat dome, ribs, the rim
    const cc = o.col || [[232, 224, 206], [214, 196, 160], [226, 228, 222]][Math.floor(R() * 3)];
    const dome = [];
    for (let i = 0; i <= 16; i++) { const a = Math.PI * (1 + i / 16); dome.push([top[0] + Math.cos(a) * rx, top[1] + 1.6 * s + Math.sin(a) * ry]); }
    const rim = [];
    for (let i = 16; i >= 0; i--) { const a = Math.PI * (i / 16); rim.push([top[0] + Math.cos(a) * rx, top[1] + 1.6 * s + Math.sin(a) * ry * 0.35]); }
    wash(ctx, [...dome, ...rim], rgba(cc, 0.95), 0.2);
    for (let i = 1; i < 8; i++) { const p = dome[i * 2]; stroke(ctx, [top, p], { w: 0.35 * s, col: 'rgba(30,34,36,0.35)', tin: 0, tout: 0.2 }); }
    stroke(ctx, dome, { w: 0.7 * s, col: INKS, tin: 0.05, tout: 0.05 });
    stroke(ctx, rim, { w: 0.5 * s, col: INKM, tin: 0.05, tout: 0.05 });
  }

  /**
   * A boat in side view, lying along x (the river runs across the scroll): (x, y) = the waterline at the
   * stern (left end); L = length in px; its beam runs into depth (D), so we see the near side, the deck
   * from above, the right-hand end, and a barrel mat cabin.
   */
  function boat(ctx, x, y, L, R, o = {}) {
    const s = o.s ?? 1;
    const beam = o.beam ?? L * 0.16;
    const P = (u, v, w = 0) => [x + u + D[0] * w, y - v + D[1] * w];   // u along, v up, w across (depth)
    const hh = o.hull ?? 4.6 * s;
    const sheer = (t) => hh * (1 + 0.6 * Math.pow(Math.abs(t * 2 - 1), 2.6)) + (t > 0.5 ? (t - 0.5) * hh * 0.5 : 0);
    const N = 16;
    const pinch = (t) => Math.pow(Math.sin(Math.PI * (0.04 + 0.92 * t)), 0.45);
    const gN = [], gF = [];
    for (let i = 0; i <= N; i++) { const t = i / N; const p = pinch(t); gN.push(P(L * t, sheer(t), beam * 0.5 * (1 - p))); gF.push(P(L * t, sheer(t), beam * 0.5 * (1 + p))); }
    // reflection (under everything): a darker smear torn by ripples
    for (let k = 0; k < 6; k++) {
      const yy = 1.2 + k * 1.5 * s;
      stroke(ctx, [[x + L * (0.06 + R() * 0.08), y + yy], [x + L * (0.5 + R() * 0.1), y + yy + 0.3], [x + L * (0.86 + R() * 0.1), y + yy]], { w: (1.5 - k * 0.18) * s, col: `rgba(70,74,70,${0.15 - k * 0.02})`, tin: 0.25, tout: 0.5, wob: 0.7, seed: k + x });
    }
    // the deck seen from above, then the near side of the hull down to the water
    wash(ctx, [...gN, ...gF.slice().reverse()], rgba(mix3(WOOD, [226, 210, 182], 0.45), 0.94), 0.25);
    const side = [...gN];
    for (let i = N; i >= 0; i--) { const t = i / N; side.push(P(L * (0.06 + 0.88 * t), 0, 0)); }
    wash(ctx, side, rgba(mix3(WOOD, [70, 56, 44], 0.15), 0.92), 0.3);
    stroke(ctx, side.slice(N + 1), { w: 0.75 * s, col: INKS, tin: 0.1, tout: 0.2 });
    stroke(ctx, gN, { w: 0.9 * s, col: INKS, tin: 0.04, tout: 0.08, wob: 0.2 });
    stroke(ctx, gF, { w: 0.5 * s, col: INKM, tin: 0.05, tout: 0.1 });
    stroke(ctx, gN.map((p) => [p[0], p[1] + hh * 0.5]).slice(2, N - 1), { w: 0.4 * s, col: 'rgba(30,26,22,0.38)', tin: 0.2, tout: 0.3 });
    // the barrel mat cabin, from u0 to u1: near wall, arched roof running into depth, the right end's arch
    if (o.cabin !== false) {
      const u0 = L * (o.c0 ?? 0.30), u1 = L * (o.c1 ?? 0.70);
      const ch = o.ch ?? 5.2 * s, wallH = 2.2 * s;
      const base = (u) => sheer(u / L);
      const arch = (u) => { const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(P(u, base(u) + wallH + Math.sin(Math.PI * t) * ch, beam * (0.06 + 0.88 * t))); } return pts; };
      const A0 = arch(u0), A1 = arch(u1);
      const wallN = [P(u0, base(u0), beam * 0.06), P(u1, base(u1), beam * 0.06), A1[0], A0[0]];
      wash(ctx, wallN, rgba(mix3(MAT, [110, 90, 66], 0.35), 0.95), 0.2);
      wash(ctx, [...A0, ...A1.slice().reverse()], rgba(mix3(MAT, [236, 226, 204], 0.15), 0.96), 0.25);
      wash(ctx, [...A1, P(u1, base(u1), beam * 0.94), P(u1, base(u1), beam * 0.06)], rgba(mix3(MAT, [90, 74, 54], 0.4), 0.95), 0.2);
      const ribs = Math.max(3, Math.round((u1 - u0) / (3.4 * s)));
      for (let i = 1; i < ribs; i++) stroke(ctx, arch(mix(u0, u1, i / ribs)).slice(0, 8), { w: 0.38 * s, col: 'rgba(70,56,40,0.42)', tin: 0.1, tout: 0.3 });
      stroke(ctx, A1, { w: 0.7 * s, col: INKS, tin: 0.05, tout: 0.05 });
      stroke(ctx, [A0[0], A1[0]], { w: 0.65 * s, col: INKS, tin: 0.05, tout: 0.1 });
      stroke(ctx, [A0[5], A1[5]], { w: 0.45 * s, col: INKM, tin: 0.1, tout: 0.1 });
    }
    if (o.mast === 'up') {
      const m0 = P(L * 0.62, sheer(0.62), beam * 0.5);
      const m1 = [m0[0] + 1.2 * s, m0[1] - L * 0.62];
      stroke(ctx, [m0, m1], { w: 0.95 * s, col: INKS, tin: 0, tout: 0.25 });
      stroke(ctx, [m1, P(L * 0.02, sheer(0) + 1, beam * 0.5)], { w: 0.3 * s, col: 'rgba(30,34,36,0.42)', tin: 0, tout: 0 });
      stroke(ctx, [m1, P(L * 0.98, sheer(1) + 1, beam * 0.5)], { w: 0.3 * s, col: 'rgba(30,34,36,0.42)', tin: 0, tout: 0 });
    } else if (o.mast === 'down') {   // lowered for the bridge: it lies along the boat, over the stern
      const m0 = P(L * 0.66, sheer(0.66) + 2 * s, beam * 0.5), m1 = P(-L * 0.12, sheer(0) + 9 * s, beam * 0.5);
      stroke(ctx, [m1, m0], { w: 1.1 * s, col: INKS, tin: 0.05, tout: 0.2 });
      stroke(ctx, [m0, P(L * 0.66, sheer(0.66), beam * 0.5)], { w: 0.8 * s, col: INKS, tin: 0, tout: 0 });
    }
    for (const [u, w, opt] of o.crew || []) {
      const p = P(L * u, sheer(u), beam * w);
      figure(ctx, p[0], p[1], s * 0.95, R, opt);
    }
  }

  /**
   * The rainbow bridge, spanning the river into depth: it springs from the near bank at A and lands on the
   * far bank `span` depth units along D; Hb is the rise. Its deck runs across x (bw); we see its top, its
   * right-hand face (the woven timber arch), the rails and the crowd.
   */
  function bridge(ctx, A, span, Hb, R, o = {}) {
    const bw = o.bw ?? 20, ramp = o.ramp ?? 0.22, T = o.T ?? 4.4;
    const DECK = o.deckCol || 'rgba(196,178,150,0.9)';
    const N = 56;
    const Db = o.dir || D;
    const base = (t) => [A[0] + Db[0] * span * t, A[1] + Db[1] * span * t];
    const lift = (t) => (t <= 0 || t >= 1) ? 0 : Hb * Math.pow(Math.sin(Math.PI * t), 0.72);
    // the deck: the arch's back plus ramps at either end, down to the banks
    const deckLift = (t) => {
      if (t < 0) return Math.max(0, 5 + (t / ramp) * 5);
      if (t > 1) return Math.max(0, 5 - ((t - 1) / ramp) * 5);
      return Math.max(5, lift(t) + 1.5);
    };
    const deckAt = (t, w = 0) => { const b = base(t); return [b[0] + w * bw, b[1] - deckLift(t)]; };
    const ts = []; for (let i = 0; i <= N; i++) ts.push(-ramp + (1 + 2 * ramp) * i / N);
    // under the arch: a few short ripples in its shadow
    for (let k = 0; k < 7; k++) { const t = 0.2 + R() * 0.6; const b = base(t); stroke(ctx, [[b[0] + bw * 0.2, b[1] + 3 + k], [b[0] + bw * 1.6, b[1] + 3.4 + k]], { w: 0.9, col: 'rgba(70,90,100,0.16)', tin: 0.2, tout: 0.6 }); }
    // the far (left) face's arch, glimpsed under the deck
    const backArch = []; for (let i = 0; i <= N; i++) { const t = i / N; const b = base(t); backArch.push([b[0], b[1] - lift(t)]); }
    stroke(ctx, backArch.slice(4, -4), { w: 0.9, col: 'rgba(40,40,36,0.28)', tin: 0.1, tout: 0.1 });
    // the deck's top surface
    wash(ctx, [...ts.map((t) => deckAt(t, 0)), ...ts.slice().reverse().map((t) => deckAt(t, 1))], DECK, 0.3);
    // the far rail
    const farRail = ts.map((t) => { const p = deckAt(t, 0); return [p[0], p[1] - 4.6]; });
    stroke(ctx, farRail, { w: 0.6, col: INKM, tin: 0.05, tout: 0.05 });
    for (let i = 0; i <= N; i += 2) stroke(ctx, [deckAt(ts[i], 0), farRail[i]], { w: 0.45, col: 'rgba(30,34,36,0.45)', tin: 0, tout: 0 });
    // the crowd: thicker on the crown, some leaning out to watch the boat below
    const people = [];
    for (let i = 0; i < (o.people ?? 28); i++) {
      let t = R(); t = 0.5 + (t - 0.5) * (0.6 + 0.6 * R());
      people.push([t * (1 + 2 * ramp * 0.6) - ramp * 0.6, 0.15 + 0.7 * R()]);
    }
    people.sort((a, b) => deckAt(a[0], a[1])[1] - deckAt(b[0], b[1])[1]);
    for (const [t, w] of people) { const p = deckAt(t, w); figure(ctx, p[0], p[1], o.fs ?? 0.85, R, { lean: (R() - 0.5) * 0.5, arm: R() < 0.45 ? 'up' : 'down', flip: R() < 0.5 }); }
    for (const [t, w] of o.stalls ?? []) { const p = deckAt(t, w); parasol(ctx, p[0], p[1], 0.78, R); }
    // the visible face: the woven timber arch (the 'rainbow'), its beam ends and braces
    const face = [];
    for (let i = 0; i <= N; i++) { const t = i / N; const b = base(t); face.push([b[0] + bw, b[1] - lift(t)]); }
    const faceLow = face.map(([fx, fy], i) => [fx, fy + T * (0.8 + 0.25 * Math.pow(Math.abs(i / N * 2 - 1), 2))]);
    wash(ctx, [...face, ...faceLow.slice().reverse()], rgba(mix3(WOOD, [70, 56, 44], 0.2), 0.92), 0.25);
    for (let i = 1; i < N; i++) {
      stroke(ctx, [[face[i][0], face[i][1] - 0.2], [faceLow[i][0] + 0.3, faceLow[i][1]]], { w: 0.5, col: 'rgba(24,22,20,0.55)', tin: 0, tout: 0 });
      if (i % 3 === 0 && i < N - 2) stroke(ctx, [faceLow[i], face[i + 2]], { w: 0.35, col: 'rgba(24,22,20,0.4)', tin: 0, tout: 0 });
    }
    stroke(ctx, face, { w: 1.25, col: INKS, tin: 0.04, tout: 0.04, wob: 0.2 });
    stroke(ctx, faceLow, { w: 0.9, col: INKS, tin: 0.04, tout: 0.04, wob: 0.2 });
    // the near rail and its posts
    const deckN = ts.map((t) => deckAt(t, 1));
    const rail = deckN.map(([x, y]) => [x, y - 5.0]);
    stroke(ctx, deckN, { w: 0.9, col: INKS, tin: 0.04, tout: 0.04 });
    for (let i = 0; i <= N; i += 2) stroke(ctx, [deckN[i], rail[i]], { w: 0.55, col: INKS, tin: 0, tout: 0 });
    stroke(ctx, rail, { w: 0.8, col: INKS, tin: 0.04, tout: 0.04, wob: 0.15 });
    // abutments at the two banks
    for (const t of [0, 1]) {
      const b = base(t);
      wash(ctx, [[b[0] - 4, b[1] + 1.5], [b[0] + bw + 6, b[1] + 1.5], [b[0] + bw + 4, b[1] - 6], [b[0] - 2, b[1] - 5]], 'rgba(150,138,118,0.6)', 0.6);
      dry(ctx, [[b[0] - 6, b[1] + 1.5], [b[0] + bw + 8, b[1] + 1.8]], { w: 2.4, col: 'rgba(30,30,28,0.5)', bristles: 4, seed: b[0] });
    }
    return { deckAt, base };
  }

  /** A willow: a short gnarled trunk, wide arching branches, long cascades of pale green. (x, y) = the foot. */
  function willow(ctx, x, y, s, R, o = {}) {
    const lean = o.lean ?? (R() < 0.5 ? -1 : 1) * (0.25 + R() * 0.35);
    const H = 26 * s;
    const trunk = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; trunk.push([x + lean * H * 0.55 * t * t + (vnoise(t * 3, x, 4) - 0.5) * 2.5 * s, y - H * t]); }
    const crown = trunk[8];
    const branches = [];
    for (let b = 0; b < 6; b++) {
      const from = trunk[5 + Math.floor(R() * 4)];
      const ang = -Math.PI / 2 + (b / 5 - 0.5) * 2.4 + (R() - 0.5) * 0.4;
      const len = (14 + R() * 14) * s;
      const mid = [from[0] + Math.cos(ang) * len * 0.55, from[1] + Math.sin(ang) * len * 0.55 - 3 * s];
      const tip = [from[0] + Math.cos(ang) * len, from[1] + Math.sin(ang) * len * 0.7 + 2 * s];
      branches.push([from, mid, tip]);
    }
    // a soft canopy of pale green behind the strands, so the tree has mass
    for (const [a, m, b] of branches) {
      ctx.save(); ctx.filter = `blur(${3 * s}px)`; ctx.fillStyle = 'rgba(130,170,140,0.16)';
      ctx.beginPath(); ctx.ellipse(m[0], m[1] + 10 * s, 10 * s, 13 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    // the cascades: strands from along every branch, longest from the outer half, swaying together
    const sway = (o.sway ?? 1) * s;
    for (const [a, m, b] of branches) {
      const n = 10 + Math.floor(R() * 8);
      for (let k = 0; k < n; k++) {
        const t = 0.25 + 0.75 * R();
        const p = t < 0.5 ? [mix(a[0], m[0], t * 2), mix(a[1], m[1], t * 2)] : [mix(m[0], b[0], t * 2 - 1), mix(m[1], b[1], t * 2 - 1)];
        const len = (12 + 26 * t * R() + 10 * R()) * s;
        const green = R() < 0.82;
        stroke(ctx, [p, [p[0] + sway * 0.3, p[1] + len * 0.35], [p[0] + sway * 0.9, p[1] + len * 0.7], [p[0] + sway * 1.6, p[1] + len]],
          { w: (green ? 0.7 : 0.5) * s, col: green ? `rgba(104,148,118,${0.30 + R() * 0.18})` : 'rgba(40,52,48,0.32)', tin: 0.05, tout: 0.85, wob: 0.15, min: 0.15 });
      }
    }
    for (const br of branches) stroke(ctx, br, { w: 1.1 * s, col: 'rgba(46,44,38,0.6)', tin: 0.02, tout: 0.8, wob: 0.4 });
    stroke(ctx, trunk, { w: 3.6 * s, col: 'rgba(32,30,28,0.88)', tin: 0.0, tout: 0.6, wob: 0.4 });
    dry(ctx, trunk.map(([a, b]) => [a + 1 * s, b]), { w: 2.6 * s, col: 'rgba(20,20,20,0.45)', bristles: 3, seed: x });
    return crown;
  }

  /** A broadleaf tree in dots (an ink cluster of short dabs). */
  function dotTree(ctx, x, y, s, R) {
    const H = 22 * s;
    stroke(ctx, [[x, y], [x + (R() - 0.5) * 4 * s, y - H * 0.55], [x + (R() - 0.5) * 6 * s, y - H]], { w: 1.8 * s, col: 'rgba(32,30,28,0.8)', tin: 0, tout: 0.7 });
    for (let c = 0; c < 4; c++) {
      const cx = x + (R() - 0.5) * 14 * s, cy = y - H * (0.65 + R() * 0.4);
      for (let k = 0; k < 16; k++) {
        const px = cx + (R() - 0.5) * 11 * s, py = cy + (R() - 0.5) * 6 * s;
        stroke(ctx, [[px - 1.2 * s, py], [px + 1.2 * s, py - 0.3 * s]], { w: 1.3 * s, col: `rgba(30,40,38,${0.35 + R() * 0.35})`, tin: 0.2, tout: 0.6 });
      }
    }
  }

  return { D, figure, house, parasol, boat, bridge, willow, dotTree };
})();
