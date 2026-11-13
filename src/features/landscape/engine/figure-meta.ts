// figure-meta.ts — the figure sets' metas, the part of the sets the main thread needs: each set's world rectangle
// [u0, u1, y0, y1] (stretches and scene heights), plane and phase (figures.ts THE SET API). The engine reads them
// to key and place a layer (index.ts figureMeta); the DRAWING code (figures.ts's brush kit and sets/*.ts, with
// layerSize) is the worker's (figures.worker.ts), so it never travels in the engine's own chunk; the main-thread
// fallback loads it on demand (figure-source.ts idleDraw). Each value is its set's own `meta`, written the same way
// (K + x, so the floating point is the same); tests/unit/figure-meta.test.ts keeps the two equal. No imports: this
// module is also in the page's own bundle (figure-source.ts warms the worker before the engine arrives).

/** A set's meta (THE SET API): the world rectangle [u0, u1, y0, y1] its layer covers, its plane and phase. */
export interface FigureMeta {
  rect: [u0: number, u1: number, y0: number, y1: number];
  plane: number;
  phase: 0 | 1;
}

/** Per stretch (Home 0, Work 1, Writing 2, Résumé 3, Contact 4, the 404 5): the set's meta (sets/<name>.ts). */
export const METAS: Readonly<Record<number, FigureMeta>> = {
  0: { rect: [0.5, 1.1, 0.06, 0.87], plane: 3, phase: 1 }, // home
  1: { rect: [1.0, 2.12, 0.1, 0.95], plane: 2, phase: 1 }, // market
  2: { rect: [2 + 0.78, 2 + 1.22, 0.1, 0.7], plane: 2, phase: 1 }, // pavilion
  3: { rect: [3 + 0.16, 3 + 1, 0.2, 0.6], plane: 2, phase: 0 }, // terraces
  4: { rect: [4 + 0.5, 4 + 1.06, 0.1, 0.6], plane: 2, phase: 1 }, // ferry
  5: { rect: [5 + 0.6, 5 + 1.1, 0.12, 0.54], plane: 2, phase: 0 }, // path
};

/** The figure layer of a stretch: { rect: [u0, u1, y0, y1], plane, phase } or null (no figures there). */
export function figureMeta(stretch: number): FigureMeta | null {
  const m = METAS[Math.round(Number(stretch))];
  return m ? { rect: m.rect.slice() as FigureMeta['rect'], plane: m.plane, phase: m.phase } : null;
}
