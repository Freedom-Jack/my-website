/// <reference lib="webworker" />
/**
 * The model's worker ("Ask the painting"): everything the language model does happens here, off the page's own
 * thread and inside the visitor's browser. Nothing is fetched until the visitor asks; then, once, from this site:
 * the ONNX runtime's WebAssembly build (public/models/ort), the model's weights and its vocabulary
 * (public/models/minilm). The bytes are counted as they arrive (the page draws them). Nothing typed leaves this
 * worker except as numbers, back to the page.
 *
 *   in   { type: 'load' }                      out  { type: 'progress', loaded, total } ... { type: 'ready', bytes, ms }
 *   in   { type: 'embed', id, texts }          out  { type: 'vectors', id, vectors, pieces, ms }
 *                                              out  { type: 'error', id?, message }
 */
import { createEncoder, type Encoder, type Ort } from './encoder';
import { createTokenizer } from './tokenizer';

const BASE = '/models';
const FILES = [
  { url: `${BASE}/ort/ort-wasm-simd-threaded.wasm`, size: 14848852 },
  { url: `${BASE}/minilm/model_quantized.onnx`, size: 22972370 },
  { url: `${BASE}/minilm/vocab.txt`, size: 231508 },
];
const TOTAL = FILES.reduce((n, f) => n + f.size, 0);

let encoder: Promise<Encoder> | null = null;
const post = (m: unknown) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);

/** A file from this site, its bytes counted as they come. */
async function fetchCounted(url: string, onBytes: (n: number) => void): Promise<Uint8Array> {
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok || !res.body) throw new Error(`${url}: ${res.status}`);
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    n += value.length;
    onBytes(value.length);
  }
  const out = new Uint8Array(n);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

async function load(): Promise<Encoder> {
  const t0 = performance.now();
  let loaded = 0;
  let last = 0;
  const count = (n: number) => {
    loaded += n;
    const now = performance.now();
    if (now - last > 80) {
      last = now;
      post({ type: 'progress', loaded: Math.min(loaded, TOTAL), total: TOTAL });
    }
  };
  const [wasm, model, vocab] = await Promise.all(FILES.map((f) => fetchCounted(f.url, count)));
  post({ type: 'progress', loaded: TOTAL, total: TOTAL });
  // the runtime's own script, from this site too (a plain module: the bundler leaves the address alone)
  const from = `${BASE}/ort/ort.wasm.min.mjs`;
  const ort = (await (new Function('u', 'return import(u)') as (u: string) => Promise<unknown>)(from)) as Ort & {
    env: { wasm: { numThreads: number; wasmPaths: string; wasmBinary: ArrayBuffer | Uint8Array } };
  };
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmPaths = `${BASE}/ort/`;
  ort.env.wasm.wasmBinary = wasm;
  const enc = await createEncoder(ort, model, createTokenizer(new TextDecoder().decode(vocab)));
  await enc.embed('warm up'); // (the first run compiles the graph: the visitor's own line is then timed fairly)
  post({ type: 'ready', bytes: loaded, ms: Math.round(performance.now() - t0) });
  return enc;
}

self.onmessage = (e: MessageEvent<{ type: string; id?: number; texts?: string[] }>) => {
  const m = e.data;
  void (async () => {
    try {
      encoder ??= load();
      const enc = await encoder;
      if (m.type !== 'embed' || !m.texts) return;
      const out = [];
      for (const t of m.texts) out.push(await enc.embed(t));
      post({
        type: 'vectors',
        id: m.id,
        vectors: out.map((o) => o.vector),
        pieces: out.map((o) => o.pieces),
        ms: out.map((o) => o.ms),
      });
    } catch (err) {
      encoder = null;
      post({ type: 'error', id: m.id, message: String((err as Error)?.message || err) });
    }
  })();
};
