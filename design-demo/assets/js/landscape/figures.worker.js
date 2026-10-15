// figures.worker.js — draws a figure layer off the main thread (SPEC-R4A §7.6, §12.5): an OffscreenCanvas at the
// layer's size, the brushwork of figures.js, then either premultiplied RGBA bytes (the WebGL path uploads them as a
// mipmapped texture) or an ImageBitmap (the Canvas2D fallback draws it). Transferred, never copied. One message in,
// one message out: { id, width, height, data | bitmap, ms } or { id, error }.

import { drawFigures, layerSize, premultiply } from './figures.js';

self.onmessage = (e) => {
  const p = e.data || {};
  try {
    const t0 = performance.now();
    const { width, height } = layerSize(p.stretch, p.scale, p.dpr);
    if (!width || !height) throw new Error('no figure layer for this stretch');
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d', { willReadFrequently: p.out !== 'bitmap' });
    if (!ctx) throw new Error('no 2d context in the worker');
    drawFigures(ctx, p);
    if (p.out === 'bitmap') {
      const bitmap = canvas.transferToImageBitmap();
      self.postMessage({ id: p.id, width, height, bitmap, ms: performance.now() - t0 }, [bitmap]);
    } else {
      const img = ctx.getImageData(0, 0, width, height);
      premultiply(img.data);
      self.postMessage({ id: p.id, width, height, data: img.data, ms: performance.now() - t0 }, [img.data.buffer]);
    }
  } catch (err) {
    self.postMessage({ id: p.id, error: String((err && err.message) || err) });
  }
};
