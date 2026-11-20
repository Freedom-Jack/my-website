/**
 * "Ask the painting": the three honest steps, apart from how they are drawn (Sheet.tsx). Loaded when the sheet first
 * opens; everything here lives for the session (the root layout's host keeps it across pages), so the site's words
 * are fetched once and the model's worker is made once.
 *
 *   words()   the site's own words, /craft/corpus.json (about 8 KB over the wire), cut into its lines
 *   first()   step 0, a filed question: that line, at once; else the guard; else step 1, a search by word
 *   closer()  step 2, only when asked for: the sentence-embedding model in its worker (brain.ts, ask.worker.ts)
 *
 * Every request is to this site, and none carries what was typed.
 */
import type { Answer, Brain, Step } from './brain';
import { fileQuestions, filedKey, type Filing } from './filed';
import { isPrivate } from './guard';
import { linesOf, type AskChunk, type Line } from './lines';
import { makeSearch, type Place } from './search';
import { shape, type Said } from './shape';

export type { Place, Said };

const WORDS = '/craft/corpus.json';

export interface Words {
  chunks: AskChunk[];
  lines: Line[];
  /** the fetch, as it came over the wire (bytes) */
  bytes: number;
}

let words_: Promise<Words> | null = null;
let filed: Map<string, Filing> | null = null;
let searcher: ReturnType<typeof makeSearch> | null = null;

export function words(): Promise<Words> {
  return (words_ ??= (async () => {
    const res = await fetch(WORDS);
    if (!res.ok) throw new Error(`${WORDS}: ${res.status}`);
    const text = await res.text();
    const { chunks } = JSON.parse(text) as { chunks: AskChunk[] };
    // its size as the browser measured it on the wire (a response from the browser's cache still reports its body)
    let bytes = 0;
    try {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      bytes = entries.filter((e) => e.name.split(/[?#]/)[0]!.endsWith(WORDS)).pop()?.encodedBodySize ?? 0;
    } catch {
      bytes = 0;
    }
    return { chunks, lines: linesOf(chunks), bytes: bytes || text.length };
  })().catch((err: unknown) => {
    words_ = null; // (tried again with the next question)
    throw err;
  }));
}

export type First =
  | { kind: 'filed'; answer: Said }
  | { kind: 'private' }
  | { kind: 'places'; places: Place[]; passages: number; ms: number };

/** Steps 0 and 1: no model, nothing fetched beyond the words. */
export function first(q: string, w: Words): First {
  filed ??= fileQuestions(w.lines);
  const f = filed.get(filedKey(q));
  if (f) return { kind: 'filed', answer: shape(w.lines, f.l, f.at) };
  // what the site keeps off its pages is not searched for
  if (isPrivate(q)) return { kind: 'private' };
  searcher ??= makeSearch(w.chunks, w.lines);
  const t0 = performance.now();
  const places = searcher.query(q);
  return { kind: 'places', places, passages: searcher.passages, ms: performance.now() - t0 };
}

let brain: Brain | null = null;
let listener: ((s: Step) => void) | null = null;
let model = 0;

/** The model's size once it is in the browser (bytes); 0 until then. */
export const modelHere = () => model;

/** Step 2: the model's reading. The worker and the model's files come with the first call, never before. */
export async function closer(q: string, w: Words, onStep: (s: Step) => void): Promise<Answer> {
  listener = onStep;
  try {
    const { createBrain } = await import('./brain');
    brain ??= createBrain(
      (s) => {
        if (s.kind === 'load' && s.done) model = s.total;
        listener?.(s);
      },
      () => Promise.resolve(w.chunks),
    );
    return await brain.ask(q, onStep);
  } catch {
    return { kind: 'error' };
  }
}
