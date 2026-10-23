import { expect, test } from '@playwright/test';
import { isSoftware } from './support/pages';

/**
 * The header keeps one row on the phone widths the budgets suite does not visit (DESIGN §4.9: one row at 360 px and
 * up; the iPhone SE, mini and 8 are 375 wide). The nav's row is the home link's row.
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
    const rows = await page.evaluate(() => {
      const home = document.querySelector('.home-link')!.getBoundingClientRect();
      const nav = document.querySelector('.site-nav__list')!.getBoundingClientRect();
      const inner = document.querySelector('.site-header__inner')!.getBoundingClientRect();
      return { sameRow: Math.abs(home.top - nav.top) < 8, height: inner.height, overflow: nav.right > inner.right + 1 };
    });
    expect(rows.sameRow, `nav on the home link's row at ${width}`).toBe(true);
    expect(rows.overflow, `nav inside the frame at ${width}`).toBe(false);
    expect(rows.height, `header height at ${width}`).toBeLessThan(70);
    await ctx.close();
  });
}
