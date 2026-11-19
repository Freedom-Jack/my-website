// What the tools share: their command-line options, hashing, a folder's files, Chrome's WebP made plain, and a wait on
// a condition in the page.
import { createHash } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';

const args = process.argv.slice(2);
/** Whether a bare option was passed (`--check`). */
export const flag = (name: string) => args.includes(name);
/** An option's value (`--base http://127.0.0.1:3100`), or `d` when it is not passed. */
export const opt = (name: string, d: string) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1]! : d;
};

/** A path relative to the repository (the working directory), with forward slashes. */
export const rel = (p: string) => path.relative(process.cwd(), p).split(path.sep).join('/');
export const sha = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');

/** Every file under `dir`, recursively. */
export function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/**
 * Chrome's encoder wraps the image in VP8X with an ICC profile (sRGB, ~0.5 KB). Keep only the lossy bitstream
 * ('VP8 ' in a bare RIFF/WEBP: untagged means sRGB): smaller, and no metadata chunk of any kind.
 */
export function plainWebp(data: Buffer): Buffer {
  if (data.toString('latin1', 0, 4) !== 'RIFF' || data.toString('latin1', 8, 12) !== 'WEBP')
    throw new Error('not a WebP');
  const chunks = new Map<string, Buffer>();
  let i = 12;
  while (i + 8 <= data.length) {
    const tag = data.toString('latin1', i, i + 4);
    const n = data.readUInt32LE(i + 4);
    if (!chunks.has(tag)) chunks.set(tag, data.subarray(i + 8, i + 8 + n));
    i += 8 + n + (n & 1);
  }
  const body = chunks.get('VP8 ');
  if (!body || chunks.has('ALPH') || chunks.has('ANIM')) return data; // not the simple lossy case: leave it whole
  const size = Buffer.alloc(4);
  size.writeUInt32LE(body.length);
  const vp8 = Buffer.concat([
    Buffer.from('VP8 ', 'latin1'),
    size,
    body,
    body.length & 1 ? Buffer.alloc(1) : Buffer.alloc(0),
  ]);
  const riff = Buffer.alloc(4);
  riff.writeUInt32LE(4 + vp8.length);
  return Buffer.concat([Buffer.from('RIFF', 'latin1'), riff, Buffer.from('WEBP', 'latin1'), vp8]);
}

/** Until `fn(arg)` (a function's source, called in the page) answers truthy, asked every 150 ms; `what` names it in
 *  the error after `timeout` ms. */
export async function waitFor(page: Page, fn: string, arg: unknown, what: string, timeout: number) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await page.evaluate(`${fn}(${JSON.stringify(arg)})`)) return;
    await page.waitForTimeout(150);
  }
  throw new Error(`${what}: not ready in ${timeout} ms`);
}
