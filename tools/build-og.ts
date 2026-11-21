/**
 * The link previews: one 1200 × 630 card per page (Open Graph and Twitter images, public/og/<page>.jpg), cut from the
 * real site, so a link shared on LinkedIn, Slack, iMessage or X shows the page's own first screen: its place in the
 * painting, full-bleed, with the page's title inscribed in its sky and the line under it. Nothing else: no header,
 * no body text. src/lib/seo.ts reads public/og/manifest.json and gives every page its card (a case or a note without
 * one falls back to its section's).
 *
 *   NEXT_PUBLIC_INK_QA=1 npm run build && npm start -- -p 3100     a QA build (it exposes the engine as window.__ink)
 *   npm run build:og                                              cut every card; needs Google Chrome (headless, on
 *                                                                 this machine's GPU: the cards are the real painting)
 *   npm run build:og -- --pages home,work-rag-assistant           some of them (the manifest keeps the rest)
 *   npm run build:og -- --preview <dir>                           cut into <dir> (outside the repo) and leave
 *                                                                 public/og alone: for looking before keeping
 *   npm run build:og -- --check                                   no browser: exit 1 when a page has no card, a card
 *                                                                 is not the file the manifest names, or a page's
 *                                                                 title or under-line changed since its card was cut
 *   npm run build:og -- --base http://127.0.0.1:3000              another server (default http://127.0.0.1:3100)
 *
 * How a card is cut (the same page, never a mock-up):
 *   1. The page opens at 1200 × 630 (DPR 2, so the card is 2400 × 1260) with the band made the card's height
 *      (--band-h, set before the engine mounts), so the engine frames the page's own place by its one hero rule in a
 *      box the card's size: the waterline at 0.66 of the card, the sky above it for the title. The header, the mist
 *      at the band's foot, the page's words and the tail are hidden; what is inscribed in the sky stays, at the site's
 *      own type, enlarged by INSCRIBE about its top-left corner (a preview is shown small), and inset to SAFE from the
 *      card's edges.
 *   2. The engine is forced live and then stilled (no drift, no small life); the tool waits until the stage's plates
 *      stop being developed and the fonts are in. The under-line is set back to the words the server sent (Contact's
 *      adds the hour in the browser: a card must not carry a clock).
 *   3. Two captures a moment apart must be the same picture (nothing is still moving), or it waits and tries again;
 *      then a JPEG of the viewport. The title's box is measured against SAFE on every side, and the tool refuses a
 *      card whose inscription leaves the safe area.
 * The manifest records, per card, the file's hash and a hash of the page's inscription as the server sends it (the
 * words on the card), so --check can tell a stale card from the served pages alone.
 * Page ids: home, work, writing, resume, contact, work-<slug> (a case), writing-<slug> (a note).
 * Regenerate after any change to a title or its under-line, the type, the band, the engine or a place.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Page } from '@playwright/test';
import { site } from '../content/site.ts';
import { flag, opt, sha } from './lib.ts';

const ROOT = process.cwd();
const BASE = opt('--base', opt('--url', 'http://127.0.0.1:3100')).replace(/\/$/, '');
const PREVIEW = opt('--preview', '');
const ONLY = opt('--pages', '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const OUT_DIR = PREVIEW ? path.resolve(PREVIEW) : path.join(ROOT, 'public', 'og');
const MANIFEST = path.join(ROOT, 'public', 'og', 'manifest.json');

const CARD = { width: 1200, height: 630, dpr: 2 } as const;
/** Nothing that matters within this many px of the card's edges (previews crop). */
const SAFE = 60;
/** The inscription on the card against the site's own size at 1200 px. */
const INSCRIBE = 1.3;
const QUALITY = 84; // JPEG
const STABLE_MS = 700; // two captures this far apart must match
const CHROME_ARGS = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'];

/** What each place's card shows, for the image's alt text. */
const SCENE: Record<string, string> = {
  home: 'blue peaks above a sea of mist in the morning light',
  work: 'a river town at its arched bridge',
  writing: 'a still lake with a small pavilion under a pine',
  resume: 'terraced fields stepping down to the river',
  contact: 'a ferry at the jetty on open water',
};

