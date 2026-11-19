/**
 * The index "Ask the painting" answers from (public/ask/index.json), built with the same model the browser runs
 * (public/models/minilm, all-MiniLM-L6-v2 with 8-bit weights, through the ONNX runtime's WebAssembly build) and the
 * same tokenizer and encoder (src/features/ask), so a visitor's words and a line are measured the same way:
 *   - every line of the site's own words that may stand as an answer (the corpus's units, /craft/corpus.json from a
 *     running server; src/features/ask/lines.ts): its vector, the vector of each of its sentences, and the vector
 *     of every question it is filed under (src/features/ask/questions.ts; the things a skills or stack line names).
 * Vectors are stored as 8-bit numbers (384 each). Run again whenever the words or the questions change (a unit test
 * fails while the index is older than the words):
 *
 *   npm run build:ask -- [--base http://127.0.0.1:3100] [--test "What did you build for insurers?"]
 */
import fs from 'node:fs';
import path from 'node:path';
import * as ort from 'onnxruntime-web';
import { createEncoder, cosine, DIM, packVector, type Ort } from '../src/features/ask/encoder.ts';
import {
  headed,
  linesOf,
  listed,
  listedQuestions,
  sentences,
  type AskChunk,
  type Line,
} from '../src/features/ask/lines.ts';
import { QUESTIONS } from '../src/features/ask/questions.ts';
import { createTokenizer } from '../src/features/ask/tokenizer.ts';
import { opt } from './lib.ts';

const BASE = opt('--base', 'http://127.0.0.1:3100');
const ROOT = path.resolve(import.meta.dirname, '..');
const MODEL = path.join(ROOT, 'public/models/minilm');

(ort as unknown as { env: { wasm: { numThreads: number } } }).env.wasm.numThreads = 1;
const tokenizer = createTokenizer(fs.readFileSync(path.join(MODEL, 'vocab.txt'), 'utf8'));
const encoder = await createEncoder(
  ort as unknown as Ort,
  fs.readFileSync(path.join(MODEL, 'model_quantized.onnx')),
  tokenizer,
);
const embed = async (t: string) => (await encoder.embed(t)).vector;
const packed = async (t: string) => packVector(await embed(t));

const test = opt('--test', '');

const res = await fetch(new URL('/craft/corpus.json', BASE));
if (!res.ok)
  throw new Error(`build-ask: ${BASE}/craft/corpus.json answered ${res.status} (is the build being served?)`);
const corpus = (await res.json()) as { meta: { corpusHash: string }; chunks: AskChunk[] };
const lines = linesOf(corpus.chunks);
const answers = lines.filter((l) => l.answers);

// the questions each line is filed under: [the sentence inside the line it names (-1: the whole line), question,
// and for a listed thing its name: such a question counts only when the visitor names the thing]
type Filed = [sentence: number, question: string, thing?: string];
const filed = new Map<number, Filed[]>();
const file = (l: Line, sentence: number, qs: string[], thing?: string) =>
  filed.set(l.n, [...(filed.get(l.n) ?? []), ...qs.map((q): Filed => (thing ? [sentence, q, thing] : [sentence, q]))]);
for (const [opens, qs] of QUESTIONS) {
  const whole = answers.filter((l) => l.text.startsWith(opens));
  const inside = answers.flatMap((l) =>
    sentences(l.text).flatMap((s, j) => (j > 0 && s.startsWith(opens) ? [{ l, j }] : [])),
  );
  if (whole.length + inside.length !== 1)
    throw new Error(
      `build-ask: "${opens}" opens ${whole.length + inside.length} lines of the site, not one: the words changed; read src/features/ask/questions.ts again`,
    );
  if (whole[0]) file(whole[0], -1, qs);
  else file(inside[0]!.l, inside[0]!.j, qs);
}
// the things a skills line names; then the things only a case's stack names (each thing once, at its first line)
const seen = new Set<string>();
for (const section of ['Skills', 'Stack'])
  for (const l of answers.filter((x) => x.section === section))
    for (const thing of listed(l)) {
      if (seen.has(thing.toLowerCase())) continue;
      seen.add(thing.toLowerCase());
      file(l, -1, listedQuestions(thing), thing);
    }

const t0 = performance.now();
let nq = 0;
const out = {
  model: 'all-MiniLM-L6-v2 (8-bit weights)',
  dim: DIM,
  corpusHash: corpus.meta.corpusHash,
  /** one entry for every line of the corpus, in its order; null: a line that is never an answer */
  lines: [] as (null | { v: string; s?: string[]; q?: [number, string, string?][] })[],
};
for (const l of lines) {
  if (!l.answers) {
    out.lines.push(null);
    continue;
  }
  const ss = sentences(l.text);
  const qs = filed.get(l.n) ?? [];
  nq += qs.length;
  out.lines.push({
    v: await packed(headed(l)),
    ...(ss.length > 1 ? { s: await Promise.all(ss.map(packed)) } : {}),
    ...(qs.length
      ? {
          q: await Promise.all(
            qs.map(async ([j, q, thing]): Promise<[number, string, string?]> =>
              thing ? [j, await packed(q), thing] : [j, await packed(q)],
            ),
          ),
        }
      : {}),
  });
}

if (test) {
  // a question against the index, as the browser will read it: the five closest lines (the line itself, or a
  // question it is filed under), with their scores
  const { unpackVector } = await import('../src/features/ask/encoder.ts');
  const q = await embed(test);
  const scored = lines.flatMap((l, n) => {
    const e = out.lines[n];
    if (!e) return [];
    let score = cosine(q, unpackVector(e.v));
    for (const [, v] of e.q ?? []) score = Math.max(score, cosine(q, unpackVector(v)));
    return [{ l, score }];
  });
  scored.sort((a, b) => b.score - a.score);
  for (const { l, score } of scored.slice(0, 5))
    console.log(score.toFixed(3), `${l.chunk.page} · ${l.section}`.padEnd(34), l.text.slice(0, 90));
  process.exit(0);
}

const target = path.join(ROOT, 'public/ask/index.json');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(out));
console.log(
  `build-ask: ${answers.length} lines of ${lines.length} (${filed.size} filed under ${nq} questions), corpus ${corpus.meta.corpusHash}, in ${Math.round(performance.now() - t0)} ms -> public/ask/index.json (${Math.round(fs.statSync(target).size / 1024)} KB)`,
);
