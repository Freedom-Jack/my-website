import { expect, test } from '@playwright/test';
import { isSoftware } from './support/pages';

/**
 * The header keeps one row on the phone widths the budgets suite does not visit (DESIGN §4.9: one row at 360 px and
 * up; the iPhone SE, mini and 8 are 375 wide). The nav's row is the home link's row; every target is 44 px tall; the
 * river line runs under the row with a tick per stop and its mark under the current one (Home).
 */
for (const [width, height] of [
  [375, 667],
  [360, 800],
] as const) {
  test(`the header is one row at ${width} px`, async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    // (a software rasteriser repaints the ambient painting forever; the header's rows are DOM-only, so on software
    // the painting runs still and the page answers at once)
    if (await isSoftware(page)) await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.waitForFunction(() => document.fonts.status === 'loaded');
    // (the river line's effect measures the ticks after hydration and the mark fades in over 300 ms)
    await page.waitForFunction(
      () => getComputedStyle(document.querySelector('.site-header .river__mark')!).opacity === '1',
      undefined,
      { timeout: 15_000 },
    );
    const rows = await page.evaluate(() => {
      const home = document.querySelector('.home-link')!.getBoundingClientRect();
      const nav = document.querySelector('.site-nav__list')!.getBoundingClientRect();
      const inner = document.querySelector('.site-header__inner')!.getBoundingClientRect();
      const targets = [...document.querySelectorAll<HTMLElement>('.site-header a')].map((a) => {
        const r = a.getBoundingClientRect();
        return { name: a.textContent?.trim() ?? '', w: r.width, h: r.height };
      });
      const river = document.querySelector<HTMLElement>('.site-header .river');
      const ticks = river ? river.querySelectorAll('.river__tick').length : 0;
      const mark = river?.querySelector<HTMLElement>('.river__mark');
      return {
        sameRow: Math.abs(home.top - nav.top) < 8,
        height: inner.height,
        overflow: nav.right > inner.right + 1,
        targets,
        river: { here: river?.dataset.here ?? null, ticks, markOpacity: mark ? getComputedStyle(mark).opacity : null },
      };
    });
    expect(rows.sameRow, `nav on the home link's row at ${width}`).toBe(true);
    expect(rows.overflow, `nav inside the frame at ${width}`).toBe(false);
    expect(rows.height, `header height at ${width}`).toBeLessThan(80);
    for (const t of rows.targets) expect(t.h, `${t.name} is ${t.w} × ${t.h} at ${width}`).toBeGreaterThanOrEqual(44);
    expect(rows.river.ticks, 'the river line has five ticks').toBe(5);
    expect(rows.river.here, 'the mark stands under Home').toBe('0');
    expect(rows.river.markOpacity, 'the mark is shown').toBe('1');
    await ctx.close();
  });
}
