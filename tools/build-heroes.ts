/**
 * The heroes' stills: each mapped page's strip window as the engine's own FIRST FRAME paints it, at the three width
 * classes (wide 1440 × 900, tablet 1000 × 1200, phone 430 × 844) at DPR 1 and 2, cut from the real engine on this
 * machine's GPU: public/scenes/hero/<place>-<class>@<d>x.webp + manifest.json, read by components/page/Strip. The
 * still is the first screen's painting from the first paint, before any script (and the painting without JS or
 * WebGL); the engine's first frame lands finished under it and it fades out (layout.css .strip__still, [data-live]).
 *
 *   NEXT_PUBLIC_INK_QA=1 npm run build && npm start -- -p 3210   a QA build (it exposes the engine as window.__inkEngine)
 *   npm run build:heroes -- --base http://127.0.0.1:3210          cut every page; needs Google Chrome (headless, Metal)
 *   npm run build:heroes -- --places home,work                    some of them (the manifest stays stale until a full run)
 *   npm run build:heroes -- --preview <dir>                       also keep the raw captures (outside the repo)
 *   npm run build:heroes -- --check                               no browser: exit 1 when the stills are stale (CI)
 *
 * Per page × class × density:
 *   1. Opens the page at the class's viewport and waits for its own engine module (window.__inkEngine).
 *   2. Hides the words (visibility only: the keep-out and the veils keep measuring their lines) and any still already
 *      in the box, then remounts the engine with the page's own targets, as Landscape.tsx mounts it (the same windows,
 *      keep-outs, veils, wake, palette, quality), with no arrival, firstFrame 'complete' (the first present waits for
 *      the page's figure layer and its stage) and the QA hold (qa({ hold: true }): the loop stops on that present), so
 *      the canvas holds exactly the frame the live page hands over to.
 *   3. Captures the strip's box at the device's scale, twice (byte-identical, or refused).
 *   4. Encodes WebP in the page at the capture's own size (no rescale; the live canvas is upscaled from its buffer the
 *      same way), drops the encoder's ICC chunk, writes the file.
 *   5. Writes the manifest: each still's box (CSS px), pixel size, bytes and hash, and the inputs' hash (the engine,
 *      the elements, the places' config, the strip-height tokens and the strip's CSS, this tool's settings).
 *   6. From the phone's 1x capture, the seed (<name>-phone-seed.webp, under 1 KB): the still shrunk to about 96 px
 *      and encoded until it fits, written to the manifest as base64 too, which Strip inlines in the HTML as the
 *      phone's <img> (no request for the first screen's painting; too low in entropy to be the LCP element).
 *      Where a route's Lighthouse mobile LCP would miss 2.5 s waiting for the fetched still (INLINE_SHARP: Home, the
 *      lead's ruling R9), the seed IS the phone@1x still itself (about 5 KB): the painting is sharp at first paint and
 *      is the LCP at FCP; the @2x still swaps in over it at DPR 2 and above, in the same box (no new LCP candidate).
 * --check recomputes the inputs' hash and each file's, and the size caps. Exit 1 = stale: regenerate.
 * REGENERATE AFTER ANY ENGINE, SET, PALETTE, PLACE, STRIP-HEIGHT OR STRIP-CSS CHANGE (and when a hero's words change
 * on a wide screen: the title block's width shapes the keep-out, hence the framing).
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Page } from '@playwright/test';
import { PLACES as SITE_PLACES, type PageId } from '../src/features/landscape/places.ts';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string, d: string) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1]! : d;
};

// ------------------------------------------------------------------------------------------------ settings
type ClassName = 'wide' | 'tablet' | 'phone';
interface Cls {
  name: ClassName;
  /** The media query Strip's <source> uses (the engine's width classes: compose.ts widthClass). */
  media: string;
  viewport: { width: number; height: number };
  mobile: boolean;
  /** canvas.toDataURL('image/webp', q) per density. */
  q: Record<1 | 2, number>;
  /** bytes, any one file of this class */
  cap: number;
}
const CLASSES: Cls[] = [
  {
    name: 'wide',
    media: '(min-width: 75rem)',
    viewport: { width: 1440, height: 900 },
    mobile: false,
    q: { 1: 0.8, 2: 0.66 },
    cap: 60 * 1024,
  },
  {
    name: 'tablet',
    media: '(min-width: 40rem)',
    viewport: { width: 1000, height: 1200 },
    mobile: true,
    q: { 1: 0.8, 2: 0.7 },
    cap: 40 * 1024,
  },
  {
    name: 'phone',
    media: '',
    // (cut at 430, the widest common phone, and laid over the box with object-fit: cover, so the inline seed is never
    // upscaled on a phone and the @2x laid over it is the same box, never a larger LCP candidate: the lead's ruling R12;
    // at the old 390 px cut Lighthouse's 412 px phone took the @2x for a new LCP)
    viewport: { width: 430, height: 844 },
    mobile: true,
    q: { 1: 0.82, 2: 0.74 },
    cap: 25 * 1024,
  },
];
const DENSITIES = [1, 2] as const;
interface Hero {
  name: 'home' | 'work' | 'writing' | 'resume' | 'contact' | 'case' | 'note';
  page: PageId;
  route: string;
}
// (the vanguard round: a case and a note open INSIDE their place, closer and further along it (places.ts `inside`), so
// each deep page kind has its own still, cut from one of them: the six cases share one framing, the notes one)
const PAGES: Hero[] = [
  { name: 'home', page: 'home', route: '/' },
  { name: 'work', page: 'work', route: '/work/' },
  { name: 'case', page: 'case', route: '/work/rag-assistant/' },
  { name: 'writing', page: 'writing', route: '/writing/' },
  { name: 'note', page: 'article', route: '/writing/what-is-an-ai-agent/' },
  { name: 'resume', page: 'resume', route: '/resume/' },
  { name: 'contact', page: 'contact', route: '/contact/' },
];
const PALETTE = 'misted';
const STABLE_MS = 600; // two captures this far apart must match before a still is cut
const CHROME_ARGS = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'];
const OUT_DIR = path.join(ROOT, 'public', 'scenes', 'hero');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');
const fileName = (h: Hero, c: ClassName, d: number) => `${h.name}-${c}@${d}x.webp`;
/** The phone's seed: the phone@1x capture shrunk to the first of these widths and encoded at the first of these
 *  qualities that lands under SEED_CAP bytes. Strip inlines it in the HTML as a data URI (the first screen's painting
 *  costs no request), and at under 0.05 bits per displayed pixel Chrome never takes it for the LCP element: the words
 *  stay the LCP. The sharp phone still stands over it only where no painting will come. */
