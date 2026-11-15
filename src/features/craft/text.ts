/**
 * The craft's text tools, pure and shared by the build (the index, the eval, the recorded run) and the browser (the
 * search box), so a number computed at build is the number the visitor's own run would give.
 *   tokenize  lowercase, accents folded, a short stop list, a light suffix strip (never a dictionary)
 *   BM25      the lexical index over the site's chunks (Robertson's k1 = 1.2, b = 0.75)
 *   rrf       reciprocal rank fusion of two rankings (Cormack, Clarke and Buettcher's k = 60)
 * Nothing here generates words: a result is always one of the chunks, verbatim.
 */

const STOP = new Set(
  (
    'a an the and or of to in on for with at by from as is are was were be been it its this that these those he his ' +
    'him i my me we our you your they their them not no so if than then into over under out up about also but what ' +
    'which who how when where there here has have had do does did can could will would should may one each per via ' +
    'own more most very s'
  ).split(' '),
);

/** A light stem: plurals and the commonest verb endings, so "documents" and "documented" meet at "document". */
export function stem(w: string): string {
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

export function tokenize(text: string): string[] {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .split(/[^a-z0-9%+]+/)
    .filter((w) => w && !STOP.has(w))
    .map(stem);
}

export interface Doc {
  id: string;
  text: string;
}

export interface Index {
  n: number;
  avgdl: number;
  df: Map<string, number>;
  docs: Array<{ id: string; len: number; tf: Map<string, number> }>;
}

export function buildIndex(docs: Doc[]): Index {
  const df = new Map<string, number>();
  const out: Index['docs'] = [];
  let total = 0;
  for (const d of docs) {
    const tf = new Map<string, number>();
    const toks = tokenize(d.text);
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    out.push({ id: d.id, len: toks.length, tf });
    total += toks.length;
  }
  return { n: docs.length, avgdl: total / Math.max(1, docs.length), df, docs: out };
}

export interface Hit {
  id: string;
  score: number;
  /** the query terms (stemmed) found in the chunk */
  matched: string[];
}

const K1 = 1.2;
const B = 0.75;

export function search(index: Index, query: string, k = 8): Hit[] {
  const terms = [...new Set(tokenize(query))];
  if (!terms.length) return [];
  const hits: Hit[] = [];
  for (const d of index.docs) {
    let score = 0;
    const matched: string[] = [];
    for (const t of terms) {
      const f = d.tf.get(t);
      if (!f) continue;
      const n = index.df.get(t) ?? 0;
      const idf = Math.log(1 + (index.n - n + 0.5) / (n + 0.5));
      score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.len) / index.avgdl)));
      matched.push(t);
    }
    if (score > 0) hits.push({ id: d.id, score, matched });
  }
  hits.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
  return hits.slice(0, k);
}

/** Reciprocal rank fusion of ranked id lists: the ids ordered by the sum of 1 / (60 + rank). */
export function rrf(lists: string[][], k = 8): Array<{ id: string; score: number; ranks: number[] }> {
  const score = new Map<string, number>();
  const ranks = new Map<string, number[]>();
  lists.forEach((list, li) => {
    list.forEach((id, r) => {
      score.set(id, (score.get(id) ?? 0) + 1 / (60 + r + 1));
      const rs = ranks.get(id) ?? lists.map(() => 0);
      rs[li] = r + 1;
      ranks.set(id, rs);
    });
  });
  return [...score.entries()]
    .map(([id, s]) => ({ id, score: s, ranks: ranks.get(id)! }))
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1))
    .slice(0, k);
}

/** How a chunk's words match the query, for the "matched terms" line: the query's stems found in it. */
export function matchedWords(text: string, matched: string[]): string[] {
  const set = new Set(matched);
  const out: string[] = [];
  for (const raw of text.split(/\s+/)) {
    const toks = tokenize(raw);
    if (toks.some((t) => set.has(t))) out.push(raw.replace(/^[^\w%]+|[^\w%+]+$/g, ''));
  }
  return [...new Set(out)];
}

/**
 * The score floor (fixed before any question was asked of the index, never tuned on the eval set): a passage scoring
 * below it shares only common words with the query, so the page says "no close match" rather than show it. One rare
 * term in a passage scores about 4; one word found in a quarter of the passages, about 1.4.
 */
export const FLOOR = 2;

/** The close matches only: the hits at or above the floor. */
export const closeHits = (hits: Hit[]) => hits.filter((h) => h.score >= FLOOR);
