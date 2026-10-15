// canvas2d.js — fallback renderer for browsers without WebGL2 (or after the context is lost for good). Same ridge
// profiles, framings, palettes and figure layers as the shader (ridges.js / compose.js / figures.js), painted into
// the same views (the page's strip and closing windows, the desktop horizon band), static: no drifting mist, no wake
// and no sweep (that needs the GPU).
//
// Each view's painting is built the round-3 way: every plane's wash at quarter resolution from many small offset
// stamps of its silhouette (so it grades away from every crest, like the shader), blurred once, upscaled smoothly
// and clipped to the crisp full-resolution silhouette; dry contours on the near planes; mist bands at every foot; the
// water as reserved paper with a soft flipped reflection and a few long strokes. Pigment is a tint of each plane's
// wash; the figure layer is laid in after its plane; the keep-out is a mist ramp. Software rasterisers are common
// here, so a view is rasterised only when its framing changes; a full-quality painting that replaces a draft is
// built one plane per frame behind the draft on show. present() lays the views at their live boxes on paper (the
// horizon band as one faded, sunk offset of its painting), then the reading veil and a fine grain.

import { LAYERS } from './compose.js';
import { SCENE_ROW } from './ridges.js';

const PAPER = [239, 241, 238];
const SKY = [241, 243, 242];
const MIST = [233, 237, 236];
const INK_N = [16, 19, 21];
const INK_F = [62, 86, 100];
const AZ = [[127, 159, 184], [44, 92, 138]];    // misted, deep
const MAL = [[141, 181, 164], [58, 128, 106]];
// the veils' tone: a touch above MIST, because 8-bit blending of many faint draws stops short of
// its target (by ~5 levels on CPU canvases); this lands the wash where the GPU painted it
const STAMP = [MIST[0] + 5, MIST[1] + 5, MIST[2] + 5];

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// Smooth value noise on a 64-cell tile, ~[0, 1]: the veil's torn edge (the shader tears it with its mist field).
const NZ = (() => {
  let seed = 11;
  const n = new Float32Array(64 * 64);
  for (let i = 0; i < n.length; i++) n[i] = (seed = (seed * 16807) % 2147483647) / 2147483647;
  return n;
})();
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const x0 = xi & 63, x1 = (xi + 1) & 63, y0 = (yi & 63) << 6, y1 = ((yi + 1) & 63) << 6;
  const a = NZ[y0 + x0], b = NZ[y0 + x1], c = NZ[y1 + x0], d = NZ[y1 + x1];
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
// the mist field at a world point (viewport heights): broad billows plus a finer layer, like the shader's m1
const mistAt = (x, y) => 0.62 * vnoise(x * 1.05, y * 2.9) + 0.38 * vnoise(x * 2.6 + 5.3, y * 7.1 + 1.7);

function grainTile() {
  // fine, low-contrast paper: soft 2-3 px tooth and a sprinkling of faint short fibres
  const n = 256;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const x = c.getContext('2d', { willReadFrequently: true });
  if (!x) return null;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const cell = 2;
  const gw = n / cell;
  const g = new Float32Array(gw * gw).map(() => rnd());
  const at = (a, b) => g[(b % gw) * gw + (a % gw)];
  const img = x.createImageData(n, n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const fx = i / cell, fy = j / cell;
      const ix = Math.floor(fx), iy = Math.floor(fy);
      const tx = fx - ix, ty = fy - iy;
      const v = (at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx) * (1 - ty) + (at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx) * ty;
      const k = (j * n + i) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = v < 0.5 ? 40 : 255;
      img.data[k + 3] = Math.abs(v - 0.5) * 22;
    }
  }
  x.putImageData(img, 0, 0);
  x.lineCap = 'round';
  for (let f = 0; f < 140; f++) {
    const px = rnd() * n, py = rnd() * n, a = rnd() * Math.PI, len = 3 + rnd() * 9;
    x.strokeStyle = rnd() < 0.6 ? 'rgba(255,255,255,0.2)' : 'rgba(30,36,40,0.05)';
    x.lineWidth = 0.6;
    x.beginPath();
    x.moveTo(px - Math.cos(a) * len, py - Math.sin(a) * len);
    x.quadraticCurveTo(px + rnd() * 2 - 1, py + rnd() * 2 - 1, px + Math.cos(a) * len, py + Math.sin(a) * len);
    x.stroke();
  }
  return c;
}

