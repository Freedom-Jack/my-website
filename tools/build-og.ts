/**
 * The link previews: one 1200 × 630 card per page (Open Graph and Twitter images, public/og/<page>.jpg), cut from the
 * real site, so a link shared on LinkedIn, Slack, iMessage or X shows the page's own hero: its place in the painting
 * and its title block, with the name and the title on the inner pages. src/lib/seo.ts reads public/og/manifest.json
 * and gives every page its card (a case or a note without one falls back to its section's).
 *
 *   NEXT_PUBLIC_INK_QA=1 npm run build && npm start -- -p 3100     a QA build (the tool waits on the painting's stats)
 *   npm run build:og                                              cut every card; needs Google Chrome (headless, on
 *                                                                 this machine's GPU: the cards are the real painting)
 *   npm run build:og -- --pages home,work-rag-assistant           some of them (the manifest keeps the rest)
 *   npm run build:og -- --check                                   no browser: exit 1 when a page has no card, or a
 *                                                                 card was cut with other words than the page has now
 *   npm run build:og -- --url http://127.0.0.1:3000
 *
 * How a card is cut (the same page, reshaped, never a mock-up):
 *   1. The page opens at 1200 × 630 (DPR 2, so the card is 2400 × 1260). The header, the footer and everything but
 *      the hero are hidden; the hero's box is made the card's height, so the engine frames the page's own place by its
 *      one hero rule (compose.ts HERO) in the card. Inner pages: the box is cut 150 px taller and shifted up, so the
 *      waterline lands at 0.55 of the card, not 0.66; the title block is centred, its title at the name's size, with
 *      "Qijin Xu · Lead AI/ML Architect" above it and the intro left out (the card is a cover, not the page); Home's
 *      card: the name with one line under it, its two paragraphs left out for the same reason.
 *   2. The painting settles (the morning opening, the arrival, every figure layer), then the fonts, then a last
 *      moment for the name's swash and the light's sheen.
 *   3. A JPEG of the viewport. The manifest records each card's words, so --check can tell a stale card.
 * Page ids: home, work, writing, resume, contact, work-<slug> (a case), writing-<slug> (a note).
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { parse } from 'yaml';
import { site } from '../content/site.ts';
import { longDate } from '../src/lib/dates.ts';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string, d: string) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1]! : d;
};
const BASE = opt('--url', 'http://127.0.0.1:3100').replace(/\/$/, '');
const ONLY = opt('--pages', '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const OUT_DIR = path.join(ROOT, 'public', 'og');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');

const CARD = { width: 1200, height: 630, dpr: 2 } as const;
const EXTRA = 150; // the inner pages' hero box: this much taller than the card, shifted up by as much
const QUALITY = 82; // JPEG
const AFTER_SETTLE_MS = 3500; // the morning opening's tail, the swash, the sheen
const CHROME_ARGS = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'];

/** What each place's card shows, for the image's alt text. */
const SCENE: Record<string, string> = {
  home: 'his mountain in spring: a plum bough, a swallow and the morning light over the peaks',
  work: 'a river town at its rainbow bridge',
  writing: 'a still lake with a pavilion under a willow',
  resume: 'terraced fields stepping down to the river',
  contact: 'a ferry at the jetty on open water',
};

interface Card {
  id: string;
  route: string;
  /** the hero's title as the card shows it (the Résumé's card says "Résumé", its page's h1 is the name) */
  title: string;
  eyebrow: string;
  /** a note's byline on the card (its page's byline starts with the name, which the eyebrow carries) */
  byline?: string;
  /** Home's one line under the name (the card is a cover: its two hero paragraphs would be unreadable at preview size) */
  line?: string;
  alt: string;
}

/** A content folder's MDX files with their front matter (the pages read them through MDX; this tool reads the YAML). */
function mdx(dir: string): Array<{ slug: string; data: Record<string, unknown> }> {
  const root = path.join(ROOT, 'content', dir);
  return readdirSync(root)
    .filter((f) => f.endsWith('.mdx'))
    .sort()
    .map((f) => {
      const m = readFileSync(path.join(root, f), 'utf8').match(/^---\n([\s\S]*?)\n---\n/);
      if (!m) throw new Error(`content/${dir}/${f}: no front matter`);
      return { slug: f.slice(0, -4), data: parse(m[1]!) as Record<string, unknown> };
    });
}
/** A title's inline markup (CONTENT.md) as plain text. */
const plain = (s: string) =>
  s
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1')
    .replace(/\{([^{}]+)\}/g, '$1');
