import { expect, type Page, test } from '@playwright/test';
import { ask } from '../../content/pages/ask';
import { requests, settle } from './support/pages';

/**
 * "Ask the painting" (features/ask), on any page: the door in the header opens the sheet; an example is a filed
 * question, answered at once with one of his own lines and no model; a typed question is searched by word over the
 * site's own passages and shown as places; nothing is asked of another origin; "/" opens it, Escape closes it and
 * focus goes back to the door. The 38 MB model is fetched only when the visitor asks for the closer reading: never
 * here (ASK_MODEL=1 runs the test that does).
 */
const MODEL = /\/models\//;
const INDEX = /\/ask\/index\.json/;

const door = (page: Page) => page.getByRole('button', { name: ask.label, exact: true });
const sheet = (page: Page) => page.locator('#ask-sheet');
const elsewhere = (page: Page, urls: string[]) => {
  const here = new URL(page.url()).origin;
  return urls.filter((u) => /^https?:/.test(u) && new URL(u).origin !== here);
};

test('the door opens the sheet; an example is answered at once, in his own words, with no model', async ({ page }) => {
  await page.goto('/work/');
  await settle(page);
  const urls = requests(page);
  await expect(door(page)).toHaveAttribute('aria-expanded', 'false');
  await door(page).click();
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page)).toHaveAttribute('aria-modal', 'true');
  await expect(door(page)).toHaveAttribute('aria-expanded', 'true');
  // (the sheet takes the focus: the line to type in, or itself)
  expect(await page.evaluate(() => !!document.activeElement?.closest('#ask-sheet'))).toBe(true);

  await sheet(page).getByRole('button', { name: ask.tries[2], exact: true }).click();
  const said = sheet(page).locator('blockquote');
  await expect(said).toBeVisible();
  expect(((await said.textContent()) ?? '').trim().length).toBeGreaterThan(20);
  // how it was found is said beside it
  await expect(sheet(page).locator('ol.rec li').first()).toBeVisible();
  expect(urls.filter((u) => MODEL.test(u) || INDEX.test(u))).toEqual([]);
  expect(elsewhere(page, urls)).toEqual([]);
});

test('a typed question is searched over these pages and shown as places; "/" opens, Escape closes', async ({
  page,
}) => {
  await page.goto('/');
  await settle(page);
  const urls = requests(page);
  await page.keyboard.press('/');
  await expect(sheet(page)).toBeVisible();

  const line = sheet(page).locator('input');
  await line.fill('lineage');
  await line.press('Enter');
  const places = sheet(page).locator('ol[class*="places"] > li');
  await expect(places.first()).toBeVisible();
  // (each place is a link into the site)
  expect(await places.first().locator('a[href^="/"]').count()).toBeGreaterThan(0);
  expect(urls.filter((u) => MODEL.test(u))).toEqual([]);
  expect(elsewhere(page, urls)).toEqual([]);

  await page.keyboard.press('Escape');
  await expect(sheet(page)).toBeHidden();
  await expect(door(page)).toBeFocused();
  await expect(door(page)).toHaveAttribute('aria-expanded', 'false');
});

test('the tail’s line asks its own example', async ({ page }) => {
  await page.goto('/contact/');
  await settle(page);
  await page.locator(`.tail [data-ask="${ask.tailTry}"]`).click();
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).locator('blockquote')).toBeVisible();
});

test('the closer reading: the model is fetched from this site only when it is asked for', async ({ page }) => {
  test.skip(!process.env.ASK_MODEL, 'fetches the 38 MB model: run with ASK_MODEL=1');
  test.setTimeout(180_000);
  await page.goto('/');
  await settle(page);
  const urls = requests(page);
  await door(page).click();
  const line = sheet(page).locator('input');
  await line.fill('how do you keep an agent inside a grammar');
  await line.press('Enter');
  await expect(sheet(page).locator('ol[class*="places"] > li').first()).toBeVisible();
  expect(urls.filter((u) => MODEL.test(u))).toEqual([]);
  await sheet(page).getByRole('button', { name: ask.result.closer }).click();
  await expect(sheet(page).locator('blockquote, ol[class*="places"]').first()).toBeVisible({ timeout: 150_000 });
  expect(urls.some((u) => MODEL.test(u))).toBe(true);
  expect(elsewhere(page, urls)).toEqual([]);
});