interface Card {
  id: string;
  route: string;
  /** the place it stands in (SCENE) */
  place: keyof typeof SCENE;
}

function cards(): Card[] {
  const slugs = (dir: string) =>
    readdirSync(path.join(ROOT, 'content', dir))
      .filter((f) => f.endsWith('.mdx'))
      .sort()
      .map((f) => f.slice(0, -4));
  return [
    { id: 'home', route: '/', place: 'home' },
    { id: 'about', route: '/about/', place: 'home' },
    ...(['work', 'writing', 'resume', 'contact'] as const).map((id) => ({ id, route: `/${id}/`, place: id })),
    ...slugs('work').map((s) => ({ id: `work-${s}`, route: `/work/${s}/`, place: 'work' as const })),
    ...slugs('writing').map((s) => ({ id: `writing-${s}`, route: `/writing/${s}/`, place: 'writing' as const })),
  ];
}

// ------------------------------------------------------------------------------------------------ the page's words
/** Markup as the text a reader sees: tags and React's comment marks out, entities decoded, one space between words. */
const textOf = (html: string) =>
  html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;| /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** A page's own words as the server sends it: its title (the page's <h1>) and the line under it, if it has one. */
async function inscription(route: string): Promise<{ title: string; under: string }> {
  const res = await fetch(BASE + route);
  if (!res.ok) throw new Error(`${route}: HTTP ${res.status} (is the build being served at ${BASE}?)`);
  const html = await res.text();
  const main = html.match(/<main\b[\s\S]*?<\/main>/)?.[0] ?? '';
  const title = textOf(main.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? '');
  if (!title) throw new Error(`${route}: the page has no <h1>`);
  const under = main.match(/<p\b[^>]*class="title__under(?:[ "][^>]*)?>([\s\S]*?)<\/p>/)?.[1] ?? '';
  return { title, under: textOf(under) };
}
const wordsOf = (w: { title: string; under: string }) => sha(JSON.stringify([w.title, w.under]));
/** The card's alt text: whose page it is, then what the card shows. */
function altOf(c: Card, w: { title: string; under: string }) {
  const scene = `an ink-wash painting of ${SCENE[c.place]}`;
  // (Home alone carries the inscription; every other card carries its page's title)
  if (c.id === 'home')
    return `${w.title}, ${site.jobTitle}: ${scene}, a few columns of Chinese calligraphy and a red seal in its sky.`;
  if (c.id.startsWith('work-')) return `${w.title}: a project by ${site.name}, its title in the sky of ${scene}.`;
  // (a title that ends in ? or ! is quoted, so the alt text does not read "…agent?: a note")
  if (c.id.startsWith('writing-'))
    return `${/[?!]$/.test(w.title) ? `“${w.title}”,` : `${w.title}:`} a note by ${site.name}, its title in the sky of ${scene}.`;
  return `${w.title} · ${site.name}: the page's title in the sky of ${scene}.`;
}

