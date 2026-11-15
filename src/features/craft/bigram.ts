/**
 * The scores the mask demo samples from: a bigram model of the site's own words over the learned vocabulary, fitted at
 * build (add-α smoothing against the unigram counts). It is labelled on the page as what it is: counts of his words,
 * not a neural model. The table ships sparse (each token's top continuations) so the browser can score any step.
 */

export interface Bigram {
  /** vocabulary size */
  v: number;
  /** unigram counts per token id */
  uni: number[];
  /** per previous token: its total count and its top continuations [id, count] */
  rows: Array<{ p: number; t: number; n: Array<[number, number]> }>;
  alpha: number;
}

export function trainBigram(seqs: number[][], v: number, topK = 16, alpha = 4): Bigram {
  const uni = new Array<number>(v).fill(0);
  const rows = new Map<number, Map<number, number>>();
  for (const seq of seqs) {
    for (let i = 0; i < seq.length; i += 1) {
      uni[seq[i]!] = (uni[seq[i]!] ?? 0) + 1;
      if (i + 1 < seq.length) {
        const a = seq[i]!;
        const b = seq[i + 1]!;
        const row = rows.get(a) ?? new Map<number, number>();
        row.set(b, (row.get(b) ?? 0) + 1);
        rows.set(a, row);
      }
    }
  }
  const out: Bigram['rows'] = [];
  for (const [p, row] of [...rows.entries()].sort((a, b) => a[0] - b[0])) {
    let t = 0;
    for (const c of row.values()) t += c;
    const n = [...row.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, topK) as Array<[number, number]>;
    out.push({ p, t, n });
  }
  return { v, uni, rows: out, alpha };
}

/** log P(next | prev) for every token, as a Float64Array. */
export function scores(model: Bigram, prev: number): Float64Array {
  const total = model.uni.reduce((a, b) => a + b, 0) + model.v;
  const row = model.rows.find((r) => r.p === prev);
  const out = new Float64Array(model.v);
  const rowT = row ? row.t : 0;
  const cont = new Map<number, number>(row ? row.n : []);
  for (let t = 0; t < model.v; t += 1) {
    const u = ((model.uni[t] ?? 0) + 1) / total;
    const c = cont.get(t) ?? 0;
    out[t] = Math.log((c + model.alpha * u) / (rowT + model.alpha));
  }
  return out;
}

/** A seeded uniform generator (mulberry32), so a run replays the same way for everyone. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sample one token from the (masked) scores: softmax at temperature 1 over the legal tokens. */
export function sample(logp: Float64Array, legal: Uint8Array | null, next: () => number): number {
  let max = -Infinity;
  for (let t = 0; t < logp.length; t += 1) if ((!legal || legal[t]) && logp[t]! > max) max = logp[t]!;
  if (max === -Infinity) return -1;
  const w = new Float64Array(logp.length);
  let sum = 0;
  for (let t = 0; t < logp.length; t += 1) {
    if (legal && !legal[t]) continue;
    w[t] = Math.exp(logp[t]! - max);
    sum += w[t]!;
  }
  let r = next() * sum;
  for (let t = 0; t < logp.length; t += 1) {
    if (legal && !legal[t]) continue;
    r -= w[t]!;
    if (r <= 0) return t;
  }
  for (let t = logp.length - 1; t >= 0; t -= 1) if (!legal || legal[t]) return t;
  return -1;
}
