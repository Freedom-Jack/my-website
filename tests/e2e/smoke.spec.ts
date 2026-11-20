import { expect, test } from '@playwright/test';
import { PHONE, ROUTES, settle, TABLET, watch } from './support/pages';
import { tapsAndOverflow } from './support/taps';

/**
 * Smoke: every route, at a phone's, a tablet's and a laptop's width, answers, says what it is, holds one <main> and
 * one h1, marks where the reader is, and logs no error and no failed request; nothing leaves the window's sides.
 * Plus the hard rules on the rendered page (CLAUDE.md): no phone number, no street address, no PMP, no old résumé
 * file, the one public email, no CJK text (the seal is a path) and the visible name's form.
 */
const PHONE_NUMBER =
  /(?<![\w.#/-])(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]{0,2}\d{3}[\s.-]\d{4}(?![\w-])|(?<![\d\w])\+\d{1,3}[\s.-]?\(?\d{1,4}\)?(?:[\s.-]?\d{2,4}){2,4}(?!\d)|\btel:/i;
const CJK = /[⺀-⿟　-〿぀-ヿ㐀-䶿一-鿿가-힯豈-﫿＀-￯]/u;
const STREET =
  /\b\d{1,5}\s+(?:[A-Z][a-z]+\s){1,3}(?:Street|St\.|Avenue|Ave\.?|Road|Rd\.|Boulevard|Blvd\.?|Drive|Dr\.|Crescent|Cres\.?|Court|Ct\.|Lane|Way|Place)\b/;
const EMAIL = 'qxjack@gmail.com';

const SIZES = [
  { name: 'a phone (390)', use: PHONE },
  { name: 'a tablet (768)', use: TABLET },
  { name: 'a laptop (1440)', use: { viewport: { width: 1440, height: 900 } } },
] as const;

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.use(size.use);
    for (const r of ROUTES) {
      test(`${r.id} (${r.path})`, async ({ page }) => {
        const lost = r.page === 'not-found';
        const errors = watch(page, { allow404: lost });
        const res = await page.goto(r.path);
        expect(res?.status()).toBe(lost ? 404 : 200);
        await expect(page).toHaveTitle(r.title);
        await expect(page.locator('main')).toHaveCount(1);
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(page.locator('main h1')).toBeVisible();
        await expect(page.locator('main')).toHaveAttribute('data-page', r.page);
        await settle(page);

        // the hard rules on what the visitor gets
        const html = await page.content();
        expect(html).not.toMatch(PHONE_NUMBER);
        expect(html).not.toMatch(STREET);
        expect(html).not.toMatch(/QijinXu_Resume\.pdf/i);
        expect(html).not.toMatch(/\bPMP\b|Project Management Professional/);
        const text = await page.evaluate(() => document.body.innerText);
        expect(text).not.toMatch(CJK);
        // (the one Chinese character is the seal, and the seal is a drawing: no <text>, no font)
        expect(await page.locator('.seal text, .seal tspan').count()).toBe(0);
        // the visible name is "Qijin Xu"; "(Jack)" is for titles and search data only
        expect(text).toContain('Qijin Xu');
        expect(text).not.toMatch(/\(Jack\)/);
        // every address written or linked is the public one
        const mails = await page
          .locator('a[href^="mailto:"]')
          .evaluateAll((as) => as.map((a) => a.getAttribute('href')));
        expect(mails.length).toBeGreaterThan(0);
        for (const m of mails) expect(m).toBe(`mailto:${EMAIL}`);
        expect((text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []).filter((m) => m !== EMAIL)).toEqual([]);
        // no page links to this site's own repository (the launch gate)
        expect(await page.locator('a[href*="github.com"][href*="my-website" i]').count()).toBe(0);

        // you are here: the header's word and the tail's map mark this page (or its section) once each; the 404,
        // which lies off the map, marks nothing
        const current = await page
          .locator('[aria-current]')
          .evaluateAll((els) => els.map((e) => `${e.closest('nav, header')?.className}:${e.getAttribute('href')}`));
        if (r.current === null) expect(current).toEqual([]);
        else
          expect(current.sort()).toEqual(
            [`${r.current === '/' ? 'site-header' : 'site-nav'}:${r.current}`, `scrollmap:${r.current}`].sort(),
          );
        // the tail signs every page with the one seal; the header carries none
        await expect(page.locator('.tail .seal')).toHaveCount(1);
        await expect(page.locator('.site-header .seal')).toHaveCount(0);

        // nothing scrolls sideways, and the title stands inside the window
        const side = await page.evaluate(() => ({
          doc: document.documentElement.scrollWidth,
          win: document.documentElement.clientWidth,
          h1: (({ left, right }) => ({ left, right }))(document.querySelector('main h1')!.getBoundingClientRect()),
        }));
        expect(side.doc, 'the page is wider than the window').toBeLessThanOrEqual(side.win);
        expect(side.h1.left).toBeGreaterThanOrEqual(0);
        expect(side.h1.right).toBeLessThanOrEqual(side.win + 0.5);
        expect((await page.evaluate(tapsAndOverflow)).offenders.slice(0, 3)).toEqual([]);

        expect(errors).toEqual([]);
      });
    }
  });
}

test('old addresses go to their new homes (301)', async ({ request }) => {
  const cases: Array<[string, string]> = [
    ['/about/', '/'],
    ['/projects/', '/work/'],
    ['/blog/', '/writing/'],
    ['/blog/Building-Autonomous-AI-Agents/', '/writing/what-is-an-ai-agent/'],
    ['/writing/building-modular-ai-agents/', '/writing/what-is-an-ai-agent/'],
    ['/blog/welcome-to-my-first-blog/', '/writing/'],
    ['/documents/QijinXu_Resume.pdf', '/resume/'],
  ];
  for (const [from, to] of cases) {
    const res = await request.get(from, { maxRedirects: 0 });
    expect(res.status(), from).toBe(301);
    expect(new URL(res.headers()['location']!, 'http://x').pathname, from).toBe(to);
  }
});

test('the machine-readable files say what the pages say, and nothing to an AI agent', async ({ request }) => {
  const resume = await (await request.get('/resume.json')).json();
  expect(resume.basics.name).toBe('Qijin Xu');
  expect(resume.basics.email).toBe(EMAIL);
  expect(JSON.stringify(resume)).not.toMatch(PHONE_NUMBER);
  expect(resume.basics).not.toHaveProperty('phone');
  const llms = await (await request.get('/llms.txt')).text();
  expect(llms).toMatch(/^# Qijin Xu/);
  expect(llms).not.toMatch(PHONE_NUMBER);
  expect(llms).not.toMatch(/ignore|instruction|you (must|should)/i); // facts only, never instructions to AI agents
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain('/work/rag-assistant/');
  expect(sitemap).not.toMatch(/about|404|building-modular/);
  expect((await request.get('/robots.txt')).status()).toBe(200);
  expect((await request.get('/writing/feed.xml')).status()).toBe(200);
});

test('the résumé’s PDF link opens the one generated PDF, under his name', async ({ page, request }) => {
  await page.goto('/resume/');
  const link = page.locator('main a[href$=".pdf"]');
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute('href', '/resume.pdf');
  const pdf = await request.get('/resume.pdf');
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toContain('application/pdf');
  expect(pdf.headers()['content-disposition']).toContain('Qijin-Xu-Resume.pdf');
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
});
