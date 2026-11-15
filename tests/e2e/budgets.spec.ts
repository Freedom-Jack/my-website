import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { fontsReady, isSoftware, ROUTES, settle, VIEWPORTS } from './support/pages';

// (the budgets are DOM metrics; on a software rasteriser the painting runs still so the page's main thread
// answers at once, not minutes in)
test.beforeEach(async ({ page }) => {
  if (await isSoftware(page)) await page.emulateMedia({ reducedMotion: 'reduce' });
});

/**
 * The budgets of the vanguard round's surface (the lead's ruling R1 of 2026-11-12, on the DESIGN §6 budgets that
 * came before), per page at 1440 × 900 / 1280 × 720 / 390 × 844, measured by the demo's own probe
 * (support/measure.js):
 *   - the first screen (Home): the name, the verb line, the title line, the proof with its measure and the action are
 *     all inside the first viewport at 1440, 1280 and 390; at 375 × 667 (below) the name, the verb line and the proof
 *     are, and the action may be the first thing below the fold;
 *   - at most four type sizes on Home's first screen; at most four on any screen of any page, with the accepted
 *     exceptions named below (five where a page's own objects meet on one screen);
 *   - the name at ~220 / ~200 / ~120 px on one line; the titles at 96 / 96 / 56 (a case's and a note's long title at
 *     72 / 72 / 40);
 *   - no text animating on scroll; nothing scrolls sideways; standalone tap targets ≥ 44 × 44; the header in one row
 *     from 360 (header.spec covers 375 and 360); Work a concise index (its length in screens, until P4 and P5 add the
 *     search and the hood and re-set it).
 * RETIRED by R1 (they described the old composition): "≥ 120 / 100 / 55 first-screen words" (the first screen is now
 * judged by what is inside it, above), "display ÷ readable ≤ 0.1 (0.4 on Home)" (a poster name and a poster numeral
 * are the design) and "the photo starts on the first screen" (no photo on the first screen is the rule now: the
 * portrait sits with About, lazy).
 * Accepted exceptions (five type sizes on one screen): Home (the About block's heading beside a ledger row's numeral,
 * title, line and lead), the Résumé (its letterhead), Contact (its address), Writing (its rows under the intro, and
 * the ending's poster link on its one screen), and Work (its section title, sub-heading, table head, text and caption
 * on one short screen at 1280 × 720; the ending's poster link beside "In the open" on its last screen; P4 and P5
 * re-set Work's screens).
 * OPEN (reported, not failed): a case page's long title at 390 is two or three lines at 40 px (a question for Jack).
 */
const MEASURE = readFileSync(path.join(import.meta.dirname, 'support/measure.js'), 'utf8');
const NAME = { '1440': 220, '1280': 200, '390': 104 } as const;
const TITLE = { '1440': 96, '1280': 96, '390': 56 } as const;
const TITLE_LONG = { '1440': 72, '1280': 72, '390': 40 } as const;
const WORK_LEN = { '1440': 5, '1280': 6, '390': 8 } as const;
const FIVE_OK = new Set(['resume', 'contact', 'writing', 'home', 'work']);
const LONG = new Set(['case', 'note']);
/** The first screen's parts, in order (Home): their boxes must end inside the first viewport. */
const FIRST = ['.name', '.first__verb', '.first__title', '.first__proof', '.first__action'] as const;

type M = Record<string, any>;

/** The bottom edge (CSS px from the document's top) of each of the first screen's parts, and the name's lines. */
async function firstScreen(page: import('@playwright/test').Page) {
  return page.evaluate(
    (sel) => {
      const out: Record<string, number | null> = {};
      for (const s of sel) {
        const el = document.querySelector(s);
        out[s] = el ? el.getBoundingClientRect().bottom + scrollY : null;
      }
      const name = document.querySelector('.name');
      const lines = name ? name.getClientRects().length : 0;
      const nameRect = name?.getBoundingClientRect();
      return { bottoms: out, vh: innerHeight, nameLines: lines, nameH: nameRect?.height ?? 0 };
    },
    sel as unknown as string[],
  );
}
const sel = FIRST;

