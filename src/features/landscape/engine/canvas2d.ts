// canvas2d.ts — fallback renderer for browsers without WebGL2 (or after the context is lost for good). Same ridge
// profiles, framings, palettes and figure layers as the shader (ridges.ts / compose.ts / figures.ts), painted into
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

import { LAYERS, RIVER_FRONT } from './compose';
import { SCENE_ROW } from './ridges';
import type { FigureSlot, PresentU, Renderer, RendererMemory, SceneU } from './renderer';

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

// (colours: [r, g, b], 0..255)
const mix = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgba = (c: number[], a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const sstep = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// Smooth value noise on a 64-cell tile, ~[0, 1]: the veil's torn edge (the shader tears it with its mist field).
const NZ = (() => {
  let seed = 11;
  const n = new Float32Array(64 * 64);
  for (let i = 0; i < n.length; i++) n[i] = (seed = (seed * 16807) % 2147483647) / 2147483647;
  return n;
})();
function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const x0 = xi & 63, x1 = (xi + 1) & 63, y0 = (yi & 63) << 6, y1 = ((yi + 1) & 63) << 6;
  const a = NZ[y0 + x0], b = NZ[y0 + x1], c = NZ[y1 + x0], d = NZ[y1 + x1];
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
// the mist field at a world point (viewport heights): broad billows plus a finer layer, like the shader's m1
const mistAt = (x: number, y: number) => 0.62 * vnoise(x * 1.05, y * 2.9) + 0.38 * vnoise(x * 2.6 + 5.3, y * 7.1 + 1.7);

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
  const at = (a: number, b: number) => g[(b % gw) * gw + (a % gw)];
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

/** A view's painting: the one on show (`shown`: full, or a half-size draft) and the one being built behind it. */
interface View {
  w: number;
  h: number;
  alpha: boolean;
  full: HTMLCanvasElement;
  fc: CanvasRenderingContext2D;
  work: HTMLCanvasElement;
  kc: CanvasRenderingContext2D;
  draft: HTMLCanvasElement;
  dc: CanvasRenderingContext2D;
  ridges: Float32Array | null;
  samples: number;
  gen: number;
  shown: HTMLCanvasElement | null;
  /** A full-quality painting built one step per scene() call: the next step, for this ridge generation. */
  job: { next: number; gen: number } | null;
  /** The horizon band's sink, px. */
  shift: number;
}
/** A view that has its ridges (scene() paints only those). */
type Painted = View & { ridges: Float32Array };
/** A figure layer as Canvas2D keeps it (an ImageBitmap, or a canvas). */
type FigureSource = CanvasImageSource & { close?(): void };
/** One reading veil, in canvas uv (veilMask). */
interface VeilRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  s: number;
  R: number;
  fr: number;
  fk: number;
  reach: number;
  t0: number;
}

