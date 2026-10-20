'use strict';
// Spec-check helper (round 4b): reuses the scenes researcher's sketch painters (r4/sketch/index.html)
// so the wireframes can show the real draft art at the proposed strip sizes. Research only.
const DPR = Math.min(3, window.devicePixelRatio || 1);
const { C, smooth, mix, fbm, vnoise, rng, rgba } = INK;

// ---------- the market (Work): world = a 1440 x 560 painting in CSS px ----------
// The river runs ACROSS the scroll (as in the Song handscroll); the town faces it from the far bank; the
// rainbow bridge spans it into depth; boats in side view. Everything dissolves into mist at the edges.
const WW = 1440, WH = 560;
const farBank = (x) => 0.765 * WH - (x - 400) / 900 * 0.05 * WH + (vnoise(x / 70, 0.2, 5) - 0.5) * 4;
const nearBank = (x) => 0.915 * WH - (x - 400) / 900 * 0.035 * WH + (vnoise(x / 60, 0.8, 6) - 0.5) * 5;

function ranges(view, Wb, Hb, layersW, colour) {
  const S = view.dpr;
  const out = layersW.map((L) => {
    const crest = new Float32Array(Wb);
    for (let px = 0; px < Wb; px++) {
      const xw = view.x0 + px / S;
      const k = Math.min(L.crest.length - 2, Math.max(0, Math.floor(xw)));
      const f = xw - k;
      crest[px] = ((L.crest[k] * (1 - f) + L.crest[k + 1] * f) - view.y0) * S;
    }
    return { ...L, crest, foot: (L.foot - view.y0) * S, fade: L.fade * S };
  });
  const buf = INK.paperBuffer(Wb, Hb);
  INK.paintRanges(buf, Wb, Hb, out, colour, { scale: S, H: WH * S });
  return buf;
}

function mistOver(ctx, view, Wv, Hv, alphaAt) {
  const k = 3;
  const w = Math.ceil(Wv / k) + 1, h = Math.ceil(Hv / k) + 1;
  const off = document.createElement('canvas'); off.width = w; off.height = h;
  const o = off.getContext('2d');
  const img = o.createImageData(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const a = INK.clamp01(alphaAt(view.x0 + i * k, view.y0 + j * k));
    const p = (j * w + i) * 4;
    img.data[p] = C.MIST[0] + 4; img.data[p + 1] = C.MIST[1] + 3; img.data[p + 2] = C.MIST[2] + 3; img.data[p + 3] = a * 255;
  }
  o.putImageData(img, 0, 0);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(off, 0, 0, w, h, 0, 0, w * k * view.dpr, h * k * view.dpr);
  ctx.restore();
}

