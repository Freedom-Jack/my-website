/**
 * A CSS time as milliseconds. The CSS pipeline minifies a token's "600ms" to ".6s", so a bare parseFloat would read
 * it as 0.6 (ms): every route pan, sweep and settle then ran in under a millisecond. Seconds are read as seconds,
 * milliseconds (or a bare number) as milliseconds; anything else (empty, "auto") gives the fallback.
 */
export function parseCssTime(value: string, fallback: number): number {
  const v = value.trim();
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return fallback;
  if (/ms$/i.test(v)) return n;
  if (/s$/i.test(v)) return n * 1000;
  return n;
}

/** A custom property's time on an element (the root by default), in milliseconds. */
export function cssTime(name: string, fallback: number, el: Element = document.documentElement): number {
  return parseCssTime(getComputedStyle(el).getPropertyValue(name), fallback);
}
