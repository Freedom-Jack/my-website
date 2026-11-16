/**
 * "Ask the painting": what happens to a visitor's line (the page's side; the model itself runs in ask.worker.ts).
 *
 *   1. the model reads the line (and its parts) into vectors;
 *   2. the router decides what it is: a scene, or a question (the line against the router's own phrases, and the
 *      words a question opens with);
 *   3. a scene: each thing the painting can do is measured against the line (the model's score, and a spelt-out
 *      keyword counting too); what is close enough becomes a mood (features/landscape/types Mood);
 *      a question: the line against every passage of the site's own words, the model's score with the keyword
 *      search's (the hybrid), and under a floor it says it does not know: it never writes an answer of its own;
 *   4. every step is reported as it happens, with its real numbers (the page draws them).
 */
import type { Chunk } from '@/features/craft/corpus';
import { buildIndex, search } from '@/features/craft/text';
import type { Mood } from '@/features/landscape/types';
import { cosine, unpackVector } from './encoder';
import { ANCHORS, clauses, named, QUESTION_CUE, type Anchor } from './scene';

/** A step of the trace, as it happens. */
export type Step =
  | { kind: 'load'; loaded: number; total: number; done: boolean; ms?: number }
  | { kind: 'read'; tokens: number; pieces: string[] }
  | { kind: 'embed'; dim: number; ms: number }
  | { kind: 'route'; as: 'scene' | 'question'; scene: number; question: number }
  | { kind: 'scene'; found: { label: string; score: number }[] }
  | { kind: 'search'; passages: number; source: string; score: number; floor: number }
  | { kind: 'travel'; place: string };

export type Answer =
  | { kind: 'scene'; mood: Mood; labels: string[] }
  | { kind: 'scene-unknown' }
  | { kind: 'answer'; text: string; sentence: string; source: string; href: string; place: string; stretch: number; u: number | null; score: number }
  | { kind: 'unknown'; score: number; floor: number }
  | { kind: 'error'; message: string };

interface Index {
  dim: number;
  corpusHash: string;
  passages: { id: string; v: string; s: string[] }[];
  anchors: Record<string, string[]>;
  kinds: Record<string, string[]>;
}

/** Under this the closest passage is no answer (the model's own score, 0..1); a passage that also shares a word
 *  with the question may stand a little lower. Set on 2026-11-15 against the site's own questions and ten that it
 *  cannot answer: the questions it can answer score 0.22 to 0.86, the others 0.07 to 0.19 (one, a salary, 0.31). */
const FLOOR = 0.215;
const FLOOR_WORD = 0.17;
/** A thing of the scene is taken at this score (the model's, or a spelt-out keyword's standing in for it). */
const TAKE = { hour: 0.56, weather: 0.58, lamps: 0.6 };
const NAMED = 0.9;

const sentences = (text: string) =>
  text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9“"(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);