export function createCanvas2D(canvas: HTMLCanvasElement): Renderer | null {
  // Every canvas here is CPU-backed (willReadFrequently). This path runs where WebGL2 is missing, and
  // there 2D acceleration is usually missing or emulated too: every draw from one canvas into another
  // would sync the GPU, which costs more than the painting itself.
  const CPU: CanvasRenderingContext2DSettings = { alpha: false, willReadFrequently: true };
  let context: CanvasRenderingContext2D | null = null;
  try { context = canvas.getContext('2d', CPU); } catch { context = null; }
  if (!context) return null;
  const ctx = context;   // (typed: the helper functions below see a context, never a possible null)
  // (a scratch canvas's context is null only where Canvas2D itself is missing: the first five are checked below)
  const surf = (alpha = false): [HTMLCanvasElement, CanvasRenderingContext2D] => { const c = document.createElement('canvas'); return [c, c.getContext('2d', { alpha, willReadFrequently: true })!]; };
  // shared scratch buffers (quarter resolution), grown to the largest view
  const [low, wc] = surf(true);
  const [soft, sc] = surf(true);
  const [stamp, mc] = surf(true);
  const [veilC, vc] = surf(true);
  const [figC, fx] = surf(true);
  if (!wc || !sc || !mc || !vc || !fx) return null;
  const tile = grainTile();
  const blurOK = 'filter' in wc;
  let grain: CanvasPattern | null = null;
  let W = 0, H = 0, VW = 0, VH = 0;
  let veilImg: ImageData | null = null, veilKey = '';
  const views = new Map<string, View>();
  const figs = new Map<string, FigureSource>();   // id -> image (ImageBitmap or canvas)
  const banks = new Map<string, { cv: HTMLCanvasElement; amp: number; h: number }>();   // 4b: baked mist-bank edges (stage(), bank())
  const curtC = new Map<number, { src: HTMLCanvasElement; key: string; cv: HTMLCanvasElement }>();   // 4b: a layer with the curtain's fade cut out of it (stage(), curtained())

  function lowSize(w: number, h: number): [number, number] {
    const lw = Math.max(2, Math.round(w / 4)), lh = Math.max(2, Math.round(h / 4));
    if (low.width !== lw || low.height !== lh) {
      low.width = soft.width = stamp.width = lw;
      low.height = soft.height = stamp.height = lh;
    }
    return [lw, lh];
  }

  // ---------------------------------------------------------------- painting one view
  // scene height -> view px: the view shows scene heights [top - span, top] (a window; the full view: [0, 1])
  const vy = (U: SceneU, y: number, h: number) => ((U.view[1] - y) / U.view[2]) * h;
  // a near plane over water sinks into it (only its headlands stand out), as in the shader
  const sunk = (v: Painted, l: number, c: number) => (l >= 3 ? 0.14 * v.ridges[(SCENE_ROW * v.samples + c) * 4] : 0);
  function silhouette(v: Painted, U: SceneU, l: number, w: number, h: number) {
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
  function sky(lc: CanvasRenderingContext2D, U: SceneU, w: number, h: number) {
    const g = lc.createLinearGradient(0, vy(U, 1, h), 0, vy(U, 0.45, h));
    g.addColorStop(0, rgba(SKY));
    g.addColorStop(1, rgba(PAPER));
    lc.fillStyle = g;
    lc.fillRect(0, 0, w, h);
  }
  // the plane's mean pigment and lean across the view (row 7: pigment, malachite lean)
  function pigment(v: Painted) {
    let s = 0, m = 0;
    const r = (LAYERS + 2) * v.samples;
    for (let c = 0; c < v.samples; c++) { s += v.ridges[(r + c) * 4 + 2]; m += v.ridges[(r + c) * 4 + 3]; }
    return [s / v.samples, m / v.samples];
  }
  // one plane into `lc` (w x h). A draft takes fewer, unblurred wash steps.
  function plane(v: Painted, l: number, U: SceneU, lc: CanvasRenderingContext2D, w: number, h: number, draft: boolean) {
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
    if (U.planes && l === 1) {
      // 4b, round 3 (the living ground's full-viewport views): the second far range's crest dissolves into drifting mist
      // as in WebGL, where this range is all but lost in the haze. Painted here it kept a crisp, nearly straight ridge
      // across the right margin: a broad mist line laid along the crest (and a fainter one under it), its strength broken
      // along its length by noise, so the ridge shows only in places and never as a ruled edge.
      wc.lineCap = 'butt';
      const n = v.samples, every = Math.max(1, Math.round(n / LW));
      for (const [dy, k, lw] of [[0.3, 1, 3], [2, 0.55, 2.4]]) {
        wc.lineWidth = lw;
        for (let c = 0; c + every < n; c += every) {
          const a = k * clamp01(0.6 + 0.6 * vnoise((c / n) * 9.0 + 3.7, 1.9) - 0.2 * vnoise((c / n) * 23.0, 6.1));
          if (a < 0.02) continue;
          const x0 = (c / (n - 1)) * LW, x1 = ((c + every) / (n - 1)) * LW;
          const y0 = vy(U, v.ridges[(l * n + c) * 4] - sunk(v, l, c), LH) + dy;
          const y1 = vy(U, v.ridges[(l * n + c + every) * 4] - sunk(v, l, c + every), LH) + dy;
          wc.strokeStyle = rgba(MIST, a);
          wc.beginPath(); wc.moveTo(x0, y0); wc.lineTo(x1, y1); wc.stroke();
        }
      }
    }
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
    // terraced fields (the Résumé's shore, ridges row 8): broken lines stepping down the hill. 4b: level, as the figure
    // layer's walls are (sets/terraces.ts, and the shader): a wall at level z lies at y = z - s (crest - z), sagging
    // where the hill swells toward us, and only where the ground stands above its level. Where that layer stands on
    // this plane it draws the walls itself, so the lines give way to it there (never two rhythms crossing)
    if (l >= 2 && !U.horizon) {
      const n = v.samples, r8 = (LAYERS + 3) * n;
      let tmax = 0, zTop = -1;
      for (let c = 0; c < n; c += 2) {
        const t = v.ridges[(r8 + c) * 4];
        tmax = Math.max(tmax, t);
        if (t > 0.05) zTop = Math.max(zTop, v.ridges[(l * n + c) * 4 + 2]);
      }
      if (tmax > 0.05) {
        const u = h / U.view[2];
        const stepZ = 0.0128 - 0.0038 * sstep(0.5, 1, dep);
        const layer = [U.figA, U.figB].filter((f) => f && f.plane === l && f.k > 0 && figs.has(f.id) && f.raw) as FigureSlot[];
        const open = new Float32Array(n), sag = new Float32Array(n);
        for (let c = 0; c < n; c += 2) {
          const x = U.view[0] + (c / (n - 1)) * U.view[3];   // world x, viewport heights
          let lw = 0;
          for (const f of layer) {
            const q = (x / U.hs - f.raw[0]) / (f.raw[1] - f.raw[0]);
            lw = Math.max(lw, sstep(0, 0.13, q) * sstep(1, 0.88, q) * Math.min(1, f.k));
          }
          open[c] = v.ridges[(r8 + c) * 4] > 0.05 && lw < 0.5 ? 1 : 0;
          sag[c] = 0.30 + 0.26 * vnoise(x * 2.2 + l * 3.1, 0.57 + l);
        }
        lc.lineJoin = 'round';
        lc.lineWidth = Math.max(0.8, u * 0.0016);
        for (let j = 0; j < 16; j++) {
          const z = zTop - (j + 0.4) * stepZ;
          if (z < foot - 0.02) break;
          lc.setLineDash(draft ? [] : [u * 0.05, u * 0.012, u * 0.02, u * 0.016]);
          lc.lineDashOffset = j * u * 0.031;
          lc.strokeStyle = rgba(INK_N, (0.25 - 0.13 * Math.min(1, (zTop - z) / 0.16)) * tmax * strength);
          const line = new Path2D();
          let on = false;
          for (let c = 0; c < n; c += 2) {
            const B = v.ridges[(l * n + c) * 4 + 2];
            const px = (c / (n - 1)) * w, py = vy(U, z - sag[c] * (B - z), h);
            if (open[c] && B - z > 0.0065) { if (on) line.lineTo(px, py); else { line.moveTo(px, py); on = true; } } else on = false;
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
    // (eased, not linear: a linear ramp's sudden start reads as a ruled line across the peaks, 4b)
    for (let k = 0; k <= 6; k++) { const t = k / 6; mb.addColorStop(t, rgba(MIST, 0.92 * t * t * (3 - 2 * t))); }
    lc.fillStyle = mb;
    lc.fillRect(0, y0, w, h - y0);
  }
  // Water in front of the far shore (planes 0-2): reserved paper below the waterline (down to a river's near bank),
  // a soft flipped copy of the far shore, a mist band on the waterline, a few long strokes.
  function water(v: Painted, U: SceneU, lc: CanvasRenderingContext2D, w: number, h: number, draft: boolean) {
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
  // 4b: the river's mist over a figure layer (the shader's figMist): the town's back rows dissolve into it and low
  // banks drift among them, keyed by depth: it lies behind the nearest things in each column (compose.ts RIVER_FRONT),
  // so the bridge and the crowd on its crown, the landmark and the masts stand clear. A low-resolution mask of how much
  // mist covers the layer (alpha), laid over it with destination-out; null where the layer stands on no river.
  const mists = new Map<string, HTMLCanvasElement>();
  function frontAt(u: number) {
    const F = RIVER_FRONT, x = (u - F.u0) / F.du;
    if (!(x > 0 && x < F.hb.length - 1)) return F.def;
    const i = Math.floor(x);
    return F.hb[i] + (F.hb[i + 1] - F.hb[i]) * (x - i);
  }
  function riverMist(U: SceneU, v: Painted, f: FigureSlot, fw: number, fh: number, x0: number, w: number): HTMLCanvasElement | null {
    const n = v.samples, r = SCENE_ROW * v.samples, r7 = (LAYERS + 2) * v.samples;
    const col = (i: number, mw: number) => Math.min(n - 1, Math.max(0, Math.round(((x0 + ((i + 0.5) / mw) * fw) / w) * (n - 1))));
    const mw = Math.max(2, Math.ceil(fw / 3)), mh = Math.max(2, Math.ceil(fh / 3));
    let any = false, sig = '';
    for (let i = 0; i < mw; i += Math.max(1, mw >> 3)) {
      const c = col(i, mw), riv = v.ridges[(r + c) * 4] * (1 - v.ridges[(r7 + c) * 4 + 1]);
      if (riv > 0.001) any = true;
      sig += `${riv.toFixed(2)}:${v.ridges[(r + c) * 4 + 1].toFixed(4)},`;
    }
    if (!any) return null;
    const key = `${f.id}|${fw}x${fh}|${x0.toFixed(1)}|${w}|${sig}`;
    if (mists.has(key)) return mists.get(key)!;
    const m = document.createElement('canvas');
    m.width = mw; m.height = mh;
    const mc2 = m.getContext('2d', { willReadFrequently: true });   // (CPU-backed, as every canvas here)
    if (!mc2) return null;
    const img = mc2.createImageData(mw, mh), d = img.data;
    const [u0, u1, y0, y1] = f.raw;
    const nz = (x: number, y: number) => 0.5 + (0.62 * vnoise(x * 4, y * 4) + 0.38 * vnoise(x * 8 + 5.3, y * 8 + 1.7) - 0.5) * 0.75;
    for (let i = 0; i < mw; i++) {
      const c = col(i, mw), riv = v.ridges[(r + c) * 4] * (1 - v.ridges[(r7 + c) * 4 + 1]), wY = v.ridges[(r + c) * 4 + 1];
      if (riv <= 0.001) continue;
      const u = u0 + ((i + 0.5) / mw) * (u1 - u0), px = u * U.hs, fr = frontAt(u);
      for (let j = 0; j < mh; j++) {
        const hb = y1 - ((j + 0.5) / mh) * (y1 - y0) - wY, db = hb - fr;
        if (db < -0.004) continue;
        const n1 = nz(px * 0.28, hb * 9 + 0.3), n2 = nz(px * 0.61 + 0.2, hb * 14 + 0.6);
        const back = sstep(0.003, 0.025, db + (n1 - 0.5) * 0.012) * (0.55 + 0.5 * n1);
        const drift = sstep(0.5, 0.72, n1 * 0.75 + n2 * 0.35) * sstep(0, 0.008, db) * (1 - sstep(0.02, 0.034, db)) * 0.85;
        d[(j * mw + i) * 4 + 3] = Math.round(255 * clamp01(Math.max(back * 0.92, drift)) * riv);
      }
    }
    mc2.putImageData(img, 0, 0);
    if (mists.size > 6) mists.delete(mists.keys().next().value!);
    mists.set(key, m);
    return m;
  }
  // a figure layer laid into the painting (world rect -> view px)
  function figure(U: SceneU, lc: CanvasRenderingContext2D, w: number, h: number, f: FigureSlot, v: Painted) {
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
    const mist = v ? riverMist(U, v, f, fw, fh, x0, w) : null;
    if (mist) {
      fx.globalCompositeOperation = 'destination-out';
      fx.imageSmoothingQuality = 'low';
      fx.drawImage(mist, 0, 0, fw, fh);
    }
    fx.globalCompositeOperation = 'source-over';
    lc.save();
    lc.globalAlpha = Math.min(1, f.k);
    lc.drawImage(figC, x0, t0, x1 - x0, t1 - t0);
    lc.restore();
  }
  // the keep-out: mist recomposes the scene where the text stands (opaque to 140 px left of its edge, clear 140 right);
  // a 4b depth layer in front of the base simply clears there (the base's mist shows through)
  function keepOut(U: SceneU, lc: CanvasRenderingContext2D, w: number, h: number) {
    if (!U.keep || !(U.keep[1] > 0)) return;
    const kx = U.keep[0] * w, kr = U.keep[2] * w;
    const g = lc.createLinearGradient(kx - kr, 0, kx + kr, 0);
    g.addColorStop(0, rgba(mix(MIST, SKY, 0.45), 1));
    g.addColorStop(1, rgba(mix(MIST, SKY, 0.45), 0));
    lc.save();
    if (isLayer(U)) lc.globalCompositeOperation = 'destination-out';
    lc.fillStyle = g;
    lc.fillRect(0, 0, kx + kr, h);
    lc.restore();
  }
  // 4b depth layers: U.planes = [first plane, last plane, 1 = a layer over transparent paper]
  const isLayer = (U: SceneU) => !!U.planes && U.planes[2] > 0.5;
  const inRange = (U: SceneU, l: number) => !U.planes || (l >= U.planes[0] - 0.01 && l <= U.planes[1] + 0.01);
  // the painting's steps, far to near; the water goes in front of the far shore; figures after their plane
  const STEPS = LAYERS + 1;
  function step(v: Painted, k: number, U: SceneU, lc: CanvasRenderingContext2D, w: number, h: number, draft: boolean) {
    const pl = k < 3 ? k : k === 3 ? 2 : k - 1;      // the plane this step belongs to (the water goes with plane 2)
    if (!inRange(U, pl)) { if (k === STEPS - 1) keepOut(U, lc, w, h); return; }
    if (k < 3) plane(v, k, U, lc, w, h, draft);
    else if (k === 3) water(v, U, lc, w, h, draft);
    else plane(v, k - 1, U, lc, w, h, draft);
    // the layer of plane p, phase 0 goes after that plane; phase 1 after its band (the same here) or the water
    const done = k < 3 ? k : k === 3 ? 2.5 : k - 1;
    for (const f of [U.figA, U.figB]) {
      if (!f) continue;
      const at = f.phase > 0.5 && f.plane === 2 ? 2.5 : f.plane;
      if (Math.abs(at - done) < 0.01) figure(U, lc, w, h, f, v);
    }
    if (k === STEPS - 1) keepOut(U, lc, w, h);
  }
  function ground(lc: CanvasRenderingContext2D, U: SceneU, w: number, h: number) {
    if (isLayer(U)) { lc.setTransform(1, 0, 0, 1, 0, 0); lc.clearRect(0, 0, w, h); } else sky(lc, U, w, h);
  }
  function paintAll(v: Painted, lc: CanvasRenderingContext2D, w: number, h: number, U: SceneU, draft: boolean) {
    ground(lc, U, w, h);
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
    view(id, w, h, alpha = false) {
      w = Math.max(2, w | 0); h = Math.max(2, h | 0);
      let v: View | null | undefined = views.get(id);
      if (v && v.w === w && v.h === h && v.alpha === alpha) return false;
      if (v && v.alpha !== alpha) { views.delete(id); v = null; }
      if (!v) {
        // (a 4b depth layer in front of the base is painted over transparent paper)
        const [full, fc] = surf(alpha), [work, kc] = surf(alpha), [draft, dc] = surf(alpha);
        // (its size is set just below)
        v = { full, fc, work, kc, draft, dc, ridges: null, samples: 0, gen: 0, shown: null, job: null, shift: 0, alpha } as Omit<View, 'w' | 'h'> as View;
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
    dropView(id) { const v = views.get(id); if (v) { v.full.width = v.work.width = v.draft.width = 0; views.delete(id); } for (const c of curtC.values()) c.cv.width = 0; curtC.clear(); },
    hasView(id) { return !!views.get(id)?.shown; },
    /** QA: bytes held per view (two full-size canvases and a half-size draft each). */
    memory() {
      const out: RendererMemory = { total: 0, views: {}, figures: figs.size };
      for (const [id, v] of views) {
        const b = (v.full.width * v.full.height + v.work.width * v.work.height + v.draft.width * v.draft.height) * 4;
        out.views[id] = { w: v.w, h: v.h, bytes: b };
        out.total += b;
      }
      return out;
    },
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
     * it is complete (index.ts calls again on the next frames); with nothing on show yet it is painted at once.
     */
    scene(id, U) {
      const v = views.get(id);
      if (!v || !v.ridges) return true;
      v.shift = U.horizon ? Math.round((U.hzShift || 0) * v.h) : 0;
      if (U.draft) {
        v.job = null;
        paintAll(v as Painted, v.dc, v.draft.width, v.draft.height, U, true);
        v.shown = v.draft;
        return true;
      }
      if (v.shown !== v.draft) {
        v.job = null;
        paintAll(v as Painted, v.fc, v.w, v.h, U, false);
        v.shown = v.full;
        return true;
      }
      if (!v.job || v.job.gen !== v.gen) {
        v.job = { next: 0, gen: v.gen };
        ground(v.kc, U, v.w, v.h);
      }
      step(v as Painted, v.job.next, U, v.kc, v.w, v.h, false);
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
      if (hz && hz.shown && U.horizon!.k > 0) {
        ctx.globalAlpha = U.horizon!.k * 0.7;
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
      // 4b: the living ground's depth layers at their sinks (drawImage offsets), the haze deck and the sea of mist
      if (U.stage) stage(U);
      // the windows at their live boxes, feathered into the paper at top and bottom
      for (const w of U.windows || []) {
        const v = views.get(w.id);
        if (!v || !v.shown) continue;
        const x0 = w.rect[0] * W, x1 = w.rect[2] * W;
        const y0 = (1 - w.rect[3]) * H, y1 = (1 - w.rect[1]) * H;
        const a = w.feather[3] >= 1 ? 1 : clamp01(w.feather[3]);
        ctx.globalAlpha = a;
        ctx.imageSmoothingEnabled = true;
        // (the painting may sink inside its box: drawn lower, clipped to the box, with paper above its own top and its top
        // feather sunk with it; round 3: the box's top row used to be repeated above it, a wall of grey columns on phones)
        const sk = Math.max(0, Math.min(1, w.sink || 0)) * (y1 - y0);
        if (sk <= 0.5) ctx.drawImage(v.shown, 0, 0, v.shown.width, v.shown.height, x0, y0, x1 - x0, y1 - y0);
        ctx.globalAlpha = 1;
        if (sk > 0.5) {
          ctx.save();
          ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
          ctx.globalAlpha = a;
          ctx.drawImage(v.shown, 0, 0, v.shown.width, v.shown.height, x0, y0 + sk, x1 - x0, y1 - y0);
          ctx.globalAlpha = 1;
          ctx.restore();
        }
        const bh = y1 - y0;
        const ft = w.feather[0] * bh, fb = w.feather[1] * bh;
        const tk = sk > 0.5 ? sk : 0;
        if (tk > 0) { ctx.fillStyle = rgba(PAPER); ctx.fillRect(x0, y0, x1 - x0, Math.min(tk, bh)); }
        if (ft > 1 && tk < bh) { const g = ctx.createLinearGradient(0, y0 + tk, 0, y0 + tk + ft); g.addColorStop(0, rgba(PAPER, 1)); g.addColorStop(1, rgba(PAPER, 0)); ctx.fillStyle = g; ctx.fillRect(x0, y0 + tk, x1 - x0, Math.min(ft, bh - tk)); }
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
   * 4b: the living ground. The far layer (opaque, at its own resolution) at its sink, its sky row repeated above it; a
   * pale haze deck; the middle and near layers (transparent, each over its crop) at theirs; the cloud (mid-lift) and the
   * sea of mist rising over their feet. The deck's, the cloud's and the sea's surfaces billow (a baked edge, never a
   * ruled line). No drift here: Canvas2D is a still painting that only moves with the scroll.
   */
  function stage(U: PresentU) {
    const S = U.stage!;   // (present() calls it with a stage)
    const O = S.offsets, R = S.rects;
    ctx.imageSmoothingEnabled = true;
    for (let i = 0; i < 3; i++) {
      const v = views.get(S.ids[i]);
      const a = O[i * 4 + 2];
      if (!v || !v.shown || !(a > 0)) continue;
      const sw = v.shown.width, sh = v.shown.height;
      const dx = O[i * 4] * W, dy = O[i * 4 + 1] * H;
      // the crop (uv, y up) in canvas px
      const x0 = R[i * 4] * W, x1 = R[i * 4 + 2] * W, y0 = (1 - R[i * 4 + 3]) * H, y1 = (1 - R[i * 4 + 1]) * H;
      if (i === 0) {
        if (dy > 0.5) ctx.drawImage(v.shown, 0, 0, sw, 1, dx, 0, W, dy + 1);
        if (dx > 0.5) ctx.drawImage(v.shown, 0, 0, 1, sh, 0, 0, dx + 1, H);
      }
      // (the middle and near layers fade out as the cloud thickens: a baked bank's billows dip below its top line, and
      // the town must never show above them while it steps inside)
      ctx.globalAlpha = i > 0 && S.cloud ? a * (1 - clamp01(S.cloud[0])) : a;
      let img = v.shown;
      if (i > 0 && S.curt && S.curt[1] >= 0.5 && x1 > x0) {
        // the curtain (Canvas2D: on or off, never half): the layer fades out left of its edge (a soft ramp, cached)
        const e = (S.curt[0] * W - dx - x0) / (x1 - x0) * sw, w = (S.curt[2] * W) / (x1 - x0) * sw;
        img = curtained(i, v, e - w, e + w * 0.15);
      }
      ctx.drawImage(img, 0, 0, sw, sh, dx + x0, dy + y0, x1 - x0, y1 - y0);
      ctx.globalAlpha = 1;
      if (i === 0 && S.k[3] > 0) {
        // the haze deck between far and middle (uv y up: the deck's height from the bottom), its top billowing
        const y = (1 - S.sea[2]) * H, soft = S.sea[1] * H;
        bank(y - soft * 0.7, soft * 2.3, mix(MIST, SKY, 0.35), 0.82 * S.k[3], 1);
      }
    }
    if (S.cloud && S.cloud[0] > 0) {
      // the mid-lift cloud (the shader's): reserved-paper billows with a soft grey wash laid just above each top (a
      // toned bank drawn a little higher first, the pale one over it), a nearer billow lower down the same way
      const y = (1 - S.cloud[1]) * H, soft = S.cloud[2] * H, k = S.cloud[0];
      const tone = [194, 204, 201], pale = mix(MIST, SKY, 0.5);
      bank(y - soft * 0.4 - 0.08 * H, soft * 1.4, tone, 0.42 * k, 2);
      bank(y - soft * 0.4 - 0.03 * H, soft * 1.4, pale, 0.97 * k, 2);
      bank(y + 0.13 * H - 0.05 * H, soft * 1.4, tone, 0.36 * k, 5);
      bank(y + 0.13 * H, soft * 1.4, pale, 0.9 * k, 5);
    }
    if (S.k[2] > 0) {
      const y = (1 - S.sea[0]) * H, soft = S.sea[1] * H;
      bank(y - soft * 0.45, soft * 1.45, mix(MIST, SKY, 0.25), S.k[2], 3);
      // deeper down the sea is paper
      const d0 = y + soft, g = ctx.createLinearGradient(0, d0, 0, d0 + 0.2 * H);
      g.addColorStop(0, rgba(mix(PAPER, SKY, 0.3), 0));
      g.addColorStop(1, rgba(mix(PAPER, SKY, 0.3), S.k[2]));
      ctx.fillStyle = g;
      ctx.fillRect(0, d0, W, H - d0);
    }
  }
  function curtained(i: number, v: View, e0: number, e1: number) {
    const img = v.shown!;   // (stage() calls it for a layer on show)
    const key = `${Math.round(e0)}|${Math.round(e1)}|${img.width}x${img.height}|${v.gen}`;
    const c = curtC.get(i);
    if (c && c.src === img && c.key === key) return c.cv;
    const cv = c?.cv || document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const x = cv.getContext('2d', { willReadFrequently: true })!;   // (CPU-backed, as every canvas here)
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'destination-out';
    const g = x.createLinearGradient(e0, 0, e1, 0);
    for (let k = 0; k <= 6; k++) { const t = k / 6; g.addColorStop(t, `rgba(0,0,0,${(1 - t * t * (3 - 2 * t)).toFixed(3)})`); }
    x.fillStyle = g;
    x.fillRect(0, 0, cv.width, cv.height);
    x.globalCompositeOperation = 'source-over';
    curtC.set(i, { src: img, key, cv });
    return cv;
  }
  // A bank of mist from `top` down (solid below top + depth), its upper surface billowing: a sprite baked once per
  // (size, colour, seed) with a noisy alpha edge, then a solid fill below it (`banks`, above).
  function bank(top: number, depth: number, c: number[], k: number, seed: number) {
    if (!(k > 0)) return;
    const d = Math.max(4, Math.round(depth));
    const key = `${W}|${d}|${c.map(Math.round).join(',')}|${seed}`;
    let sp = banks.get(key);
    if (!sp) {
      if (banks.size > 8) banks.clear();
      const amp = d * 0.55;
      const h = Math.round(d + amp * 2);
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = h;
      const x = cv.getContext('2d', { willReadFrequently: true })!;   // (CPU-backed, as every canvas here)
      const img = x.createImageData(W, h);
      for (let i = 0; i < W; i++) {
        const u = (i / Math.max(1, H)) * 3.1 + seed * 7.3;
        const off = (vnoise(u, seed * 3.1) - 0.5) * 2 * amp + (vnoise(u * 3.7, seed + 9.2) - 0.5) * amp * 0.5;
        for (let j = 0; j < h; j++) {
          const t = sstep(amp + off, amp + off + d, j);
          const o = (j * W + i) * 4;
          img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = Math.round(t * 255);
        }
      }
      x.putImageData(img, 0, 0);
      sp = { cv, amp, h };
      banks.set(key, sp);
    }
    ctx.globalAlpha = k;
    ctx.drawImage(sp.cv, 0, top - sp.amp);
    ctx.fillStyle = rgba(c);
    const below = top - sp.amp + sp.h;
    if (below < H) ctx.fillRect(0, below, W, H - below);
    ctx.globalAlpha = 1;
  }

  /**
   * The reading veil's mask (alpha = how much paper lies over the landscape), the shader's formula per pixel: each
   * rect's distance (aspect-corrected), feathered over its radius and torn by the mist field. Returns false when
   * there is no veil. Recomputed only when the rects or the size change.
   */
  function veilMask(U: PresentU) {
    const list: VeilRect[] = [];
    // 4b living veils (U.live[0] 2): solid paper over the text's own lines and U.live[1] round them, then a torn edge
    // (wk, the margin's reach, is set just below)
    const live = U.live && U.live[0] > 1.5
      ? { c: U.live[1], F: U.live[2], y: U.live2 ? U.live2[0] : 0, sw: U.live2 ? U.live2[2] : 0, px: U.live2 ? U.live2[3] : 1 / 900 } as { c: number; F: number; y: number; sw: number; px: number; wk: number } : null;
    // (round 3, as the shader: a wide window's longer reach applies beside a block only)
    if (live) live.wk = Math.min(1.8, Math.max(1, U.aspect / live.px / 1440));
    for (let k = 0; k < U.veilS.length; k++) {
      const x0 = U.veil[k * 4];
      if (x0 < -0.5 || !(U.veilS[k] > 0)) continue;
      const R = U.veilR * (U.veilF ? U.veilF[k] : 1);
      const fr = R / 0.13;
      const fk = U.veilF ? U.veilF[k] : 1;
      list.push({
        x0, y0: U.veil[k * 4 + 1], x1: U.veil[k * 4 + 2], y1: U.veil[k * 4 + 3], s: U.veilS[k],
        R, fr, fk, reach: live ? (live.c * 0.8 + (live.F * 1.9 + live.sw * 1.3) * live.wk) * fk : R + 0.03 * fr, t0: U.live && U.live[0] > 0.5 ? 0 : clamp01((1 - U.veilS[k]) / 0.28),
      });
    }
    if (!list.length) return false;
    const key = `${VW}x${VH} ${U.aspect.toFixed(4)} ${live ? 'L' + live.y.toFixed(4) : ''}` +
      list.map((v) => [v.x0, v.y0, v.x1, v.y1, v.s, v.R].map((n) => n.toFixed(4)).join(',')).join(' ');
    if (key === veilKey) return true;
    veilKey = key;
    const d = veilImg!.data;   // (made by resize(), before any present)
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
          let val: number;
          if (live) {
            // (the shader's living edge: tongues of mist ~100 px tall down a column's side, anchored to the page, linear in
            // the field above a soft floor; the feather keeps its full width and runs out further where the margin has
            // room; no painting is read here, so its ramp takes the middle of the shader's ink range)
            const yq = v - live.y;
            // (round 3, as the shader: the margin factor is continuous across the box's corners, and along a top or bottom
            // edge the tongues turn into billows that vary along the edge, so a summit under it never meets a ruler)
            const side = sstep(0.25, 0.75, qx / Math.max(qx + qy, 1e-6));
            const ws = 1 + (live.wk - 1) * side;
            const c = live.c * L.fk, F = Math.min(live.F * ws, U.veilR) * L.fk;
            let sw = 0;
            if (side > 0.001) {
              const t = (vnoise(u * asp * 2.0 + 3.1, yq * 9.0 + 1.3) - 0.5) * 2.4 + (vnoise(u * asp * 3.4 + 7.7, yq * 15.0 + 5.2) - 0.5) * 1.0;
              sw += side * Math.min(1.3, -0.1 + 0.15 * Math.log(1 + Math.exp((0.3 + 0.85 * t + 0.1) / 0.15)));
            }
            if (side < 0.999) {
              const t = (vnoise(u * asp * 3.6 + 5.3, yq * 1.8 + 2.9) - 0.5) * 2.6 + (vnoise(u * asp * 7.6 + 1.7, yq * 3.2 + 8.1) - 0.5) * 1.15;
              sw += (1 - side) * 0.8 * Math.min(1.3, -0.1 + 0.15 * Math.log(1 + Math.exp((0.3 + 0.85 * t + 0.1) / 0.15)));
            }
            const inb = Math.max(0, Math.min(u - L.x0, L.x1 - u));
            const room = ((L.x0 + (1 - L.x1 - L.x0) * sstep(L.x0, L.x1, u)) + inb) * asp / live.px;
            const kr = 0.35 + 0.65 * sstep(240, 420, room);
            const B = c * 0.8 + F * 0.5 + sw * live.sw * ws * L.fk * kr;
            const tear = (m - 0.5) * F * 1.8 * sstep(c, c + F * 0.5, vd);
            val = L.s * Math.max(1 - sstep(c * 0.8 - 8 * live.px, c * 0.8, vd), 1 - sstep(B - F * 0.5, B + F * (0.5 + (0.58 - 0.13 * side) * kr), vd + tear));
          }
          else {
            const tear = L.t0 + (1 - L.t0) * sstep(0, 0.02 * L.fr, vd);
            val = L.s * (1 - sstep(0, L.R, vd + (m - 0.5) * 0.06 * L.fr * tear));
          }
          if (val > a) a = val;
        }
        d[(j * VW + i) * 4 + 3] = Math.round(a * 255);
      }
    }
    vc.putImageData(veilImg!, 0, 0);
    return true;
  }
}
