import { createRequire } from 'node:module';
import { expect, type Page, test } from '@playwright/test';
import { fontsReady, isSoftware, settle } from './support/pages';

/**
 * The craft on Work (features/craft; the brief's P4 acceptance and the attack's A2, A5, A8, A11, A15): nothing of it is
 * fetched before the box's first focus or a fold's first opening; the status line says what was downloaded, measured;
 * every request of a search session is a same-origin GET that carries none of the typed text; the keyboard (a roving
 * tabindex, Enter opens, Escape clears); the submit at a 460 px tall viewport; axe on Work; the pan and back.
 */
const isCraft = (u: string) => new URL(u).pathname.startsWith('/craft/');
const box = (page: Page) => page.getByRole('searchbox', { name: 'Search these pages' });

async function open(page: Page) {
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  await page.goto('/work/');
  await fontsReady(page);
  await page.waitForLoadState('networkidle');
  return urls;
}

test('nothing of the craft loads before the first focus or the first fold', async ({ page }) => {
  const urls = await open(page);
  await page.waitForTimeout(500);
  expect(urls.filter(isCraft)).toEqual([]);
  const before = urls.length;

  await box(page).focus();
  await expect(page.getByRole('status').filter({ hasText: 'downloaded' })).toBeVisible();
  expect(
    urls
      .slice(before)
      .filter(isCraft)
      .map((u) => new URL(u).pathname),
  ).toEqual(['/craft/corpus.json']);

  await page.locator('#hood-mask summary').click();
  await expect(page.locator('#hood-mask table')).toBeVisible();
  expect(urls.filter(isCraft).map((u) => new URL(u).pathname)).toContain('/craft/mask.json');
  expect(urls.filter((u) => /\/craft\/(lineage|eval)\.json/.test(u))).toEqual([]);
});

test('the status line says the bytes it measured; no request carries what is typed', async ({ page }) => {
  await open(page);
  const seen: Array<{ url: string; method: string; body: string | null }> = [];
  page.on('request', (r) => seen.push({ url: r.url(), method: r.method(), body: r.postData() }));
  const typed = 'lineage';
  await box(page).fill(typed);
  const status = page.getByRole('status').filter({ hasText: 'downloaded' });
  await expect(status).toHaveText(/downloaded [1-9]\d* KB from this site · nothing you type is sent anywhere/);
  await expect(page.locator('a[data-hit]').first()).toBeVisible();
  await box(page).press('Enter');
  await page.waitForTimeout(300);
  const origin = new URL(page.url()).origin;
  expect(seen.length).toBeGreaterThan(0);
  for (const r of seen) {
    expect(new URL(r.url).origin, r.url).toBe(origin);
    expect(r.method, r.url).toBe('GET');
    expect(r.body, r.url).toBeNull();
    expect(decodeURIComponent(r.url).toLowerCase(), r.url).not.toContain(typed);
  }
});

test('keyboard: Down enters the results, one tab stop, Enter opens, Escape clears', async ({ page }) => {
  await open(page);
  await box(page).fill('data platform');
  const hits = page.locator('a[data-hit]');
  await expect(hits.first()).toBeVisible();
  expect(await hits.count()).toBeGreaterThan(1);
  await box(page).press('ArrowDown');
  await expect(hits.nth(0)).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(hits.nth(1)).toBeFocused();
  // the roving tabindex: one result is in the tab order
  expect(await page.locator('a[data-hit][tabindex="0"]').count()).toBe(1);
  await page.keyboard.press('Escape');
  await expect(box(page)).toBeFocused();
  await expect(box(page)).toHaveValue('');
  await expect(hits).toHaveCount(0);

  await box(page).fill('hockey');
  await box(page).press('ArrowDown');
  const href = await hits.first().getAttribute('href');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`${href!.replace(/[#?]/g, '\\$&')}$`));
});

test('a query with no close match says so', async ({ page }) => {
  await open(page);
  await box(page).fill('piano');
  await expect(page.getByText('No close match in these pages.')).toBeVisible();
});

test.describe('on a phone with the keyboard up (390 × 460)', () => {
  test.use({ viewport: { width: 390, height: 460 }, hasTouch: true, isMobile: true });
  test('the submit blurs the box and brings the results under the header; the place is a 44 px control', async ({
    page,
  }) => {
    await open(page);
    await box(page).fill('lineage');
    await expect(page.locator('a[data-hit]').first()).toBeVisible();
    await box(page).press('Enter');
    await expect(box(page)).not.toBeFocused();
    await page.waitForTimeout(400);
    const header = await page.locator('header').first().boundingBox();
    const results = await page.locator('[id$="-results"]').boundingBox();
    expect(results!.y).toBeGreaterThanOrEqual((header?.y ?? 0) + (header?.height ?? 0) - 1);
    expect(results!.y).toBeLessThan(460 / 2);
    const show = page.getByRole('button', { name: /show the place/ }).first();
    const b = await show.boundingBox();
    expect(b!.height).toBeGreaterThanOrEqual(44);
    await show.click();
    const crop = page.locator('form[role="search"] img').first();
    await expect(crop).toBeVisible();
    // (A2: on a thumb the place is a pre-cut still crop, inline and lazy; the painting itself does not pan)
    expect(await crop.getAttribute('src')).toMatch(/\/scenes\//);
    expect(await crop.getAttribute('loading')).toBe('lazy');
    const ink = await page.evaluate(() => {
      const L = (window as unknown as { __ink?: { stats(): { stretch?: number } } }).__ink;
      return L ? (L.stats().stretch ?? null) : null;
    });
    if (ink !== null) {
      await page.locator('a[data-hit]').first().focus();
      await page.waitForTimeout(600);
      const after = await page.evaluate(
        () => (window as unknown as { __ink: { stats(): { stretch?: number } } }).__ink.stats().stretch ?? null,
      );
      expect(after, 'a coarse pointer: no pan on focus').toBeCloseTo(ink, 3);
    }
  });
});

test('axe finds nothing on Work, folds open', async ({ page }) => {
  await open(page);
  await box(page).fill('lineage');
  for (const k of ['lineage', 'mask', 'eval']) await page.locator(`#hood-${k} summary`).click();
  await expect(page.locator('#hood-eval table')).toBeVisible();
  await expect(page.locator('#hood-lineage svg')).toBeVisible();
  const require = createRequire(import.meta.url);
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  const violations = await page.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: { run(o?: unknown): Promise<{ violations: Array<{ id: string; nodes: unknown[] }> }> };
      }
    ).axe;
    const r = await axe.run({ runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } });
    return r.violations.map((v) => `${v.id} (${v.nodes.length})`);
  });
  expect(violations).toEqual([]);
});

test('a focused result pans the painting to its place, and back', async ({ page }) => {
  await page.goto('/work/');
  test.skip(await isSoftware(page), 'the painting is judged on a hardware GPU');
  await settle(page);
  test.skip((await page.locator('html').getAttribute('data-live')) !== 'on', 'the painting is not live here');
  const stretch = () =>
    page.evaluate(() => (window as unknown as { __ink: { stats(): { stretch?: number } } }).__ink.stats().stretch ?? 0);
  const s0 = await stretch();
  await box(page).fill('hockey');
  await box(page).press('ArrowDown');
  await expect.poll(stretch, { timeout: 5000 }).not.toBeCloseTo(s0, 1);
  await page.keyboard.press('Escape');
  await expect.poll(stretch, { timeout: 5000 }).toBeCloseTo(s0, 1);
});