// ------------------------------------------------------------------------------------------------ in the page
/** Set before the engine mounts: the band is the card. */
const CSS = `
:root { --band-h: ${CARD.height}px !important; --band-sea: 0px !important; --band-zoom: 1 !important; --edge: ${SAFE + 12}px !important; }
.site-header, .skip-link, .band__mist, nextjs-portal { display: none !important; }
body > :not(.band, main), main * { visibility: hidden !important; }
main .inscription, main .inscription * { visibility: visible !important; }
main .inscription { animation: none !important; opacity: 1 !important; }
.inscription__at { left: ${SAFE + 12}px !important; top: ${SAFE + 12}px !important; zoom: ${INSCRIBE}; max-width: ${Math.round((CARD.width - 2 * (SAFE + 12)) / INSCRIBE)}px !important; }
/* (only Home carries an inscription: every other page's own title stands in the sky of its card) */
main:not(:has(.inscription)) .page-head, main:not(:has(.inscription)) .page-head * { visibility: visible !important; }
main:not(:has(.inscription)) .page-head { position: absolute !important; z-index: 7 !important; left: 0; top: ${SAFE + 12}px; display: block !important; padding: 0 ${SAFE + 12}px !important; max-width: ${CARD.width}px !important; zoom: ${INSCRIBE}; }
`;
const INIT = `window.__inkLive = true;
try { localStorage.setItem('ink:still', '1'); } catch {}
document.addEventListener('DOMContentLoaded', () => {
  const s = document.createElement('style');
  s.textContent = ${JSON.stringify(CSS)};
  document.head.appendChild(s);
});`;
/** The live stage is up and nothing is pending. */
const READY_JS = `(() => {
  if (document.readyState !== 'complete') return false;
  if (document.fonts && document.fonts.status !== 'loaded') return false;
  const i = window.__ink;
  if (!i) return false;
  const s = i.stats();
  return !!(s.plates && s.plates.on && s.stage && s.stage.ready && !s.pending);
})()`;
const DEVELOPED_JS = `(() => { const s = window.__ink.stats(); return s.plates && s.plates.on ? s.plates.developed : -1; })()`;
/** The under-line as the server sent it, and the inscription's box on the card (CSS px). */
const PLACE_JS = `((under) => {
  window.scrollTo(0, 0);
  const at = document.querySelector('main .inscription .inscription__at') || document.querySelector('main .page-head');
  if (!at) return null;
  const u = at.querySelector('.title__under');
  const norm = (t) => t.replace(/\\s+/g, ' ').trim();
  if (u && under && norm(u.textContent) !== under) u.textContent = under;
  let box = null;
  for (const el of at.querySelectorAll('.inscription__art, .inscription__en, .title, .title__under')) {
    const range = document.createRange();
    range.selectNodeContents(el);
    for (const r of [...range.getClientRects(), el.getBoundingClientRect()]) {
      if (!r.width || !r.height) continue;
      box = box
        ? { l: Math.min(box.l, r.left), t: Math.min(box.t, r.top), r: Math.max(box.r, r.right), b: Math.max(box.b, r.bottom) }
        : { l: r.left, t: r.top, r: r.right, b: r.bottom };
    }
  }
  return box;
})`;

/** A box on the card, in CSS px from its top-left corner. */
interface Box {
  l: number;
  t: number;
  r: number;
  b: number;
}

async function settle(page: Page, route: string) {
  await page.waitForFunction(READY_JS, undefined, { timeout: 45_000, polling: 250 });
  let last = -1;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(500);
    const n = (await page.evaluate(DEVELOPED_JS)) as number;
    if (n >= 0 && n === last) return;
    last = n;
  }
  throw new Error(`${route}: the stage's plates never stopped being developed`);
}

// ------------------------------------------------------------------------------------------------ the manifest
interface Entry {
  file: string;
  width: number;
  height: number;
  alt: string;
  /** a hash of the page's inscription as served when the card was cut: --check compares it with the page's now */
  words: string;
  sha256: string;
}
interface Manifest {
  cards: Record<string, Entry>;
}

function readManifest(): Manifest {
  if (!existsSync(MANIFEST)) return { cards: {} };
  return JSON.parse(readFileSync(MANIFEST, 'utf8')) as Manifest;
}

async function check(list: Card[]) {
  const m = readManifest();
  const problems: string[] = [];
  for (const c of list) {
    const e = m.cards[c.id];
    if (!e) {
      problems.push(`${c.id}: no card (its page falls back to its section's); npm run build:og -- --pages ${c.id}`);
      continue;
    }
    const file = path.join(ROOT, 'public', 'og', e.file);
    if (!existsSync(file)) problems.push(`${c.id}: ${e.file} is missing`);
    else if (sha(readFileSync(file)) !== e.sha256) problems.push(`${c.id}: ${e.file} differs from the manifest`);
    const w = await inscription(c.route);
    if (e.words !== wordsOf(w)) problems.push(`${c.id}: the page's title or under-line changed since its card was cut`);
    else if (e.alt !== altOf(c, w))
      problems.push(`${c.id}: the card's alt text changed; re-cut it to record the new one`);
  }
  for (const id of Object.keys(m.cards)) if (!list.some((c) => c.id === id)) problems.push(`${id}: a card for no page`);
  if (problems.length) {
    console.error('The link previews are stale:\n  ' + problems.join('\n  '));
    process.exit(1);
  }
  console.log(`The link previews are current (${list.length} cards).`);
}