for (const [vp, v] of Object.entries(VIEWPORTS) as Array<
  [keyof typeof VIEWPORTS, (typeof VIEWPORTS)[keyof typeof VIEWPORTS]]
>) {
  test.describe(`budgets at ${v.width} × ${v.height}`, () => {
    test.use({
      viewport: { width: v.width, height: v.height },
      deviceScaleFactor: v.dpr,
      isMobile: v.mobile,
      hasTouch: v.mobile,
    });
    for (const r of ROUTES) {
      test(r.id, async ({ page }) => {
        await page.goto(r.path);
        // (the budgets are DOM metrics: they wait for the fonts they measure, not for the painting, which a
        // software rasteriser may take minutes to settle)
        await fontsReady(page);
        const m = (await page.evaluate(`(${MEASURE})({ taps: true })`)) as M;
        const fail: string[] = [];
        // the first screen's formula (Home): every part inside the first viewport
        if (r.id === 'home') {
          const f = await firstScreen(page);
          for (const s of FIRST) {
            const b = f.bottoms[s];
            if (b === null) fail.push(`${s} is missing from the first screen`);
            else if (b > f.vh + 0.5) fail.push(`${s} ends at ${Math.round(b)} px, below the first viewport (${f.vh})`);
          }
          if (f.nameLines !== 1 || f.nameH > m.nameFs * 1.1) fail.push(`the name is not on one line (${f.nameLines})`);
          if (Math.abs(m.nameFs - NAME[vp]) > 3) fail.push(`name ${m.nameFs}px, target ~${NAME[vp]}`);
          if (m.photo?.onFirstScreen) fail.push(`the photo is on the first screen (top ${m.photo?.top})`);
        } else {
          const want = LONG.has(r.id) ? TITLE_LONG[vp] : TITLE[vp];
          if (Math.abs(m.h1Fs - want) > 0.5) fail.push(`title ${m.h1Fs}px, target ${want}`);
        }
        // type sizes: four on Home's first screen, four on any screen (five where accepted)
        if (r.id === 'home' && m.s0.sizes.length > 4)
          fail.push(`${m.s0.sizes.length} type sizes on the first screen: ${m.s0.sizes}`);
        const fiveOk = FIVE_OK.has(r.id);
        if (m.maxSizesPerScreen > 4 && !(m.maxSizesPerScreen === 5 && fiveOk))
          fail.push(`${m.maxSizesPerScreen} type sizes on one screen`);
        // a case's long title on a phone: reported for Jack
        if (LONG.has(r.id) && vp === '390' && (m.h1?.lines ?? 0) > 2)
          test
            .info()
            .annotations.push({ type: 'open', description: `${r.id} at 390: the title runs ${m.h1.lines} lines` });
        // no text animating on scroll
        if (m.reveal !== 0 || !m.arriveOk) fail.push(`data-reveal ${m.reveal}, data-arrive ${m.arrive}`);
        // nothing scrolls sideways; standalone tap targets ≥ 44 × 44
        if (m.overflow.sideways || m.overflow.offenderCount)
          fail.push(`sideways: ${JSON.stringify(m.overflow.offenders?.slice(0, 3))}`);
        const small = m.taps?.small ?? [];
        if (small.length)
          fail.push(
            `tap targets < 44: ${small
              .slice(0, 4)
              .map((t: M) => `${t.el} '${t.name}' ${t.hitW}×${t.hitH}`)
              .join('; ')}`,
          );
        // the header in one row from 360
        if (v.width >= 360 && (m.header?.rows ?? 1) > 1) fail.push(`header wraps into ${m.header.rows} rows`);
        // Work, a concise index
        if (r.id === 'work' && m.screens > WORK_LEN[vp]) fail.push(`Work is ${m.screens} screens > ${WORK_LEN[vp]}`);
        expect(fail, `${r.id} at ${vp}`).toEqual([]);
      });
    }
  });
}

/**
 * The first screen on the small phones (the lead's ruling R1): at 375 × 667 (the iPhone SE, mini and 8) the name, the
 * verb line and the proof are inside the first viewport and the action may be the first thing below the fold; at
 * 360 × 800 the name is still one line and everything is inside. At both widths every standalone target on the page
 * is 44 × 44 (the attack's A12: the size sweep at 360; the sweep at 390 runs in the budgets above).
 */
