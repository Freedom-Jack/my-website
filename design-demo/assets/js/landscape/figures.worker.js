// figures.worker.js — draws a figure layer off the main thread (SPEC-R4A §7.6, §12.5): an OffscreenCanvas at the
// layer's size, the brushwork of figures.js (whose figure sets, sets/*.js, load with it), then one of:
//   out 'gpu'     (WebGL, 4b) an ImageBitmap of the layer (transferToImageBitmap: no readback; gl.js uploads it
//                 premultiplied), with its drifting sprites cut out of it: a life anchor marked params.sprite (Work's
//                 punt) is copied into its own small bitmap and cleared from the layer, so the present pass can move it
//                 and its static copy never ghosts. The anchor gets `cut`: the sprite's box in layer uv (u0, v0, u1, v1).
//   out 'bitmap'  (Canvas2D) an ImageBitmap of the layer as drawn: nothing is cut (Canvas2D is still; the boat stays)
//   out 'bytes'   premultiplied RGBA bytes (the 4a WebGL path, kept for callers that read the bytes)
// Transferred, never copied. One message in, one message out: { id, width, height, data | bitmap, sprites?, ms, life }
// or { id, error }. `life` is the layer's life anchors (figures.js, THE LIFE API); `sprites` [{ width, height, bitmap }]
// in the order of the anchors that carry `cut` (each anchor's `sprite` is its index here).

import { drawFigures, layerSize, premultiply } from './figures.js';

const PAD = 4;   // layer px of clear border round a sprite (its anti-aliased edge, and room for the bleed halo's mips)

function cutSprites(canvas, ctx, life, width, height) {
  const sprites = [];
  for (const a of life) {
    if (a.kind !== 'boat' || !a.params?.sprite || !Array.isArray(a.uv)) continue;
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
    a.cut = [x0 / width, y0 / height, x1 / width, y1 / height];
    a.sprite = sprites.length;
    sprites.push({ width: x1 - x0, height: y1 - y0, bitmap: sc.transferToImageBitmap() });
  }
  return sprites;
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
    const life = drawFigures(ctx, p);
    if (p.out === 'gpu') {
      const sprites = cutSprites(canvas, ctx, life, width, height);
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
