/**
 * The index "Ask the painting" answers from (public/ask/index.json), built with the same model the browser runs
 * (public/models/minilm, all-MiniLM-L6-v2 with 8-bit weights, through the ONNX runtime's WebAssembly build) and the
 * same tokenizer and encoder (src/features/ask), so a visitor's words and a passage are measured the same way:
 *   - every passage of the site's own words (the search's corpus, /craft/corpus.json from a running server): its
 *     vector and the vector of each of its sentences (the answer is the passage; its closest sentence is marked);
 *   - every phrase of the scene's anchors and of the router's two kinds (src/features/ask/scene.ts).
 * Vectors are stored as 8-bit numbers (384 each). Run again whenever the words or the anchors change:
 *
 *   npm run build:ask -- [--base http://127.0.0.1:3105] [--test "snow at dusk, the lanterns lit"]
 */
import fs from 'node:fs';
import path from 'node:path';
import * as ort from 'onnxruntime-web';
import { createEncoder, cosine, DIM, packVector, type Ort } from '../src/features/ask/encoder.ts';
import { ANCHORS, KINDS, clauses } from '../src/features/ask/scene.ts';
import { createTokenizer } from '../src/features/ask/tokenizer.ts';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => (args.includes(k) ? args[args.indexOf(k) + 1]! : d);
const BASE = opt('--base', 'http://127.0.0.1:3105');
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

/** A passage's sentences (the answer's closest one is marked on the page). */
export const sentences = (text: string) =>
  text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9“"(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);

const test = opt('--test', '');
if (test) {
  // a line against the anchors, as the browser will read it
  const parts = clauses(test);
  const vs = await Promise.all(parts.map(embed));
  for (const a of ANCHORS) {
    let best = 0;
    for (const p of a.phrases) {
      const pv = await embed(p);
      for (const v of vs) best = Math.max(best, cosine(v, pv));
    }
    console.log(best.toFixed(3), a.group.padEnd(8), a.key);
  }
  for (const [kind, phrases] of Object.entries(KINDS)) {
    let best = 0;
    for (const p of phrases) best = Math.max(best, cosine(vs[0]!, await embed(p)));
    console.log(best.toFixed(3), 'kind    ', kind);
  }
  process.exit(0);
}

const res = await fetch(new URL('/craft/corpus.json', BASE));
if (!res.ok)
  throw new Error(`build-ask: ${BASE}/craft/corpus.json answered ${res.status} (is the build being served?)`);
const corpus = (await res.json()) as {
  meta: { corpusHash: string };
  chunks: { id: string; text: string; page: string; section: string }[];
};

const t0 = performance.now();
const passages: { id: string; v: string; s: string[] }[] = [];
for (const c of corpus.chunks) {
  const ss = sentences(c.text);
  // (a passage is measured with its own heading: "Contact. Say hello. …": a question names the subject more often
  // than the passage's first words do)
  passages.push({
    id: c.id,
    v: packVector(await embed(`${c.page}. ${c.section.replace(/ · /g, ', ')}. ${c.text}`)),
    s: await Promise.all(ss.map(async (s) => packVector(await embed(s)))),
  });
}
const anchors: Record<string, string[]> = {};
for (const a of ANCHORS) anchors[a.key] = await Promise.all(a.phrases.map(async (p) => packVector(await embed(p))));
const kinds: Record<string, string[]> = {};
for (const [k, phrases] of Object.entries(KINDS))
  kinds[k] = await Promise.all(phrases.map(async (p) => packVector(await embed(p))));

const out = {
  model: 'all-MiniLM-L6-v2 (8-bit weights)',
  dim: DIM,
  corpusHash: corpus.meta.corpusHash,
  passages,
  anchors,
  kinds,
};
const file = path.join(ROOT, 'public/ask/index.json');
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(out));
console.log(
  `build-ask: ${passages.length} passages, ${passages.reduce((n, p) => n + p.s.length, 0)} sentences, ${ANCHORS.length} anchors in ${Math.round(performance.now() - t0)} ms -> public/ask/index.json (${Math.round(fs.statSync(file).size / 1024)} KB)`,
);
