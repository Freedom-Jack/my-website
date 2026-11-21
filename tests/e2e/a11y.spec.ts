import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { sampledContrast } from './support/contrast';
import { fontsReady, PHONE, type Route, ROUTES, scrollTo, settle, SMALL_PHONE, TABLET } from './support/pages';
import { tapsAndOverflow } from './support/taps';

/**
 * Accessibility, on every route:
 *   - axe-core (wcag2a, wcag2aa, wcag21aa, wcag22aa, best-practice) at a laptop's and a phone's width: no serious or
 *     critical violation. The page is judged as a reader who has gone down it meets it (the pieces that load as they
 *     are reached are in).
 *   - the words on the paper: axe cannot judge contrast over the paper's grain (a background image), so it judges
 *     them again on the plain paper colour, with the band out of the way; what it still cannot decide (a link's
 *     drawn underline, a diagram's words) is sampled from the pixels really painted under it.
 *   - the words on the painting (the header's words, the page's title and the line under it, the next place's name):
 *     sampled from the pixels painted under them, at the page's top, once the band has stood back, and at the page's
 *     end: 4.5:1, or 3:1 for large text (the titles).
 *   - tap targets on a phone: every standalone target at least 44 px tall (a link inside a sentence is WCAG 2.5.8's
 *     exception).
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'];
/** Rules that must have run on every page: a rule renamed or dropped by an axe update fails here, not silently. */
const RULES = [
  'color-contrast',
  'link-name',
  'button-name',
  'aria-hidden-focus',
  'aria-valid-attr-value',
  'aria-allowed-attr',
  'landmark-one-main',
  'region',
  'page-has-heading-one',
  'heading-order',
  'bypass',
  'target-size',
  'meta-viewport',
  'html-has-lang',
  'document-title',
  'image-alt',
] as const;

/**
 * What the checks below are known to find and are told to leave out, so each still guards everything else. Empty
 * today. An entry here is a defect in src/ waiting for its fix: name the rule or the link's words, say where it is,
 * and take the entry out with the fix (the tap-target check fails on an entry that no longer applies).
 */
const KNOWN = {
  /** axe rule ids left out, by route */
  axe: {} as Partial<Record<Route['id'], string[]>>,
  /** standalone links under 44 px tall on a phone (360 × 800), by their words: `*` is every page */
  small: {} as Partial<Record<Route['id'] | '*', string[]>>,
};

/** Go down the page and back, so what loads as it is reached (the live pieces, the tail's map) has loaded. */
async function readThrough(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight / 2) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise((done) => setTimeout(done, 60));
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

async function axeOn(page: Page, route: Route, known: string[]) {
  await page.goto(route.path);
  await fontsReady(page);
  await readThrough(page);
  const fail: string[] = [];

  // ---- every rule, on the page as it stands
  const axe = await new AxeBuilder({ page })
    .withTags(TAGS)
    .options({ rules: Object.fromEntries(RULES.map((id) => [id, { enabled: true }])) })
    .analyze();
  const ran = new Set([...axe.passes, ...axe.violations, ...axe.incomplete, ...axe.inapplicable].map((x) => x.id));
  expect(
    RULES.filter((id) => !ran.has(id)),
    'rules that did not run',
  ).toEqual([]);
  const say = (v: (typeof axe.violations)[number]) =>
    `${v.id} [${v.impact}] (${v.nodes.length}): ${v.nodes
      .slice(0, 3)
      .map((n) => n.target.join(' '))
      .join(' | ')}`;
  for (const v of axe.violations)
    if ((v.impact === 'serious' || v.impact === 'critical') && !known.includes(v.id)) fail.push(say(v));
  const lesser = axe.violations.filter((v) => v.impact !== 'serious' && v.impact !== 'critical');
  if (lesser.length)
    test.info().annotations.push({ type: 'axe, moderate or minor', description: lesser.map(say).join(' · ') });

  // ---- the words on the paper: contrast against the plain paper colour (the grain and the band set aside)
  const band = await page.addStyleTag({
    content: '.band, .inscription, .site-header { visibility: hidden !important; }',
  });
  const grain = await page.addStyleTag({ content: 'html { background-image: none !important; }' });
  const onPaper = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
  for (const v of onPaper.violations) fail.push(say(v));
  await grain.evaluate((n) => (n as Element).remove());
  // what axe still could not decide, sampled where it lies on the real paper (not what is hidden from readers)
  const undecided: string[] = [];
  for (const n of onPaper.incomplete.flatMap((v) => v.nodes)) {
    const sel = String(n.target[0]);
    const deco = await page
      .locator(sel)
      .first()
      .evaluate((e) => !!e.closest('[aria-hidden="true"]'))
      .catch(() => false);
    if (!deco) undecided.push(sel);
  }
  if (undecided.length > 45) fail.push(`contrast undecided on ${undecided.length} nodes (45 are sampled)`);
  const notes: string[] = [];
  for (const sel of undecided.slice(0, 45)) {
    const c = await sampledContrast(page, page.locator(sel).first());
    if (c.unsampled === 'missing') fail.push(`contrast: ${sel} was undecided by axe and cannot be sampled`);
    else if (c.unsampled) notes.push(`${sel}: no box`);
    else if (c.worst < c.need) fail.push(`contrast (sampled): ${sel} ${c.worst}:1 < ${c.need}:1 (${c.color})`);
  }
  await band.evaluate((n) => (n as Element).remove());
  test.info().annotations.push({
    type: 'contrast',
    description: `${undecided.length} sampled${notes.length ? `; ${notes.join(' · ')}` : ''}`,
  });
  return fail;
}

