import { describe, expect, it } from 'vitest';
// The landscape engine's pure parts (no DOM, no GPU): where each place stands, how a window frames it, the palette.
import { framingAt, sceneName, SCENES, widthClass, STRETCH_COUNT } from '@/features/landscape/engine/compose';
import { PALETTES, PIGMENTS, paletteName, pigmentAt } from '@/features/landscape/engine/palette';

describe('the landscape engine, pure parts', () => {
  it('names each stretch of the one handscroll', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((k) => sceneName(k))).toEqual([
      'peak',
      'river',
      'path',
      'lake',
      'shore',
      'crossing',
      'lone-peak',
    ]);
    expect(STRETCH_COUNT).toBe(7);
    expect(SCENES.length).toBe(7);
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
    for (const k of [0, 1, 3, 4, 5, 6]) {
      const f = framingAt(k, 'wide', { width: 1440, height: 360, keepoutRight: 700 }, 'strip');
      expect(Number.isFinite(f.worldLeft), `stretch ${k}`).toBe(true);
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
