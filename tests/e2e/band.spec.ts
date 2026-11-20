import { expect, test, type Page } from '@playwright/test';
import { ENGINE_MARK, isSoftware, PHONE, ROUTES, scrollTo, settle, TABLET } from './support/pages';

/**
 * THE BAND (styles/band.css, components/layout/Band): the painting, one fixed band across the top of every page, in
 * front of the words.
 *   - at a page's top it is on screen with that page's still loaded (every device, before and without any script);
 *   - as the page is read it stands back (it settles) and the words pass under it;
 *   - under reduced motion, or with "Still the landscape", it stands settled and nothing moves;
 *   - the engine is for wide screens with a hardware GPU only: a phone, a tablet, a quiet page, a page on Save-Data
 *     and a laptop without a GPU fetch none of it (0 engine bytes: no script holding its shaders, no worker);
 *   - without JavaScript every page still shows its still and all its words.
 * CI has no GPU: there the probe keeps every page on its still, and the tests about the live engine skip.
 */

/** The band as it stands now: its box, its own scale, how far its still has travelled west, what its still shows. */
const bandNow = (page: Page) =>
  page.evaluate(() => {
    const band = document.querySelector<HTMLElement>('.band')!;
    const r = band.getBoundingClientRect();
    const still = document.querySelector<HTMLElement>('.band__still:not(.is-waiting)');
    const img = still?.querySelector('img') ?? null;
    const m = (el: Element | null) => (el ? new DOMMatrixReadOnly(getComputedStyle(el).transform) : null);
    return {
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
      scale: m(band)!.a,
      west: m(still)?.e ?? 0,
      page: still?.dataset.page ?? null,
      src: img?.currentSrc ?? '',
      loaded: !!img && img.complete && img.naturalWidth > 0,
      shown: !!img && img.getBoundingClientRect().right > 0 && img.getBoundingClientRect().left < innerWidth,
      moving: [band, still].flatMap((el) => el?.getAnimations() ?? []).length,
      window: [innerWidth, innerHeight],
    };
  });

/** Every script the page fetches from now on, with its body (read as it arrives), and every worker it starts. */
function scripts(page: Page) {
  const bodies: Array<Promise<{ url: string; body: string }>> = [];
  const workers: string[] = [];
  page.on('response', (r) => {
    if (r.request().resourceType() !== 'script') return;
    bodies.push(
      r.text().then(
        (body) => ({ url: r.url(), body }),
        () => ({ url: r.url(), body: '' }),
      ),
    );
  });
  page.on('worker', (w) => workers.push(w.url()));
  return {
    workers,
    /** the scripts fetched so far that hold the engine */
    async engine() {
      return (await Promise.all(bodies)).filter((s) => s.body.includes(ENGINE_MARK)).map((s) => s.url);
    },
    async count() {
      return (await Promise.all(bodies)).length;
    },
  };
}

/** The still stands for `reason` (the probe's QA mark names it), and nothing of the engine has been fetched. */
async function expectNoEngine(page: Page, watch: ReturnType<typeof scripts>, reason: string) {
  await expect(page.locator('html')).toHaveAttribute('data-live', 'still', { timeout: 15_000 });
  expect(await page.evaluate(() => !!(window as unknown as { __ink?: unknown }).__ink)).toBe(false);
  const marks = await page.evaluate(() => performance.getEntriesByType('mark').map((m) => m.name));
  expect(marks.filter((m) => m.startsWith('ink:still:'))).toEqual([`ink:still:${reason}`]);
  expect(await watch.count(), 'the page’s own scripts were seen').toBeGreaterThan(0);
  expect(await watch.engine(), 'scripts holding the engine').toEqual([]);
  expect(watch.workers, 'workers started').toEqual([]);
  const b = await bandNow(page);
  expect(b.loaded, 'the still is the painting').toBe(true);
}

