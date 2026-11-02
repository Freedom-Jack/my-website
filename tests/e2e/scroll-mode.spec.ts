import { expect, test, type Page } from '@playwright/test';
import { VIEWPORTS, settle } from './support/pages';

/**
 * The scroll, held (elements.ts scroll; src/features/scroll): the footer's opener folds the page into the paper and
 * the sheet stands over it, the painting in its band under the hand.
 *   - it opens from the footer at the page's own place, <main> inert, and the keys walk it: an arrow one place, End
 *     the crossing; the inscription follows the camera (the engine's own position, window.__ink.stats().stretch);
 *   - a link in the inscription is the way in: the page arrives with the camera already there, the sheet gone;
 *   - Esc returns the page (not inert), the focus (the opener) and the camera (the page's own place);
 *   - quiet (Still): every walk is a cut, nothing animates in the sheet;
 *   - a phone: the band is Home's hero (180..250 px), the stops and the close are 44 px targets, a swipe is
 *     held by the hand and settles on a place, nothing overflows sideways;
 *   - the element off (window.__elOff): no opener.
 * They read the QA build's window.__ink (NEXT_PUBLIC_INK_QA=1), like the other e2e probes. The opener does nothing
 * without a live painting (no renderer, or the static fallback), so each test skips there; on a software renderer
 * the walks run slower, so their waits are longer, never fixed.
 */
type S = Record<string, any>;
const stats = (page: Page) => page.evaluate(() => (window as unknown as { __ink: { stats(): S } }).__ink.stats());

/** A live painting (the opener does nothing on the static fallback, and is hidden with it). */
async function live(page: Page) {
  return page.evaluate(() => {
    const L = (window as unknown as { __ink?: { mode: string } }).__ink;
    return !!L && L.mode !== 'static' && !document.documentElement.classList.contains('no-landscape');
  });
}
/** 1 on a hardware GPU, more on a software rasteriser (its frames are slow; the walks are timed on the clock). */
async function slack(page: Page) {
  const s = await stats(page);
  return s.software ? 3 : 1;
}
/** The scroll opens where the hand last left it (sessionStorage 'ink:at'): forgotten, so it opens at the page's place. */
const forget = (page: Page) => page.evaluate(() => sessionStorage.removeItem('ink:at'));
/** The opener, at the page's end, clicked; the sheet stands and its band holds the focus. */
async function open(page: Page) {
  await page.evaluate(() =>
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' as ScrollBehavior }),
  );
  await page.locator('button.scroll-opener').click();
  await expect(page.locator('.scroll-sheet[role=dialog]')).toBeVisible();
  const band = page.locator('.scroll-band[role=slider]');
  await expect(band).toBeFocused();
  return band;
}
/** Until the camera stands at x (the engine's own position, to a thousandth). */
async function atStretch(page: Page, x: number, timeout: number) {
  await page.waitForFunction(
    (t) => Math.abs(Number((window as unknown as { __ink: { stats(): S } }).__ink.stats().stretch) - t) < 1e-3,
    x,
    { timeout, polling: 50 },
  );
}
const inert = (page: Page) => page.evaluate(() => document.getElementById('main')?.inert ?? null);