for (const size of [
  { name: 'a laptop (1440 × 900)', use: { viewport: { width: 1440, height: 900 } } },
  { name: 'a phone (390 × 844)', use: PHONE },
] as const) {
  test.describe(`axe on ${size.name}`, () => {
    test.use(size.use);
    for (const r of ROUTES)
      test(r.id, async ({ page }) => {
        expect(await axeOn(page, r, KNOWN.axe[r.id] ?? [])).toEqual([]);
      });
  });
}

// ------------------------------------------------------------------ the words on the painting
/** The header's words (his name, the five places, the Ask's field), then what is inscribed: the line in English and
 *  where it is from. (The page's own title and the way on stand on the paper, where axe judges them.) */
const HEADER = '.site-header__name, .site-nav a, .ask-door';
const LINE = 'main .inscription .inscription__en > span';
const FROM = 'main .inscription .inscription__en > cite';

async function wordsOnThePainting(page: Page, route: Route, where: 'top' | 'settled' | 'end') {
  const fail: string[] = [];
  const read: string[] = [];
  const sample = async (sel: string, need?: number) => {
    const all = page.locator(sel);
    let n = 0;
    for (let i = 0; i < (await all.count()); i++) {
      const el = all.nth(i);
      // (what a reader sees: laid out, not let out of sight, inside the window)
      const seen = await el.evaluate((e) => {
        if (!e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
        for (let x: Element | null = e; x; x = x.parentElement)
          if (Number(getComputedStyle(x).opacity) < 0.99) return false;
        const b = e.getBoundingClientRect();
        return b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight;
      });
      if (!seen) continue;
      const c = await sampledContrast(page, el, { inPlace: true, need });
      const words = (await el.innerText()).trim().replace(/\s+/g, ' ').slice(0, 28);
      if (c.unsampled) fail.push(`${route.id}, ${where}: "${words}" could not be sampled (${c.unsampled})`);
      else if (c.worst < c.need)
        fail.push(`${route.id}, ${where}: "${words}" ${c.worst}:1 < ${c.need}:1 at ${c.px} px`);
      else read.push(`${words} ${c.worst}`);
      n++;
    }
    return n;
  };
  // the header's words stand fixed: on the sky at the page's top, on the header's own paper after. Always there,
  // always 4.5:1 (a narrow phone shows the seal alone for his name: the five places and the Ask at the least)
  expect(await sample(HEADER, 4.5), `${route.id}, ${where}: the header's words`).toBeGreaterThanOrEqual(6);
  if (where === 'top' && route.id === 'home') {
    // what is inscribed in Home's sky: small text, 4.5:1
    expect(
      await sample(LINE, 4.5),
      `${route.id}: the inscription's line is in the window at the page's top`,
    ).toBeGreaterThan(0);
    await sample(FROM, 4.5);
  }
  return { fail, read };
}

for (const size of [
  { name: 'a laptop (1440 × 900)', use: { viewport: { width: 1440, height: 900 } } },
  { name: 'a small laptop (1280 × 720)', use: { viewport: { width: 1280, height: 720 } } },
  { name: 'a tablet (768 × 1024)', use: TABLET },
  { name: 'a phone (390 × 844)', use: PHONE },
] as const) {
  test.describe(`the words on the painting, ${size.name}`, () => {
    test.use(size.use);
    test('the header and what is inscribed stay readable as the painting moves', async ({ page }) => {
      test.setTimeout(120_000);
      const fail: string[] = [];
      for (const r of ROUTES) {
        await page.goto(r.path);
        await settle(page);
        for (const where of ['top', 'settled', 'end'] as const) {
          await scrollTo(page, where === 'top' ? 0 : where === 'settled' ? size.use.viewport.height : 1e6);
          const got = await wordsOnThePainting(page, r, where);
          fail.push(...got.fail);
        }
      }
      expect(fail).toEqual([]);
    });
  });
}

// ------------------------------------------------------------------ tap targets
async function smallTargets(page: Page, route: Route) {
  await page.goto(route.path);
  await fontsReady(page);
  await readThrough(page);
  const m = await page.evaluate(tapsAndOverflow);
  return { small: m.small, offenders: m.offenders };
}

test.describe('tap targets on a phone (360 × 800)', () => {
  test.use(SMALL_PHONE);
  for (const r of ROUTES) {
    test(r.id, async ({ page }) => {
      const m = await smallTargets(page, r);
      const known = [...(KNOWN.small['*'] ?? []), ...(KNOWN.small[r.id] ?? [])];
      const small = m.small
        .filter((t) => !known.includes(t.name))
        .map((t) => `${t.el} '${t.name}' ${t.hitW}×${t.hitH}`);
      expect(small, `${r.id}: standalone targets under 44 px tall`).toEqual([]);
      // (an entry that no longer applies is taken off the list, so the list never hides a new one of the same name)
      const stale = known.filter((name) => !m.small.some((t) => t.name === name));
      expect(stale, `${r.id}: KNOWN.small entries that are no longer small`).toEqual([]);
      expect(m.offenders.slice(0, 3)).toEqual([]);
    });
  }
});