for (const size of [
  { name: 'a laptop', use: { viewport: { width: 1440, height: 900 } }, part: 'wide-a' },
  { name: 'a phone', use: PHONE, part: 'phone-a' },
] as const) {
  test.describe(size.name, () => {
    test.use(size.use);

    test('every page opens with the band on screen and its own still loaded', async ({ page }) => {
      for (const r of ROUTES) {
        await page.goto(r.path);
        await settle(page);
        const b = await bandNow(page);
        expect(b.top, r.id).toBe(0);
        expect(b.left, r.id).toBe(0);
        // (it opens at full size: it fills the window's width and more, and stands 40 % of its height or more)
        expect(b.scale, r.id).toBe(1);
        expect(b.width, r.id).toBeGreaterThanOrEqual(b.window[0]);
        expect(b.height / b.window[1], r.id).toBeGreaterThan(0.4);
        expect(b.height / b.window[1], r.id).toBeLessThan(0.75);
        expect(b.page, r.id).toBe(r.page);
        expect(b.src, r.id).toContain(`/scenes/band/${r.page}-${size.part}`);
        expect(b.loaded, `${r.id}: the still has loaded`).toBe(true);
        expect(b.shown, `${r.id}: the still is in the window`).toBe(true);
      }
    });

    test('read one screen down, the band has stood back and the words pass under it', async ({ page }) => {
      for (const r of ROUTES.filter((x) => ['home', 'work', 'case', 'note', 'resume'].includes(x.id))) {
        await page.goto(r.path);
        await settle(page);
        const top = await bandNow(page);
        await scrollTo(page, top.window[1]);
        const read = await bandNow(page);
        // it has settled: smaller about the window's top-left corner, still as wide as the window; and it has
        // unrolled west
        expect(read.scale, r.id).toBeGreaterThan(0.5);
        expect(read.scale, r.id).toBeLessThan(0.7);
        expect(read.height, r.id).toBeCloseTo(top.height * read.scale, 0);
        expect(read.width, r.id).toBeGreaterThanOrEqual(read.window[0] - 1);
        expect([read.top, read.left], r.id).toEqual([0, 0]);
        expect(read.west, `${r.id}: the still has travelled west`).toBeLessThan(-10);
        // the words pass under it: somewhere in the next screen a line of the page lies inside the band's box, and
        // what is painted at that point is the band (asked with its pointer-events on: it lets the pointer through)
        await page.addStyleTag({ content: '.band, .band * { pointer-events: auto !important; }' });
        let under: { text: string; top: string } | null = null;
        for (let i = 0; i < 8 && !under; i++) {
          under = await page.evaluate(() => {
            const band = document.querySelector('.band')!.getBoundingClientRect();
            for (const el of document.querySelectorAll<HTMLElement>('main :is(p, li, h2, h3, dt, dd, td)')) {
              if (el.closest('.inscription') || !el.innerText.trim() || !el.checkVisibility()) continue;
              const b = el.getBoundingClientRect();
              const y = Math.max(b.top + 3, 90);
              if (y > Math.min(b.bottom, band.bottom * 0.8) || b.width < 8) continue;
              const hit = document.elementFromPoint(Math.max(1, b.left + Math.min(12, b.width / 2)), y);
              return {
                text: el.innerText.trim().slice(0, 40),
                // (the band itself, or what is inscribed in its sky: the page's title and its line)
                top: hit?.closest('.band, .inscription') ? 'band' : String(hit?.className),
              };
            }
            return null;
          });
          if (!under) await scrollTo(page, (await page.evaluate(() => scrollY)) + 110);
        }
        expect(under, `${r.id}: no words came under the band`).not.toBeNull();
        expect(under!.top, `${r.id}: "${under!.text}" is under the band`).toBe('band');
      }
    });

    for (const quiet of ['reduced motion', 'Still the landscape'] as const) {
      test(`${quiet}: the band stands settled and does not move`, async ({ page }) => {
        if (quiet === 'reduced motion') await page.emulateMedia({ reducedMotion: 'reduce' });
        else await page.addInitScript(() => localStorage.setItem('ink:still', '1'));
        for (const r of ROUTES.filter((x) => ['home', 'case'].includes(x.id))) {
          await page.goto(r.path);
          await settle(page);
          const top = await bandNow(page);
          expect(top.scale, r.id).toBeLessThan(0.7);
          expect(top.width, r.id).toBeCloseTo(top.window[0], 0);
          expect(top.loaded, r.id).toBe(true);
          expect(top.moving, `${r.id}: animations on the band`).toBe(0);
          const title = () =>
            page.evaluate(() => JSON.stringify(document.querySelector('main h1')!.getBoundingClientRect()));
          const at = await title();
          await scrollTo(page, top.window[1]);
          // (the same box, the same still at the same place, the title where it was)
          expect(await bandNow(page), r.id).toEqual(top);
          expect(await title(), r.id).toBe(at);
          await scrollTo(page, 1e6);
          expect(await bandNow(page), r.id).toEqual(top);
        }
      });
    }
  });
}

