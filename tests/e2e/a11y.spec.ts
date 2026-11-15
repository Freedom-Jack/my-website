import { readFileSync } from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { fontsReady, isSoftware, ROUTES } from './support/pages';

/**
 * Accessibility, enforced (vanguard research/accessibility-of-the-moves.md §5b; the lead's package P6):
 *   - axe-core (through @axe-core/playwright) on every route at 1440 × 900 and 360 × 800, tags wcag2a, wcag2aa,
 *     wcag21aa, wcag22aa and best-practice: zero violations. The rules §5b names are asserted to exist in the installed
 *     axe and to have run, so a renamed rule cannot silently drop out. color-contrast results axe could not decide
 *     ("incomplete": text over the painting or its still, which axe cannot sample) are decided by §5b's pixel-sampled
 *     test instead: the text is made transparent, its box is captured as painted, and the text colour must reach 4.5:1
 *     (3:1 for large text) against both the lightest and the darkest 5 % of the ground under it; a node that cannot be
 *     sampled (not rendered, off the page) is a failure.
 *   - the tap-target sweep (the attack's A12) at 360 × 800 on every route: every standalone target 44 × 44 (the sweep at
 *     390 runs in budgets.spec, on every route; inline links in a sentence are WCAG 2.5.8's exception).
 * On a software rasteriser the pages run under reduced motion (the still; the painting is judged on a GPU).
 */
const RULES = [
  'color-contrast',
  'link-name',
  'button-name',
  'aria-hidden-focus',
  'aria-valid-attr-value',
  'aria-required-attr',
  'aria-allowed-attr',
  'aria-allowed-role',
  'landmark-one-main',
  'region',
  'page-has-heading-one',
  'heading-order',
  'bypass',
  'skip-link',
  'scrollable-region-focusable',
  'svg-img-alt',
  'target-size',
  'focus-order-semantics',
  'tabindex',
  'meta-viewport',
  'html-has-lang',
  'document-title',
  'image-alt',
] as const;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'];
/** §5b's pixel-sampled contrast for the nodes axe could not decide: [selector, worst ratio, needed, note]. A node that
 *  cannot be sampled is never a silent pass (the P6 review): `missing` (its selector finds nothing, or it cannot be
 *  read) fails the test; `hidden` (laid out with no box: nothing on screen to read) is annotated. */
async function sampledContrast(page: Page, selectors: string[]) {
  const out: Array<{ sel: string; worst: number; need: number; note: string; unsampled?: 'missing' | 'hidden' }> = [];
  for (const sel of selectors.slice(0, 40)) {
    const el = page.locator(sel).first();
    const info = await el
      .evaluate((e) => {
        const cs = getComputedStyle(e);
        const svg = e instanceof SVGElement;
        const fill = svg && cs.fill && cs.fill.startsWith('rgb') ? cs.fill : cs.color;
        const px = parseFloat(cs.fontSize);
        const bold = Number(cs.fontWeight) >= 700;
        e.scrollIntoView({ block: 'center', inline: 'nearest' });
        return { color: fill, large: px >= 24 || (bold && px >= 18.66), opacity: Number(cs.opacity) };
      })
      .catch(() => null);
    if (!info) {
      out.push({ sel, worst: 0, need: 0, note: 'not found: cannot be sampled', unsampled: 'missing' });
      continue;
    }
    const box = await el.boundingBox();
    if (!box || box.width < 1 || box.height < 1) {
      out.push({ sel, worst: 0, need: 0, note: 'not rendered: no box to sample', unsampled: 'hidden' });
      continue;
    }
    await el.evaluate((e) => e.classList.add('__contrast-probe'));
    const style = await page.addStyleTag({
      content:
        '.__contrast-probe, .__contrast-probe * { color: transparent !important; -webkit-text-fill-color: transparent !important; fill: transparent !important; text-decoration-color: transparent !important; text-shadow: none !important; caret-color: transparent !important; }',
    });
    const png = await page.screenshot({ clip: box, animations: 'disabled', caret: 'hide' });
    await style.evaluate((n) => (n as Element).remove());
    await el.evaluate((e) => e.classList.remove('__contrast-probe'));
    const r = await page.evaluate(
      async ([b64, color]) => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + b64;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const g = c.getContext('2d')!;
        g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        const lin = (v: number) => {
          const x = v / 255;
          return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        };
        const lum = (r: number, gg: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
        const ls: number[] = [];
        for (let i = 0; i < d.length; i += 4) ls.push(lum(d[i]!, d[i + 1]!, d[i + 2]!));
        ls.sort((a, b) => a - b);
        const lo = ls[Math.floor(ls.length * 0.05)]!;
        const hi = ls[Math.min(ls.length - 1, Math.floor(ls.length * 0.95))]!;
        const m = color.match(/[\d.]+/g)!.map(Number);
        const t = lum(m[0]!, m[1]!, m[2]!);
        const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        return { worst: Math.min(ratio(t, lo), ratio(t, hi)) };
      },
      [png.toString('base64'), info.color] as const,
    );
    out.push({ sel, worst: Math.round(r.worst * 100) / 100, need: info.large ? 3 : 4.5, note: info.color });
  }
  return out;
}

