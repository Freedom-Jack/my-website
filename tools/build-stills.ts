/**
 * The footer story map's five scene stills, cut at build time from the real engine (DESIGN 11.B), so the map is
 * the painting itself in miniature. public/scenes/<place>@1x|2x.webp + manifest.json, read by StoryMap.
 *
 *   NEXT_PUBLIC_INK_QA=1 npm run build && npm start     a QA build (it exposes the engine as window.__inkEngine)
 *   npm run build:stills                                cut all five; needs Google Chrome (headless, SwiftShader)
 *   npm run build:stills -- --places home,work          rebuild some (the manifest stays stale until a full run)
 *   npm run build:stills -- --preview <dir>             also keep the raw crops (outside the repo)
 *   npm run build:stills -- --check                     no browser: exit 1 when the stills are stale (CI)
 *
 * Per mapped place (Home 0, Work 1, Writing 3, Résumé 4, Contact 5; the road 2 has no page, the 404 lies off the
 * map):
 *   1. Opens the place's page at 1440 × 900, DPR 2, and hides its words (only the strip's box stays).
 *   2. Remounts the page's own engine on its own canvas with the page's own place and windows, but with no veils,
 *      keep-outs or wake, a FIXED internal resolution and no ambient drift: the painting alone with the mist at
 *      rest, so the same inputs give the same files, byte for byte. (Not `still: true`: on 2026-10-15 the stilled
 *      engine left the figure layers of Home, Writing and Contact unshown.) The strip path is forced (`ground: ''`):
 *      a living page would mount the stage, which has no strip framing.
 *   3. Waits on the engine's own stats() (no fixed delays): nothing pending, every figure layer drawn and faded
 *      in, the newest scene a full-quality one.
 *   4. Turns the place's crop rect (world units, below) into strip pixels through stats().framing.strip; a rect
 *      outside the strip window fails.
 *   5. Captures that region at DPR 2, then in the page steps it down to the tile at 1x and 2x, divides out the
 *      paper (the footer multiplies the stills into whatever paper is behind them) and encodes WebP.
 *   6. Writes the stills and manifest.json: the hash of every generating input and of each file.
 *
 * --check recomputes the input hash (the engine: src/features/landscape/engine/**\/*.ts; the mapped places' config
 * in places.ts; the strip-height tokens, which size the windows; this tool's crop table and settings), compares it
 * and each file's hash with the manifest, checks the size caps, and checks that layout.css and places.ts still
 * carry this table's focus, foot fades and order. Exit 1 = stale: regenerate.
 * REGENERATE AFTER ANY ENGINE, SET, PALETTE, PLACE OR STRIP-HEIGHT CHANGE.
 *
 * Ported from design-demo/tools/build-stills.py (demo 4b, record: design-demo/_notes/r4b/RECORD.md §5.1); the same
 * table, settings and in-page steps, so an unchanged engine gives the demo's own bytes. (The engine has since become
 * TypeScript, the same program with types: its stills stayed byte-identical.)
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Page } from '@playwright/test';
import { PLACES as SITE_PLACES, STORY_MAP, type PageId } from '../src/features/landscape/places.ts';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string, d: string) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1]! : d;
};

// ------------------------------------------------------------------------------------------------ the crop table
// Each place's still is the region a painter would choose to stand for it, cut from its page's opening strip, plus
// the mist and far ranges at its sides that the footer needs to meet its neighbours (the footer never shows a whole
// still: a soft window, layout.css, shows the part between the midpoints to its neighbours).
// rect = [u0, u1, y0, y1]: world x in stretches (stretch k spans k..k+1) and scene heights (0 = the bottom of the
// scene, y up), the units of compose.js and stats().framing. w = the tile's width at 1x (CSS px; every tile is
// TILE_H tall), and every rect has its tile's aspect: (u1 - u0) * 1.6 / (y1 - y0) = w / TILE_H (1.6 = scene heights
// per stretch). The y ranges (hence each place's scale) are the ones the art lead passed for faithfulness.
// focus = where the place's centre lies across the still (0..1): the footer pins that point over the place's label
// and tick (layout.css --focus). fade_b = how far up (0..1 of the tile) the still dissolves at its foot
// (layout.css --fade-b). The side feathers are the footer's windows (layout.css), not the still's.
// Each rect must hold the footer's widest window (layout.css: at the narrowest art-to-column ratio, .37, and the
// feathers' slant): Home u .30-1.0; Work 1.07-2.0 (its left edge stops after the seam crag, u 1.0-1.04); Writing
// 3.12-4.1 (its left is the far range and its reflection: the road's faint thread); Résumé 4.29-4.81; Contact
// 5.39-6.0.
interface Still {
  name: 'home' | 'work' | 'writing' | 'resume' | 'contact';
  page: PageId;
  route: string;
  stretch: number;
  w: number;
  rect: [number, number, number, number];
  focus: number;
  fade_b: number;
}
const PLACES: Still[] = [
  // his two massifs (the host u .65, the near peaks u .88-1.0), the hut (u .846) and the traveller (u .80); the
  // window's own right edge (u 1.0) is the near peaks' cut in the hero, so the footer dissolves them
  {
    name: 'home',
    page: 'home',
    route: '/',
    stretch: 0,
    w: 252,
    rect: [0.001, 1.0, 0.156, 0.6],
    focus: 0.76,
    fade_b: 0.1,
  },
  // the rainbow bridge (u 1.48-1.67) centred in its town, the boats, the willows, the hills and the needle crest;
  // the town's left end and the river to u 1.05 (Home's side), its right end to the window's edge (the road)
  {
    name: 'work',
    page: 'work',
    route: '/work/',
    stretch: 1,
    w: 355,
    rect: [1.0491, 2.0, 0.19, 0.49],
    focus: 0.54,
    fade_b: 0.12,
  },
  // the far peak (u 3.76), its whole reflection and the pavilion on its promontory (u 3.93); on its left the
  // lake's far range and its reflection, to the window's edge (u 3.1)
  {
    name: 'writing',
    page: 'writing',
    route: '/writing/',
    stretch: 3,
    w: 386,
    rect: [3.1005, 4.1, 0.15, 0.44],
    focus: 0.71,
    fade_b: 0.16,
  },
  // the two terraced hills (u 4.35-4.78) with the farmhouse (u 4.63) under the far range (the doc strip: low),
  // with mist and the far range at both sides
  {
    name: 'resume',
    page: 'resume',
    route: '/resume/',
    stretch: 4,
    w: 317,
    rect: [4.25, 4.85004, 0.178, 0.39],
    focus: 0.52,
    fade_b: 0.22,
  },
  // the ferry (u 5.64) at the jetty (to u 5.8) and his mountain's echo on the far shore (u 5.84)
  {
    name: 'contact',
    page: 'contact',
    route: '/contact/',
    stretch: 5,
    w: 252,
    rect: [5.3025, 6.0, 0.18, 0.49],
    focus: 0.62,
    fade_b: 0.14,
  },
];
const TILE_H = 70; // every still's height at 1x, CSS px (the footer shows it 44-74 px tall); 2x is 140
const DENSITIES = [1, 2] as const;
const WEBP_Q = 0.85; // canvas.toDataURL('image/webp', q)
const VIEWPORT = { width: 1440, height: 900, dpr: 2 };
const ENGINE_QUALITY = 1.5; // the engine's fixed internal resolution (its buffer's long side is capped at 1920 px)
const PALETTE = 'misted'; // the site's default palette
const PAPER = [239, 241, 238]; // --paper and the shader's PAPER (#EFF1EE); divided out to white
const CAP_FILE = 16 * 1024; // bytes, any one still
const CAP_TOTAL = 60 * 1024; // bytes, all ten
const CHROME_ARGS = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--disable-gpu-sandbox',
  '--hide-scrollbars',
];
const OUT_DIR = path.join(ROOT, 'public', 'scenes');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');

// ------------------------------------------------------------------------------------------------ in the page
const HIDE_CSS = `
main { visibility: hidden !important; }
main [data-landscape="strip"] { visibility: visible !important; }
.site-header, .site-footer, .skip-link { visibility: hidden !important; }
`;
// The page's own place and windows (its <main>'s data-*), no veils / keep-outs / wake, fixed resolution, no
// ambient drift: the mist stays at the engine's starting clock, what a page shows as it opens.
const REMOUNT_JS = `(async ([Q, palette]) => {
  const eng = window.__inkEngine;
  const canvas = document.querySelector('canvas.landscape');
  const main = document.getElementById('main');
  if (!canvas || !main || typeof eng?.mountLandscape !== 'function') return 'no-engine (a QA build? NEXT_PUBLIC_INK_QA=1)';
  const d = main.dataset;
  const h = eng.mountLandscape(canvas, {
    stretch: Number(d.stretch), distance: d.distance, presence: Number(d.presence), palette,
    strip: main.querySelector('[data-landscape="strip"]'), closing: main.querySelector('[data-landscape="closing"]'),
    horizon: Number(d.horizon), ground: '', veil: [], keepout: [], wake: [],   // (the strip, also on a living page)
    arrival: 'none', quality: Q, pointer: false, ambient: false,
  });
  window.__stillsHandle = h;
  return h.mode;
})`;
// Settled: nothing pending, every figure layer drawn AND faded in, the newest scene a full one.
const SETTLE_JS = `(async (name) => {
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const h = window[name];
  if (!h) return false;
  const s = h.stats();
  if (s.arriving || s.pending || s.sweeping || s.deferred) return false;
  if (Object.values(s.figures || {}).includes('pending')) return false;
  if ((s.figureSlots || []).some((f) => f.k < 0.999)) return false;
  if (!(s.fullAt > 0) || s.draftAt > s.fullAt || performance.now() - s.draftAt < 400) return false;
  return 'settled';
})`;
const BOX_JS = `(() => { const e = document.querySelector('main [data-landscape="strip"]'); if (!e) return null;
  const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; })()`;
// Scale down (halving with a high-quality filter, then one last drawImage to the exact size), divide out the paper,
// encode WebP. Returns { '<density>': base64 } plus the source size.
const PROCESS_JS = `(async ([b64, sizes, paper, quality]) => {
  const img = new Image();
  img.src = 'data:image/png;base64,' + b64;
  await img.decode();
  const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const draw = (src, sw, sh, w, h) => {
    const c = canvasOf(w, h), x = c.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(src, 0, 0, sw, sh, 0, 0, w, h);
    return c;
  };
  const out = { src: [img.naturalWidth, img.naturalHeight] };
  for (const [d, w, h] of sizes) {
    let src = img, sw = img.naturalWidth, sh = img.naturalHeight;
    while (sw >= w * 4 && sh >= h * 4) {
      const nw = Math.round(sw / 2), nh = Math.round(sh / 2);
      src = draw(src, sw, sh, nw, nh); sw = nw; sh = nh;
    }
    const c = draw(src, sw, sh, w, h), x = c.getContext('2d');
    const id = x.getImageData(0, 0, w, h), p = id.data;
    const k = paper.map((v) => 255 / v);
    let paperish = 0;
    for (let i = 0; i < p.length; i += 4) {
      p[i] = Math.min(255, Math.round(p[i] * k[0]));
      p[i + 1] = Math.min(255, Math.round(p[i + 1] * k[1]));
      p[i + 2] = Math.min(255, Math.round(p[i + 2] * k[2]));
      p[i + 3] = 255;
      if (p[i] + p[i + 1] + p[i + 2] >= 750) paperish++;
    }
    x.putImageData(id, 0, 0);
    const url = c.toDataURL('image/webp', quality);
    if (!url.startsWith('data:image/webp;base64,')) return { error: 'this Chrome cannot encode WebP' };
    out[d] = url.slice('data:image/webp;base64,'.length);
    out['paper' + d] = Math.round(1000 * paperish / (w * h)) / 1000;
  }
  return out;
})`;

// ------------------------------------------------------------------------------------------------ inputs and hashes
const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join('/');
const sha = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');
const outName = (s: Still, d: number) => `${s.name}@${d}x.webp`;

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
  // only the place's config, not its words: what <main data-*> tells the engine, and the strip's kind (its height)
  for (const s of PLACES) {
    const { stretch, distance, presence, horizon, ground, strip } = SITE_PLACES[s.page];
    const config = { stretch, distance, presence, horizon, ground, strip };
    items.push([`src/features/landscape/places.ts#${s.page}`, sha(JSON.stringify(config))]);
  }
  // the strip heights size the windows, hence their framings: each --strip-* / --closing-* line with its media query
  let media = '';
  const lines: string[] = [];
  for (const l of readFileSync(path.join(ROOT, 'src', 'styles', 'tokens.css'), 'utf8').split('\n')) {
    if (l.includes('@media')) media = l.trim();
    else if (/^\s*--(strip|closing)-/.test(l)) lines.push(`${media} | ${l.trim()}`);
  }
  items.push(['src/styles/tokens.css#strip-heights', sha(lines.join('\n'))]);
  const settings = {
    places: PLACES,
    tile: TILE_H,
    densities: DENSITIES,
    webp: WEBP_Q,
    viewport: VIEWPORT,
    quality: ENGINE_QUALITY,
    palette: PALETTE,
    paper: PAPER,
    chrome: CHROME_ARGS,
    js: [HIDE_CSS, REMOUNT_JS, SETTLE_JS, PROCESS_JS],
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
  tiles?: Record<string, [number, number]>;
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
const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Do the footer's CSS and the story map's table still match this one? Returns a list of problems. */
function consistency(): string[] {
  const bad: string[] = [];
  const css = readFileSync(path.join(ROOT, 'src', 'styles', 'layout.css'), 'utf8');
  const found = new Map<number, Record<string, string>>();
  for (const m of css.matchAll(/\.story-map__scene\[data-stretch='(\d)'\]\s*\{([^}]*)\}/g)) {
    const decl = Object.fromEntries(
      [...m[2]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((d) => [d[1]!, d[2]!.trim()]),
    );
    found.set(Number(m[1]), { ...found.get(Number(m[1])), ...decl });
  }
  for (const s of PLACES) {
    const have = found.get(s.stretch) ?? {};
    for (const [k, v] of [
      ['--focus', pct(s.focus)],
      ['--fade-b', pct(s.fade_b)],
    ] as const)
      if (have[k] !== v)
        bad.push(
          `layout.css .story-map__scene[data-stretch='${s.stretch}'] ${k} is ${have[k]}, the crop table says ${v}`,
        );
    if (SITE_PLACES[s.page].stretch !== s.stretch)
      bad.push(`places.ts puts ${s.page} at stretch ${SITE_PLACES[s.page].stretch}, the crop table at ${s.stretch}`);
  }
  const map = STORY_MAP.map((p) => `${p.still}@${p.stretch}`).join(' ');
  const table = PLACES.map((s) => `${s.name}@${s.stretch}`).join(' ');
  if (map !== table) bad.push(`places.ts STORY_MAP is ${map}, the crop table ${table}`);
  return bad;
}

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
  let total = 0;
  for (const s of PLACES) {
    const tile = man.tiles?.[s.name];
    if (!tile || tile[0] !== s.w || tile[1] !== TILE_H)
      problems.push(`manifest tiles.${s.name} is ${JSON.stringify(tile)}, the crop table says [${s.w}, ${TILE_H}]`);
    for (const d of DENSITIES) {
      const f = outName(s, d);
      const p = path.join(OUT_DIR, f);
      if (!existsSync(p)) {
        problems.push(`missing: ${rel(p)}`);
        continue;
      }
      const data = readFileSync(p);
      total += data.length;
      if (man.files?.[f]?.sha256 !== sha(data)) problems.push(`${rel(p)} differs from the manifest (edited by hand?)`);
      if (data.length > CAP_FILE) problems.push(`${rel(p)} is ${data.length} bytes (cap ${CAP_FILE})`);
    }
  }
  if (total > CAP_TOTAL) problems.push(`the stills weigh ${total} bytes together (cap ${CAP_TOTAL})`);
  problems.push(...consistency());
  if (problems.length) {
    for (const p of problems) console.log('STALE:', p);
    console.log('stills: STALE; regenerate with npm run build:stills (a QA build must be serving)');
    return 1;
  }
  console.log(
    `stills: up to date (${PLACES.length * DENSITIES.length} files, ${total} bytes; inputs ${man.inputs!.slice(0, 12)})`,
  );
  return 0;
}

