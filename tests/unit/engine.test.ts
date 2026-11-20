import { describe, expect, it } from 'vitest';
// The landscape engine's pure parts (no DOM, no GPU): where each place stands, how the band frames it, the palette.
import {
  cameraFor,
  framingAt,
  framingBlend,
  sceneName,
  sceneField,
  SCENES,
  SCENE_FIELDS,
  widthClass,
  STRETCH_COUNT,
  HERO,
  WORLD,
  resolve,
  spec,
} from '@/features/landscape/engine/compose';
import { PALETTES, paletteName, pigmentAt } from '@/features/landscape/engine/palette';
import { BAND } from '@/features/landscape/band';

/** The band's box on the wide class's stage (features/landscape/band.ts): what every page's hero is framed in. */
const BOX = { width: BAND.ref[0], height: BAND.ref[0] * BAND.ratio };

describe('the landscape engine, pure parts', () => {
  it('names each stretch of the one handscroll', () => {
    // one place per stretch, in the nav's order, then the 404's lone peak
    expect([0, 1, 2, 3, 4, 5].map((k) => sceneName(k))).toEqual([
      'peak',
      'river',
      'lake',
      'shore',
      'crossing',
      'lone-peak',
    ]);
    expect(STRETCH_COUNT).toBe(6);
    expect(SCENES.length).toBe(6);
  });
  it('classes widths as the CSS breakpoints do', () => {
    expect(widthClass(1440, 900)).toBe('wide');
    expect(widthClass(1024, 768)).toBe('tablet');
    expect(widthClass(390, 844)).toBe('phone');
    expect(widthClass(844, 390)).toBe('short');
  });
  it('frames the band deterministically (the same inputs, the same framing)', () => {
    const a = framingAt(0, 'wide', BOX);
    const b = framingAt(0, 'wide', BOX);
    expect(a).toEqual(b);
    expect(Number.isFinite(a.scale)).toBe(true);
    expect(a.scale).toBeGreaterThan(0);
  });
  it('frames every inner hero the same way: one horizon, one scale, the focus at one place', () => {
    for (const [cls, width, height] of [
      ['wide', 1440, 360],
      ['wide', 1280, 300],
      ['tablet', 1024, 220],
      ['phone', 390, 169],
    ] as const) {
      const fr = [1, 2, 3, 4, 5].map((k) => framingAt(k, cls, { width, height }));
      for (const f of fr) {
        expect(f.worldTop, `${cls} ${width}`).toBeCloseTo(fr[0]!.worldTop, 6);
        expect(f.scale, `${cls} ${width}`).toBe(fr[0]!.scale);
        // the shared horizon (the river's waterline) HERO.at down the box
        expect(((f.worldTop - HERO.horizon) * f.scale) / 1.6 / height).toBeCloseTo(HERO.at, 6);
      }
    }
  });
  it('opens a deep page inside its place: closer by HERO.inside, on the same horizon, east of the landmark', () => {
    for (const [k, u] of [
      [1, 0.72],
      [2, 0.84],
    ] as const) {
      const hero = framingAt(k, 'wide', BOX);
      const inside = framingAt(k, 'wide', { ...BOX, inside: true });
      expect(inside.scale).toBeCloseTo(hero.scale * HERO.inside, 6);
      expect(inside.nominal).toBe(hero.nominal); // (its figure layer is the place's own)
      // the shared horizon at the same height down the box
      expect(((inside.worldTop - HERO.horizon) * inside.scale) / 1.6 / BOX.height).toBeCloseTo(HERO.at, 6);
      // its focus column holds the scene's inner focus, east of the hero's
      expect(inside.worldLeft + (HERO.fx.wide * BOX.width) / inside.scale).toBeCloseTo(k + u, 6);
      expect(inside.worldLeft).toBeGreaterThan(hero.worldLeft);
      // a page's own sub-anchor instead (insideU)
      const own = framingAt(k, 'wide', { ...BOX, inside: true, insideU: 0.5 });
      expect(own.worldLeft + (HERO.fx.wide * BOX.width) / own.scale).toBeCloseTo(k + 0.5, 6);
    }
    // a phone's case: the bridge (its east end at u 1.655) out of view to the west, the quay and the boats whole
    const ph = framingAt(1, 'phone', { width: 390, height: 168.8, inside: true });
    expect(ph.worldLeft).toBeGreaterThan(1.655);
    expect(ph.worldLeft + 390 / ph.scale).toBeGreaterThan(1.93);
    // Home keeps its own hero: the flag changes nothing there
    expect(framingAt(0, 'wide', { ...BOX, inside: true })).toEqual(framingAt(0, 'wide', BOX));
  });
  it('finds the camera position that brings a part of a place to the focus column (the sub-anchors)', () => {
    const box = BOX;
    for (const [k, u] of [
      [1, 0.9],
      [1, 0.3],
      [3, 0.7],
      [2, 0.95],
    ] as const) {
      const s = cameraFor(k, u, 'wide', box);
      const f = framingBlend(s, 'wide', box, 'strip');
      expect(f.worldLeft + (HERO.fx.wide * box.width) / f.scale).toBeCloseTo(k + u, 3);
    }
    // the hero's own focus is its own camera (to the solver's tolerance)
    expect(cameraFor(3, 0.65, 'wide', box)).toBeCloseTo(3, 3);
    // clamped to the scroll
    expect(cameraFor(0, -2, 'wide', box)).toBe(0);
    expect(cameraFor(5, 3, 'wide', box)).toBe(5);
  });
  it('paints the scroll with one composition, and one river that never breaks', () => {
    expect(SCENES.every((s) => s.page[0] === WORLD[0] && s.page[1] === WORLD[1])).toBe(true);
    const P = resolve(spec(...WORLD), 1.6);
    const f = new Float32Array(SCENE_FIELDS);
    // from where it has come out of the mist past his mountain to the crossing, the water is whole at every seam
    for (let u = 1.12; u <= 4.86; u += 0.01) {
      sceneField(u, P, f);
      expect(f[0], `water at u ${u.toFixed(2)}`).toBeGreaterThan(0.99);
      expect(f[1], `waterline at u ${u.toFixed(2)}`).toBeCloseTo(0.29, 2);
    }
  });
  it('paints with one palette, misted (any other name falls back to it), and reads its pigments along the scroll', () => {
    expect(Object.keys(PALETTES)).toEqual(['misted']);
    expect(paletteName('nonsense')).toBe('misted');
    const c = pigmentAt(0.5, 'misted');
    expect(c).toHaveLength(3);
  });
});
