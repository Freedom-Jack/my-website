import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { fontsReady, isSoftware, ROUTES } from './support/pages';
import { tapsAndOverflow } from './support/taps';

/**
 * Accessibility, enforced:
 *   - axe-core (through @axe-core/playwright) on every route at 1440 × 900 and 360 × 800, tags wcag2a, wcag2aa,
 *     wcag21aa, wcag22aa and best-practice: zero violations. The RULES are asserted to exist in the installed axe and
 *     to have run, so a renamed rule cannot silently drop out. color-contrast results axe could not decide
 *     ("incomplete": text over the painting or its still, which axe cannot sample) are decided by a pixel-sampled
 *     test instead: the text is made transparent, its box is captured as painted, and the text colour must reach 4.5:1
 *     (3:1 for large text) against both the lightest and the darkest 5 % of the ground under it; a node that cannot be
 *     found or read is a failure, and one with no box is noted in the report.
 *   - the tap-target sweep at 360 × 800 on every route: every standalone target 44 × 44 (inline links in a sentence
 *     are WCAG 2.5.8's exception).
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
/** The pixel-sampled contrast for the nodes axe could not decide: [selector, worst ratio, needed, note]. A node that
 *  cannot be sampled is never a silent pass: `missing` (its selector finds nothing, or it cannot be read) fails the
 *  test; `hidden` (laid out with no box: nothing on screen to read) is annotated. */
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
    // (the text made transparent; a token struck through with a brush, [data-struck], is struck by its own ::after:
    // like a line-through, the strike is the text's decoration, not the ground under it, so it goes with the text)
    const style = await page.addStyleTag({
      content:
        '.__contrast-probe, .__contrast-probe * { color: transparent !important; -webkit-text-fill-color: transparent !important; fill: transparent !important; text-decoration-color: transparent !important; text-shadow: none !important; caret-color: transparent !important; } .__contrast-probe::placeholder { color: transparent !important; -webkit-text-fill-color: transparent !important; } .__contrast-probe[data-struck]::after { visibility: hidden !important; }',
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
        // (the page as a reader who has gone down it meets it: the pieces that take their code and data as they are
        // reached, Ask, the search, Work's live pieces, are in their live form before anything is judged)
        await page.evaluate(async () => {
          for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight / 2) {
            scrollTo(0, y);
            await new Promise((done) => setTimeout(done, 80));
          }
          scrollTo(0, 0);
        });
        await page.waitForTimeout(700);
        const axe = await new AxeBuilder({ page })
          .withTags(TAGS)
          // (every rule in RULES, enabled explicitly: a rename fails the "did not run" check below)
          .options({ rules: Object.fromEntries(RULES.map((id) => [id, { enabled: true }])) })
          .analyze();
        const ran = new Set(
          [...axe.passes, ...axe.violations, ...axe.incomplete, ...axe.inapplicable].map((x) => x.id),
        );
        const missing = RULES.filter((id) => !ran.has(id));
        expect(missing, 'rules that did not run').toEqual([]);
        const fail = axe.violations.map(
          (v) =>
            `${v.id} (${v.nodes.length}): ${v.nodes
              .slice(0, 3)
              .map((n) => n.target.join(' '))
              .join(' | ')}`,
        );
        const all = axe.incomplete
          .filter((x) => x.id === 'color-contrast')
          .flatMap((v) => v.nodes.map((n) => String(n.target[0])));
        // (a figure drawn large beside its own sentence is decoration, hidden from assistive technology:
        // its words are the sentence's, which is checked; an outlined numeral has no fill for the sampler to read)
        const undecided: string[] = [];
        for (const sel of all) {
          const deco = await page
            .locator(sel)
            .first()
            .evaluate((e) => !!e.closest('[aria-hidden="true"]'))
            .catch(() => false);
          if (!deco) undecided.push(sel);
        }
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

test.describe('tap targets at 360 × 800', () => {
  test.use({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  for (const r of ROUTES) {
    test(r.id, async ({ page }) => {
      await page.goto(r.path);
      await fontsReady(page);
      const m = await page.evaluate(tapsAndOverflow);
      const small = m.small.map((t) => `${t.el} '${t.name}' ${t.hitW}×${t.hitH}`);
      expect(small, `${r.id}: standalone targets under 44 × 44`).toEqual([]);
      expect(m.offenders.slice(0, 3)).toEqual([]);
    });
  }
});
