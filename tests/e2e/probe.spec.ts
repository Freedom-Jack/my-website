import { expect, test, type Page } from '@playwright/test';
import { isSoftware } from './support/pages';

/**
 * The live probe (features/landscape/probe.ts, 01-budgets.md "The painting's rules" as amended): on every device the
 * page opens on its pre-cut still, and the engine is fetched only after every "may the painting run" check passes.
 *   - reduced motion, "Still the landscape" and Save-Data: the still stands (html[data-live="still"]), the engine's
 *     chunks are never requested (0 engine bytes: no script or worker request after the load event), no handle;
 *   - a hardware GPU, nothing quiet: the probe passes (data-live="on"), the engine mounts, its first frame lands
 *     under the strip's still ([data-live] on the strip's box) and the still fades out;
 *   - the still is in the HTML from the first paint: an <img> in the strip's box before any script, a data URI
 *     (the inline seed) at phone widths and a fetched source on laptops; the phone's HTML holds no other image request
 *     for it; the sharp phone still is set for the no-painting states.
 */
type Req = { url: string; type: string; t: number };
/** Every request the page makes from now on, with its time from the watch's start (ms). */
function watchRequests(page: Page): { reqs: Req[] } {
  const reqs: Req[] = [];
  const t0 = Date.now();
  page.on('request', (r) => reqs.push({ url: r.url(), type: r.resourceType(), t: Date.now() - t0 }));
  return { reqs };
}
const engineRequests = (reqs: Req[], afterMs: number) =>
  reqs.filter((r) => (r.type === 'script' || r.type === 'other') && /\/_next\/static\//.test(r.url) && r.t > afterMs);

/** The still stands for `reason` (R3: the probe's QA mark names it, so the zero-byte tests tell the checks apart on a
 *  software rasteriser too): data-live="still", no handle, no script fetched after the load, the still shown. */
async function expectStillFor(page: Page, reqs: Req[], reason: string) {
  await page.waitForLoadState('load');
  const loadedAt = reqs.length ? Math.max(...reqs.map((r) => r.t)) : 0;
  await expect(page.locator('html')).toHaveAttribute('data-live', 'still', { timeout: 15_000 });
  expect(await page.evaluate(() => !!(window as unknown as { __ink?: unknown }).__ink)).toBe(false);
  expect(engineRequests(reqs, loadedAt), 'scripts requested after the page loaded').toEqual([]);
  const still = page.locator('[data-landscape="strip"] .strip__still--seed img');
  await expect(still).toHaveCount(1);
  expect(await still.evaluate((e) => getComputedStyle(e.closest('.strip__still')!).opacity)).toBe('1');
  const marks = await page.evaluate(() => performance.getEntriesByType('mark').map((m) => m.name));
  expect(marks).toContain(`ink:still:${reason}`);
  for (const other of ['quiet', 'save-data', 'gpu', 'cadence'].filter((r) => r !== reason))
    expect(marks).not.toContain(`ink:still:${other}`);
  return marks;
}

test('no hardware GPU (a WebGL2 context with failIfMajorPerformanceCaveat refused): the still, for the GPU', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, opts?: unknown) {
      if (
        type === 'webgl2' &&
        (opts as { failIfMajorPerformanceCaveat?: boolean } | undefined)?.failIfMajorPerformanceCaveat
      )
        return null;
      return (get as (this: HTMLCanvasElement, t: string, o?: unknown) => RenderingContext | null).call(
        this,
        type,
        opts,
      );
    } as typeof get;
  });
  const { reqs } = watchRequests(page);
  await page.goto('/');
  const marks = await expectStillFor(page, reqs, 'gpu');
  expect(marks).not.toContain('ink:gpu:ok');
});

test('a slow cadence (every frame over 20 ms, the retry too): the still, for the cadence', async ({ page }) => {
  test.skip(await isSoftware(page), 'a software rasteriser fails the GPU check first (the test above)');
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb: FrameRequestCallback) =>
      raf((t) => {
        const start = performance.now();
        while (performance.now() - start < 30) {
          /* a slow phone's frame */
        }
        cb(t);
      });
  });
  const { reqs } = watchRequests(page);
  await page.goto('/');
  const marks = await expectStillFor(page, reqs, 'cadence');
  expect(marks).toContain('ink:gpu:ok');
  expect(marks).toContain('ink:probe:retry');
});

