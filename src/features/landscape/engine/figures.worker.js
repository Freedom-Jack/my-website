// figures.worker.js — draws a figure layer off the main thread (SPEC-R4A §7.6, §12.5): an OffscreenCanvas at the
// layer's size, the brushwork of figures.js (whose figure sets, sets/*.js, load with it), then one of:
//   out 'gpu'     (WebGL, 4b) an ImageBitmap of the layer (transferToImageBitmap: no readback; gl.js uploads it
//                 premultiplied), with its moving things apart in one sprite atlas (buildSprites): a boat marked
//                 params.sprite (Work's punt) is cut out of the layer, a set's own sprite (the bridge's walker, the
//                 ferry) is painted on its own, so the present pass can move them and no static copy ever ghosts.
//   out 'bitmap'  (Canvas2D) an ImageBitmap of the layer as drawn: nothing is cut (Canvas2D is still; the boat stays)
//   out 'bytes'   premultiplied RGBA bytes (the 4a WebGL path, kept for callers that read the bytes)
// Transferred, never copied. One message in, one message out: { id, width, height, data | bitmap, sprites?, ms, life }
// or { id, error }. `life` is the layer's life anchors (figures.js, THE LIFE API); `sprites` [{ width, height, bitmap }]
// in the order of the anchors that carry `cut` (each anchor's `sprite` is its index here).

import { drawFigures, layerSize, premultiply, registerSets } from './figures.js';
import { SETS } from './sets/index.js';

registerSets(SETS);

const PAD = 4;      // layer px of clear border round a sprite (its anti-aliased edge, and room for the bleed halo's mips)
const GAP = 24;     // atlas px between two sprites, so a coarse mip of one never bleeds into its neighbour

