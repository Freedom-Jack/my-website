import { describe, expect, it } from 'vitest';
import { parseCssTime } from '@/lib/css-time';

describe('parseCssTime (a minified ".6s" is 600 ms)', () => {
  it('reads seconds as seconds', () => {
    expect(parseCssTime('.6s', 1)).toBe(600);
    expect(parseCssTime(' 0.42s ', 1)).toBe(420);
  });
  it('reads milliseconds and bare numbers as milliseconds', () => {
    expect(parseCssTime('600ms', 1)).toBe(600);
    expect(parseCssTime('90', 1)).toBe(90);
  });
  it('falls back on anything else', () => {
    expect(parseCssTime('', 400)).toBe(400);
    expect(parseCssTime('auto', 400)).toBe(400);
  });
});
