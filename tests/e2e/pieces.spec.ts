import { expect, test } from '@playwright/test';
import { hood } from '../../content/craft/hood';
import { workCraft } from '../../content/pages/work-craft';
import { requests, settle } from './support/pages';

/**
 * "Under the hood": the three live pieces, each on the page of the case it is tied to (features/craft). A piece's
 * data (/craft/<kind>.json) is fetched only as the reader comes near it, never with the page; then it renders: the
 * grammar's mask steps under the reader's hand and writes the case's own record, the search's test shows its marks
 * and its result, the lineage is drawn.
 */
const PIECES = [
  { kind: 'mask', path: '/work/proprietary-language-agent/', title: workCraft.hood.mask.title },
  { kind: 'eval', path: '/work/rag-assistant/', title: workCraft.hood.eval.title },
  { kind: 'lineage', path: '/work/data-operations/', title: workCraft.hood.lineage.title },
] as const;

for (const piece of PIECES) {
  test(`${piece.title}: fetched as it is reached, then it runs`, async ({ page }) => {
    const urls = requests(page);
    const data = `/craft/${piece.kind}.json`;
    await page.goto(piece.path);
    await settle(page);
    const section = page.locator(`#hood-${piece.kind}`);
    await expect(section.getByRole('heading', { name: piece.title })).toHaveCount(1);
    expect(
      urls.filter((u) => u.includes(data)),
      'not fetched with the page',
    ).toEqual([]);

    await section.scrollIntoViewIfNeeded();
    await expect.poll(() => urls.some((u) => u.includes(data)), { timeout: 15_000 }).toBe(true);

    if (piece.kind === 'mask') {
      const record = section.locator('code').first();
      await expect(record).toBeVisible();
      const before = (await record.textContent()) ?? '';
      // (the record opens on the case's own words, mid-record)
      expect(before).toContain('"title": "');
      const next = section.getByRole('button', { name: hood.mask.next, exact: true });
      for (let i = 0; i < 400 && (await next.count()); i += 1) await next.click();
      const after = (await record.textContent()) ?? '';
      expect(after.length).toBeGreaterThan(before.length);
      // the finished record is the case's own: valid JSON, with the status its outcome line states
      const rec = JSON.parse(after) as { status: string; title: string };
      expect(rec.status).toBe('in progress');
      await expect(section.getByText(hood.mask.done)).toBeVisible();
    } else if (piece.kind === 'eval') {
      await expect(section.getByText(/On \d+ questions the search returns the right passage first/)).toBeVisible();
    } else {
      await expect(section.locator('svg[role="img"]')).toBeVisible();
    }
  });
}