test.describe('the scroll, held (1440)', () => {
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

  test('opens from the footer and walks by the keys', async ({ page }) => {
    await page.goto('/work/');
    await settle(page);
    test.skip(!(await live(page)), 'the scroll opens on a live painting only');
    const k = await slack(page);
    await forget(page);
    const band = await open(page);
    await expect.poll(() => inert(page), 'the page folded: <main> inert').toBe(true);
    // at the page's own place: Work
    await expect(band).toHaveAttribute('aria-valuenow', '1');
    await expect(band).toHaveAttribute('aria-valuetext', 'Work');
    await expect(page.locator('.scroll-place a')).toHaveText('Work');
    // one place right, at a walking pace
    await band.press('ArrowRight');
    await atStretch(page, 2, 8000 * k);
    await expect(page.locator('.scroll-place a')).toHaveText('Writing');
    await expect(band).toHaveAttribute('aria-valuenow', '2');
    await expect(band).toHaveAttribute('aria-valuetext', 'Writing');
    // End: the crossing
    await band.press('End');
    await atStretch(page, 4, 8000 * k);
    await expect(page.locator('.scroll-place a')).toHaveText('Contact');
    await expect(band).toHaveAttribute('aria-valuenow', '4');
    // the stops name the place the camera stands at
    await expect(page.locator('.story-map--scroll .story-map__list button[aria-current]')).toHaveText('Contact');
  });

  test('arrives at the page with the camera already there', async ({ page }) => {
    await page.goto('/work/');
    await settle(page);
    test.skip(!(await live(page)), 'the scroll opens on a live painting only');
    const k = await slack(page);
    await forget(page);
    const band = await open(page);
    await band.press('End');
    await atStretch(page, 4, 8000 * k);
    const way = page.locator('.scroll-place a');
    await expect(way).toHaveText('Contact');
    await expect(way).toHaveAttribute('href', '/contact/');
    await way.click();
    await expect(page).toHaveURL(/\/contact\/$/);
    await expect(page.locator('main[data-page="contact"]')).toHaveCount(1);
    await expect(page.locator('.scroll-sheet')).toHaveCount(0);
    await settle(page);
    expect((await stats(page)).stretch, 'the camera at the crossing').toBeCloseTo(4, 3);
    // the page that arrived is the reader's: not inert, and its own words have the focus
    expect(await inert(page)).toBe(false);
  });

  test('Escape returns the page and the focus', async ({ page }) => {
    await page.goto('/resume/');
    await settle(page);
    test.skip(!(await live(page)), 'the scroll opens on a live painting only');
    await forget(page);
    await open(page);
    expect(await inert(page)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('.scroll-sheet')).toHaveCount(0);
    await expect.poll(() => inert(page), 'the page returned: <main> not inert').toBe(false);
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.classList.contains('scroll-opener') ?? false), {
        message: 'the focus returned to the opener',
      })
      .toBe(true);
    await settle(page);
    expect((await stats(page)).stretch, 'the camera at the page’s own place').toBeCloseTo(3, 3);
  });

  test('quiet: every walk is a cut', async ({ page }) => {
    // "Still the landscape", remembered on this device (scroll.spec.ts sets it the same way)
    await page.addInitScript(() => localStorage.setItem('ink:still', '1'));
    await page.goto('/work/');
    await settle(page);
    test.skip(!(await live(page)), 'the scroll opens on a live painting only');
    await expect(page.locator('html')).toHaveClass(/is-still/);
    await forget(page);
    const band = await open(page);
    await expect(band).toHaveAttribute('aria-valuenow', '1');
    // (the neighbour's figures are prepared at the open: a layer still on its way is not a walk's motion)
    await page.waitForFunction(
      () => (window as unknown as { __ink: { stats(): S } }).__ink.stats().figures?.[0] !== 'pending',
      undefined,
      { timeout: 20_000, polling: 100 },
    );
    await band.press('ArrowLeft');
    // the cut: at Home at once, nothing left to settle, within 300 ms of the key
    await page.waitForFunction(
      () => {
        const s = (window as unknown as { __ink: { stats(): S } }).__ink.stats();
        return s.stretch === 0 && !s.pending;
      },
      undefined,
      { timeout: 300, polling: 16 },
    );
    const s = await stats(page);
    expect(s.stretch, 'exactly at Home').toBe(0);
    expect(s.pending, 'nothing pending').toBe(false);
    expect(s.held ?? false, 'the keys walk by panTo, never the hand’s hold').toBe(false);
    // nothing moves in the sheet: no fade, no slide, no Web Animation. The one thing allowed to run is the brush
    // links' own 200 ms colour transition as "you are here" moves to the next stop (jade.css .brush: the interface's
    // link grammar, which Still does not govern, as the header's slide in scroll.spec.ts), and by 500 ms not even that.
    const running = () =>
      page.evaluate(() =>
        document
          .querySelector('.scroll-sheet')!
          .getAnimations({ subtree: true })
          .map((a) => {
            const t = (a.effect as KeyframeEffect | null)?.target as Element | null;
            const prop = (a as CSSTransition).transitionProperty ?? (a as CSSAnimation).animationName ?? a.id;
            return `${a.constructor.name}:${prop}@${t?.tagName.toLowerCase()}.${[...(t?.classList ?? [])].join('.')}`;
          }),
      );
    const now = await running();
    expect(
      now.filter((d) => !/^CSSTransition:(color|text-decoration-color)@button\.brush$/.test(d)),
      `only the brush links' colour may transition (running now: ${now.join(', ') || 'nothing'})`,
    ).toEqual([]);
    await page.waitForTimeout(500);
    expect(await running(), 'nothing runs inside the sheet half a second after the key').toEqual([]);
    await expect(page.locator('.scroll-place a')).toHaveText('Home');
    await expect(band).toHaveAttribute('aria-valuenow', '0');
  });

  test('the flag off: no opener', async ({ page }) => {
    await page.addInitScript(() => ((window as unknown as { __elOff: string[] }).__elOff = ['scroll']));
    await page.goto('/work/');
    await settle(page);
    await expect(page.locator('html')).not.toHaveClass(/el-scroll/);
    // (server-rendered, so it is in the DOM; the element's CSS is what hides it: off means gone)
    const opener = page.locator('button.scroll-opener');
    await expect(opener).toHaveCount(1);
    await expect(opener).toBeHidden();
    await expect(page.locator('.scroll-sheet')).toHaveCount(0);
  });
});

