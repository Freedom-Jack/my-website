/**
 * The windows' stills, cut at build time from the real engine: each window into the painting (elements.ts glimpses)
 * has its own still, its rest pose ("Still the landscape" on), cut from the page at 390 × 844 (DPR 2) with the header
 * hidden: public/scenes/glimpse/<page>-<j>@1x|2x.webp + public/scenes/manifest.json. (The footer story map's five
 * place stills went with it in the vanguard round: the lead's ruling R12; nothing read them since P2's tail.)
 *
 *   NEXT_PUBLIC_INK_QA=1 npm run build && npm start     a QA build (it exposes the engine as window.__inkEngine)
 *   npm run build:stills                                cut them all; needs Google Chrome (headless, SwiftShader)
 *   npm run build:stills -- --preview <dir>             also keep the raw crops (outside the repo)
 *   npm run build:stills -- --check                     no browser: exit 1 when the stills are stale (CI)
 *
 * Per page with windows (GLIMPSE_PAGES): opens it with "Still the landscape" on, scrolls each window to the middle of
 * the view, waits on the engine's own stats() (no fixed delays) until that window is painted and the loop is quiet,
 * captures it twice (byte-identical, or refused), steps it down to 1x and 2x and encodes WebP.
 *
 * --check recomputes the input hash (the engine: src/features/landscape/engine/**\/*.ts; elements.ts; the windows'
 * pages' config in places.ts; the strip-height tokens, which size the windows; this tool's settings), compares it and
 * each file's hash with the manifest and checks the size caps. Exit 1 = stale: regenerate.
 * REGENERATE AFTER ANY ENGINE, SET, PALETTE, PLACE OR STRIP-HEIGHT CHANGE.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Page } from '@playwright/test';
import { PLACES as SITE_PLACES } from '../src/features/landscape/places.ts';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string, d: string) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1]! : d;
};

const DENSITIES = [1, 2] as const;
const STABLE_MS = 1500; // two captures this far apart must match before a still is cut
const CHROME_ARGS = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--disable-gpu-sandbox',
  '--hide-scrollbars',
];
const OUT_DIR = path.join(ROOT, 'public', 'scenes');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');

// ------------------------------------------------------------------------------------------------ the windows' stills
// The windows (elements.ts glimpses): each window into the painting has its own still, its rest pose ("Still the
// landscape" on), cut from the page at 390 x 844 (DPR 2) with the words hidden: public/scenes/glimpse/<id>@1x|2x.webp.
// The window shows it until the engine paints it (and wherever it cannot), then cross-fades to the painting (layout.css
// .glimpse[data-live]). Recorded in the manifest's `glimpses` (inputs: the same as the map's).
const GLIMPSE_PAGES = [
  { page: 'home', route: '/', n: 2 },
  { page: 'work', route: '/work/', n: 2 },
  { page: 'resume', route: '/resume/', n: 2 }, // (before Experience and before Skills; never in the timeline)
] as const;
const GLIMPSE_VP = { width: 390, height: 844, dpr: 2 };
const GLIMPSE_DIR = path.join(OUT_DIR, 'glimpse');
const GLIMPSE_Q = 0.8;
const CAP_GLIMPSE = 40 * 1024; // bytes, any one window's still
const CAP_GLIMPSE_TOTAL = 260 * 1024; // all of them (12 files)
const glimpseName = (page: string, j: number, d: number) => `${page}-${j}@${d}x.webp`;
// (the box holds no words: only the header, which may return over it, is hidden)
const GLIMPSE_HIDE = `.site-header, .skip-link, .seal { visibility: hidden !important; }`; // (the seal too: it would leave a red row on Home's first window)
// window j of the page's laid-out ones painted and shown, at rest, and the loop quiet
const GLIMPSE_SETTLE_JS = `(async ([n, j]) => {
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const h = window.__ink; if (!h) return false;
  const s = h.stats();
  if (s.arriving || s.pending || s.sweeping || s.deferred || !s.still) return false;
  const l = (s.glimpses && s.glimpses.list || []).filter((g) => !g.end && Number.isFinite(g.doc) && g.doc > 0);
  return l.length === n && l[j] && l[j].painted && l[j].live ? 'settled' : false;
})`;
const GLIMPSE_ENCODE_JS = `(async ([b64, sizes, quality]) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const out = {};
  for (const [d, w, h] of sizes) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, w, h);
    const url = c.toDataURL('image/webp', quality);
    if (!url.startsWith('data:image/webp;base64,')) return { error: 'this Chrome cannot encode WebP' };
    out[d] = url.slice('data:image/webp;base64,'.length);
  }
  return out;
})`;

// ------------------------------------------------------------------------------------------------ inputs and hashes
const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join('/');
const sha = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** Every input that shapes the stills, as [label, sha256] pairs, sorted by label. */
function inputs(): [string, string][] {
  const items: [string, string][] = [];
  for (const p of walk(path.join(ROOT, 'src', 'features', 'landscape', 'engine')))
    if (p.endsWith('.ts')) items.push([rel(p), sha(readFileSync(p))]);
  // (the element switches decide what the engine and the figure sets paint)
  const elements = path.join(ROOT, 'src', 'features', 'landscape', 'elements.ts');
  items.push([rel(elements), sha(readFileSync(elements))]);
  // only the page's config, not its words: what <main data-*> tells the engine, and the strip's kind (its height)
  for (const g of GLIMPSE_PAGES) {
    const { stretch, distance, presence, horizon, ground, strip } = SITE_PLACES[g.page];
    const config = { stretch, distance, presence, horizon, ground, strip };
    items.push([`src/features/landscape/places.ts#${g.page}`, sha(JSON.stringify(config))]);
  }
  // the strip heights size the windows, hence their framings: each --strip-* / --closing-* / --glimpse-* line with its
  // media query
  let media = '';
  const lines: string[] = [];
  for (const l of readFileSync(path.join(ROOT, 'src', 'styles', 'tokens.css'), 'utf8').split('\n')) {
    if (l.includes('@media')) media = l.trim();
    else if (/^\s*--(strip|closing|glimpse)-/.test(l)) lines.push(`${media} | ${l.trim()}`);
  }
  items.push(['src/styles/tokens.css#strip-heights', sha(lines.join('\n'))]);
  const settings = {
    densities: DENSITIES,
    stable: STABLE_MS,
    chrome: CHROME_ARGS,
    glimpses: [GLIMPSE_PAGES, GLIMPSE_VP, GLIMPSE_Q, GLIMPSE_HIDE, GLIMPSE_SETTLE_JS, GLIMPSE_ENCODE_JS],
  };
  items.push(['tools/build-stills.ts#settings', sha(JSON.stringify(settings))]);
  return items.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}