for (const [width, height, inside] of [
  [375, 667, ['.name', '.first__verb', '.first__proof']],
  [360, 800, [...FIRST]],
] as const) {
  test(`Home's first screen at ${width} × ${height}`, async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    if (await isSoftware(page)) await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await fontsReady(page);
    const f = await firstScreen(page);
    const fail: string[] = [];
    for (const s of inside) {
      const b = f.bottoms[s];
      if (b === null) fail.push(`${s} is missing`);
      else if (b > f.vh + 0.5) fail.push(`${s} ends at ${Math.round(b)} px, below the first viewport (${f.vh})`);
    }
    if (f.nameLines !== 1) fail.push(`the name is not on one line (${f.nameLines})`);
    const m = (await page.evaluate(`(${MEASURE})({ taps: true })`)) as M;
    if (m.overflow.sideways || m.overflow.offenderCount)
      fail.push(`sideways: ${JSON.stringify(m.overflow.offenders?.slice(0, 3))}`);
    if (m.s0.sizes.length > 4) fail.push(`${m.s0.sizes.length} type sizes on the first screen: ${m.s0.sizes}`);
    const small = m.taps?.small ?? [];
    if (small.length)
      fail.push(
        `tap targets < 44: ${small
          .slice(0, 4)
          .map((t: M) => `${t.el} '${t.name}' ${t.hitW}×${t.hitH}`)
          .join('; ')}`,
      );
    expect(fail, `Home at ${width} × ${height}`).toEqual([]);
    await ctx.close();
  });
}

/**
 * Home's words (P5): under 400 in <main>, the ending included, counted as a reader meets them (its rendered text: a
 * print-only line is not counted, the ledger's numerals are). content/pages/home.ts `held` keeps what was taken off.
 */
test("Home's words: under 400", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const words = await page.evaluate(
    () =>
      (document.querySelector('main') as HTMLElement).innerText.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w))
        .length,
  );
  expect(words, `Home has ${words} words`).toBeLessThan(400);
});

/**
 * Colour stays out from behind text: no blue blocks or stripes on the inner pages. On the inner pages at 1440 the
 * 120 px column left of the text block, from the header's foot to the hero box's foot, is paper: its mean chroma
 * (max - min of RGB, 0-255) within 2 of the paper's own (#EFF1EE: 3).
 */
const PAPER_CHROMA = 3;
test.describe('colour off text: the column left of the text is paper', () => {
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  for (const r of ROUTES.filter((x) => ['writing', 'resume', 'contact'].includes(x.id))) {
    test(r.id, async ({ page }) => {
      // (reads the painting's own pixels: judged on a real GPU, DESIGN §13)
      test.skip(await isSoftware(page), 'the painting is judged on a hardware GPU');
      await page.goto(r.path);
      await settle(page);
      const box = await page.evaluate(() => {
        const t = document.querySelector('.strip__text')?.getBoundingClientRect();
        const a = document.querySelector('.strip__art')?.getBoundingClientRect();
        const h = document.querySelector('header')?.getBoundingClientRect();
        return t && a
          ? { left: t.left, top: Math.max(h ? h.bottom : 0, a.top), bottom: Math.min(a.bottom, innerHeight) }
          : null;
      });
      expect(box, `${r.id}: hero boxes`).not.toBeNull();
      const w = Math.max(8, Math.min(120, Math.floor(box!.left)));
      const png = await page.screenshot({
        clip: { x: 0, y: box!.top, width: w, height: Math.max(8, box!.bottom - box!.top) },
      });
      const chroma = await page.evaluate(async (b64) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const x = c.getContext('2d')!;
        x.drawImage(img, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height).data;
        let s = 0;
        for (let i = 0; i < d.length; i += 4)
          s += Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
        return s / (d.length / 4);
      }, png.toString('base64'));
      expect(
        Math.abs(chroma - PAPER_CHROMA),
        `${r.id}: mean chroma left of the text ${chroma.toFixed(2)}`,
      ).toBeLessThanOrEqual(2);
    });
  }
});