const SEED_WIDTHS = [96, 80, 64];
const SEED_QS = [0.75, 0.6, 0.5, 0.4, 0.3, 0.2];
const SEED_CAP = 1024;
const seedName = (h: Hero) => `${h.name}-phone-seed.webp`;
/** R9: the places whose inline seed is the sharp phone@1x still itself (no blur seed file; the cap is SHARP_SEED_CAP).
 *  A place joins only when its Lighthouse mobile LCP misses 2.5 s with the small seed (vanguard/07-measurements.md,
 *  P6: Home 2.61 s; the case, the note and the Résumé 2.53 s) AND its HTML has the room under 30,000 B gzip (the
 *  inline still is sent twice, in the HTML and in the flight data: about 2 B gzip per byte of WebP). Work (29.6 KB)
 *  has no room: it keeps its small seed alone on the first screen and its sharp still only in the still states
 *  (Strip SEED_ALONE, the lead's ruling R12), so its LCP is the words. */
const INLINE_SHARP: ReadonlySet<Hero['name']> = new Set(['home', 'case', 'note', 'resume']);
const SHARP_SEED_CAP = 12 * 1024;

// ------------------------------------------------------------------------------------------------ in the page
// (the words stay laid out and, to the engine, visible: their ink, backgrounds and marks are made transparent instead of
// hidden, because the veils skip text whose visibility is hidden (textBox); a still already in the box is hidden so the
// capture is the canvas)
const HIDE_CSS = `
.site-header, .skip-link, .seal { visibility: hidden !important; }
.strip__text, .strip__text * { color: transparent !important; -webkit-text-fill-color: transparent !important; text-decoration-color: transparent !important; background: transparent !important; border-color: transparent !important; box-shadow: none !important; text-shadow: none !important; }
.strip__text *::before, .strip__text *::after { background: transparent !important; border-color: transparent !important; box-shadow: none !important; }
.strip__text :is(svg, img, video, canvas) { visibility: hidden !important; }
.strip__still { display: none !important; }
`;
// The page's own targets (targets.ts targetsOf, kept in step with it) and Landscape.tsx's options, with no arrival
// (the still IS the settled painting), firstFrame 'complete' and the QA hold.
const REMOUNT_JS = `(async ([palette]) => {
  const eng = window.__inkEngine;
  const canvas = document.querySelector('canvas.landscape');
  const main = document.getElementById('main');
  if (!canvas || !main || typeof eng?.mountLandscape !== 'function') return 'no-engine (a QA build? NEXT_PUBLIC_INK_QA=1)';
  const d = main.dataset, html = document.documentElement;
  const on = (k) => html.classList.contains('el-' + k);
  const targets = {
    strip: main.querySelector('[data-landscape="strip"]'),
    closing: main.querySelector('[data-landscape="closing"]'),
    keepout: main.querySelectorAll('[data-landscape="keepout"]'),
    glimpse: on('glimpses') ? main.querySelectorAll('[data-landscape="glimpse"], [data-glimpse="end"]') : [],
    veil: [...main.querySelectorAll('[data-veil]'), ...(on('cameraTravels') || on('unroll') ? document.querySelectorAll('.site-footer .tail__colophon, .site-footer .tail__stamp, .site-footer .tail__base') : [])],
    wake: main.querySelectorAll('[data-wake]'),
    horizon: Number(d.horizon ?? 0.6),
    ground: d.ground === 'living' ? 'living' : '',
    inside: d.inside === undefined ? false : d.inside === '' || Number.isNaN(Number(d.inside)) ? true : Number(d.inside),
  };
  const h = eng.mountLandscape(canvas, {
    stretch: Number(d.stretch), distance: d.distance, presence: Number(d.presence), palette, ...targets,
    still: html.classList.contains('is-still'), arrival: 'none', firstFrame: 'complete',
  });
  if (typeof h.qa !== 'function') return 'no-qa (a QA build? NEXT_PUBLIC_INK_QA=1)';
  h.qa({ hold: true });
  window.__heroHandle = h;
  return h.mode;
})`;
// Held: the first present is on the canvas and the loop has stopped on it (nothing pending, every figure layer in).
const HELD_JS = `(() => {
  const h = window.__heroHandle;
  if (!h) return false;
  const s = h.stats();
  if (s.presents < 1 || s.running || s.pending || s.arriving) return false;
  if (Object.values(s.figures || {}).includes('pending')) return false;
  return 'held';
})`;
const BOX_JS = `(() => { const e = document.querySelector('main [data-landscape="strip"]'); if (!e) return null;
  const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; })()`;