const inputHash = (items: [string, string][]) => sha(items.map(([a, b]) => `${a} ${b}`).join('\n'));

/**
 * Chrome's encoder wraps the image in VP8X with an ICC profile (sRGB, ~0.5 KB). Keep only the lossy bitstream
 * ('VP8 ' in a bare RIFF/WEBP: untagged means sRGB): smaller, and no metadata chunk of any kind.
 */
function plainWebp(data: Buffer): Buffer {
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

interface Manifest {
  about?: string;
  inputs?: string;
  inputList?: Record<string, string>;
  glimpses?: Record<string, { bytes: number; sha256: string; size: [number, number] }>;
}
function readManifest(): Manifest | null {
  try {
    return JSON.parse(readFileSync(MANIFEST, 'utf8')) as Manifest;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------------------------------------ --check
function check(): number {
  const man = readManifest();
  if (!man) {
    console.log('stills: no readable manifest; run npm run build:stills');
    return 1;
  }
  const problems: string[] = [];
  const items = inputs();
  if (man.inputs !== inputHash(items)) {
    const now = Object.fromEntries(items);
    const was = man.inputList ?? {};
    const changed = [...new Set([...Object.keys(now), ...Object.keys(was)])].filter((k) => now[k] !== was[k]).sort();
    problems.push(`the generating inputs changed: ${changed.join(', ') || '(no per-file list in the manifest)'}`);
  }
  let gTotal = 0;
  for (const g of GLIMPSE_PAGES)
    for (let j = 0; j < g.n; j++)
      for (const d of DENSITIES) {
        const f = glimpseName(g.page, j, d);
        const p = path.join(GLIMPSE_DIR, f);
        if (!existsSync(p)) {
          problems.push(`missing: ${rel(p)}`);
          continue;
        }
        const data = readFileSync(p);
        gTotal += data.length;
        if (man.glimpses?.[f]?.sha256 !== sha(data))
          problems.push(`${rel(p)} differs from the manifest (edited by hand?)`);
        if (data.length > CAP_GLIMPSE) problems.push(`${rel(p)} is ${data.length} bytes (cap ${CAP_GLIMPSE})`);
      }
  if (gTotal > CAP_GLIMPSE_TOTAL)
    problems.push(`the windows' stills weigh ${gTotal} bytes together (cap ${CAP_GLIMPSE_TOTAL})`);
  if (problems.length) {
    for (const p of problems) console.log('STALE:', p);
    console.log('stills: STALE; regenerate with npm run build:stills (a QA build must be serving)');
    return 1;
  }
  const n = GLIMPSE_PAGES.reduce((k, g) => k + g.n * DENSITIES.length, 0);
  console.log(`stills: up to date (${n} files, ${gTotal} bytes; inputs ${man.inputs!.slice(0, 12)})`);
  return 0;
}

// ------------------------------------------------------------------------------------------------ build
async function waitFor(page: Page, fn: string, arg: unknown, what: string, timeout: number) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await page.evaluate(`${fn}(${JSON.stringify(arg)})`)) return;
    await page.waitForTimeout(150);
  }
  throw new Error(`${what}: not settled in ${timeout} ms`);
}