test('where nothing moves the band, the way on (the next place’s name) stands inside the window', async ({ page }) => {
  // (styles/band.css .inscription--next: it is inscribed in the band only where the band moves with the page; here it
  // is the page's last line, on the paper)
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const use of [PHONE.viewport, { width: 1440, height: 900 }]) {
    await page.setViewportSize(use);
    await page.goto('/work/');
    await settle(page);
    await scrollTo(page, 1e6);
    const box = await page.locator('.inscription__next').boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(use.width);
  }
});

test.describe('no engine where it is not wanted', () => {
  for (const narrow of [
    { name: 'a phone', use: PHONE },
    { name: 'a tablet', use: TABLET },
  ] as const) {
    test.describe(narrow.name, () => {
      test.use(narrow.use);
      test('no page fetches a byte of the engine', async ({ page }) => {
        for (const r of ROUTES) {
          const watch = scripts(page);
          await page.goto(r.path);
          await settle(page);
          // (read to the end and back, so everything a page fetches late has been asked for)
          await scrollTo(page, 1e6);
          await scrollTo(page, 0);
          await page.waitForLoadState('networkidle');
          await expectNoEngine(page, watch, 'narrow');
          page.removeAllListeners('response');
          page.removeAllListeners('worker');
        }
      });
    });
  }

  for (const quiet of ['reduced motion', 'Still the landscape', 'Save-Data'] as const) {
    test(`a laptop, ${quiet}: the still stands and no engine byte is fetched`, async ({ page }) => {
      if (quiet === 'reduced motion') await page.emulateMedia({ reducedMotion: 'reduce' });
      else if (quiet === 'Still the landscape') await page.addInitScript(() => localStorage.setItem('ink:still', '1'));
      else
        await page.addInitScript(() => {
          Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true });
        });
      const watch = scripts(page);
      await page.goto('/');
      await page.waitForLoadState('load');
      // (long enough for the engine to have been asked for, had it been: the first paint, the idle moment's 1.5 s
      // ceiling and the probe's 1.5 s)
      await page.waitForTimeout(3500);
      await expectNoEngine(page, watch, quiet === 'Save-Data' ? 'save-data' : 'quiet');
    });
  }

  test('a laptop without a hardware GPU: the still stands, for the GPU', async ({ page }) => {
    // (a WebGL2 context asked for with failIfMajorPerformanceCaveat is refused: a GPU-less machine. CI's own
    // software renderer is refused by its name, the probe's second check, without this.)
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
    const watch = scripts(page);
    await page.goto('/');
    await expectNoEngine(page, watch, 'gpu');
  });

  test('a laptop whose every frame is slow: the still stands, for the cadence', async ({ page }) => {
    test.skip(await isSoftware(page), 'a software rasteriser fails the GPU check first');
    await page.addInitScript(() => {
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb: FrameRequestCallback) =>
        raf((t) => {
          const start = performance.now();
          while (performance.now() - start < 30) {
            /* a slow machine's frame */
          }
          cb(t);
        });
    });
    const watch = scripts(page);
    await page.goto('/');
    await expectNoEngine(page, watch, 'cadence');
  });
});

