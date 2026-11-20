import { expect, test } from '@playwright/test';
import { isSoftware, ROUTES, settle } from './support/pages';

// (on a software rasteriser the painting runs still, so the DOM-only route checks answer at once, not minutes in)
test.beforeEach(async ({ page }) => {
  if (await isSoftware(page)) await page.emulateMedia({ reducedMotion: 'reduce' });
});

/**
 * Back returns the reader to where they were (features/navigation): the content arrives at once on a pop, so the
 * position is kept per path for the session and restored before the painting is rebound.
 */
test('Back returns to the row you left', async ({ page }) => {
  await page.goto('/work/');
  await settle(page);
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' as ScrollBehavior }));
  await page.waitForTimeout(200);
  // (a reader clicks the header where they are; Playwright's own click would scroll the link into view first)
  await page.evaluate(() => document.querySelector<HTMLAnchorElement>(".site-nav a[href='/resume/']")!.click());
  // (a CI runner busy with two software-rendered workers can take a few seconds to finish the route change)
  await expect(page).toHaveURL(/\/resume\/$/, { timeout: 15_000 });
  await settle(page);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/work\/$/);
  await expect(page.locator('main')).toHaveAttribute('data-page', 'work');
  await page.waitForTimeout(400);
  expect(Math.abs((await page.evaluate(() => scrollY)) - 900)).toBeLessThan(3);
  await page.goForward();
  await expect(page).toHaveURL(/\/resume\/$/);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

/**
 * A nav word changes the page without a full load: the document stays (a mark left on window survives), the new
 * page's title takes the focus (Next's own announcer says it once), the header marks where the reader now is, and the band is
 * still there with the new place's still.
 */
test('a nav word changes the page in place: focus on the new title, the title announced, the band kept', async ({
  page,
}) => {
  await page.goto('/');
  await settle(page);
  await page.evaluate(() => ((window as unknown as { __kept?: boolean }).__kept = true));
  await page.locator(".site-nav a[href='/writing/']").click();
  await expect(page).toHaveURL(/\/writing\/$/, { timeout: 15_000 });
  await expect(page.locator('main')).toHaveAttribute('data-page', 'writing');
  await settle(page);
  expect(await page.evaluate(() => (window as unknown as { __kept?: boolean }).__kept)).toBe(true);
  const writing = ROUTES.find((r) => r.id === 'writing')!;
  await expect(page).toHaveTitle(writing.title);
  await expect(page.locator('main h1')).toHaveCount(1);
  await expect(page.locator('main h1')).toBeFocused();
  await expect(page.locator(".site-nav a[href='/writing/']")).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.band')).toBeVisible();
  await expect(page.locator('.band__still')).toHaveAttribute('data-page', 'writing');
});

test('an address that is not a page shows the 404, with a way back', async ({ page }) => {
  const res = await page.goto('/no-such-page/');
  expect(res!.status()).toBe(404);
  await expect(page.locator('main')).toHaveAttribute('data-page', 'not-found');
  await expect(page.locator("main a[href='/']").first()).toBeVisible();
});
