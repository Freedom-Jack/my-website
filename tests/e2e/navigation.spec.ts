import { expect, test } from '@playwright/test';
import { settle } from './support/pages';

/**
 * Back returns the reader to where they were (features/navigation): the content arrives at once on a pop, so the
 * position is kept per path for the session and restored before the painting is rebound.
 */
test('Back returns to the row you left', async ({ page }) => {
  await page.goto('/work/');
  await settle(page);
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' as ScrollBehavior }));
  await page.waitForTimeout(200);
  // (a reader clicks the returning header where they are; Playwright's own click would scroll the link into view first)
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