test('a laptop with a GPU: the engine comes, paints the band live, and travels to the next place', async ({ page }) => {
  test.skip(await isSoftware(page), 'the live painting is judged on a hardware GPU');
  // (about the live engine: the probe's cadence check is skipped, so a busy test machine cannot refuse it)
  await page.addInitScript(() => {
    (window as unknown as { __inkLive: boolean }).__inkLive = true;
  });
  const watch = scripts(page);
  await page.goto('/');
  // the still is the first screen's painting, before the engine
  expect((await bandNow(page)).page).toBe('home');
  await expect(page.locator('html')).toHaveAttribute('data-live', 'on', { timeout: 20_000 });
  const ink = () =>
    page.evaluate(() => {
      const L = (window as any).__ink;
      return L ? { mode: L.mode, stretch: Math.round(L.stats().stretch), plates: !!L.stats().plates?.on } : null;
    });
  await expect.poll(async () => (await ink())?.mode, { timeout: 20_000 }).toBe('webgl');
  // (this is how the other tests know the engine's script: the one that holds its shaders)
  expect((await watch.engine()).length, `a script holding "${ENGINE_MARK}"`).toBeGreaterThan(0);
  expect(watch.workers.length, 'the figure worker').toBeGreaterThan(0);
  await settle(page);
  expect((await ink())!.stretch).toBe(0);
  // the plates (the live stage's layers) take over from the canvas once the first scene has landed
  await expect(page.locator('html')).toHaveAttribute('data-plates', 'on', { timeout: 20_000 });
  // a page change is the painting's own travel: it arrives at Work's place
  await page.locator('.site-nav a[href="/work/"]').click();
  await expect(page.locator('main')).toHaveAttribute('data-page', 'work');
  await expect.poll(async () => (await ink())?.stretch, { timeout: 10_000 }).toBe(1);
  await expect(page.locator('html')).toHaveAttribute('data-live', 'on');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  for (const r of ROUTES) {
    test(`${r.id}: the still and every word`, async ({ page, browser }) => {
      await page.goto(r.path);
      const b = await bandNow(page);
      expect(b.page).toBe(r.page);
      expect(b.loaded, 'the still has loaded').toBe(true);
      expect(b.height).toBeGreaterThan(100);
      await expect(page.locator('main h1')).toBeVisible();
      // what does nothing without a script is not offered
      await expect(page.locator('.ask-door')).toBeHidden();
      // every line the page shows with JavaScript is there without it. (Left out: what only a script can do: the
      // live pieces, the buttons, the hour where he is.)
      const lines = (p: Page) =>
        p.evaluate(() =>
          document
            .querySelector('main')!
            .innerText.split('\n')
            .map((s) =>
              s
                .replace(/, \d{1,2}:\d{2} [ap]m there/, '')
                .replace(/\s+/g, ' ')
                .trim()
                .toLowerCase(),
            )
            .filter(Boolean),
        );
      // (where the band moves with the page, the line under the title is read at the page's top and the next
      // place's name at its end: each is out of sight, and out of innerText, at the other)
      const atTop = await lines(page);
      // (no script runs in this page, so no frame callback either: a plain scroll, then a moment for the styles)
      await page.evaluate(() => window.scrollTo(0, 1e6));
      await page.waitForTimeout(200);
      const without = new Set([...atTop, ...(await lines(page))]);
      const ctx = await browser.newContext({ javaScriptEnabled: true, reducedMotion: 'reduce' });
      const withJs = await ctx.newPage();
      await withJs.goto(new URL(r.path, page.url()).href);
      await withJs.waitForLoadState('load');
      await withJs.addStyleTag({
        content: 'main [id^="hood-"], main [data-js-only], main button { display: none !important; }',
      });
      const missing = (await lines(withJs)).filter((l) => !without.has(l));
      await ctx.close();
      expect(without.size).toBeGreaterThan(3);
      expect(missing, 'lines shown only with JavaScript').toEqual([]);
    });
  }
});