const ENCODE_JS = `(async ([b64, quality]) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const url = c.toDataURL('image/webp', quality);
  if (!url.startsWith('data:image/webp;base64,')) return { error: 'this Chrome cannot encode WebP' };
  return { size: [c.width, c.height], webp: url.slice('data:image/webp;base64,'.length) };
})`;
// The seed: the capture shrunk to `width` (smoothly), encoded at each quality asked for (Node picks the first under the cap).
const SEED_JS = `(async ([b64, width, qs]) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const w = width, h = Math.max(2, Math.round((img.naturalHeight * width) / img.naturalWidth));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, w, h);
  const out = [];
  for (const q of qs) {
    const url = c.toDataURL('image/webp', q);
    if (!url.startsWith('data:image/webp;base64,')) return { error: 'this Chrome cannot encode WebP' };
    out.push({ q, webp: url.slice('data:image/webp;base64,'.length) });
  }
  return { size: [w, h], out };
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
/** Every input that shapes the stills, as [label, sha256] pairs, sorted by label (as tools/build-stills.ts does). */
function inputs(): [string, string][] {
  const items: [string, string][] = [];
  for (const p of walk(path.join(ROOT, 'src', 'features', 'landscape', 'engine')))
    if (p.endsWith('.ts')) items.push([rel(p), sha(readFileSync(p))]);
  const elements = path.join(ROOT, 'src', 'features', 'landscape', 'elements.ts');
  items.push([rel(elements), sha(readFileSync(elements))]);
  for (const h of PAGES) {
    const { stretch, distance, presence, horizon, ground, strip, inside } = SITE_PLACES[h.page];
    items.push([
      `src/features/landscape/places.ts#${h.page}`,
      sha(JSON.stringify({ stretch, distance, presence, horizon, ground, strip, inside: inside ?? false })),
    ]);
  }
  // the strip heights size the box, hence its framing: each --strip-* line with its media query
  let media = '';
  const lines: string[] = [];
  for (const l of readFileSync(path.join(ROOT, 'src', 'styles', 'tokens.css'), 'utf8').split('\n')) {
    if (l.includes('@media')) media = l.trim();
    else if (/^\s*--strip-/.test(l)) lines.push(`${media} | ${l.trim()}`);
  }
  items.push(['src/styles/tokens.css#strip-heights', sha(lines.join('\n'))]);
  // the strip's own layout (the box's grid, the title block's width at wide: the keep-out)
  const css = readFileSync(path.join(ROOT, 'src', 'styles', 'layout.css'), 'utf8');
  const m = css.match(/The painted strip[\s\S]*?(?=\/\* =====)/);
  items.push(['src/styles/layout.css#strip', sha(m ? m[0] : css)]);
  const settings = {
    classes: CLASSES,
    densities: DENSITIES,
    pages: PAGES,
    palette: PALETTE,
    chrome: CHROME_ARGS,
    seed: { widths: SEED_WIDTHS, qs: SEED_QS, cap: SEED_CAP, sharp: [...INLINE_SHARP], sharpCap: SHARP_SEED_CAP },
    js: [HIDE_CSS, REMOUNT_JS, HELD_JS, ENCODE_JS, SEED_JS],
  };
  items.push(['tools/build-heroes.ts#settings', sha(JSON.stringify(settings))]);
  return items.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}
