// figure-source.js: where figure layers are drawn (main thread only; the engine, index.js, is its one user).
// A module worker (figures.worker.js) with OffscreenCanvas where the browser has both, else idle chunks here.
// Kept apart from figures.js (the drawing kit, which the worker imports): a module that both spawns the worker and is
// part of the worker's own graph makes the worker's bundle reference itself, which a production Turbopack build never
// finishes resolving.

import { layerSize, paintSteps, premultiply } from './figures.js';

/**
 * Where figure layers are drawn: a module worker with OffscreenCanvas when the browser has both (Safari 16.4+), else
 * the main thread in idle chunks of <= 8 ms. request() resolves to { width, height, data (premultiplied RGBA bytes,
 * top row first) | bitmap, sprites? (out 'gpu': the boats cut out of it), ms, life (the layer's life anchors) }.
 */
export function createFigureSource() {
  let worker = null, broken = false, seq = 0, dead = false;
  const pending = new Map();
  const canWorker = typeof Worker === 'function' && typeof OffscreenCanvas === 'function';
  function ensure() {
    if (worker || broken || !canWorker) return worker;
    try {
      worker = new Worker(new URL('./figures.worker.js', import.meta.url), { type: 'module', name: 'figures' });
      worker.onmessage = (e) => {
        const p = pending.get(e.data?.id);
        if (!p) return;
        pending.delete(e.data.id);
        if (e.data.error) p.fallback(); else p.resolve(e.data);
      };
      worker.onerror = (e) => {
        e.preventDefault?.();
        broken = true;
        try { worker.terminate(); } catch { /* ignore */ }
        worker = null;
        const all = [...pending.values()];
        pending.clear();
        all.forEach((p) => p.fallback());
      };
    } catch { broken = true; worker = null; }
    return worker;
  }
  function request(params) {
    return new Promise((resolve, reject) => {
      if (dead) { reject(new Error('destroyed')); return; }
      const id = ++seq;
      const fallback = () => { if (!dead) idleDraw(params).then(resolve, reject); };
      const w = ensure();
      if (!w) { fallback(); return; }
      pending.set(id, { resolve, reject, fallback });
      w.postMessage({ id, ...params });
    });
  }
  return {
    request,
    destroy() {
      dead = true;
      try { worker?.terminate(); } catch { /* ignore */ }
      worker = null;
      pending.clear();
    },
  };
}

// The main-thread fallback: the same steps, run in idle time, at most ~8 ms at a go.
function idleDraw(p) {
  return new Promise((resolve, reject) => {
    const { width, height } = layerSize(p.stretch, p.scale, p.dpr);
    let canvas;
    try {
      canvas = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(width, height) : Object.assign(document.createElement('canvas'), { width, height });
    } catch (err) { reject(err); return; }
    // (always CPU-backed here: 'bytes' and 'gpu' are read back below, and 'bitmap' is drawn into Canvas2D's own CPU-backed
    // canvases, where a GPU-backed one is read back on its first draw: see figures.worker.js)
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) { reject(new Error('no 2d context')); return; }
    const steps = paintSteps(ctx, p);
    let ms = 0;
    const ric = typeof requestIdleCallback === 'function' ? requestIdleCallback : (f) => setTimeout(() => f({ timeRemaining: () => 8 }), 16);
    const run = (deadline) => {
      const t0 = performance.now();
      const budget = Math.min(8, Math.max(2, deadline?.timeRemaining?.() ?? 8));
      try {
        while (performance.now() - t0 < budget) {
          const step = steps.next();
          if (step.done) {
            ms += performance.now() - t0;
            const life = step.value || [];
            if (p.out === 'bitmap') resolve({ width, height, bitmap: canvas, ms, life });
            else {
              const img = ctx.getImageData(0, 0, width, height);
              resolve({ width, height, data: premultiply(img.data), ms, life });
            }
            return;
          }
        }
      } catch (err) { reject(err); return; }
      ms += performance.now() - t0;
      ric(run, { timeout: 300 });
    };
    ric(run, { timeout: 300 });
  });
}