async function cut(list: Card[]) {
  await mkdir(OUT_DIR, { recursive: true });
  const m = readManifest();
  const browser = await chromium.launch({ channel: 'chrome', args: CHROME_ARGS });
  try {
    for (const c of list) {
      const w = await inscription(c.route);
      // (a context per card: the engine mounts fresh on the card's own box, never a page change's arrival)
      const ctx = await browser.newContext({
        viewport: { width: CARD.width, height: CARD.height },
        deviceScaleFactor: CARD.dpr,
      });
      const page = await ctx.newPage();
      await page.addInitScript(INIT);
      const res = await page.goto(BASE + c.route, { waitUntil: 'load' });
      if (!res || !res.ok()) throw new Error(`${c.route}: HTTP ${res?.status()}`);
      await settle(page, c.route);
      let bytes: Buffer | null = null;
      let box: Box | null = null;
      for (let attempt = 0; attempt < 5 && !bytes; attempt++) {
        box = (await page.evaluate(`${PLACE_JS}(${JSON.stringify(w.under)})`)) as Box | null;
        const a = await page.screenshot({ type: 'png', scale: 'device' });
        await page.waitForTimeout(STABLE_MS);
        const b = await page.screenshot({ type: 'png', scale: 'device' });
        if (sha(a) === sha(b)) bytes = await page.screenshot({ type: 'jpeg', quality: QUALITY, scale: 'device' });
      }
      if (!bytes) throw new Error(`${c.id}: the card kept changing between captures`);
      if (!box) throw new Error(`${c.id}: nothing is inscribed on the card`);
      const out = [box.l, box.t, CARD.width - box.r, CARD.height - box.b].map((v) => Math.round(v));
      if (Math.min(...out) < SAFE)
        throw new Error(
          `${c.id}: the inscription comes within ${Math.min(...out)} px of the card's edge (left ${out[0]}, top ${out[1]}, right ${out[2]}, bottom ${out[3]}; the safe area is ${SAFE} px)`,
        );
      const file = `${c.id}.jpg`;
      await writeFile(path.join(OUT_DIR, file), bytes);
      m.cards[c.id] = {
        file,
        width: CARD.width * CARD.dpr,
        height: CARD.height * CARD.dpr,
        alt: altOf(c, w),
        words: wordsOf(w),
        sha256: sha(bytes),
      };
      console.log(
        `${c.id}: ${file} (${Math.round(bytes.length / 1024)} KB) · "${w.title}"${w.under ? ` / "${w.under}"` : ''} · clear of the edges by ${out.join(', ')} px (left, top, right, bottom)`,
      );
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  if (PREVIEW) {
    console.log(`preview only: ${list.length} card(s) in ${OUT_DIR}; public/og and its manifest are as they were`);
    return;
  }
  const ordered: Manifest = {
    cards: Object.fromEntries(Object.entries(m.cards).sort(([a], [b]) => a.localeCompare(b))),
  };
  await writeFile(MANIFEST, JSON.stringify(ordered, null, 2) + '\n');
  console.log(`wrote ${path.relative(ROOT, MANIFEST)}`);
}

async function main() {
  const all = cards();
  if (flag('--check')) return check(all);
  const list = ONLY.length ? all.filter((c) => ONLY.includes(c.id)) : all;
  const unknown = ONLY.filter((id) => !all.some((c) => c.id === id));
  if (unknown.length)
    throw new Error(`no such page: ${unknown.join(', ')} (pages: ${all.map((c) => c.id).join(', ')})`);
  await cut(list);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