test.describe('the scroll, held (390, a phone)', () => {
  const vp = VIEWPORTS['390'];
  test.use({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dpr,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
  });

  test('phone: the band, the stops and a swipe', async ({ page }) => {
    await page.goto('/resume/');
    await settle(page);
    test.skip(!(await live(page)), 'the scroll opens on a live painting only');
    await forget(page);
    const band = await open(page);
    await expect(band).toHaveAttribute('aria-valuenow', '3');
    // the band is Home's hero: 236 px at 390 × 844 (tokens.css --scroll-band)
    const box = (await band.boundingBox())!;
    expect(box, 'the band has a box').not.toBeNull();
    expect(box.height, 'the band’s height').toBeGreaterThanOrEqual(180);
    expect(box.height, 'the band’s height').toBeLessThanOrEqual(250);
    expect(box.width, 'the band spans the viewport').toBeGreaterThanOrEqual(vp.width - 1);
    // the stops and the close: 44 px targets
    const stops = page.locator('.story-map--scroll .story-map__list button');
    await expect(stops).toHaveCount(5);
    for (const b of [...(await stops.all()), page.locator('.scroll-close button')]) {
      const r = await b.boundingBox();
      expect(r, `${await b.textContent()}: a box`).not.toBeNull();
      expect(r!.height, `${await b.textContent()}: tall enough for a thumb`).toBeGreaterThanOrEqual(44);
    }
    // the hand: a slow swipe to the left across the band, held a moment, then let go (the painting follows the hand:
    // the camera moves right under it; a release at rest is the detent's, a flick's is the next place)
    const scale = (await stats(page)).framing?.strip?.scale;
    test.info().annotations.push({ type: 'band', description: `${box.width} × ${box.height} px, ${scale} px/stretch` });
    const y = box.y + box.height / 2;
    const swipe = async (x0: number, x1: number, stepMs: number) => {
      await page.mouse.move(box.x + x0, y);
      await page.mouse.down();
      for (let i = 1; i <= 10; i++) {
        await page.mouse.move(box.x + x0 + ((x1 - x0) * i) / 10, y);
        await page.waitForTimeout(stepMs);
      }
    };
    await swipe(300, 60, 80); // 240 px at 0.3 px/ms: under the flick's 0.5
    await page.waitForTimeout(120); // (one hold per animation frame; the hand rests before letting go)
    const held = Number((await stats(page)).stretch);
    await page.mouse.up();
    // the camera was under the hand: it had left the page's place before the release
    expect(Math.abs(held - 3), `the hand moved the camera (at ${held} before the release)`).toBeGreaterThan(0.01);
    // released, it settles on a place (a phone's detent reaches half a stretch: every release settles)
    await page.waitForTimeout(1500);
    const at = Number((await stats(page)).stretch);
    expect(Math.abs(at - Math.round(at)), `settled on a place (at ${at})`).toBeLessThan(1e-3);
    expect(at).toBeGreaterThanOrEqual(0);
    expect(at).toBeLessThanOrEqual(4);
    await expect(band).toHaveAttribute('aria-valuenow', String(Math.round(at)));
    // a flick (let go while still moving) carries the scroll on to the next place in its direction
    const next = at < 4 ? at + 1 : at - 1;
    if (next > at) await swipe(300, 60, 8);
    else await swipe(60, 300, 8); // (at the crossing already: a flick back west)
    await page.mouse.up();
    await atStretch(page, next, 4000);
    await expect(band).toHaveAttribute('aria-valuenow', String(next));
    await expect(page.locator('.scroll-place a')).toHaveText(['Home', 'Work', 'Writing', 'Résumé', 'Contact'][next]!);
    // nothing runs off the side
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways overflow').toBe(
      true,
    );
  });
});