const text = (data: Record<string, unknown>, key: string, where: string) => {
  const v = data[key];
  if (typeof v === 'string' && v) return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  throw new Error(`${where}: no ${key}`);
};

async function cards(): Promise<Card[]> {
  const eyebrow = `${site.name} · ${site.jobTitle}`;
  const label = (href: string) => site.nav.find((n) => n.href === href)?.label ?? href;
  const list: Card[] = [
    {
      id: 'home',
      route: '/',
      title: site.name,
      eyebrow: '',
      line: `${site.jobTitle} · ${site.seo.employer.name}, ${site.city}`,
      alt: `${site.name}, ${site.jobTitle}: his name and introduction beside an ink-wash painting of ${SCENE.home}.`,
    },
    ...(['work', 'writing', 'resume', 'contact'] as const).map((id) => ({
      id,
      route: `/${id}/`,
      title: label(`/${id}/`),
      eyebrow,
      alt: `${label(`/${id}/`)}: ${eyebrow}, beside an ink-wash painting of ${SCENE[id]}.`,
    })),
  ];
  for (const { slug, data } of mdx('work')) {
    const title = plain(text(data, 'title', `content/work/${slug}.mdx`));
    list.push({
      id: `work-${slug}`,
      route: `/work/${slug}/`,
      title,
      eyebrow,
      alt: `${title}: a project by ${site.name}, beside an ink-wash painting of ${SCENE.work}.`,
    });
  }
  for (const { slug, data } of mdx('writing')) {
    const where = `content/writing/${slug}.mdx`;
    const title = text(data, 'title', where);
    const kind = text(data, 'kind', where);
    list.push({
      id: `writing-${slug}`,
      route: `/writing/${slug}/`,
      title,
      eyebrow,
      byline: `${kind} · ${longDate(text(data, 'published', where))}`,
      // (a title that ends in ? or ! is quoted, so the alt text does not read "…agent?: a note")
      alt: `${/[?!]$/.test(title) ? `“${title}”,` : `${title}:`} a ${kind.toLowerCase()} by ${site.name}, beside an ink-wash painting of ${SCENE.writing}.`,
    });
  }
  return list;
}

// ------------------------------------------------------------------------------------------------ in the page
const CSS = `
:root { --strip-sub: ${CARD.height + EXTRA}px !important; --strip-home: ${CARD.height}px !important; }
.site-header, .site-footer, .skip-link { display: none !important; }
main * { visibility: hidden !important; }
main .strip, main .strip * { visibility: visible !important; }
main .strip .actions, main .strip .hero__actions { display: none !important; }
main .strip--sub { margin-top: -${EXTRA}px !important; }
main .strip--sub > .strip__text { padding-block: 0 !important; align-self: center !important; margin-top: ${EXTRA}px !important; }
main .strip--sub .page-title { font-size: 4.5rem !important; line-height: 1 !important; }
main .strip .lead { display: none !important; }
.og-line { margin: 1.25rem 0 0 !important; font-size: 1.75rem !important; font-weight: 560 !important; line-height: 1.25 !important; color: var(--ink-2) !important; }
.og-eyebrow { margin: 0 0 1.25rem !important; font-size: 1.5rem !important; font-weight: 560 !important; color: var(--ink-2) !important; }
`;
// The hero's words as the card wants them: the eyebrow above the title, the Résumé's title, a note's byline.
const PREPARE_JS = `(([title, eyebrow, byline, line]) => {
  const text = document.querySelector('main .strip__text');
  if (!text) return 'no hero';
  const h1 = text.querySelector('h1');
  if (!h1) return 'no title';
  if (h1.textContent.trim() !== title) h1.textContent = title;
  if (eyebrow) {
    const p = document.createElement('p');
    p.className = 'og-eyebrow';
    p.textContent = eyebrow;
    text.prepend(p);
  }
  if (byline) {
    const b = text.querySelector('p.small');
    if (b) b.textContent = byline;
  }
  if (line) {
    const p = document.createElement('p');
    p.className = 'og-line';
    p.textContent = line;
    h1.insertAdjacentElement('afterend', p);
  }
  window.scrollTo(0, 0);
  return 'ok';
})`;
// Settled: the painting has nothing left to paint (tests/e2e/support/pages.ts settle), and the fonts are in.
const SETTLE_JS = `(() => {
  if (document.readyState !== 'complete') return false;
  if (document.fonts && document.fonts.status !== 'loaded') return false;
  if (document.documentElement.classList.contains('no-landscape')) return true;
  const L = window.__ink;
  if (!L) return performance.now() > 15000;
  const s = L.stats();
  if (!s || s.mode === 'static') return true;
  if (s.arriving || s.pending || s.sweeping || s.deferred) return false;
  if (Object.values(s.figures || {}).includes('pending')) return false;
  const w = s.windows || {};
  const anyVis = (w.strip && w.strip.visible) || (w.closing && w.closing.visible) || s.hzK > 0;
  if (anyVis && (!(s.fullAt > 0) || s.draftAt > s.fullAt || performance.now() - s.draftAt < 400)) return false;
  return true;
})`;