for (const quiet of ['reduced motion', 'Still the landscape', 'Save-Data'] as const) {
  test(`${quiet}: the still stands and no engine byte is fetched`, async ({ page }) => {
    if (quiet === 'reduced motion') await page.emulateMedia({ reducedMotion: 'reduce' });
    else if (quiet === 'Still the landscape') await page.addInitScript(() => localStorage.setItem('ink:still', '1'));
    else
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true });
      });
    const { reqs } = watchRequests(page);
    await page.goto('/');
    await page.waitForLoadState('load');
    const loadedAt = reqs.length ? Math.max(...reqs.map((r) => r.t)) : 0;
    // (long enough for the import to have happened: first paint, the idle moment's 1.5 s ceiling, the probe's 1.5 s
    // and its retry)
    await page.waitForTimeout(5500);
    await expect(page.locator('html')).toHaveAttribute('data-live', 'still');
    expect(await page.evaluate(() => !!(window as unknown as { __ink?: unknown }).__ink)).toBe(false);
    expect(engineRequests(reqs, loadedAt), 'scripts requested after the page loaded').toEqual([]);
    // the still is the painting: sharp and shown
    const still = page.locator('[data-landscape="strip"] .strip__still--seed img');
    await expect(still).toHaveCount(1);
    expect(await still.evaluate((e) => getComputedStyle(e.closest('.strip__still')!).opacity)).toBe('1');
    // (R3: the reason is asserted, not inferred: the probe's QA mark names it)
    const marks = await page.evaluate(() => performance.getEntriesByType('mark').map((m) => m.name));
    expect(marks).toContain(quiet === 'Save-Data' ? 'ink:still:save-data' : 'ink:still:quiet');
  });
}

test('a hardware GPU: the probe passes, the engine mounts and the still hands over', async ({ page }) => {
  test.skip(await isSoftware(page), 'the live painting is judged on a hardware GPU');
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-live', 'probing');
  // the still is up before any script could have run (the HTML carries it)
  const still = page.locator('[data-landscape="strip"] .strip__still--seed img');
  await expect(still).toHaveCount(1);
  await expect(page.locator('html')).toHaveAttribute('data-live', 'on', { timeout: 20_000 });
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __ink?: { mode: string } }).__ink?.mode), {
      timeout: 20_000,
    })
    .toBe('webgl');
  await expect(page.locator('[data-landscape="strip"]')).toHaveAttribute('data-live', '', { timeout: 20_000 });
  await expect
    .poll(() => still.evaluate((e) => getComputedStyle(e.closest('.strip__still')!).opacity), {
      timeout: 5000,
    })
    .toBe('0');
});

test.describe('the still in the HTML', () => {
  test('a laptop: a fetched source for the wide class, no preload but the two fonts', async ({ page }) => {
    const { reqs } = watchRequests(page);
    const res = await page.goto('/');
    const html = (await res!.text()) as string;
    expect(html).toMatch(/<picture class="strip__still strip__still--seed">/);
    expect(html).toMatch(/<source media="\(min-width: 75rem\)"/);
    const preloads = html.match(/<link rel="preload"[^>]*>/g) ?? [];
    expect(preloads.filter((p) => /as="font"/.test(p)).length, preloads.join('\n')).toBe(2);
    // (no image, style or fetch preload: the still, the photo and the engine are found from the HTML and the probe;
    // the one other preload is Next's own low-priority hint for a script chunk of its runtime)
    for (const p of preloads) expect(p, p).toMatch(/as="(font|script)"/);
    await page.waitForLoadState('load');
    await page.waitForTimeout(300);
    expect(reqs.filter((r) => /\/scenes\/hero\/home-wide@/.test(r.url)).length).toBe(1);
    // (the phone's sharp still is a second picture whose source above 40 rem is a blank pixel: never fetched here)
    expect(reqs.filter((r) => /\/scenes\/hero\/home-phone/.test(r.url))).toEqual([]);
  });
  test.describe('a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    test('Home: the inline seed is the sharp @1x still itself (R9); the @2x is fetched once, at low priority', async ({
      page,
    }) => {
      const { reqs } = watchRequests(page);
      await page.goto('/');
      const src = await page
        .locator('[data-landscape="strip"] .strip__still--seed img')
        .evaluate((e) => (e as HTMLImageElement).currentSrc);
      expect(src).toMatch(/^data:image\/webp;base64,/);
      // (the sharp still, not a blur: more than 2 KB and at most 12 KB of WebP)
      expect(src.length).toBeGreaterThan(2048 * 1.33);
      expect(src.length).toBeLessThan(12 * 1024 * 1.34 + 30);
      const sharp = page.locator('[data-landscape="strip"] .strip__still--sharp img');
      expect(await sharp.evaluate((e) => (e as HTMLImageElement).currentSrc)).toMatch(/home-phone@2x\.webp/);
      expect(await sharp.getAttribute('fetchpriority')).toBe('low');
      await page.waitForLoadState('load');
      await page.waitForTimeout(500);
      const stills = reqs.filter((r) => /\/scenes\/hero\//.test(r.url));
      expect(stills.length, 'the @2x phone still, once').toBe(1);
      expect(stills[0]!.url).toMatch(/home-phone@2x\.webp/);
      // the windows' stills below the fold are lazy (R5): none in the first load
      expect(
        reqs.filter((r) => /\/scenes\/glimpse\//.test(r.url)),
        'no window still in the first load',
      ).toEqual([]);
    });
  });
});