const inputHash = (items: [string, string][]) => sha(items.map(([a, b]) => `${a} ${b}`).join('\n'));

/** Chrome's encoder wraps the image in VP8X with an ICC profile; keep only the lossy bitstream (untagged = sRGB). */
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
  if (!body || chunks.has('ALPH') || chunks.has('ANIM')) return data;
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

interface StillEntry {
  /** The strip box at the class's viewport, CSS px (the <img>'s width/height). */
  box: [number, number];
  /** The framing the engine painted it with (stats().framing.strip), for the record. */
  framing?: Record<string, unknown> | null;
  files: Record<'1' | '2', string>;
  /** The phone class only: the inline seed (its file, bytes, quality, pixel size, bits per displayed pixel at DPR 1
   *  and 2, and the base64 Strip inlines). `sharp`: the seed is the phone@1x still itself (INLINE_SHARP, R9). */
  seed?: {
    file: string;
    bytes: number;
    q: number;
    size: [number, number];
    bpp: [number, number];
    data: string;
    sharp?: boolean;
  };
}
interface Manifest {
  about?: string;
  inputs?: string;
  inputList?: Record<string, string>;
  classes?: Record<string, { media: string; viewport: [number, number] }>;
  stills?: Record<string, Partial<Record<ClassName, StillEntry>>>;
  files?: Record<string, { bytes: number; sha256: string; size: [number, number] }>;
  totalBytes?: number;
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
  if (!man || !man.inputs) {
    console.log('heroes: no manifest yet; run npm run build:heroes (a QA build must be serving)');
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
  for (const h of PAGES)
    for (const c of CLASSES)
      for (const d of DENSITIES) {
        const f = fileName(h, c.name, d);
        const p = path.join(OUT_DIR, f);
        if (!existsSync(p)) {
          problems.push(`missing: ${rel(p)}`);
          continue;
        }
        const data = readFileSync(p);
        if (man.files?.[f]?.sha256 !== sha(data))
          problems.push(`${rel(p)} differs from the manifest (edited by hand?)`);
        if (data.length > c.cap) problems.push(`${rel(p)} is ${data.length} bytes (cap ${c.cap})`);
        if (man.stills?.[h.name]?.[c.name]?.files?.[String(d) as '1' | '2'] !== f)
          problems.push(`manifest stills.${h.name}.${c.name} does not name ${f}`);
      }
  for (const h of PAGES) {
    const sharp = INLINE_SHARP.has(h.name);
    const f = sharp ? fileName(h, 'phone', 1) : seedName(h);
    const cap = sharp ? SHARP_SEED_CAP : SEED_CAP;
    const p = path.join(OUT_DIR, f);
    const seed = man.stills?.[h.name]?.phone?.seed;
    if (!!seed?.sharp !== sharp) problems.push(`manifest stills.${h.name}.phone.seed: sharp should be ${sharp}`);
    if (!existsSync(p)) {
      problems.push(`missing: ${rel(p)}`);
      continue;
    }
    const data = readFileSync(p);
    if (man.files?.[f]?.sha256 !== sha(data)) problems.push(`${rel(p)} differs from the manifest (edited by hand?)`);
    if (data.length > cap) problems.push(`${rel(p)} is ${data.length} bytes (cap ${cap})`);
    if (!seed || seed.file !== f || seed.data !== data.toString('base64'))
      problems.push(`manifest stills.${h.name}.phone.seed does not carry ${f}`);
  }
  if (problems.length) {
    for (const p of problems) console.log('STALE:', p);
    console.log('heroes: STALE; regenerate with npm run build:heroes (a QA build must be serving)');
    return 1;
  }
  console.log(
    `heroes: up to date (${PAGES.length * CLASSES.length * DENSITIES.length} files, ${man.totalBytes} bytes; inputs ${man.inputs.slice(0, 12)})`,
  );
  return 0;
}

// ------------------------------------------------------------------------------------------------ build
type Box = [number, number, number, number];
/** What the held handle reports (stats()), the part this tool reads. */
interface HeldStats {
  stretch?: number;
  widthClass?: string;
  figures?: Record<string, string>;
  presents?: number;
  framing?: { strip?: Record<string, unknown> | null };
  stage?: { framing?: Record<string, unknown> | null } | null;
}
async function waitFor(page: Page, fn: string, arg: unknown, what: string, timeout: number) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await page.evaluate(`${fn}(${JSON.stringify(arg)})`)) return;
    await page.waitForTimeout(150);
  }
  throw new Error(`${what}: not there in ${timeout} ms`);
}

