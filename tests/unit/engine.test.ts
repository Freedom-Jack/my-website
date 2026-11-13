import { describe, expect, it } from 'vitest';
// The landscape engine's pure parts (no DOM, no GPU): where each place stands, how a window frames it, the palette.
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
import { PALETTES, PIGMENTS, paletteName, pigmentAt } from '@/features/landscape/engine/palette';

describe('the landscape engine, pure parts', () => {
  it('names each stretch of the one handscroll', () => {
    // round 5: one place per stretch, in the nav's order; the road (a stretch with no page) is gone
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
  it('frames a strip deterministically (the same inputs, the same framing)', () => {
    const box = { width: 1440, height: 522, keepoutRight: 700 };
    const a = framingAt(0, 'wide', box, 'strip');
    const b = framingAt(0, 'wide', box, 'strip');
    expect(a).toEqual(b);
    expect(Number.isFinite(a.scale)).toBe(true);
    expect(a.scale).toBeGreaterThan(0);
  });
  it('keeps the place right of the text: the focus stands right of the keep-out', () => {
    for (const k of [0, 1, 2, 3, 4, 5]) {
      const f = framingAt(k, 'wide', { width: 1440, height: 360, keepoutRight: 700 }, 'strip');
      expect(Number.isFinite(f.worldLeft), `stretch ${k}`).toBe(true);
      expect(f.focus[0], `stretch ${k}`).toBeGreaterThanOrEqual(700 + 180);
    }
  });
  it('frames every inner hero the same way: one horizon, one scale, the focus at one place (round 5)', () => {
    for (const [cls, width, height] of [
      ['wide', 1440, 360],
      ['wide', 1280, 300],
      ['tablet', 1024, 220],
      ['phone', 390, 169],
    ] as const) {
      const fr = [1, 2, 3, 4, 5].map((k) =>
        framingAt(k, cls, { width, height, keepoutRight: cls === 'wide' ? width * 0.486 : null }, 'strip'),
      );
      for (const f of fr) {
        expect(f.worldTop, `${cls} ${width}`).toBeCloseTo(fr[0]!.worldTop, 6);
        expect(f.scale, `${cls} ${width}`).toBe(fr[0]!.scale);
        // the shared horizon (the river's waterline) HERO.at down the box
        expect(((f.worldTop - HERO.horizon) * f.scale) / 1.6 / height).toBeCloseTo(HERO.at, 6);
      }
    }
  });
  it('opens a deep page inside its place: closer by HERO.inside, on the same horizon, east of the landmark (the vanguard round)', () => {
    const box = { width: 1440, height: 360, keepoutRight: 700 };
    const open = { width: 1440, height: 360, keepoutRight: null }; // (no words over the box: the framing as named)
    for (const [k, u, keepU] of [
      [1, 0.72, 0.482],
      [2, 0.84, 0.84],
    ] as const) {
      const hero = framingAt(k, 'wide', box, 'strip');
      const inside = framingAt(k, 'wide', { ...box, inside: true }, 'strip');
      expect(inside.scale).toBeCloseTo(hero.scale * HERO.inside, 6);
      expect(inside.nominal).toBe(hero.nominal); // (its figure layer is the strip's)
      // the shared horizon at the same height down the box
      expect(((inside.worldTop - HERO.horizon) * inside.scale) / 1.6 / box.height).toBeCloseTo(HERO.at, 6);
      // its focus column holds the scene's inner focus, east of the hero's (where no words overlap the box)
      const named = framingAt(k, 'wide', { ...open, inside: true }, 'strip');
      expect(named.worldLeft + (HERO.fx.wide * open.width) / named.scale).toBeCloseTo(k + u, 6);
      expect(inside.worldLeft).toBeGreaterThan(hero.worldLeft);
      // ...and under the words the keep-out rule still holds: the place's leftmost figurative point (Work: the bridge's
      // west foot) stands at least KEEP_GAP right of the text, so the bridge looms whole at the words' edge
      expect((k + keepU - inside.worldLeft) * inside.scale).toBeGreaterThanOrEqual(700 + 180 - 1e-6);
      // a page's own sub-anchor instead (A2)
      const own = framingAt(k, 'wide', { ...open, inside: true, insideU: 0.5 }, 'strip');
      expect(own.worldLeft + (HERO.fx.wide * open.width) / own.scale).toBeCloseTo(k + 0.5, 6);
    }
    // a phone's case strip: the bridge (its east end at u 1.655) out of view to the west, the quay and the boats whole
    const ph = framingAt(1, 'phone', { width: 390, height: 168.8, inside: true }, 'strip');
    expect(ph.worldLeft).toBeGreaterThan(1.655);
    expect(ph.worldLeft + 390 / ph.scale).toBeGreaterThan(1.93);
    // the closing and the five heroes are untouched by the flag
    expect(framingAt(1, 'wide', { ...box, inside: true }, 'closing')).toEqual(framingAt(1, 'wide', box, 'closing'));
    expect(framingAt(0, 'wide', { width: 1440, height: 522, keepoutRight: 700, inside: true }, 'strip')).toEqual(
      framingAt(0, 'wide', { width: 1440, height: 522, keepoutRight: 700 }, 'strip'),
    );
  });
  it('finds the camera position that brings a part of a place to the focus column (A2, the sub-anchors)', () => {
    const box = { width: 1440, height: 360, keepoutRight: 700 };
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
  it('paints the scroll with one composition, and one river that never breaks (round 5)', () => {
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
  it('keeps the paper cool and cinnabar for the seal only (no pigment is red or warm)', () => {
    expect(Object.keys(PALETTES)).toEqual(['ink', 'misted', 'rich']);
    expect(paletteName('nonsense')).toBe('misted');
    const hex = Object.values(PIGMENTS)
      .flat()
      .filter((v) => typeof v === 'string') as string[];
    expect(hex.map((h) => h.toUpperCase())).not.toContain('#B1362B');
    const c = pigmentAt(0.5, 'misted');
    expect(c).toHaveLength(3);
  });
});
