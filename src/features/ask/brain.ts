/**
 * "Ask the painting": what happens to a visitor's question (the page's side; the model itself runs in ask.worker.ts).
 *
 *   1. the model reads the line into a vector;
 *   2. a private matter is turned away before anything is searched (the guard);
 *   3. otherwise the line is measured against every line of the site's own words and against the questions each
 *      line is filed under (questions.ts); the three closest are reported with their scores, and under a floor it
 *      says it does not know: it never writes an answer of its own;
 *   4. every step is reported as it happens, with its real numbers (the page draws them).
 *
 * Round 7: the other half (a scene read from the words, repainting the painting by hour and weather) is gone with
 * the colours it painted (Jack: "It looks not inked Chinese painting"). Every line is a question now.
 */
import { cosine, unpackVector } from './encoder';
import { LEANS, linesOf, sentences, type AskChunk, type Line } from './lines';

/** A step of the trace, as it happens. */
export type Step =
  | { kind: 'load'; loaded: number; total: number; done: boolean }
  | { kind: 'read'; tokens: number }
  | { kind: 'embed'; dim: number; ms: number }
  | { kind: 'guard' }
  | {
      kind: 'search';
      lines: number;
      floor: number;
      /** the three closest lines, the closest first: where each stands and its score */
      top: { source: string; score: number }[];
    }
  | { kind: 'travel'; place: string };

export type Answer =
  | {
      kind: 'answer';
      /** the line (or the one sentence of it) that answers, word for word */
      said: string;
      /** the short lines that stand beside it on the page (a list's other items), before and after */
      before: string[];
      after: string[];
      source: string;
      href: string;
      stretch: number;
      u: number | null;
    }
  | { kind: 'private' }
  | { kind: 'unknown'; score: number; floor: number }
  | { kind: 'error' };

/** public/ask/index.json (tools/build-ask.ts): one entry for every line of the corpus, in its order. */
interface Index {
  dim: number;
  corpusHash: string;
  lines: (null | { v: string; s?: string[]; q?: [sentence: number, vector: string, thing?: string][] })[];
}

/**
 * Under this the closest line is no answer (the model's own score, 0..1, of the question against the line or
 * against a question the line is filed under). Set on 2026-11-15 on 39 questions written after the filed ones, in
 * other words, and 50 the site cannot answer, run in the browser: 33 of the 39 were answered rightly, 1 arguably,
 * 5 were turned away; of the 50, 49 were turned away (15 by the guard) and 1, about a job, was shown where to
 * write. The set was the builder's; Jack's own questions replace it (NEW-WORDS.md).
 */
const FLOOR = 0.55;
/** What the site does not hold on purpose: turned away before anything is searched. */
const PRIVATE =
  /\b(salary|salaries|income|wage|net worth|how much (are|were) you paid|how much (do|does|did) .*\b(pay|earn|make)|how old|your age|birthday|born|married|are you single|wife|husband|girlfriend|boyfriend|kids?|children|parents|mother|father|religio\w*|god|politic\w*|vote|your health|blood type|home address|street address|phone number|your phone|cell number|mobile number)\b/i;
/** A line this short is shown with the short lines beside it (a list's other items); a line this long is answered
 *  with its closest sentence. */
