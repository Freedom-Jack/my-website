/**
 * The sentence encoder: text in, one unit vector of 384 numbers out (all-MiniLM-L6-v2, 8-bit weights, run by the
 * ONNX runtime's WebAssembly build). The model's own recipe: tokens, the transformer, the mean of the token vectors,
 * unit length. The same code runs in the browser's worker and in the build's index, so a query and a passage are
 * measured the same way.
 */
import type { Tokenizer } from './tokenizer';

/** The part of the ONNX runtime this needs (onnxruntime-web's API; typed here so the page bundles none of it). */
export interface Ort {
  InferenceSession: { create(model: Uint8Array | ArrayBuffer, options?: object): Promise<OrtSession> };
  Tensor: new (type: 'int64', data: BigInt64Array, dims: number[]) => unknown;
}
interface OrtSession {
  readonly inputNames: readonly string[];
  run(feeds: Record<string, unknown>): Promise<Record<string, { data: Float32Array; dims: readonly number[] }>>;
}

export const DIM = 384;

export interface Encoder {
  /** One text's vector (unit length), how many pieces it was cut into, and how long the model took (ms). */
  embed(text: string): Promise<{ vector: Float32Array; pieces: string[]; ms: number }>;
}

export async function createEncoder(ort: Ort, model: Uint8Array | ArrayBuffer, tokenizer: Tokenizer): Promise<Encoder> {
  const session = await ort.InferenceSession.create(model, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  });
  return {
    async embed(text) {
      const { ids, pieces } = tokenizer.encode(text);
      const n = ids.length;
      const big = (v: number[]) => new ort.Tensor('int64', BigInt64Array.from(v.map((x) => BigInt(x))), [1, n]);
      const feeds: Record<string, unknown> = { input_ids: big(ids), attention_mask: big(ids.map(() => 1)) };
      if (session.inputNames.includes('token_type_ids')) feeds.token_type_ids = big(ids.map(() => 0));
      const t0 = performance.now();
      const out = await session.run(feeds);
      const ms = performance.now() - t0;
      const h = out.last_hidden_state ?? Object.values(out)[0];
      const d = h.dims[h.dims.length - 1];
      // the mean of the token vectors (every token counts: one text at a time, no padding), then unit length
      const v = new Float32Array(d);
      for (let i = 0; i < n; i++) for (let j = 0; j < d; j++) v[j] += h.data[i * d + j];
      let len = 0;
      for (let j = 0; j < d; j++) {
        v[j] /= n;
        len += v[j] * v[j];
      }
      len = Math.sqrt(len) || 1;
      for (let j = 0; j < d; j++) v[j] /= len;
      return { vector: v, pieces, ms };
    },
  };
}

/** A unit vector as 8-bit numbers (base64), and back: the index carries every passage's vector this way. */
export function packVector(v: Float32Array): string {
  const b = new Int8Array(v.length);
  for (let i = 0; i < v.length; i++) b[i] = Math.max(-127, Math.min(127, Math.round(v[i] * 127)));
  let s = '';
  const u = new Uint8Array(b.buffer);
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s);
}
export function unpackVector(s: string): Float32Array {
  const bin = atob(s);
  const v = new Float32Array(bin.length);
  let len = 0;
  for (let i = 0; i < bin.length; i++) {
    const x = (bin.charCodeAt(i) << 24) >> 24;
    v[i] = x;
    len += x * x;
  }
  len = Math.sqrt(len) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= len;
  return v;
}
export const cosine = (a: Float32Array, b: Float32Array) => {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += a[i] * b[i];
  return d;
};