const MEASURE = readFileSync(path.join(import.meta.dirname, 'support/measure.js'), 'utf8');
type M = Record<string, any>;

test.beforeEach(async ({ page }) => {
  if (await isSoftware(page)) await page.emulateMedia({ reducedMotion: 'reduce' });
});

for (const [width, height] of [
  [1440, 900],
  [360, 800],
] as const) {
  test.describe(`axe at ${width} × ${height}`, () => {
    test.use({
      viewport: { width, height },
      ...(width < 600 ? { deviceScaleFactor: 3, isMobile: true, hasTouch: true } : {}),
    });
    for (const r of ROUTES) {
      test(r.id, async ({ page }) => {
        await page.goto(r.path);
        await fontsReady(page);
        const axe = await new AxeBuilder({ page })
          .withTags(TAGS)
          // (every rule §5b names, enabled explicitly: a rename fails the "did not run" check below)
          .options({ rules: Object.fromEntries(RULES.map((id) => [id, { enabled: true }])) })
          .analyze();
        const ran = new Set(
          [...axe.passes, ...axe.violations, ...axe.incomplete, ...axe.inapplicable].map((x) => x.id),
        );
        const missing = RULES.filter((id) => !ran.has(id));
        expect(missing, 'rules §5b names that did not run').toEqual([]);
        const fail = axe.violations.map(
          (v) =>
            `${v.id} (${v.nodes.length}): ${v.nodes
              .slice(0, 3)
              .map((n) => n.target.join(' '))
              .join(' | ')}`,
        );
        const undecided = axe.incomplete
          .filter((x) => x.id === 'color-contrast')
          .flatMap((v) => v.nodes.map((n) => String(n.target[0])));
        const sampled = await sampledContrast(page, undecided);
        if (undecided.length > 40) fail.push(`color-contrast undecided on ${undecided.length} nodes (sampled 40)`);
        for (const c of sampled)
          if (c.unsampled === 'missing') fail.push(`contrast (sampled) ${c.sel}: undecided by axe and ${c.note}`);
          else if (!c.unsampled && c.worst < c.need)
            fail.push(`contrast (sampled) ${c.sel}: ${c.worst}:1 < ${c.need}:1 (${c.note})`);
        const hidden = sampled.filter((c) => c.unsampled === 'hidden');
        if (hidden.length)
          test.info().annotations.push({
            type: 'contrast not sampled',
            description: hidden.map((c) => `${c.sel}: ${c.note}`).join(' · '),
          });
        test.info().annotations.push({
          type: 'contrast sampled',
          description:
            sampled
              .filter((c) => !c.unsampled)
              .map((c) => `${c.sel} ${c.worst}`)
              .join(' · ') || 'none undecided',
        });
        expect(fail, `${r.id} at ${width}`).toEqual([]);
      });
    }
  });
}

test.describe('tap targets at 360 × 800 (A12)', () => {
  test.use({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  for (const r of ROUTES) {
    test(r.id, async ({ page }) => {
      await page.goto(r.path);
      await fontsReady(page);
      const m = (await page.evaluate(`(${MEASURE})({ taps: true })`)) as M;
      const small = (m.taps?.small ?? []).map((t: M) => `${t.el} '${t.name}' ${t.hitW}×${t.hitH}`);
      expect(small, `${r.id}: standalone targets under 44 × 44`).toEqual([]);
      expect(m.overflow.sideways || m.overflow.offenderCount ? m.overflow.offenders?.slice(0, 3) : []).toEqual([]);
    });
  }
});