const SHORT = 110;
const LONG = 360;
/** A score under the floor, as it is printed: cut to two places, never rounded up to the floor itself. */
const under = (score: number) => Math.floor(Math.max(0, score) * 100) / 100;
/** Whether a line names a thing as a word of its own ("go" in "Do you write Go?", not in "going"). */
const names = (line: string, thing: string) => {
  const at = ` ${line.toLowerCase().replace(/[^a-z0-9+#.\-/]+/g, ' ')} `.replace(/[.?!]+ /g, ' ');
  return at.includes(` ${thing.toLowerCase()} `);
};
export function createBrain(onStep: (s: Step) => void) {
  let worker: Worker | null = null;
  let seq = 0;
  const waiting = new Map<
    number,
    { resolve: (v: { vectors: Float32Array[]; pieces: string[][]; ms: number[] }) => void; reject: (e: Error) => void }
  >();
  let data: Promise<{
    lines: Line[];
    /** a line's vectors, by its place in the corpus (none: a line that is never an answer) */
    vec: Map<
      number,
      { v: Float32Array; s: Float32Array[]; q: [sentence: number, vector: Float32Array, thing?: string][] }
    >;
  }> | null = null;

  function start() {
    if (worker) return;
    worker = new Worker(new URL('./ask.worker.ts', import.meta.url), { type: 'module', name: 'ask' });
    worker.onmessage = (
      e: MessageEvent<{
        type: string;
        id?: number;
        loaded?: number;
        total?: number;
        ms?: number[];
        bytes?: number;
        vectors?: Float32Array[];
        pieces?: string[][];
        message?: string;
      }>,
    ) => {
      const m = e.data;
      if (m.type === 'progress') onStep({ kind: 'load', loaded: m.loaded!, total: m.total!, done: false });
      else if (m.type === 'ready') onStep({ kind: 'load', loaded: m.bytes!, total: m.bytes!, done: true });
      else if (m.type === 'vectors') {
        waiting.get(m.id!)?.resolve({ vectors: m.vectors!, pieces: m.pieces!, ms: m.ms! });
        waiting.delete(m.id!);
      } else if (m.type === 'error') {
        const err = new Error(m.message || 'the model could not run');
        if (m.id !== undefined) {
          waiting.get(m.id)?.reject(err);
          waiting.delete(m.id);
        } else for (const w of waiting.values()) w.reject(err);
      }
    };
    worker.onerror = () => {
      for (const w of waiting.values()) w.reject(new Error('the model could not start'));
      waiting.clear();
    };
    worker.postMessage({ type: 'load' });
  }
  const embed = (texts: string[]) =>
    new Promise<{ vectors: Float32Array[]; pieces: string[][]; ms: number[] }>((resolve, reject) => {
      start();
      const id = ++seq;
      waiting.set(id, { resolve, reject });
      worker!.postMessage({ type: 'embed', id, texts });
    });
  const load = () =>
    (data ??= (async () => {
      const [index, corpus] = await Promise.all([
        fetch('/ask/index.json').then((r) => r.json() as Promise<Index>),
        fetch('/craft/corpus.json').then((r) => r.json() as Promise<{ chunks: AskChunk[] }>),
      ]);
      // the words are the build's own (the corpus); the index only says how they are measured
      const lines = linesOf(corpus.chunks);
      if (lines.length !== index.lines.length) throw new Error('the index is older than the words (npm run build:ask)');
      const vec = new Map(
        index.lines.flatMap((e, n) =>
          e
            ? [
                [
                  n,
                  {
                    v: unpackVector(e.v),
                    s: (e.s ?? []).map(unpackVector),
                    q: (e.q ?? []).map(([j, v, thing]): [number, Float32Array, string?] => [j, unpackVector(v), thing]),
                  },
                ] as const,
              ]
            : [],
        ),
      );
      return { lines, vec };
    })());

  return {
    async ask(line: string): Promise<Answer> {
      try {
        const [D, E] = await Promise.all([load(), embed([line])]);
        onStep({ kind: 'read', tokens: E.pieces[0]!.length });
        onStep({ kind: 'embed', dim: E.vectors[0]!.length, ms: E.ms[0]! });
        const whole = E.vectors[0]!;

        // the guard first: what the site keeps off its pages is not searched for
        if (PRIVATE.test(line)) {
          onStep({ kind: 'guard' });
          return { kind: 'private' };
        }
        // every line that may answer: the question against the line itself, and against each question the line is
        // filed under (the closer of the two is the line's score)
        let hit: { l: Line; score: number; sentence: number } | null = null;
        let count = 0;
        const ranked: { l: Line; score: number }[] = [];
        for (const l of D.lines) {
          const v = D.vec.get(l.n);
          if (!v) continue;
          count += 1;
          let score = cosine(whole, v.v),
            sentence = -1;
          for (const [j, qv, thing] of v.q) {
            // (a question about a listed thing, "Do you know Java?", counts only when the visitor names the thing)
            if (thing && !names(line, thing)) continue;
            const c = cosine(whole, qv);
            if (c > score) {
              score = c;
              sentence = j;
            }
          }
          if (!hit || score > hit.score) hit = { l, score, sentence };
          ranked.push({ l, score });
        }
        const where = (l: Line) => `${l.chunk.page} · ${l.section}`;
        const source = hit ? where(hit.l) : '';
        // the three closest, one per place on a page (two lines of one section are one candidate)
        ranked.sort((p, q) => q.score - p.score);
        const top: { source: string; score: number }[] = [];
        for (const r of ranked) {
          if (top.length >= 3) break;
          if (!top.some((t) => t.source === where(r.l))) top.push({ source: where(r.l), score: Math.max(0, r.score) });
        }
        onStep({ kind: 'search', lines: count, floor: FLOOR, top });
        if (!hit || hit.score < FLOOR) return { kind: 'unknown', score: under(hit?.score ?? 0), floor: FLOOR };

        // what is shown, word for word: the sentence the question was filed under; or the line, when it is not
        // long; or a long line's closest sentence (with the sentence before it, when it leans on it)
        const { l } = hit;
        const ss = sentences(l.text);
        let at = hit.sentence;
        if (at < 0 && l.text.length > LONG && ss.length > 1) {
          const sv = D.vec.get(l.n)?.s ?? [];
          at = 0;
          for (let i = 1; i < Math.min(ss.length, sv.length); i++)
            if (cosine(whole, sv[i]!) > cosine(whole, sv[at]!)) at = i;
        }
        let said = at < 0 ? l.text : (ss[at] ?? l.text);
        const prev = at > 0 ? ss[at - 1] : undefined;
        if (prev && LEANS.test(said) && prev.length + said.length < LONG) said = `${prev} ${said}`;
        // a list's item stands with the items beside it: a run of three or more short lines under one heading
        // (a degree and its honours, a diagram's steps), the nearest first, while they fit
        const before: string[] = [],
          after: string[] = [];
        const beside = (x: Line | undefined): x is Line =>
          !!x && x.answers && x.chunk.page === l.chunk.page && x.section === l.section && x.text.length < SHORT;
        if (at < 0 && l.text.length < SHORT) {
          let up = l.n,
            down = l.n;
          while (beside(D.lines[up - 1])) up -= 1;
          while (beside(D.lines[down + 1])) down += 1;
          if (down - up >= 2) {
            let room = LONG - l.text.length;
            for (let d = 1; d <= 3 && before.length + after.length < 3; d++)
              for (const n of [l.n + d, l.n - d]) {
                const x = D.lines[n];
                if (n < up || n > down || !x || x.text.length > room || before.length + after.length >= 3) continue;
                // (only lines that touch what is already shown: a list is never shown with a gap)
                if (n > l.n ? after.length !== d - 1 : before.length !== d - 1) continue;
                room -= x.text.length;
                if (n > l.n) after.push(x.text);
                else before.unshift(x.text);
              }
          }
        }
        onStep({ kind: 'travel', place: l.chunk.place });
        return {
          kind: 'answer',
          said,
          before,
          after,
          source,
          href: l.anchor ? `${l.chunk.href}#${l.anchor}` : l.chunk.href,
          stretch: l.chunk.stretch,
          u: l.chunk.u,
        };
      } catch {
        return { kind: 'error' };
      }
    },
    destroy() {
      worker?.terminate();
      worker = null;
      waiting.clear();
    },
  };
}
export type Brain = ReturnType<typeof createBrain>;