// The layer's moving things, as ONE sprite atlas (a row of sprites; WebGL keeps one sampler for them all):
//  - a boat with params.sprite true is CUT out of the layer (its box holds the boat and nothing else);
//  - a set's own sprite (ownSprite: the bridge's walker, the moored ferry) is PAINTED on a canvas of its own, never
//    into the layer, then cropped to its ink.
// Each gets cut (its box in layer uv), sprite 0, atlas [u0, u1, v1] (its place in the atlas) and spx (texels).
function buildSprites(canvas, ctx, life, width, height, own) {
  const parts = [];   // { a, src, sx, sy, w, h, x0, y0 } (layer px)
  for (const a of life) {
    if (a.kind !== 'boat' || a.params?.sprite !== true || !Array.isArray(a.uv)) continue;
    const x0 = Math.max(0, Math.floor(a.uv[0] * width) - PAD), y0 = Math.max(0, Math.floor(a.uv[1] * height) - PAD);
    const x1 = Math.min(width, Math.ceil(a.uv[2] * width) + PAD), y1 = Math.min(height, Math.ceil(a.uv[3] * height) + PAD);
    if (x1 - x0 < 2 || y1 - y0 < 2) continue;
    const sc = new OffscreenCanvas(x1 - x0, y1 - y0);
    const sx = sc.getContext('2d');
    if (!sx) continue;
    sx.drawImage(canvas, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
    parts.push({ a, src: sc, sx: 0, sy: 0, w: x1 - x0, h: y1 - y0, x0, y0 });
  }
  for (const o of own) {
    const a = life[o.i];
    if (!a) continue;
    // the hint box in layer px, clipped to the layer
    const bx0 = Math.max(0, Math.floor(o.box.x * o.k + o.ox)), by0 = Math.max(0, Math.floor(o.box.y * o.k + o.oy));
    const bx1 = Math.min(width, Math.ceil((o.box.x + o.box.w) * o.k + o.ox)), by1 = Math.min(height, Math.ceil((o.box.y + o.box.h) * o.k + o.oy));
    if (bx1 - bx0 < 2 || by1 - by0 < 2) continue;
    const sc = new OffscreenCanvas(bx1 - bx0, by1 - by0);
    const sx = sc.getContext('2d', { willReadFrequently: true });
    if (!sx) continue;
    sx.setTransform(o.k, 0, 0, o.k, o.ox - bx0, o.oy - by0);
    sx.lineCap = 'round';
    sx.lineJoin = 'round';
    o.paint({ ...o.env, ctx: sx });
    // crop to the ink (alpha > 0), plus the clear border
    const d = sx.getImageData(0, 0, bx1 - bx0, by1 - by0).data;
    let cx0 = Infinity, cy0 = Infinity, cx1 = -1, cy1 = -1;
    for (let y = 0, i = 3; y < by1 - by0; y++) for (let x = 0; x < bx1 - bx0; x++, i += 4) {
      if (d[i] === 0) continue;
      if (x < cx0) cx0 = x; if (x > cx1) cx1 = x; if (y < cy0) cy0 = y; if (y > cy1) cy1 = y;
    }
    if (cx1 < 0) continue;
    const sx0 = Math.max(0, cx0 - PAD), sy0 = Math.max(0, cy0 - PAD);
    const sx1 = Math.min(bx1 - bx0, cx1 + 1 + PAD), sy1 = Math.min(by1 - by0, cy1 + 1 + PAD);
    parts.push({ a, src: sc, sx: sx0, sy: sy0, w: sx1 - sx0, h: sy1 - sy0, x0: bx0 + sx0, y0: by0 + sy0 });
  }
  if (!parts.length) return [];
  const aw = parts.reduce((n, q) => n + q.w, 0) + GAP * (parts.length - 1);
  const ah = Math.max(...parts.map((q) => q.h));
  const atlas = new OffscreenCanvas(Math.min(4096, aw), ah);
  const ax = atlas.getContext('2d');
  if (!ax) return [];
  let at = 0;
  for (const q of parts) {
    if (at + q.w > atlas.width) break;
    ax.drawImage(q.src, q.sx, q.sy, q.w, q.h, at, 0, q.w, q.h);
    const a = q.a;
    a.cut = [q.x0 / width, q.y0 / height, (q.x0 + q.w) / width, (q.y0 + q.h) / height];
    a.sprite = 0;
    a.atlas = [at / atlas.width, (at + q.w) / atlas.width, q.h / atlas.height];
    a.spx = [q.w, q.h];
    at += q.w + GAP;
  }
  return [{ width: atlas.width, height: atlas.height, bitmap: atlas.transferToImageBitmap() }];
}

self.onmessage = (e) => {
  const p = e.data || {};
  try {
    const t0 = performance.now();
    const { width, height } = layerSize(p.stretch, p.scale, p.dpr);
    if (!width || !height) throw new Error('no figure layer for this stretch');
    const canvas = new OffscreenCanvas(width, height);
    // CPU-backed for every consumer but WebGL's ImageBitmap path: 'bytes' reads the pixels back, and 'bitmap' is drawn
    // into Canvas2D's own canvases, which are all CPU-backed (canvas2d.js createCanvas2D): a GPU-backed bitmap there is
    // read back on its first draw, a multi-second raster flush on load in the fallback (final review r1, item 7)
    const ctx = canvas.getContext('2d', { willReadFrequently: p.out !== 'gpu' });
    if (!ctx) throw new Error('no 2d context in the worker');
    const own = p.out === 'gpu' ? [] : null;   // the set's own sprites: painted apart (buildSprites), not into the layer
    const life = drawFigures(ctx, p, own);
    if (p.out === 'gpu') {
      const sprites = buildSprites(canvas, ctx, life, width, height, own);
      const bitmap = canvas.transferToImageBitmap();
      self.postMessage({ id: p.id, width, height, bitmap, sprites, ms: performance.now() - t0, life }, [bitmap, ...sprites.map((s) => s.bitmap)]);
    } else if (p.out === 'bitmap') {
      const bitmap = canvas.transferToImageBitmap();
      self.postMessage({ id: p.id, width, height, bitmap, ms: performance.now() - t0, life }, [bitmap]);
    } else {
      const img = ctx.getImageData(0, 0, width, height);
      premultiply(img.data);
      self.postMessage({ id: p.id, width, height, data: img.data, ms: performance.now() - t0, life }, [img.data.buffer]);
    }
  } catch (err) {
    self.postMessage({ id: p.id, error: String((err && err.message) || err) });
  }
};