function paintMarket(canvas, view, opts = {}) {
  const Wv = view.w, Hv = view.h, S = view.dpr;
  const Wb = Math.round(Wv * S), Hb = Math.round(Hv * S);
  canvas.width = Wb; canvas.height = Hb; canvas.style.width = Wv + 'px'; canvas.style.height = Hv + 'px';
  const ctx = canvas.getContext('2d');
  const far = INK.ridge(WW, 0.50 * WH, 0.22 * WH, [[0.28, 0.15, 0.45], [0.60, 0.16, 0.65], [0.90, 0.12, 0.5]], 21);
  const mid = INK.ridge(WW, 0.62 * WH, 0.34 * WH, [[0.70, 0.045, 1.0, 0.3], [0.765, 0.035, 0.74, -0.2], [0.62, 0.04, 0.45], [0.93, 0.05, 0.66, 0.2], [0.50, 0.06, 0.25]], 22);
  const layers = [
    { crest: far, foot: 0.63 * WH, fade: 0.10 * WH, dep: 0.0, ink: 0.62, seed: 31 },
    { crest: mid, foot: 0.70 * WH, fade: 0.09 * WH, dep: 0.42, ink: 0.82, seed: 32 },
  ];
  const buf = ranges(view, Wb, Hb, layers, opts.colour ?? null);
  INK.putBuffer(ctx, buf, Wb, Hb);
  ctx.setTransform(S, 0, 0, S, -view.x0 * S, -view.y0 * S);
  const R = rng(opts.seed ?? 7);
  // the mid range's crest in dry brush, broken: the contour a painter puts on the nearer ridge
  for (let x0 = 840; x0 < 1400; x0 += 70 + R() * 50) {
    const pts = []; for (let x = x0; x < x0 + 60 + R() * 60 && x < WW - 1; x += 3) pts.push([x, mid[x | 0] + 0.8]);
    if (pts.length > 4 && mid[pts[0][0] | 0] < 0.60 * WH) INK.dry(ctx, pts, { w: 2.2, col: 'rgba(30,44,52,0.40)', bristles: 4, seed: x0, thr: 0.45 });
  }

  // the river: reserved paper between the banks (horizontal, slightly falling to the left)
  const top = [], bot = [];
  for (let x = 300; x <= 1440; x += 6) { top.push([x, farBank(x)]); bot.push([x, nearBank(x)]); }
  INK.wash(ctx, [...top, ...bot.slice().reverse()], 'rgba(243,245,243,0.95)', 1.2);
  // the near bank: earth running down to the bottom of the band
  { const g = ctx.createLinearGradient(0, 0.9 * WH, 0, WH); g.addColorStop(0, 'rgba(186,160,128,0.14)'); g.addColorStop(1, 'rgba(186,160,128,0)'); ctx.save(); ctx.beginPath(); ctx.moveTo(bot[0][0], bot[0][1]); for (const p of bot) ctx.lineTo(p[0], p[1]); ctx.lineTo(1440, WH + 30); ctx.lineTo(300, WH + 30); ctx.closePath(); ctx.fillStyle = g; ctx.filter = 'blur(2px)'; ctx.fill(); ctx.restore(); }
  // the far bank: a stone embankment, then the street (a pale earth strip)
  INK.wash(ctx, [...top.map(([x, y]) => [x, y - 15]), ...top.slice().reverse()], 'rgba(186,160,128,0.15)', 1.5);
  INK.dry(ctx, top.filter((p) => p[0] > 380 && p[0] < 1340), { w: 3.0, col: 'rgba(44,44,40,0.45)', bristles: 5, seed: 4, thr: 0.36 });
  INK.dry(ctx, bot.filter((p) => p[0] > 420 && p[0] < 1300), { w: 3.6, col: 'rgba(44,44,40,0.40)', bristles: 6, seed: 9, thr: 0.40 });
  // long low strokes on the water
  for (let k = 0; k < 40; k++) {
    const x0 = 420 + R() * 880;
    const y = mix(farBank(x0) + 8, nearBank(x0) - 5, R());
    const len = 14 + R() * 40;
    INK.stroke(ctx, [[x0, y], [x0 + len * 0.5, y + 0.4], [x0 + len, y - 0.2]], { w: 0.8 + R() * 0.9, col: `rgba(70,96,110,${0.10 + R() * 0.14})`, tin: 0.1, tout: 0.7, wob: 0.5 });
  }

  // every thing is painted on its own layer, then laid into the painting with the same ink behaviour:
  // a faint bleed halo (ink wicking into the paper), a touch of transparency, then the mist over it
  const tT0 = performance.now();
  const layer = document.createElement('canvas'); layer.width = Wb; layer.height = Hb;
  const tctx = layer.getContext('2d');
  tctx.setTransform(S, 0, 0, S, -view.x0 * S, -view.y0 * S);
  {
  const ctx = tctx;
  const items = [];
  // the far bank's town: a front row facing the water, a broken second and third row behind (up and right,
  // along D), gaps for trees. Street life in front.
  const D = THINGS.D;
  const BD = [0.90, -0.42];
  const bridgeA = [720, nearBank(720) + 1], span = (nearBank(770) - farBank(840) + 2) / -BD[1];
  const bridgeB = [bridgeA[0] + BD[0] * span, bridgeA[1] + BD[1] * span];
  for (const [row, k, sc, keep] of [[3, 66, 0.78, 0.55], [2, 34, 0.9, 0.75], [1, 0, 1.0, 0.92]]) {
    for (let x = 340 + R() * 20; x < 1360;) {
      const s = sc * (0.92 + R() * 0.16);
      const w = (26 + R() * 34) * s, h = (10 + R() * 4) * s;
      const y = farBank(x + w * 0.5) - 15 + D[1] * k;
      const xx = x + D[0] * k;
      const nearBridge = Math.abs(xx + w / 2 - bridgeB[0] - 10) < 34 && row === 1;
      if (R() < keep && !nearBridge) {
        const thatch = R() < 0.18;
        const storey = !thatch && R() < 0.22, awning = row === 1 && !storey && R() < 0.4;
        items.push({ y, f: () => THINGS.house(ctx, xx, y, w, storey ? h * 1.55 : h, R, { d: w * (0.45 + R() * 0.25), wideShop: R() < 0.4, shop: row === 1 || R() < 0.3, thatch, storey, awning }) });
        if (row > 1 && R() < 0.35) { const tx = xx + w * (0.2 + R() * 0.6), ty = y + 3; items.push({ y: ty + 2, f: () => (R() < 0.5 ? THINGS.willow(ctx, tx, ty, 0.55, R, { sway: 1 }) : THINGS.dotTree(ctx, tx, ty, 0.55, R)) }); }
        if (row === 1) {
          const n = 1 + Math.floor(R() * 3.2);
          for (let i = 0; i < n; i++) { const fx = xx + R() * w, fy = y + 4 + R() * 8; items.push({ y: fy, f: () => THINGS.figure(ctx, fx, fy, 0.95 + R() * 0.15, R, { pole: R() < 0.16, flip: R() < 0.5 }) }); }
          if (R() < 0.3) { const px = xx + w * (0.3 + R() * 0.4), py = y + 10; items.push({ y: py, f: () => THINGS.parasol(ctx, px, py, 0.92, R) }); }
        }
      } else if (row === 1 && R() < 0.7) {
        const tx = xx + w * 0.5, ty = y + 2;
        items.push({ y: ty, f: () => (R() < 0.6 ? THINGS.willow(ctx, tx, ty, 0.62, R, { sway: 1 }) : THINGS.dotTree(ctx, tx, ty, 0.6, R)) });
      }
      x += w + (2 + R() * 10) * s;
    }
  }
  // the near bank: big willows, a stall and people at the bridge's foot
  for (const [x, s] of [[560, 1.45], [1160, 1.6], [1320, 1.1]]) { const y = nearBank(x) + 22; items.push({ y, f: () => THINGS.willow(ctx, x, y, s, R, { sway: 1.5 }) }); }
  for (let i = 0; i < 26; i++) { const rx = 460 + R() * 860, ry = nearBank(rx) + 3 + R() * 4; items.push({ y: ry, f: () => INK.stroke(ctx, [[rx, ry], [rx + (R() - 0.3) * 4, ry - 5 - R() * 6]], { w: 0.8, col: 'rgba(60,80,64,0.35)', tin: 0, tout: 0.9 }) }); }
  items.push({ y: nearBank(700) + 16, f: () => THINGS.parasol(ctx, 706, nearBank(706) + 16, 1.0, R) });
  for (let i = 0; i < 7; i++) { const fx = 640 + R() * 120, fy = nearBank(fx) + 8 + R() * 14; items.push({ y: fy, f: () => THINGS.figure(ctx, fx, fy, 1.05, R, { pole: i === 2, flip: R() < 0.5 }) }); }
  // boats: moored along the far bank (masts up), one coming down to the bridge with its mast lowered
  const boats = [
    { x: 455, y: farBank(480) + 12, L: 74, o: { s: 0.9, mast: 'up', crew: [[0.92, 0.4, { flip: true }]] } },
    { x: 548, y: farBank(570) + 15, L: 92, o: { s: 0.95, mast: 'up', c0: 0.22, c1: 0.62 } },
    { x: 1185, y: farBank(1200) + 13, L: 58, o: { s: 0.8, mast: 'up' } },
    { x: 880, y: nearBank(950) - 16, L: 150, o: { s: 1.15, mast: 'down', c0: 0.28, c1: 0.66, crew: [[0.06, 0.2, { punt: true, hat: 'cone' }], [0.18, 0.15, { punt: true }], [0.80, 0.25, { arm: 'up', hat: 'cone', flip: true }], [0.90, 0.3, { arm: 'up', flip: true }], [0.74, 0.7, { arm: 'up', flip: true }]] } },
    { x: 1235, y: nearBank(1260) - 10, L: 40, o: { s: 0.75, crew: [[0.15, 0.4, { punt: true, hat: 'cone' }]], cabin: false } },
  ];
  for (const b of boats) items.push({ y: b.y, f: () => THINGS.boat(ctx, b.x, b.y, b.L, R, b.o) });
  items.push({ y: bridgeA[1] - 2, f: () => THINGS.bridge(ctx, bridgeA, span, 40, R, { dir: BD, people: 32, bw: 19, ramp: 0.13, T: 5.5, stalls: [[-0.14, 0.5], [1.14, 0.5]] }) });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.f();
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 0.30; ctx.filter = `blur(${1.3 * S}px)`; ctx.drawImage(layer, 0, 0);
  ctx.filter = 'none'; ctx.globalAlpha = opts.thingsAlpha ?? 0.9; ctx.drawImage(layer, 0, 0);
  ctx.restore();
  (window.__things = window.__things || []).push({ ms: Math.round(performance.now() - tT0), w: Wb, h: Hb });

  // mist: the back rows dissolve towards the hills, banks drift across the town, the scene melts at its edges
  mistOver(ctx, view, Wv, Hv, (x, y) => {
    const n = fbm(x / 230, y / 30, 61, 4), n2 = fbm(x / 110, y / 20, 62, 3);
    const back = smooth(0.58 * WH, 0.64 * WH, y) * (1 - smooth(0.63 * WH, 0.69 * WH, y + (n - 0.5) * 30)) * (0.55 + 0.5 * n);
    const drift = smooth(0.50, 0.72, n * 0.75 + n2 * 0.35) * smooth(0.60 * WH, 0.66 * WH, y) * (1 - smooth(0.70 * WH, 0.76 * WH, y)) * 0.75;
    const lowDrift = smooth(0.55, 0.75, n2 * 0.6 + n * 0.5) * smooth(0.95 * WH, 1.0 * WH, y) * 0.5;
    const ML = opts.mistLeft || [300, 560]; const left = 1 - smooth(ML[0], ML[1], x + (n - 0.5) * 220);
    const right = smooth(1250, 1440, x + (n - 0.5) * 160);
    const bottom = smooth(0.965 * WH, 1.0 * WH, y + (n - 0.5) * 20);
    const k = smooth(0.55 * WH, 0.62 * WH, y);
    return Math.max(back * 0.85, drift, lowDrift, left * 0.95 * k, right * 0.75 * k, bottom * 0.85);
  });
  INK.grain(ctx, Wb, Hb, 1);
}

// ---------- the colour study: one range, four treatments ----------
function paintStudy(canvas, colour, opts = {}) {
  const W = 1440, H = 300, S = Math.min(2, DPR);
  const Wb = W * S, Hb = H * S;
  canvas.width = Wb; canvas.height = Hb; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  const sc = (y) => y * S;
  const L = [
    { crest: INK.ridge(Wb, sc(0.52 * H), sc(0.30 * H), [[0.22, 0.24, 0.5], [0.62, 0.30, 0.7]], 41), foot: sc(0.72 * H), fade: sc(0.16 * H), dep: 0, ink: 0.62, seed: 41 },
    { crest: INK.ridge(Wb, sc(0.66 * H), sc(0.40 * H), [[0.04, 0.15, 0.55], [0.50, 0.18, 0.45], [0.97, 0.20, 0.8]], 42), foot: sc(0.84 * H), fade: sc(0.15 * H), dep: 0.3, ink: 0.72, seed: 42 },
    { crest: INK.ridge(Wb, sc(0.82 * H), sc(0.78 * H), [[0.66, 0.10, 0.8], [0.77, 0.09, 1.0, 0.1], [0.40, 0.12, 0.2]], 43), foot: sc(0.98 * H), fade: sc(0.16 * H), dep: 0.6, ink: 0.86, seed: 43 },
    { crest: INK.ridge(Wb, sc(1.02 * H), sc(0.52 * H), [[0.91, 0.12, 1.0], [1.02, 0.10, 0.55], [0.02, 0.18, 0.7], [0.26, 0.1, 0.3]], 44), foot: sc(1.12 * H), fade: sc(0.14 * H), dep: 0.95, ink: 0.95, seed: 44 },
  ];
  const buf = INK.paperBuffer(Wb, Hb);
  INK.paintRanges(buf, Wb, Hb, L, colour, { scale: S, H: H * S });
  INK.putBuffer(ctx, buf, Wb, Hb);
  ctx.setTransform(S, 0, 0, S, 0, 0);
  if (opts.traveller) {
    // the protagonist: a lone traveller on a path at the foot of the host peak, a hut above the mist
    const R = rng(5);
    const path = [[1004, 300], [998, 290], [1012, 281], [1030, 274], [1022, 266], [1036, 258], [1050, 251]];
    INK.dry(ctx, path, { w: 2.6, col: 'rgba(60,70,72,0.30)', bristles: 3, seed: 2, thr: 0.5 });
    INK.dry(ctx, path.map(([x, y]) => [x + 2.5, y + 0.8]), { w: 1.6, col: 'rgba(150,120,90,0.22)', bristles: 2, seed: 6, thr: 0.45 });
    THINGS.figure(ctx, 1024, 270, 1.5, R, { hat: 'cone', lean: 0.10, arm: 'down', robe: [246, 246, 242] });
    INK.stroke(ctx, [[1027.5, 255], [1022.5, 270.5]], { w: 0.75, col: 'rgba(20,24,26,0.85)', tin: 0, tout: 0 });   // a staff
    THINGS.house(ctx, 1090, 214, 20, 6.5, R, { d: 10, shop: false, roof: [150, 120, 88] });
    THINGS.dotTree(ctx, 1080, 216, 0.38, R);
  }
  INK.grain(ctx, Wb, Hb, 1);
}


window.STRIP = { paintMarket, paintStudy, WW, WH };