// ------------------------------------------------------------------------------------------------ the manifest
interface Entry {
  file: string;
  width: number;
  height: number;
  alt: string;
  /** the words the card was cut with: --check compares them with the page's words now */
  words: string;
  sha256: string;
}
interface Manifest {
  cards: Record<string, Entry>;
}
const wordsOf = (c: Card) => sha(JSON.stringify([c.title, c.eyebrow, c.byline ?? '', c.line ?? '']));
const sha = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');

function readManifest(): Manifest {
  if (!existsSync(MANIFEST)) return { cards: {} };
  return JSON.parse(readFileSync(MANIFEST, 'utf8')) as Manifest;
}

function check(list: Card[]) {
  const m = readManifest();
  const problems: string[] = [];
  for (const c of list) {
    const e = m.cards[c.id];
    if (!e) {
      problems.push(`${c.id}: no card (its page falls back to its section's); npm run build:og -- --pages ${c.id}`);
      continue;
    }
    const file = path.join(OUT_DIR, e.file);
    if (!existsSync(file)) problems.push(`${c.id}: ${e.file} is missing`);
    else if (sha(readFileSync(file)) !== e.sha256) problems.push(`${c.id}: ${e.file} differs from the manifest`);
    if (e.words !== wordsOf(c)) problems.push(`${c.id}: the card was cut with other words than the page has now`);
    if (e.alt !== c.alt) problems.push(`${c.id}: the card's alt text changed; re-cut it to record the new one`);
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
    const ctx = await browser.newContext({
      viewport: { width: CARD.width, height: CARD.height },
      deviceScaleFactor: CARD.dpr,
    });
    const page = await ctx.newPage();
    for (const c of list) {
      const res = await page.goto(BASE + c.route, { waitUntil: 'load' });
      if (!res || !res.ok()) throw new Error(`${c.route}: HTTP ${res?.status()}`);
      await page.addStyleTag({ content: CSS });
      // (a string is evaluated as an expression: each one is called in the expression itself)
      const prepared = await page.evaluate(
        `${PREPARE_JS}(${JSON.stringify([c.title, c.eyebrow, c.byline ?? '', c.line ?? ''])})`,
      );
      if (prepared !== 'ok') throw new Error(`${c.route}: ${prepared}`);
      await page.waitForFunction(`${SETTLE_JS}()`, undefined, { timeout: 45_000, polling: 250 });
      await page.waitForTimeout(AFTER_SETTLE_MS);
      const file = `${c.id}.jpg`;
      const bytes = await page.screenshot({ type: 'jpeg', quality: QUALITY, scale: 'device' });
      await writeFile(path.join(OUT_DIR, file), bytes);
      m.cards[c.id] = {
        file,
        width: CARD.width * CARD.dpr,
        height: CARD.height * CARD.dpr,
        alt: c.alt,
        words: wordsOf(c),
        sha256: sha(bytes),
      };
      console.log(`${c.id}: ${file} (${Math.round(bytes.length / 1024)} KB)`);
    }
  } finally {
    await browser.close();
  }
  const ordered: Manifest = {
    cards: Object.fromEntries(Object.entries(m.cards).sort(([a], [b]) => a.localeCompare(b))),
  };
  await writeFile(MANIFEST, JSON.stringify(ordered, null, 2) + '\n');
  console.log(`wrote ${path.relative(ROOT, MANIFEST)}`);
}

async function main() {
  const all = await cards();
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