// ------------------------------------------------------------------------------------------------ build
interface Framing {
  scale: number;
  worldLeft: number;
  worldTop: number;
}
type Box = [number, number, number, number];

/** World rect -> [x, y, w, h] in viewport CSS px, through the strip's framing; null if it leaves the window. */
function cropPx([u0, u1, y0, y1]: Still['rect'], fr: Framing, box: Box): Box | null {
  const { scale: s, worldLeft: left, worldTop: top } = fr;
  const hs = 1.6; // scene heights per stretch (compose.js HS)
  let [x0, x1] = [(u0 - left) * s, (u1 - left) * s];
  let [t0, t1] = [((top - y1) * s) / hs, ((top - y0) * s) / hs];
  const eps = 1.0;
  if (x0 < -eps || t0 < -eps || x1 > box[2] + eps || t1 > box[3] + eps) return null;
  [x0, t0] = [Math.max(0, x0), Math.max(0, t0)];
  [x1, t1] = [Math.min(box[2], x1), Math.min(box[3], t1)];
  return [box[0] + x0, box[1] + t0, x1 - x0, t1 - t0];
}
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const windowOf = (fr: Framing, box: Box) =>
  [fr.worldLeft, fr.worldLeft + box[2] / fr.scale, fr.worldTop - (box[3] * 1.6) / fr.scale, fr.worldTop].map(r3);

