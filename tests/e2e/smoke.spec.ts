import { expect, test } from '@playwright/test';
import { isSoftware, ROUTES, settle } from './support/pages';

// A smoke test per route: it answers, says what it is, holds one <main> and one h1, is marked as the page it is,
// paints (or falls back), and logs no errors. Plus the hard rules on the rendered page (DESIGN §2).
// (a software rasteriser repaints the ambient painting forever and stalls the page's main thread; the checks here
// are DOM-only, so on software the painting runs still — reduced motion — and the page answers at once)
test.beforeEach(async ({ page }) => {
  if (await isSoftware(page)) await page.emulateMedia({ reducedMotion: 'reduce' });
});
const PHONE =
  /(?<![\w.#/-])(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]{0,2}\d{3}[\s.-]\d{4}(?![\w-])|(?<![\d\w])\+\d{1,3}[\s.-]?\(?\d{1,4}\)?(?:[\s.-]?\d{2,4}){2,4}(?!\d)|\btel:/i;
const CJK = /[⺀-⿟　-〿぀-ヿ㐀-䶿一-鿿가-힯豈-﫿＀-￯]/u;

for (const r of ROUTES) {
  test(`${r.id} (${r.path})`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() !== 'error' || /GPU stall due to ReadPixels/.test(m.text())) return;
      // (the 404 page's own document answers 404, which the browser logs)
      if (r.page === 'not-found' && /status of 404/.test(m.text())) return;
      errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(String(e)));
    const res = await page.goto(r.path);
    expect(res?.status()).toBe(r.page === 'not-found' ? 404 : 200);
    await expect(page).toHaveTitle(r.title);
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('main h1')).toHaveCount(1);
    await expect(page.locator('main')).toHaveAttribute('data-page', r.page);
    await settle(page);
    // the landscape mounted (or gave the page its static fallback), or the live probe kept the page on its still
    // (features/landscape/probe.ts: reduced motion, Still, Save-Data, no hardware WebGL, a failed cadence)
    const mode = await page.evaluate(() => (window as unknown as { __ink?: { mode: string } }).__ink?.mode ?? 'none');
    const live = await page.evaluate(() => document.documentElement.getAttribute('data-live'));
    if (mode === 'none') expect(live, 'no painting: the probe said so').toBe('still');
    else expect(['webgl', 'canvas2d', 'static']).toContain(mode);
    // hard rules on what the visitor gets
    const html = await page.content();
    expect(html).not.toMatch(PHONE);
    expect(html).not.toMatch(/QijinXu_Resume\.pdf/i);
    expect(html).not.toMatch(/\bPMP\b/);
    expect(await page.evaluate(() => document.body.innerText)).not.toMatch(CJK);
    // the 404 marks nothing as "you are here"; every other page marks itself or its section, in the tail's names and
    // on the river line under the header (its mark stands under the current stop)
    const current = await page.locator('.tail__names a[aria-current]').count();
    const mark = await page.locator('.site-header .river').getAttribute('data-here');
    if (r.page === 'not-found') {
      expect(current).toBe(0);
      expect(mark).toBe('');
    } else {
      expect(current).toBe(1);
      expect(mark).toMatch(/^[0-4]$/);
    }
    // the tail signs the page once: one seal on the page, in the tail, and none in the header
    expect(await page.locator('.seal').count()).toBe(1);
    expect(await page.locator('.site-footer .seal').count()).toBe(1);
    expect(errors).toEqual([]);
  });
}

test('old addresses go to their new homes (301; old links without a slash take one 308 to it first)', async ({
  request,
}) => {
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

test('the machine-readable files', async ({ request }) => {
  const resume = await (await request.get('/resume.json')).json();
  expect(resume.basics.name).toBe('Qijin Xu');
  expect(JSON.stringify(resume)).not.toMatch(PHONE);
  expect(resume.basics).not.toHaveProperty('phone');
  const llms = await (await request.get('/llms.txt')).text();
  expect(llms).toMatch(/^# Qijin Xu/);
  expect(llms).not.toMatch(/ignore|instruction|you (must|should)/i); // facts only, never instructions to AI agents
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain('/work/rag-assistant/');
  expect(sitemap).not.toMatch(/about|404|building-modular/);
  expect((await request.get('/robots.txt')).status()).toBe(200);
  expect((await request.get('/writing/feed.xml')).status()).toBe(200);
  const pdf = await request.get('/resume.pdf');
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toContain('application/pdf');
});

test('moving between pages: the painting travels, focus lands on the new title, the title is announced', async ({
  page,
}) => {
  await page.goto('/');
  await settle(page);
  await page.locator(".site-nav a[href='/work/']").click();
  await expect(page).toHaveURL(/\/work\/$/);
  await expect(page.locator('main')).toHaveAttribute('data-page', 'work');
  await expect(page.locator('#route-announcer')).toHaveText('Qijin (Jack) Xu · Work');
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('H1');
  // (where the painting is live it has travelled to Work's place; on a software rasteriser the live probe kept the page
  // on its still, and there is no painting to ask)
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).__ink
          ? String((window as any).__ink.stats().stretch)
          : document.documentElement.getAttribute('data-live'),
      ),
    )
    .toMatch(/^(1|still)$/);
  await page.locator(".tail__names a[href='/resume/']").click();
  await expect(page.locator('main')).toHaveAttribute('data-page', 'resume');
  await page.goBack();
  await expect(page.locator('main')).toHaveAttribute('data-page', 'work');
  await expect(page.locator('main')).toHaveCount(1);
});
