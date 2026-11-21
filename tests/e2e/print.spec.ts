import { expect, test } from '@playwright/test';
import { fontsReady } from './support/pages';

/**
 * Print: the résumé is the page people print. It prints on two pages at most, on white, without the painting, the
 * header, the way on or the tail (the generated /resume.pdf is the same print: tools/build-pdf.ts gates its words).
 */
test('the résumé prints on two pages at most, without the painting, the header or the tail', async ({ page }) => {
  await page.goto('/resume/');
  await fontsReady(page);
  await page.emulateMedia({ media: 'print' });
  for (const sel of ['.band', '.site-header', '.tail', '.ask-door'])
    expect(
      await page.locator(sel).evaluateAll((els) => els.every((el) => getComputedStyle(el).display === 'none')),
      sel,
    ).toBe(true);
  // (a PDF's pages are counted from its page objects)
  const pdf = await page.pdf({ format: 'Letter', printBackground: false });
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  expect(pages).toBeGreaterThan(0);
  expect(pages).toBeLessThanOrEqual(2);
});
