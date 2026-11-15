/** "{n} of {v}" → its values (the craft's small templates; an unknown token stays as written). */
export const fill = (s: string, v: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m));

/** A share as the site writes figures: 0.85 → "85%". */
export const pct = (x: number) => `${Math.round(x * 100)}%`;
