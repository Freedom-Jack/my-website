/**
 * A byte-level byte-pair vocabulary learned from the site's own words at build (pure; the browser only encodes and
 * decodes with the merges it is given). Real ids, real merges, nothing pretrained: the corpus holds no Chinese
 * character, so none can enter the vocabulary (the seal is a drawn path, never text). GPT-2's pre-tokenisation shape
 * (a word keeps its leading space), 256 byte tokens plus the merges learned.
 */

const PRE = /\s?\p{L}+|\s?\p{N}+|\s?[^\s\p{L}\p{N}]+|\s+/gu;
const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: false });

export interface BPE {
  /** token id → its bytes */
  vocab: number[][];
  /** in order: [left id, right id] → the new id is 256 + its index */
  merges: Array<[number, number]>;
}

export function preTokens(text: string): string[] {
  return text.match(PRE) ?? [];
}

/** Learn `n` merges from the texts (counted by pre-token type, as the standard algorithm does). Deterministic. */
export function trainBPE(texts: string[], n: number): BPE {
  const vocab: number[][] = Array.from({ length: 256 }, (_, i) => [i]);
  const merges: Array<[number, number]> = [];
  const types = new Map<string, { seq: number[]; count: number }>();
  for (const text of texts)
    for (const p of preTokens(text)) {
      const e = types.get(p);
      if (e) e.count += 1;
      else types.set(p, { seq: [...enc.encode(p)], count: 1 });
    }
  const list = [...types.values()];
  for (let m = 0; m < n; m += 1) {
    const pairs = new Map<string, number>();
    for (const { seq, count } of list)
      for (let i = 0; i + 1 < seq.length; i += 1) {
        const key = `${seq[i]},${seq[i + 1]}`;
        pairs.set(key, (pairs.get(key) ?? 0) + count);
      }
    let best: string | null = null;
    let bestN = 1; // a pair seen once is not worth a token
    for (const [key, c] of pairs)
      if (c > bestN || (c === bestN && best !== null && key < best)) {
        best = key;
        bestN = c;
      }
    if (best === null) break;
    const [a, b] = best.split(',').map(Number) as [number, number];
    const id = vocab.length;
    vocab.push([...vocab[a]!, ...vocab[b]!]);
    merges.push([a, b]);
    for (const t of list) {
      const s = t.seq;
      if (s.length < 2) continue;
      const out: number[] = [];
      for (let i = 0; i < s.length; i += 1) {
        if (i + 1 < s.length && s[i] === a && s[i + 1] === b) {
          out.push(id);
          i += 1;
        } else out.push(s[i]!);
      }
      t.seq = out;
    }
  }
  return { vocab, merges };
}

/** Encode a text with the learned merges (lowest rank first, the standard way). */
export function encode(text: string, bpe: BPE): number[] {
  const rank = new Map<string, number>();
  bpe.merges.forEach(([a, b], i) => rank.set(`${a},${b}`, i));
  const out: number[] = [];
  for (const p of preTokens(text)) {
    let seq: number[] = [...enc.encode(p)];
    for (;;) {
      let bestI = -1;
      let bestR = Infinity;
      for (let i = 0; i + 1 < seq.length; i += 1) {
        const r = rank.get(`${seq[i]},${seq[i + 1]}`);
        if (r !== undefined && r < bestR) {
          bestR = r;
          bestI = i;
        }
      }
      if (bestI < 0) break;
      seq = [...seq.slice(0, bestI), 256 + bestR, ...seq.slice(bestI + 2)];
    }
    out.push(...seq);
  }
  return out;
}

/** A token's bytes as text for the page: spaces shown as "␣", control bytes and broken sequences as "·". */
export function tokenText(bytes: number[]): string {
  const s = dec.decode(new Uint8Array(bytes));
  return [...s].map((ch) => (ch === ' ' ? '␣' : ch === '�' || ch.charCodeAt(0) < 0x20 ? '·' : ch)).join('');
}

export function decodeBytes(bytes: number[]): string {
  return dec.decode(new Uint8Array(bytes));
}