async function build(): Promise<number> {
  const base = opt('--base', 'http://127.0.0.1:3100');
  const timeout = Number(opt('--timeout', '60000'));
  const only = opt('--places', '');
  const names = only ? only.split(',').map((n) => n.trim()) : PAGES.map((h) => h.name);
  for (const n of names) if (!PAGES.some((h) => h.name === n)) throw new Error(`--places: no place "${n}"`);
  const preview = opt('--preview', '');
  if (preview) {
    if (!path.relative(ROOT, path.resolve(preview)).startsWith('..'))
      throw new Error(`--preview must be outside the repo: ${preview}`);
    await mkdir(preview, { recursive: true });
  }
  await mkdir(OUT_DIR, { recursive: true });
  const man = readManifest() ?? {};
  const files = { ...man.files };
  const stills: NonNullable<Manifest['stills']> = { ...man.stills };
  const report: Record<string, unknown>[] = [];
  const browser = await chromium.launch({ ...(process.env.CI ? {} : { channel: 'chrome' }), args: CHROME_ARGS });
  try {
    for (const c of CLASSES)
      for (const d of DENSITIES) {
        const ctx = await browser.newContext({
          viewport: c.viewport,
          deviceScaleFactor: d,
          isMobile: c.mobile,
          hasTouch: c.mobile,
        });
        // (the page's own mount is replaced; its ceremony need not run, and its probe need not be waited for: a QA
        // build mounts at once with __inkLive)
        await ctx.addInitScript(() => {
          (window as unknown as { __inkLive?: boolean }).__inkLive = true;
          try {
            sessionStorage.setItem('ink:morning', '1');
            sessionStorage.setItem('ink:swash', '1');
          } catch {
            /* private mode */
          }
        });
        for (const h of PAGES.filter((p) => names.includes(p.name))) {
          const t0 = Date.now();
          const page = await ctx.newPage();
          const errors: string[] = [];
          page.on('pageerror', (e) => errors.push(String(e)));
          const res = await page.goto(new URL(h.route, base).toString(), { waitUntil: 'load' });
          if (!res?.ok()) throw new Error(`${h.route}: HTTP ${res?.status()}`);
          await page.evaluate(() => document.fonts.ready);
          await waitFor(
            page,
            '(() => !!window.__inkEngine)',
            null,
            `${h.name} ${c.name}@${d}x: the engine module`,
            timeout,
          );
          await page.addStyleTag({ content: HIDE_CSS });
          const mode = await page.evaluate(`${REMOUNT_JS}(${JSON.stringify([PALETTE])})`);
          if (mode !== 'webgl')
            throw new Error(`${h.name} ${c.name}@${d}x: the engine mounted as ${String(mode)}, not webgl`);
          await waitFor(page, HELD_JS, null, `${h.name} ${c.name}@${d}x: the first frame`, timeout);
          const st = (await page.evaluate('window.__heroHandle.stats()')) as HeldStats;
          if (Number(st.stretch) !== SITE_PLACES[h.page].stretch)
            throw new Error(`${h.name}: the page sits at stretch ${st.stretch}`);
          if (st.widthClass !== c.name)
            throw new Error(
              `${h.name} at ${c.viewport.width} × ${c.viewport.height}: the engine's width class is ${st.widthClass}, not ${c.name}`,
            );
          const box = (await page.evaluate(BOX_JS)) as Box | null;
          if (!box) throw new Error(`${h.name}: no strip window on ${h.route}`);
          const shot = () =>
            page.screenshot({
              clip: { x: box[0], y: box[1], width: box[2], height: box[3] },
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
              throw new Error(
                `${h.name} ${c.name}@${d}x: the painting kept changing between captures; nothing written`,
              );
            png = again;
          }
          if (preview) await writeFile(path.join(preview, `${h.name}-${c.name}@${d}x.png`), png);
          const out = (await page.evaluate(`${ENCODE_JS}(${JSON.stringify([png.toString('base64'), c.q[d]])})`)) as {
            error?: string;
            size: [number, number];
            webp: string;
          };
          if (out.error) throw new Error(`${h.name}: ${out.error}`);
          if (errors.length) console.log(`  ${h.name} ${c.name}@${d}x: page errors:\n    ${errors.join('\n    ')}`);
          const data = plainWebp(Buffer.from(out.webp, 'base64'));
          const f = fileName(h, c.name, d);
          await writeFile(path.join(OUT_DIR, f), data);
          files[f] = { bytes: data.length, sha256: sha(data), size: out.size };
          const entry: StillEntry = stills[h.name]?.[c.name] ?? { box: [0, 0], files: { '1': '', '2': '' } };
          entry.box = [Math.round(box[2]), Math.round(box[3])];
          entry.framing = (st.framing && st.framing.strip) || (st.stage && st.stage.framing) || null;
          entry.files[String(d) as '1' | '2'] = f;
          // the phone's seed, from the 1x capture: the first width and quality under the cap
          if (c.name === 'phone' && d === 1 && INLINE_SHARP.has(h.name)) {
            // R9: the seed is this still itself
            if (data.length > SHARP_SEED_CAP)
              throw new Error(`${h.name}: ${f} is over ${SHARP_SEED_CAP} bytes to inline`);
            await rm(path.join(OUT_DIR, seedName(h)), { force: true });
            delete files[seedName(h)];
            const px = entry.box[0] * entry.box[1];
            const bpp = (k: number) => Math.round(((data.length * 8) / (px * k * k)) * 1000) / 1000;
            entry.seed = {
              file: f,
              bytes: data.length,
              q: c.q[1],
              size: out.size,
              bpp: [bpp(1), bpp(2)],
              data: data.toString('base64'),
              sharp: true,
            };
          } else if (c.name === 'phone' && d === 1) {
            let seed: StillEntry['seed'] | undefined;
            for (const sw of SEED_WIDTHS) {
              const r = (await page.evaluate(
                `${SEED_JS}(${JSON.stringify([png.toString('base64'), sw, SEED_QS])})`,
              )) as {
                error?: string;
                size: [number, number];
                out: { q: number; webp: string }[];
              };
              if (r.error) throw new Error(`${h.name} seed: ${r.error}`);
              for (const cand of r.out) {
                const bytes = plainWebp(Buffer.from(cand.webp, 'base64'));
                if (bytes.length > SEED_CAP) continue;
                const sf = seedName(h);
                await writeFile(path.join(OUT_DIR, sf), bytes);
                files[sf] = { bytes: bytes.length, sha256: sha(bytes), size: r.size };
                const px = entry.box[0] * entry.box[1];
                const bpp = (k: number) => Math.round(((bytes.length * 8) / (px * k * k)) * 1000) / 1000;
                seed = {
                  file: sf,
                  bytes: bytes.length,
                  q: cand.q,
                  size: r.size,
                  bpp: [bpp(1), bpp(2)],
                  data: bytes.toString('base64'),
                };
                break;
              }
              if (seed) break;
            }
            if (!seed) throw new Error(`${h.name}: no seed under ${SEED_CAP} bytes`);
            entry.seed = seed;
            report.push({
              still: seed.file,
              'box css': entry.box.join('x'),
              px: seed.size.join('x'),
              bytes: seed.bytes,
              cap: SEED_CAP,
              over: '',
              figures: `q ${seed.q}, ${seed.bpp[1]} bits/px @2x`,
              presents: '',
              s: '',
            });
          }
          stills[h.name] = { ...stills[h.name], [c.name]: entry };
          report.push({
            still: f,
            'box css': entry.box.join('x'),
            px: out.size.join('x'),
            bytes: data.length,
            cap: c.cap,
            over: data.length > c.cap ? 'OVER' : '',
            figures: JSON.stringify(st.figures),
            presents: st.presents,
            s: Math.round((Date.now() - t0) / 100) / 10,
          });
          await page.close();
        }
        await ctx.close();
      }
  } finally {
    await browser.close();
  }
  let items = inputs();
  let digest = inputHash(items);
  const whole = PAGES.every((h) => names.includes(h.name));
  if (!whole && man.inputs && man.inputs !== digest) {
    console.log(`note: only ${names.join(', ')} rebuilt and the inputs changed; run without --places to refresh all`);
    items = Object.entries(man.inputList ?? {});
    digest = man.inputs;
  }
  const total = Object.values(files).reduce((n, f) => n + f.bytes, 0);
  const next: Manifest = {
    about:
      "The heroes' stills (the strip's first frame per page and width class), made by tools/build-heroes.ts from the engine; regenerate after any engine or scene change. inputs = sha256 over inputList.",
    inputs: digest,
    inputList: Object.fromEntries(items),
    classes: Object.fromEntries(
      CLASSES.map((c) => [
        c.name,
        { media: c.media, viewport: [c.viewport.width, c.viewport.height] as [number, number] },
      ]),
    ),
    stills: Object.fromEntries(Object.entries(stills).sort(([a], [b]) => (a < b ? -1 : 1))),
    files: Object.fromEntries(Object.entries(files).sort(([a], [b]) => (a < b ? -1 : 1))),
    totalBytes: total,
  };
  await writeFile(MANIFEST, `${JSON.stringify(next, null, 1)}\n`);
  console.table(report);
  console.log(`\n${Object.keys(files).length} files, ${total} bytes in ${rel(OUT_DIR)}/; manifest ${rel(MANIFEST)}`);
  const over = report.filter((r) => r.over);
  if (over.length) {
    console.log(`over the size caps: ${over.map((r) => r.still).join(', ')} (lower q in CLASSES)`);
    return 1;
  }
  return 0;
}

const run = flag('--check') ? Promise.resolve(check()) : build();
run.then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(`build-heroes: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  },
);