export function createCanvas2D(canvas) {
  // Every canvas here is CPU-backed (willReadFrequently). This path runs where WebGL2 is missing, and
  // there 2D acceleration is usually missing or emulated too: every draw from one canvas into another
  // would sync the GPU, which costs more than the painting itself.
  const CPU = { alpha: false, willReadFrequently: true };
  let ctx = null;
  try { ctx = canvas.getContext('2d', CPU); } catch { ctx = null; }
  if (!ctx) return null;
  const surf = (alpha = false) => { const c = document.createElement('canvas'); return [c, c.getContext('2d', { alpha, willReadFrequently: true })]; };
  // shared scratch buffers (quarter resolution), grown to the largest view
  const [low, wc] = surf(true);
  const [soft, sc] = surf(true);
  const [stamp, mc] = surf(true);
  const [veilC, vc] = surf(true);
  const [figC, fx] = surf(true);
  if (!wc || !sc || !mc || !vc || !fx) return null;
  const tile = grainTile();
  const blurOK = 'filter' in wc;
  let grain = null;
  let W = 0, H = 0, VW = 0, VH = 0;
  let veilImg = null, veilKey = '';
  const views = new Map();   // id -> { w, h, full, fc, work, kc, draft, dc, ridges, samples, gen, shown, job, shift }
  const figs = new Map();    // id -> image (ImageBitmap or canvas)

  function lowSize(w, h) {
    const lw = Math.max(2, Math.round(w / 4)), lh = Math.max(2, Math.round(h / 4));
    if (low.width !== lw || low.height !== lh) {
      low.width = soft.width = stamp.width = lw;
      low.height = soft.height = stamp.height = lh;
    }
    return [lw, lh];
  }

  // ---------------------------------------------------------------- painting one view
  // scene height -> view px: the view shows scene heights [top - span, top] (a window; the full view: [0, 1])
  const vy = (U, y, h) => ((U.view[1] - y) / U.view[2]) * h;
  // a near plane over water sinks into it (only its headlands stand out), as in the shader
  const sunk = (v, l, c) => (l >= 3 ? 0.14 * v.ridges[(SCENE_ROW * v.samples + c) * 4] : 0);
  function silhouette(v, U, l, w, h) {
    const path = new Path2D();
    path.moveTo(-2, h + 2);
    for (let c = 0; c < v.samples; c++) {
      const y = v.ridges[(l * v.samples + c) * 4] - sunk(v, l, c);
      path.lineTo((c / (v.samples - 1)) * w, vy(U, y, h));
    }
    path.lineTo(w + 2, h + 2);
    path.closePath();
    return path;
  }
  function sky(lc, U, w, h) {
    const g = lc.createLinearGradient(0, vy(U, 1, h), 0, vy(U, 0.45, h));
    g.addColorStop(0, rgba(SKY));
    g.addColorStop(1, rgba(PAPER));
    lc.fillStyle = g;
    lc.fillRect(0, 0, w, h);
  }
  // the plane's mean pigment and lean across the view (row 7: pigment, malachite lean)
  function pigment(v) {
    let s = 0, m = 0;
    const r = (LAYERS + 2) * v.samples;
    for (let c = 0; c < v.samples; c++) { s += v.ridges[(r + c) * 4 + 2]; m += v.ridges[(r + c) * 4 + 3]; }
    return [s / v.samples, m / v.samples];
  }
  // one plane into `lc` (w x h). A draft takes fewer, unblurred wash steps.
  function plane(v, l, U, lc, w, h, draft) {
    const [LW, LH] = lowSize(w, h);
    const dep = l / (LAYERS - 1);
    const foot = U.feet[l * 3], fade = U.feet[l * 3 + 1], strength = U.feet[l * 3 + 2];
    const ink = mix(mix(INK_F, INK_N, Math.pow(dep, 0.8)), MIST, (1 - dep) * 0.35);
    let crest = mix(MIST, ink, Math.min(1, (0.62 + 0.3 * dep) * strength));
    const [pk, lean] = U.horizon ? [0, 0] : pigment(v);
    if (pk > 0.01) {
      // the misted blue-green: the wash leans to azurite or malachite, far planes misted, near ones deeper
      const deep = Math.min(1, dep * 0.85);
      const pig = mix(mix(AZ[0], AZ[1], deep), mix(MAL[0], MAL[1], deep), lean);
      crest = mix(crest, mix(pig, MIST, (1 - dep) * 0.34), Math.min(0.75, pk * 0.85));
    }
    const lowPath = silhouette(v, U, l, LW, LH);
    wc.setTransform(1, 0, 0, 1, 0, 0);
    wc.clearRect(0, 0, LW, LH);
    wc.fillStyle = rgba(crest);
    wc.fillRect(0, 0, LW, LH);
    const bodyW = ((0.30 - 0.14 * dep) / U.view[2]) * LH;
    const steps = draft ? 24 : 72;
    const step = (bodyW * 2.6) / steps;
    mc.clearRect(0, 0, LW, LH);
    mc.fillStyle = rgba(STAMP);
    mc.fill(lowPath);
    wc.globalAlpha = 1 - Math.exp(-step / (bodyW * 0.75));
    for (let k = 1; k <= steps; k++) wc.drawImage(stamp, 0, Math.round(k * step));
    wc.globalAlpha = 1;
    let src = low;
    if (blurOK && !draft) {
      sc.globalCompositeOperation = 'copy';
      sc.drawImage(low, 0, 0);
      sc.globalCompositeOperation = 'source-over';
      sc.filter = 'blur(1.25px)';
      sc.drawImage(low, 0, 0);
      sc.filter = 'none';
      src = soft;
    }
    const path = silhouette(v, U, l, w, h);
    lc.save();
    lc.clip(path);
    lc.imageSmoothingEnabled = true;
    lc.imageSmoothingQuality = 'low';
    lc.drawImage(src, 0, 0, LW, LH, 0, 0, w, h);
    // terraced fields (the Résumé's shore, ridges row 8): broken lines parallel to the hill's crest, stepping down it
    if (l >= 2 && !U.horizon) {
      const r8 = (LAYERS + 3) * v.samples;
      let tmax = 0;
      for (let c = 0; c < v.samples; c += 4) tmax = Math.max(tmax, v.ridges[(r8 + c) * 4]);
      if (tmax > 0.05) {
        const u = h / U.view[2];
        const stepY = (0.017 - 0.0065 * dep);
        lc.lineJoin = 'round';
        lc.lineWidth = Math.max(0.8, u * 0.0016);
        for (let j = 1; j <= 9; j++) {
          lc.setLineDash(draft ? [] : [u * 0.05, u * 0.012, u * 0.02, u * 0.016]);
          lc.lineDashOffset = j * u * 0.031;
          lc.strokeStyle = rgba(INK_N, (0.26 - 0.022 * j) * tmax * strength);
          const line = new Path2D();
          let on = false;
          for (let c = 0; c < v.samples; c += 2) {
            const t = v.ridges[(r8 + c) * 4];
            const y = v.ridges[(l * v.samples + c) * 4 + 2] - (j + 0.4) * stepY;   // under the broad crest
            const px = (c / (v.samples - 1)) * w;
            if (t > 0.05) { if (on) line.lineTo(px, vy(U, y, h)); else { line.moveTo(px, vy(U, y, h)); on = true; } } else on = false;
          }
          lc.stroke(line);
        }
        lc.setLineDash([]);
      }
    }
    if (dep > 0.4) {
      // dry contour on the nearer planes, broken like a dry brush
      const line = new Path2D();
      for (let c = 0; c < v.samples; c++) {
        const y = v.ridges[(l * v.samples + c) * 4] - sunk(v, l, c);
        const px = (c / (v.samples - 1)) * w;
        if (c) line.lineTo(px, vy(U, y, h)); else line.moveTo(px, vy(U, y, h));
      }
      const u = h / U.view[2];
      lc.lineJoin = 'round';
      lc.setLineDash([u * 0.06, u * 0.01, u * 0.025, u * 0.014]);
      lc.lineWidth = Math.max(1, u * 0.004);
      lc.strokeStyle = rgba(INK_N, 0.5 * dep * strength);
      lc.stroke(line);
      lc.setLineDash([]);
    }
    lc.restore();
    // the foot dissolves into a mist band
    const y0 = vy(U, foot + fade * 1.5, h), y1 = vy(U, foot - 0.05, h);
    const mb = lc.createLinearGradient(0, y0, 0, y1);
    mb.addColorStop(0, rgba(MIST, 0));
    mb.addColorStop(1, rgba(MIST, 0.92));
    lc.fillStyle = mb;
    lc.fillRect(0, y0, w, h - y0);
  }
  // Water in front of the far shore (planes 0-2): reserved paper below the waterline (down to a river's near bank),
  // a soft flipped copy of the far shore, a mist band on the waterline, a few long strokes.
  function water(v, U, lc, w, h, draft) {
    const [LW, LH] = lowSize(w, h);
    const r = SCENE_ROW * v.samples, r6 = (SCENE_ROW + 1) * v.samples, r7 = (LAYERS + 2) * v.samples, r8 = (LAYERS + 3) * v.samples;
    let any = false, wySum = 0, nySum = 0, n = 0, shore = 0, mir = 0, ind = 0;
    for (let c = 0; c < v.samples; c++) {
      const ws = v.ridges[(r + c) * 4];
      if (ws > 0.02) {
        any = true; wySum += v.ridges[(r + c) * 4 + 1] * ws; nySum += v.ridges[(r7 + c) * 4] * ws; shore += v.ridges[(r7 + c) * 4 + 1] * ws; n += ws;
        mir += v.ridges[(r8 + c) * 4 + 1] * ws;
        ind += (U.horizon ? 0 : v.ridges[(r6 + c) * 4 + 3] * v.ridges[(r7 + c) * 4 + 2]) * ws;
      }
    }
    if (!any) return;
    const wyMean = wySum / n, nyMean = nySum / n, shoreK = shore / n, mirror = mir / n, indigo = Math.min(1, ind / n);
    const bottom = nyMean > -0.5 ? vy(U, nyMean, LH) : LH;
    mc.clearRect(0, 0, LW, LH);
    for (let i = 0; i < LW; i++) {
      const c = Math.min(v.samples - 1, Math.round(((i + 0.5) / LW) * v.samples - 0.5));
      const ws = v.ridges[(r + c) * 4];
      if (ws <= 0.01) continue;
      const top = vy(U, v.ridges[(r + c) * 4 + 1], LH);
      mc.fillStyle = `rgba(0,0,0,${ws.toFixed(3)})`;
      mc.fillRect(i, top + 0.5, 1, Math.max(0, bottom - top));
    }
    const yl = vy(U, wyMean, LH);
    sc.globalCompositeOperation = 'copy';
    sc.drawImage(lc.canvas, 0, 0, w, h, 0, 0, LW, LH);
    sc.globalCompositeOperation = 'source-over';
    wc.setTransform(1, 0, 0, 1, 0, 0);
    wc.globalCompositeOperation = 'copy';
    wc.fillStyle = rgba(mix(PAPER, SKY, 0.4));
    wc.fillRect(0, 0, LW, LH);
    wc.globalCompositeOperation = 'source-over';
    wc.globalAlpha = (0.3 + 0.28 * mirror) * shoreK;   // still water (the lake) holds its mirror whole
    wc.setTransform(1, 0, 0, -1, 0, 2 * yl);
    wc.drawImage(soft, 0, 0);
    wc.setTransform(1, 0, 0, 1, 0, 0);
    wc.globalAlpha = 1;
    wc.globalCompositeOperation = 'destination-in';
    wc.drawImage(stamp, 0, 0);
    wc.globalCompositeOperation = 'source-over';
    lc.imageSmoothingEnabled = true;
    lc.imageSmoothingQuality = 'low';
    lc.drawImage(low, 0, 0, LW, LH, 0, 0, w, h);
    // the crossing's water: a pale indigo wash (azurite toned with indigo), a little deeper toward the viewer, laid
    // through the water's own soft mask (stamp: each column's water strength), so it never shows an edge
    if (indigo > 0.01) {
      const ind = mix(mix(AZ[0], INK_F, 0.38), MIST, 0.4);
      wc.setTransform(1, 0, 0, 1, 0, 0);
      wc.globalCompositeOperation = 'copy';
      const g = wc.createLinearGradient(0, yl, 0, LH);
      g.addColorStop(0, rgba(ind, 0.4 * indigo));
      g.addColorStop(1, rgba(ind, 0.62 * indigo));
      wc.fillStyle = g;
      wc.fillRect(0, 0, LW, LH);
      wc.globalCompositeOperation = 'destination-in';
      wc.drawImage(stamp, 0, 0);
      wc.globalCompositeOperation = 'source-over';
      lc.save();
      lc.globalCompositeOperation = 'multiply';
      lc.drawImage(low, 0, 0, LW, LH, 0, 0, w, h);
      lc.restore();
    }
    // a few long, low strokes (dashed: a dry brush), thinner near the waterline
    const u = h / U.view[2];
    lc.save();
    lc.lineCap = 'round';
    [[0.03, 0.0025, 0.16], [0.075, 0.003, 0.13], [0.17, 0.005, 0.1]].forEach(([d, t, a], j) => {
      if (nyMean > -0.5 && wyMean - d < nyMean) return;
      const y = vy(U, wyMean - d, h);
      if (y > h) return;
      const uu = u * (0.05 + 0.04 * j);
      lc.setLineDash(draft ? [] : [uu * 1.7, uu * 0.3, uu * 0.6, uu * 1.1, uu * 2.4, uu * 0.5, uu * 0.35, uu * 1.6]);
      lc.lineDashOffset = j * u * 0.13;
      lc.lineWidth = Math.max(1, t * u);
      lc.strokeStyle = rgba(INK_F, a);
      lc.beginPath();
      let on = false;
      for (let c = 0; c < v.samples; c += 2) {
        const ws = v.ridges[(r + c) * 4], st = v.ridges[((SCENE_ROW + 1) * v.samples + c) * 4];
        const run = ws > 0.6 && st > 0.2 && Math.sin(c * 0.021 + j * 2.1) > -0.15;
        const x = (c / (v.samples - 1)) * w;
        if (run && !on) { lc.moveTo(x, y); on = true; } else if (run) lc.lineTo(x, y); else on = false;
      }
      lc.stroke();
    });
    lc.restore();
    // the waterline melts into mist
    const ya = vy(U, wyMean + 0.03, h);
    const mg = lc.createLinearGradient(0, ya, 0, ya + 0.05 * u);
    mg.addColorStop(0, rgba(MIST, 0));
    mg.addColorStop(0.6, rgba(MIST, 0.55));
    mg.addColorStop(1, rgba(MIST, 0));
    lc.fillStyle = mg;
    lc.fillRect(0, ya, w, 0.05 * u);
  }
  // a figure layer laid into the painting (world rect -> view px)
  function figure(U, lc, w, h, f) {
    const img = f && figs.get(f.id);
    if (!img || !(f.k > 0)) return;
    const [u0, u1, y0, y1] = f.raw;
    const x0 = ((u0 * U.hs - U.view[0]) / U.view[3]) * w, x1 = ((u1 * U.hs - U.view[0]) / U.view[3]) * w;
    const t0 = vy(U, y1, h), t1 = vy(U, y0, h);
    // the layer melts into mist at both ends (as the shader lays it in), through a scratch canvas
    const fw = Math.max(2, Math.round(x1 - x0)), fh = Math.max(2, Math.round(t1 - t0));
    if (figC.width !== fw || figC.height !== fh) { figC.width = fw; figC.height = fh; }
    fx.globalCompositeOperation = 'copy';
    fx.imageSmoothingEnabled = true;
    fx.imageSmoothingQuality = 'high';
    fx.drawImage(img, 0, 0, fw, fh);
    fx.globalCompositeOperation = 'destination-in';
    const g = fx.createLinearGradient(0, 0, fw, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.13, 'rgba(0,0,0,1)'); g.addColorStop(0.88, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    fx.fillStyle = g;
    fx.fillRect(0, 0, fw, fh);
    fx.globalCompositeOperation = 'source-over';
    lc.save();
    lc.globalAlpha = Math.min(1, f.k);
    lc.drawImage(figC, x0, t0, x1 - x0, t1 - t0);
    lc.restore();
  }
  // the keep-out: mist recomposes the scene where the text stands (opaque to 140 px left of its edge, clear 140 right)
  function keepOut(U, lc, w, h) {
    if (!U.keep || !(U.keep[1] > 0)) return;
    const kx = U.keep[0] * w, kr = U.keep[2] * w;
    const g = lc.createLinearGradient(kx - kr, 0, kx + kr, 0);
    g.addColorStop(0, rgba(mix(MIST, SKY, 0.45), 1));
    g.addColorStop(1, rgba(mix(MIST, SKY, 0.45), 0));
    lc.fillStyle = g;
    lc.fillRect(0, 0, kx + kr, h);
  }
  // the painting's steps, far to near; the water goes in front of the far shore; figures after their plane
  const STEPS = LAYERS + 1;
  function step(v, k, U, lc, w, h, draft) {
    if (k < 3) plane(v, k, U, lc, w, h, draft);
    else if (k === 3) water(v, U, lc, w, h, draft);
    else plane(v, k - 1, U, lc, w, h, draft);
    // the layer of plane p, phase 0 goes after that plane; phase 1 after its band (the same here) or the water
    const done = k < 3 ? k : k === 3 ? 2.5 : k - 1;
    for (const f of [U.figA, U.figB]) {
      if (!f) continue;
      const at = f.phase > 0.5 && f.plane === 2 ? 2.5 : f.plane;
      if (Math.abs(at - done) < 0.01) figure(U, lc, w, h, f);
    }
    if (k === STEPS - 1) keepOut(U, lc, w, h);
  }
  function paintAll(v, lc, w, h, U, draft) {
    sky(lc, U, w, h);
    for (let k = 0; k < STEPS; k++) step(v, k, U, lc, w, h, draft);
  }

  return {
    mode: 'canvas2d',
    software: false,
    rendererName: 'canvas2d',
    get ready() { return true; },
    resize(w, h) {
      if (w === W && h === H) return;
      W = canvas.width = w;
      H = canvas.height = h;
      VW = veilC.width = Math.max(2, Math.round(w / 4));
      VH = veilC.height = Math.max(2, Math.round(h / 4));
      veilImg = vc.createImageData(VW, VH);
      for (let i = 0; i < veilImg.data.length; i += 4) {
        veilImg.data[i] = PAPER[0]; veilImg.data[i + 1] = PAPER[1]; veilImg.data[i + 2] = PAPER[2];
      }
      veilKey = '';
      grain = tile ? ctx.createPattern(tile, 'repeat') : null;
    },
    view(id, w, h) {
      w = Math.max(2, w | 0); h = Math.max(2, h | 0);
      let v = views.get(id);
      if (v && v.w === w && v.h === h) return false;
      if (!v) {
        const [full, fc] = surf(), [work, kc] = surf(), [draft, dc] = surf();
        v = { full, fc, work, kc, draft, dc, ridges: null, samples: 0, gen: 0, shown: null, job: null, shift: 0 };
        views.set(id, v);
      }
      v.w = v.full.width = v.work.width = w;
      v.h = v.full.height = v.work.height = h;
      v.draft.width = Math.max(2, Math.round(w / 2));
      v.draft.height = Math.max(2, Math.round(h / 2));
      v.shown = null;
      v.job = null;
      return true;
    },
    dropView(id) { views.delete(id); },
    hasView(id) { return !!views.get(id)?.shown; },
    ridges(id, data, n) { const v = views.get(id); if (v) { v.ridges = data; v.samples = n; v.gen++; } },
    figure(id, img) {
      if (!img) { const old = figs.get(id); try { old?.close?.(); } catch { /* ignore */ } figs.delete(id); return true; }
      const src = img.bitmap || img.canvas;
      if (!src) return false;
      figs.set(id, src);
      return true;
    },
    hasFigure(id) { return figs.has(id); },
    /**
     * Paint a view. A draft (U.draft: a pan in flight) is painted at half resolution, at once. A full-quality
     * painting that replaces a draft is painted one plane per call behind the draft on show, and returns false until
     * it is complete (index.js calls again on the next frames); with nothing on show yet it is painted at once.
     */
    scene(id, U) {
      const v = views.get(id);
      if (!v || !v.ridges) return true;
      v.shift = U.horizon ? Math.round((U.hzShift || 0) * v.h) : 0;
      if (U.draft) {
        v.job = null;
        paintAll(v, v.dc, v.draft.width, v.draft.height, U, true);
        v.shown = v.draft;
        return true;
      }
      if (v.shown !== v.draft) {
        v.job = null;
        paintAll(v, v.fc, v.w, v.h, U, false);
        v.shown = v.full;
        return true;
      }
      if (!v.job || v.job.gen !== v.gen) {
        v.job = { next: 0, gen: v.gen };
        sky(v.kc, U, v.w, v.h);
      }
      step(v, v.job.next, U, v.kc, v.w, v.h, false);
      if (++v.job.next < STEPS) return false;
      [v.full, v.work] = [v.work, v.full];
      [v.fc, v.kc] = [v.kc, v.fc];
      v.shown = v.full;
      v.job = null;
      return true;
    },
    present(U) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = rgba(PAPER);
      ctx.fillRect(0, 0, W, H);
      // the horizon band: round 3's way, one faded offset of its painting sunk toward the bottom of the view
      const hz = U.horizon && views.get(U.horizon.id);
      if (hz && hz.shown && U.horizon.k > 0) {
        ctx.globalAlpha = U.horizon.k * 0.7;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(hz.shown, 0, 0, hz.shown.width, hz.shown.height, 0, hz.shift, W, H);
        ctx.globalAlpha = 1;
        const vg = 0.09 * Math.min(1, U.veilR / 0.13);
        const b = ctx.createLinearGradient(0, H * (1 - vg), 0, H);
        b.addColorStop(0, rgba(MIST, 0));
        b.addColorStop(1, rgba(MIST, 0.55));
        ctx.fillStyle = b;
        ctx.fillRect(0, H * (1 - vg), W, H * vg);
      }
      // the windows at their live boxes, feathered into the paper at top and bottom
      for (const w of U.windows || []) {
        const v = views.get(w.id);
        if (!v || !v.shown) continue;
        const x0 = w.rect[0] * W, x1 = w.rect[2] * W;
        const y0 = (1 - w.rect[3]) * H, y1 = (1 - w.rect[1]) * H;
        const a = w.feather[3] >= 1 ? 1 : clamp01(w.feather[3]);
        ctx.globalAlpha = a;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(v.shown, 0, 0, v.shown.width, v.shown.height, x0, y0, x1 - x0, y1 - y0);
        ctx.globalAlpha = 1;
        const bh = y1 - y0;
        const ft = w.feather[0] * bh, fb = w.feather[1] * bh;
        if (ft > 1) { const g = ctx.createLinearGradient(0, y0, 0, y0 + ft); g.addColorStop(0, rgba(PAPER, 1)); g.addColorStop(1, rgba(PAPER, 0)); ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, ft); }
        if (fb > 1) { const g = ctx.createLinearGradient(0, y1 - fb, 0, y1); g.addColorStop(0, rgba(PAPER, 0)); g.addColorStop(1, rgba(PAPER, 1)); ctx.fillStyle = g; ctx.fillRect(x0, y1 - fb, x1 - x0, fb); }
      }
      // reading veil: paper banked up behind the text, feathered and torn (the mask, stretched smoothly)
      if (veilMask(U)) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'low';
        ctx.drawImage(veilC, 0, 0, VW, VH, 0, 0, W, H);
      }
      if (grain && U.grain > 0) {
        // the grain tile is authored in CSS px; it unrolls with the pan
        const s = 1 / U.px;
        ctx.save();
        ctx.globalAlpha = Math.min(1, U.grain * 2.5);
        ctx.scale(s, s);
        ctx.translate(-(U.panPx % 256), 0);
        ctx.fillStyle = grain;
        ctx.fillRect(0, 0, W / s + 256, H / s);
        ctx.restore();
      }
    },
    destroy() {
      for (const v of views.values()) { v.full.width = v.full.height = v.work.width = v.work.height = v.draft.width = v.draft.height = 0; }
      views.clear();
      for (const f of figs.values()) { try { f.close?.(); } catch { /* ignore */ } }
      figs.clear();
      low.width = low.height = soft.width = soft.height = stamp.width = stamp.height = 0;
      veilC.width = veilC.height = 0;
      veilImg = null;
    },
  };

  /**
   * The reading veil's mask (alpha = how much paper lies over the landscape), the shader's formula per pixel: each
   * rect's distance (aspect-corrected), feathered over its radius and torn by the mist field. Returns false when
   * there is no veil. Recomputed only when the rects or the size change.
   */
  function veilMask(U) {
    const list = [];
    for (let k = 0; k < U.veilS.length; k++) {
      const x0 = U.veil[k * 4];
      if (x0 < -0.5 || !(U.veilS[k] > 0)) continue;
      const R = U.veilR * (U.veilF ? U.veilF[k] : 1);
      const fr = R / 0.13;
      list.push({
        x0, y0: U.veil[k * 4 + 1], x1: U.veil[k * 4 + 2], y1: U.veil[k * 4 + 3], s: U.veilS[k],
        R, fr, reach: R + 0.03 * fr, t0: clamp01((1 - U.veilS[k]) / 0.28),
      });
    }
    if (!list.length) return false;
    const key = `${VW}x${VH} ${U.aspect.toFixed(4)} ` +
      list.map((v) => [v.x0, v.y0, v.x1, v.y1, v.s, v.R].map((n) => n.toFixed(4)).join(',')).join(' ');
    if (key === veilKey) return true;
    veilKey = key;
    const d = veilImg.data;
    const asp = U.aspect;
    for (let j = 0; j < VH; j++) {
      const v = 1 - (j + 0.5) / VH;
      for (let i = 0; i < VW; i++) {
        const u = (i + 0.5) / VW;
        let a = 0;
        let m = -1;
        for (let k = 0; k < list.length; k++) {
          const L = list[k];
          const qx = Math.max(L.x0 - u, u - L.x1, 0) * asp;
          const qy = Math.max(L.y0 - v, v - L.y1, 0);
          const vd = Math.sqrt(qx * qx + qy * qy);
          if (vd >= L.reach) continue;
          if (m < 0) m = mistAt(u * asp, v);
          const tear = L.t0 + (1 - L.t0) * sstep(0, 0.02 * L.fr, vd);
          const val = L.s * (1 - sstep(0, L.R, vd + (m - 0.5) * 0.06 * L.fr * tear));
          if (val > a) a = val;
        }
        d[(j * VW + i) * 4 + 3] = Math.round(a * 255);
      }
    }
    vc.putImageData(veilImg, 0, 0);
    return true;
  }
}
