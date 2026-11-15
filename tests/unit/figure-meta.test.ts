// The figure sets' metas as the main thread keeps them (engine/figure-meta.ts, the engine's chunk) equal the sets'
// own (sets/*.ts, the worker's chunk): a set moved or resized without its line in figure-meta.ts would be placed by
// the old rectangle.
import { describe, expect, it } from 'vitest';
import { METAS, figureMeta } from '@/features/landscape/engine/figure-meta';
import { layerSize } from '@/features/landscape/engine/figures';
import { SETS } from '@/features/landscape/engine/sets';

describe('the figure sets’ metas', () => {
  it('match each set’s own meta, value for value', () => {
    expect(SETS.length).toBe(Object.keys(METAS).length);
    for (const { stretch, name, module } of SETS) {
      expect(METAS[stretch], `${name} (stretch ${stretch})`).toEqual(module.meta);
      expect(figureMeta(stretch), name).toEqual(module.meta);
    }
  });
  it('size a layer as the set’s rectangle says', () => {
    const { width, height } = layerSize(0, 1440, 2);
    const [u0, u1, y0, y1] = SETS[0]!.module.meta!.rect;
    expect(width).toBe(Math.round((u1 - u0) * 1440 * 2));
    expect(height).toBe(Math.round((y1 - y0) * (1440 / 1.6) * 2));
    expect(layerSize(9, 1440, 2)).toEqual({ width: 0, height: 0 });
  });
});
