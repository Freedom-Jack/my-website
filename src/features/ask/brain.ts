/**
 * "Ask the painting": what happens to a visitor's line (the page's side; the model itself runs in ask.worker.ts).
 *
 *   1. the model reads the line (and its parts) into vectors;
 *   2. the router decides what it is: a scene, or a question (the line against the router's own phrases, and the
 *      words a question opens with);
 *   3. a scene: each thing the painting can do is measured against the line (the model's score, and a spelt-out
 *      keyword counting too); what is close enough becomes a mood (features/landscape/types Mood);
 *      a question: a private matter is turned away before anything is searched (the guard); otherwise the line is
 *      measured against every line of the site's own words and against the questions each line is filed under
 *      (questions.ts), and under a floor it says it does not know: it never writes an answer of its own;
 *   4. every step is reported as it happens, with its real numbers (the page draws them).
 */
import type { Mood } from '@/features/landscape/types';
import { cosine, unpackVector } from './encoder';
import { LEANS, linesOf, sentences, type AskChunk, type Line } from './lines';
import { ANCHORS, clauses, named, QUESTION_CUE, type Anchor } from './scene';

/** A step of the trace, as it happens. */
export type Step =
  | { kind: 'load'; loaded: number; total: number; done: boolean; ms?: number }
  | { kind: 'read'; tokens: number; pieces: string[] }
  | { kind: 'embed'; dim: number; ms: number }
  | { kind: 'route'; as: 'scene' | 'question'; scene: number; question: number }
  | { kind: 'scene'; found: { label: string; score: number }[] }
  | { kind: 'guard' }
  | { kind: 'search'; lines: number; source: string; score: number; floor: number }
  | { kind: 'travel'; place: string };

export type Answer =
  | { kind: 'scene'; mood: Mood; labels: string[] }
  | { kind: 'scene-unknown' }
  | {
      kind: 'answer';
      /** the line (or the one sentence of it) that answers, word for word */
      said: string;
      /** the short lines that stand beside it on the page (a list's other items), before and after */
      before: string[];
      after: string[];
      source: string;
      href: string;
      place: string;
      stretch: number;
      u: number | null;
      score: number;
    }
  | { kind: 'private' }
  | { kind: 'unknown'; score: number; floor: number }
  | { kind: 'error'; message: string };

/** public/ask/index.json (tools/build-ask.ts): one entry for every line of the corpus, in its order. */
interface Index {
  dim: number;
  corpusHash: string;
  lines: (null | { v: string; s?: string[]; q?: [sentence: number, vector: string, thing?: string][] })[];
  anchors: Record<string, string[]>;
  kinds: Record<string, string[]>;
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
/** A thing of the scene is taken at this score (the model's, or a spelt-out keyword's standing in for it). */
const TAKE = { hour: 0.56, weather: 0.58, lamps: 0.6 };
const NAMED = 0.9;

export function createBrain(onStep: (s: Step) => void) {
  let worker: Worker | null = null;
  let ready = false;
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
    anchors: Map<string, Float32Array[]>;
    kinds: Record<string, Float32Array[]>;
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
        ms?: number | number[];
        bytes?: number;
        vectors?: Float32Array[];
        pieces?: string[][];
        message?: string;
      }>,
    ) => {
      const m = e.data;
      if (m.type === 'progress') onStep({ kind: 'load', loaded: m.loaded!, total: m.total!, done: false });
      else if (m.type === 'ready') {
        ready = true;
        onStep({ kind: 'load', loaded: m.bytes!, total: m.bytes!, done: true, ms: m.ms as number });
      } else if (m.type === 'vectors') {
        waiting.get(m.id!)?.resolve({ vectors: m.vectors!, pieces: m.pieces!, ms: m.ms as number[] });
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
      const anchors = new Map(Object.entries(index.anchors).map(([k, vs]) => [k, vs.map(unpackVector)]));
      const kinds = Object.fromEntries(Object.entries(index.kinds).map(([k, vs]) => [k, vs.map(unpackVector)]));
      return { lines, vec, anchors, kinds };
    })());

  return {
    get ready() {
      return ready;
    },
    async ask(line: string): Promise<Answer> {
      try {
        const parts = clauses(line);
        const [D, E] = await Promise.all([load(), embed(parts)]);
        onStep({ kind: 'read', tokens: E.pieces[0]!.length, pieces: E.pieces[0]! });
        onStep({ kind: 'embed', dim: E.vectors[0]!.length, ms: E.ms[0]! });
        const whole = E.vectors[0]!;
        const best = (vs: Float32Array[], qs: Float32Array[] = [whole]) =>
          Math.max(...vs.flatMap((v) => qs.map((q) => cosine(q, v))));

        // the router
        const sceneK = best(D.kinds.scene!),
          questionK = best(D.kinds.question!);
        const taken = (a: Anchor) => Math.max(best(D.anchors.get(a.key) ?? [], E.vectors), named(line, a) ? NAMED : 0);
        const scores = ANCHORS.map((a) => ({ a, score: taken(a) }));
        const anyScene = scores.some((x) => x.score >= TAKE[x.a.group]);
        const cue = QUESTION_CUE.test(line);
        const as: 'scene' | 'question' = !cue && (anyScene || sceneK > questionK + 0.08) ? 'scene' : 'question';
        onStep({ kind: 'route', as, scene: sceneK, question: questionK });

        if (as === 'scene') {
          // one hour and one weather at most (the closest of each), and the lamps
          const pick = (g: Anchor['group']) =>
            scores.filter((x) => x.a.group === g && x.score >= TAKE[g]).sort((p, q) => q.score - p.score)[0];
          const hour = pick('hour'),
            weather = pick('weather'),
            lamps = pick('lamps');
          const found = [hour, weather, lamps].filter(Boolean) as { a: Anchor; score: number }[];
          onStep({ kind: 'scene', found: found.map((x) => ({ label: x.a.label, score: Math.min(1, x.score) })) });
          if (!found.length) return { kind: 'scene-unknown' };
          const mood: Mood = {};
          if (hour && hour.a.key !== 'day') mood[hour.a.key as 'dawn' | 'dusk' | 'night'] = 1;
          if (weather && weather.a.key !== 'clear')
            mood[weather.a.key as 'snow' | 'rain'] = hour?.a.key === 'night' ? 0.75 : 0.9;
          // (the lamps: when they are named; and a night or a dusk lights them itself)
          mood.lamps = lamps ? 1 : hour?.a.key === 'night' ? 1 : hour?.a.key === 'dusk' ? 0.8 : 0;
          return { kind: 'scene', mood, labels: found.map((x) => x.a.label) };
        }

        // a question. The guard first: what the site keeps off its pages is not searched for
        if (PRIVATE.test(line)) {
          onStep({ kind: 'guard' });
          return { kind: 'private' };
        }
        // every line that may answer: the question against the line itself, and against each question the line is
        // filed under (the closer of the two is the line's score)
        let hit: { l: Line; score: number; sentence: number } | null = null;
        let count = 0;
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
        }
        const source = hit ? `${hit.l.chunk.page} · ${hit.l.section}` : '';
        const shown = hit && hit.score >= FLOOR ? hit.score : under(hit?.score ?? 0);
        onStep({ kind: 'search', lines: count, source, score: shown, floor: FLOOR });
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
          place: l.chunk.place,
          stretch: l.chunk.stretch,
          u: l.chunk.u,
          score: hit.score,
        };
      } catch (err) {
        return { kind: 'error', message: String((err as Error)?.message || err) };
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