export function createBrain(onStep: (s: Step) => void) {
  let worker: Worker | null = null;
  let ready = false;
  let seq = 0;
  const waiting = new Map<number, { resolve: (v: { vectors: Float32Array[]; pieces: string[][]; ms: number[] }) => void; reject: (e: Error) => void }>();
  let data: Promise<{ index: Index; chunks: Chunk[]; bm25: ReturnType<typeof buildIndex>; vec: Map<string, { v: Float32Array; s: Float32Array[] }>; anchors: Map<string, Float32Array[]>; kinds: Record<string, Float32Array[]> }> | null = null;

  function start() {
    if (worker) return;
    worker = new Worker(new URL('./ask.worker.ts', import.meta.url), { type: 'module', name: 'ask' });
    worker.onmessage = (e: MessageEvent<{ type: string; id?: number; loaded?: number; total?: number; ms?: number | number[]; bytes?: number; vectors?: Float32Array[]; pieces?: string[][]; message?: string }>) => {
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
        fetch('/craft/corpus.json').then((r) => r.json() as Promise<{ chunks: Chunk[] }>),
      ]);
      const vec = new Map(index.passages.map((p) => [p.id, { v: unpackVector(p.v), s: p.s.map(unpackVector) }]));
      const anchors = new Map(Object.entries(index.anchors).map(([k, vs]) => [k, vs.map(unpackVector)]));
      const kinds = Object.fromEntries(Object.entries(index.kinds).map(([k, vs]) => [k, vs.map(unpackVector)]));
      return { index, chunks: corpus.chunks, bm25: buildIndex(corpus.chunks), vec, anchors, kinds };
    })());

  return {
    /** The model's files may come now (the visitor has turned to the line): nothing is asked of them yet. */
    warm() {
      start();
      void load();
    },
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
        const best = (vs: Float32Array[], qs: Float32Array[] = [whole]) => Math.max(...vs.flatMap((v) => qs.map((q) => cosine(q, v))));

        // the router
        const sceneK = best(D.kinds.scene!), questionK = best(D.kinds.question!);
        const taken = (a: Anchor) => Math.max(best(D.anchors.get(a.key) ?? [], E.vectors), named(line, a) ? NAMED : 0);
        const scores = ANCHORS.map((a) => ({ a, score: taken(a) }));
        const anyScene = scores.some((x) => x.score >= TAKE[x.a.group]);
        const cue = QUESTION_CUE.test(line);
        const as: 'scene' | 'question' = !cue && (anyScene || sceneK > questionK + 0.08) ? 'scene' : 'question';
        onStep({ kind: 'route', as, scene: sceneK, question: questionK });

        if (as === 'scene') {
          // one hour and one weather at most (the closest of each), and the lamps
          const pick = (g: Anchor['group']) => scores.filter((x) => x.a.group === g && x.score >= TAKE[g]).sort((p, q) => q.score - p.score)[0];
          const hour = pick('hour'), weather = pick('weather'), lamps = pick('lamps');
          const found = [hour, weather, lamps].filter(Boolean) as { a: Anchor; score: number }[];
          onStep({ kind: 'scene', found: found.map((x) => ({ label: x.a.label, score: Math.min(1, x.score) })) });
          if (!found.length) return { kind: 'scene-unknown' };
          const mood: Mood = {};
          if (hour && hour.a.key !== 'day') mood[hour.a.key as 'dawn' | 'dusk' | 'night'] = 1;
          if (weather && weather.a.key !== 'clear') mood[weather.a.key as 'snow' | 'rain'] = hour?.a.key === 'night' ? 0.75 : 0.9;
          // (the lamps: when they are named; and a night or a dusk lights them itself)
          mood.lamps = lamps ? 1 : hour?.a.key === 'night' ? 1 : hour?.a.key === 'dusk' ? 0.8 : 0;
          return { kind: 'scene', mood, labels: found.map((x) => x.a.label) };
        }

        // a question: the model's score against every passage, with the keyword search's (the hybrid)
        const hits = new Map(search(D.bm25, line, 12).map((h) => [h.id, h.score]));
        const top = Math.max(1e-6, ...hits.values());
        const ranked = D.chunks
          .map((c) => {
            const v = D.vec.get(c.id);
            const dense = v ? cosine(whole, v.v) : 0;
            return { c, dense, score: dense + 0.2 * ((hits.get(c.id) ?? 0) / top) };
          })
          .sort((p, q) => q.score - p.score);
        const hit = ranked[0];
        const source = hit ? `${hit.c.page} · ${hit.c.section.split(' · ')[0]}` : '';
        onStep({ kind: 'search', passages: D.chunks.length, source, score: hit?.dense ?? 0, floor: FLOOR });
        if (!hit || hit.dense < (hits.has(hit.c.id) ? FLOOR_WORD : FLOOR)) return { kind: 'unknown', score: hit?.dense ?? 0, floor: FLOOR };
        // the passage is the answer, word for word; its closest sentence is marked
        const ss = sentences(hit.c.text), sv = D.vec.get(hit.c.id)?.s ?? [];
        let bi = 0;
        for (let i = 1; i < Math.min(ss.length, sv.length); i++) if (cosine(whole, sv[i]!) > cosine(whole, sv[bi]!)) bi = i;
        onStep({ kind: 'travel', place: hit.c.place });
        return {
          kind: 'answer', text: hit.c.text, sentence: ss[bi] ?? '', source, href: hit.c.anchor ? `${hit.c.href}#${hit.c.anchor}` : hit.c.href,
          place: hit.c.place, stretch: hit.c.stretch, u: hit.c.u, score: hit.dense,
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