test.describe('a phone at DPR 1', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  test('Home: the inline sharp still is the whole first screen; no still is fetched (R9)', async ({ page }) => {
    const { reqs } = watchRequests(page);
    await page.goto('/');
    await page.waitForLoadState('load');
    await page.waitForTimeout(500);
    expect(reqs.filter((r) => /\/scenes\/hero\//.test(r.url))).toEqual([]);
  });
});

// R12: the phone class is cut 430 wide, so the inline seed covers the box at every phone width without upscaling, and
// the @2x laid over it (DPR 2 and above, up to 430 px) is the same box: never a larger LCP candidate.
for (const [width, dpr] of [
  [412, 2.625],
  [430, 3],
] as const)
  test.describe(`a ${width} px phone at DPR ${dpr}`, () => {
    test.use({ viewport: { width, height: 860 }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
    test(`Home: the 430 px seed covers the box, never upscaled, and the @2x lies over it (R12)`, async ({ page }) => {
      const { reqs } = watchRequests(page);
      await page.goto('/');
      const seed = page.locator('[data-landscape="strip"] .strip__still--seed img');
      const fit = await seed.evaluate((e) => {
        const i = e as HTMLImageElement;
        return { natural: i.naturalWidth, shown: i.getBoundingClientRect().width, src: i.currentSrc.slice(0, 22) };
      });
      expect(fit.src).toBe('data:image/webp;base64');
      expect(fit.natural, 'the seed is cut at 430 px').toBe(430);
      expect(fit.shown).toBeLessThanOrEqual(fit.natural);
      const sharp = page.locator('[data-landscape="strip"] .strip__still--sharp img');
      expect(await sharp.evaluate((e) => (e as HTMLImageElement).currentSrc)).toMatch(/home-phone@2x\.webp/);
      await page.waitForLoadState('load');
      await page.waitForTimeout(500);
      const stills = reqs.filter((r) => /\/scenes\/hero\//.test(r.url));
      expect(stills.map((r) => r.url.replace(/^.*\//, ''))).toEqual(['home-phone@2x.webp']);
    });
  });

test.describe('a phone, an inner page', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  test('Work: the ~1 KB seed alone on the first screen; no sharp still is requested (R12)', async ({ page }) => {
    const { reqs } = watchRequests(page);
    const res = await page.goto('/work/');
    const html = (await res!.text()) as string;
    const src = await page
      .locator('[data-landscape="strip"] .strip__still--seed img')
      .evaluate((e) => (e as HTMLImageElement).currentSrc);
    expect(src).toMatch(/^data:image\/webp;base64,/);
    expect(src.length).toBeLessThan(1500 * 1.4);
    // (no eager sharp still: the only reference to it is the fallback's background, shown where no painting comes)
    await expect(page.locator('[data-landscape="strip"] .strip__still--sharp')).toHaveCount(0);
    expect(html).not.toMatch(/<img[^>]*work-phone@/);
    await expect(page.locator('[data-landscape="strip"] .strip__fallback')).toHaveCount(1);
    // (the probe runs after the load and an idle moment: nothing in the first load asks for the sharp still)
    await page.waitForLoadState('load');
    expect(reqs.filter((r) => /\/scenes\/hero\//.test(r.url))).toEqual([]);
  });
  test('Work, where no painting comes (reduced motion): the sharp still stands over the seed, fetched once', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const { reqs } = watchRequests(page);
    await page.goto('/work/');
    await expect(page.locator('html')).toHaveAttribute('data-live', 'still', { timeout: 10_000 });
    const fb = page.locator('[data-landscape="strip"] .strip__fallback');
    await expect(fb).toBeVisible();
    await expect
      .poll(() => reqs.filter((r) => /\/scenes\/hero\//.test(r.url)).map((r) => r.url.replace(/^.*\//, '')))
      .toEqual(['work-phone@2x.webp']);
  });
});