async function waitFor(page: Page, fn: string, arg: unknown, what: string, timeout: number) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await page.evaluate(`${fn}(${JSON.stringify(arg)})`)) return;
    await page.waitForTimeout(150);
  }
  throw new Error(`${what}: not settled in ${timeout} ms`);
}

async function build(): Promise<number> {
  for (const s of PLACES) {
    const [u0, u1, y0, y1] = s.rect;
    const aspect = ((u1 - u0) * 1.6) / (y1 - y0);
    if (Math.abs(aspect / (s.w / TILE_H) - 1) > 0.002)
      throw new Error(`crop table: ${s.name} has aspect ${aspect.toFixed(4)}, its tile ${(s.w / TILE_H).toFixed(4)}`);
  }
  const base = opt('--base', 'http://127.0.0.1:3100');
  const timeout = Number(opt('--timeout', '90000'));
  const only = opt('--places', '');
  const names = only ? only.split(',').map((n) => n.trim()) : PLACES.map((s) => s.name);
  for (const n of names) if (!PLACES.some((s) => s.name === n)) throw new Error(`--places: no place "${n}"`);
  const preview = opt('--preview', '');
  if (preview) {
    if (!path.relative(ROOT, path.resolve(preview)).startsWith('..'))
      throw new Error(`--preview must be outside the repo: ${preview}`);
    await mkdir(preview, { recursive: true });
  }
  await mkdir(OUT_DIR, { recursive: true });
  const man = readManifest() ?? {};
  const files = { ...man.files };
  const report: Record<string, unknown>[] = [];

  const browser = await chromium.launch({ ...(process.env.CI ? {} : { channel: 'chrome' }), args: CHROME_ARGS });
  try {
    const ctx = await browser.newContext({
      viewport: { width: VIEWPORT.width, height: VIEWPORT.height },
      deviceScaleFactor: VIEWPORT.dpr,
    });
    for (const s of PLACES.filter((p) => names.includes(p.name))) {
      const t0 = Date.now();
      const page = await ctx.newPage();
      const errors: string[] = [];
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      page.on('pageerror', (e) => errors.push(String(e)));
      const res = await page.goto(new URL(s.route, base).toString(), { waitUntil: 'load' });
      if (!res?.ok()) throw new Error(`${s.route}: HTTP ${res?.status()}`);
      await page.evaluate(() => document.fonts.ready);
      await waitFor(page, SETTLE_JS, '__ink', `${s.name} (the page's own mount)`, timeout);
      await page.addStyleTag({ content: HIDE_CSS });
      const mode = await page.evaluate(`${REMOUNT_JS}(${JSON.stringify([ENGINE_QUALITY, PALETTE])})`);
      if (mode !== 'webgl') throw new Error(`${s.name}: the engine mounted as ${String(mode)}, not webgl`);
      await waitFor(page, SETTLE_JS, '__stillsHandle', s.name, timeout);
      await page.evaluate(
        () =>
          new Promise((r) => {
            let k = 12;
            const f = () => (--k <= 0 ? r(1) : requestAnimationFrame(f));
            requestAnimationFrame(f);
          }),
      ); // let any late fade or upload land, then settle again
      await waitFor(page, SETTLE_JS, '__stillsHandle', s.name, timeout);
      const st = (await page.evaluate('window.__stillsHandle.stats()')) as {
        stretch?: number;
        quality?: number;
        figures?: Record<string, string>;
        framing?: { strip?: Framing };
      };
      const fig = st.figures?.[String(s.stretch)];
      if (fig !== 'ready' && fig !== 'none') throw new Error(`${s.name}: figure layer ${JSON.stringify(st.figures)}`);
      if (Number(st.stretch) !== s.stretch)
        throw new Error(`${s.name}: the page sits at stretch ${st.stretch}, the table says ${s.stretch}`);
      const box = (await page.evaluate(BOX_JS)) as Box | null;
      const fr = st.framing?.strip;
      if (!box || !fr) throw new Error(`${s.name}: no strip window on ${s.route}`);
      const clip = cropPx(s.rect, fr, box);
      if (!clip)
        throw new Error(
          `${s.name}: crop ${JSON.stringify(s.rect)} leaves the strip window ${JSON.stringify(windowOf(fr, box))} (u0, u1, y0, y1); re-aim the crop table`,
        );
      const png = await page.screenshot({
        clip: { x: clip[0], y: clip[1], width: clip[2], height: clip[3] },
        scale: 'device',
        animations: 'allow',
        caret: 'initial',
      });
      if (preview) await writeFile(path.join(preview, `${s.name}-crop.png`), png);
      const sizes = DENSITIES.map((d) => [d, s.w * d, TILE_H * d]);
      const out = (await page.evaluate(
        `${PROCESS_JS}(${JSON.stringify([png.toString('base64'), sizes, PAPER, WEBP_Q])})`,
      )) as Record<string, unknown> & { error?: string; src: [number, number] };
      if (out.error) throw new Error(`${s.name}: ${out.error}`);
      if (errors.length) console.log(`  ${s.name}: console errors:\n    ${errors.join('\n    ')}`);
      for (const d of DENSITIES) {
        const data = plainWebp(Buffer.from(String(out[String(d)]), 'base64'));
        const f = outName(s, d);
        await writeFile(path.join(OUT_DIR, f), data);
        files[f] = { bytes: data.length, sha256: sha(data), size: [s.w * d, TILE_H * d] };
        if (preview) await writeFile(path.join(preview, f), data);
      }
      report.push({
        place: s.name,
        'capture px': out.src.join('x'),
        '1x bytes': files[outName(s, 1)]!.bytes,
        '2x bytes': files[outName(s, 2)]!.bytes,
        'paper @2x': out.paper2,
        'strip window u0 u1 y0 y1': windowOf(fr, box).join(' '),
        'engine q': st.quality,
        s: Math.round((Date.now() - t0) / 100) / 10,
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }

  let items = inputs();
  let digest = inputHash(items);
  const whole = PLACES.every((s) => names.includes(s.name));
  if (!whole && man.inputs && man.inputs !== digest) {
    // a partial run cannot vouch for the places it skipped: keep the old inputs, so --check still says stale
    console.log(`note: only ${names.join(', ')} rebuilt and the inputs changed; run without --places to refresh all`);
    items = Object.entries(man.inputList ?? {});
    digest = man.inputs;
  }
  const total = Object.values(files).reduce((n, f) => n + f.bytes, 0);
  const next: Manifest = {
    about:
      'Footer story-map stills, made by tools/build-stills.ts from the engine; regenerate after any engine or scene change. inputs = sha256 over inputList.',
    inputs: digest,
    inputList: Object.fromEntries(items),
    tiles: Object.fromEntries(PLACES.map((s) => [s.name, [s.w, TILE_H]])),
    files: Object.fromEntries(Object.entries(files).sort(([a], [b]) => (a < b ? -1 : 1))),
    totalBytes: total,
  };
  await writeFile(MANIFEST, `${JSON.stringify(next, null, 1)}\n`);
  console.table(report);
  console.log(
    `\n${Object.keys(files).length} files, ${total} bytes in ${rel(OUT_DIR)}/ (cap ${CAP_TOTAL}); manifest ${rel(MANIFEST)}`,
  );
  for (const b of consistency()) console.log('note:', b);
  if (total > CAP_TOTAL || Object.values(files).some((f) => f.bytes > CAP_FILE)) {
    console.log('over the size caps: lower WEBP_Q or the tile');
    return 1;
  }
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