async function build(): Promise<number> {
  const base = opt('--base', 'http://127.0.0.1:3100');
  const timeout = Number(opt('--timeout', '90000'));
  const preview = opt('--preview', '');
  if (preview) {
    if (!path.relative(ROOT, path.resolve(preview)).startsWith('..'))
      throw new Error(`--preview must be outside the repo: ${preview}`);
    await mkdir(preview, { recursive: true });
  }
  const man = readManifest() ?? {};
  const glimpseFiles = { ...man.glimpses };
  const report: Record<string, unknown>[] = [];

  const browser = await chromium.launch({ ...(process.env.CI ? {} : { channel: 'chrome' }), args: CHROME_ARGS });
  try {
    await mkdir(GLIMPSE_DIR, { recursive: true });
    const gctx = await browser.newContext({
      viewport: { width: GLIMPSE_VP.width, height: GLIMPSE_VP.height },
      deviceScaleFactor: GLIMPSE_VP.dpr,
      isMobile: true,
      hasTouch: true,
    });
    await gctx.addInitScript(() => {
      (window as unknown as { __inkLive?: boolean }).__inkLive = true;
      try {
        localStorage.setItem('ink:still', '1');
        sessionStorage.setItem('ink:morning', '1');
        sessionStorage.setItem('ink:swash', '1');
      } catch {
        /* private mode */
      }
      Object.assign(window, { __glimSoft: true });
    });
    for (const g of GLIMPSE_PAGES) {
      const t0 = Date.now();
      const page = await gctx.newPage();
      const res = await page.goto(new URL(g.route, base).toString(), { waitUntil: 'load' });
      if (!res?.ok()) throw new Error(`${g.route}: HTTP ${res?.status()}`);
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({ content: GLIMPSE_HIDE });
      const boxes = (await page.evaluate(
        `[...document.querySelectorAll('[data-landscape="glimpse"]')].map((e) => { const b = e.getBoundingClientRect(); return [b.top + scrollY, b.height, b.left, b.width]; }).filter((b) => b[1] > 0)`,
      )) as number[][];
      if (boxes.length !== g.n)
        throw new Error(`${g.page}: ${boxes.length} windows laid out at 390, the table says ${g.n}`);
      for (const [j, [top, h, left, width]] of boxes.entries()) {
        await page.evaluate(
          (y) => window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior }),
          Math.max(0, top! + h! / 2 - GLIMPSE_VP.height / 2),
        );
        await waitFor(page, GLIMPSE_SETTLE_JS, [g.n, j], `${g.page} window ${j}`, timeout);
        const y = (await page.evaluate('scrollY')) as number;
        const shot = () =>
          page.screenshot({
            clip: { x: left!, y: top! - y, width: width!, height: h! },
            scale: 'device',
            animations: 'allow',
            caret: 'initial',
          });
        let png = await shot();
        for (let tries = 0; ; tries++) {
          await page.waitForTimeout(STABLE_MS);
          const again = await shot();
          if (again.equals(png)) break;
          if (tries >= 3)
            throw new Error(`${g.page} window ${j}: the painting kept changing between captures; nothing written`);
          png = again;
        }
        if (preview) await writeFile(path.join(preview, `glimpse-${g.page}-${j}-crop.png`), png);
        const sizes = DENSITIES.map((d) => [d, Math.round(width! * d), Math.round(h! * d)]);
        const out = (await page.evaluate(
          `${GLIMPSE_ENCODE_JS}(${JSON.stringify([png.toString('base64'), sizes, GLIMPSE_Q])})`,
        )) as Record<string, string> & { error?: string };
        if (out.error) throw new Error(`${g.page} window ${j}: ${out.error}`);
        for (const [d, w2, h2] of sizes) {
          const data = plainWebp(Buffer.from(String(out[String(d)]), 'base64'));
          const f = glimpseName(g.page, j, d!);
          await writeFile(path.join(GLIMPSE_DIR, f), data);
          glimpseFiles[f] = { bytes: data.length, sha256: sha(data), size: [w2!, h2!] };
        }
        report.push({
          place: `window ${g.page}-${j}`,
          'capture px': `${Math.round(width! * 2)}x${Math.round(h! * 2)}`,
          '1x bytes': glimpseFiles[glimpseName(g.page, j, 1)]!.bytes,
          '2x bytes': glimpseFiles[glimpseName(g.page, j, 2)]!.bytes,
          s: Math.round((Date.now() - t0) / 100) / 10,
        });
      }
      await page.close();
    }
    await gctx.close();
  } finally {
    await browser.close();
  }

  const items = inputs();
  const next: Manifest = {
    about:
      "The windows' stills, made by tools/build-stills.ts from the engine; regenerate after any engine or scene change. inputs = sha256 over inputList.",
    inputs: inputHash(items),
    inputList: Object.fromEntries(items),
    // (only the windows the table lays out: a window removed from a page leaves no entry behind)
    glimpses: Object.fromEntries(
      Object.entries(glimpseFiles)
        .filter(([f]) =>
          GLIMPSE_PAGES.some((g) =>
            Array.from({ length: g.n }, (_, j) => DENSITIES.some((d) => glimpseName(g.page, j, d) === f)).some(Boolean),
          ),
        )
        .sort(([a], [b]) => (a < b ? -1 : 1)),
    ),
  };
  await writeFile(MANIFEST, `${JSON.stringify(next, null, 1)}\n`);
  console.table(report);
  const total = Object.values(next.glimpses ?? {}).reduce((k, f) => k + f.bytes, 0);
  console.log(
    `\n${Object.keys(next.glimpses ?? {}).length} files, ${total} bytes in ${rel(GLIMPSE_DIR)}/; manifest ${rel(MANIFEST)}`,
  );
  return 0;
}

const run = flag('--check') ? Promise.resolve(check()) : build();
run.then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(`build-stills: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  },
);
