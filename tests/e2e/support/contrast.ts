import type { Locator, Page } from '@playwright/test';

/** One sampled piece of text: its worst contrast against the ground painted under it, and what it needs. */
export interface Sampled {
  worst: number;
  need: number;
  color: string;
  /** the text's size as drawn (CSS px) */
  px?: number;
  /** set when it could not be sampled: `missing` (not found, or unreadable), `hidden` (laid out with no box) */
  unsampled?: 'missing' | 'hidden';
}

/**
 * The contrast of a piece of text against what is really painted under it (the painting, its still, the paper): the
 * text is made transparent, its box is captured as painted, and its colour is measured against both the lightest and
 * the darkest 5 % of that ground. WCAG's large text (24 px as drawn, or 18.66 px bold) needs 3:1, everything else
 * 4.5:1; `need` overrides it. The element is brought into view first unless `inPlace` (a fixed header, a title at the page's top).
 */
export async function sampledContrast(
  page: Page,
  el: Locator,
  { inPlace = false, need }: { inPlace?: boolean; need?: number } = {},
): Promise<Sampled> {
  const info = await el
    .evaluate((e, stay) => {
      const cs = getComputedStyle(e);
      const svg = e instanceof SVGElement;
      const fill = svg && cs.fill && cs.fill.startsWith('rgb') ? cs.fill : cs.color;
      // (its size as drawn: the band's titles are scaled with the band, a diagram's words with its drawing)
      const drawn =
        e instanceof SVGGraphicsElement
          ? Math.abs(e.getScreenCTM()?.d ?? 1)
          : e instanceof HTMLElement && e.offsetHeight
            ? e.getBoundingClientRect().height / e.offsetHeight
            : 1;
      const px = parseFloat(cs.fontSize) * drawn;
      const bold = Number(cs.fontWeight) >= 700;
      if (!stay) e.scrollIntoView({ block: 'center', inline: 'nearest' });
      return { color: fill, large: px >= 24 || (bold && px >= 18.66), px: Math.round(px * 10) / 10 };
    }, inPlace)
    .catch(() => null);
  if (!info) return { worst: 0, need: 0, color: '', unsampled: 'missing' };
  const box = await el.boundingBox();
  if (!box || box.width < 1 || box.height < 1) return { worst: 0, need: 0, color: info.color, unsampled: 'hidden' };
  // (what of the box is inside the window: a screenshot's clip cannot leave it)
  const vp = page.viewportSize() ?? { width: 1e5, height: 1e5 };
  const x = Math.max(0, box.x);
  const y = Math.max(0, box.y);
  const clip = {
    x,
    y,
    width: Math.min(box.x + box.width, vp.width) - x,
    height: Math.min(box.y + box.height, vp.height) - y,
  };
  if (clip.width < 1 || clip.height < 1) return { worst: 0, need: 0, color: info.color, unsampled: 'hidden' };
  await el.evaluate((e) => e.classList.add('__contrast-probe'));
  // (the text made transparent; a token struck through, [data-struck], is struck by its own ::after: like a
  // line-through, the strike is the text's decoration, not the ground under it, so it goes with the text)
  const style = await page.addStyleTag({
    content:
      '.__contrast-probe, .__contrast-probe * { color: transparent !important; -webkit-text-fill-color: transparent !important; -webkit-text-stroke-color: transparent !important; fill: transparent !important; stroke: transparent !important; text-decoration-color: transparent !important; text-shadow: none !important; caret-color: transparent !important; } .__contrast-probe::placeholder { color: transparent !important; -webkit-text-fill-color: transparent !important; } .__contrast-probe[data-struck]::after { visibility: hidden !important; }',
  });
  // (as it stands now: `animations: 'disabled'` would run the band's scroll-driven settling and travel to their end)
  const png = await page.screenshot({ clip, caret: 'hide' });
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
      return Math.min(ratio(t, lo), ratio(t, hi));
    },
    [png.toString('base64'), info.color] as const,
  );
  return { worst: Math.round(r * 100) / 100, need: need ?? (info.large ? 3 : 4.5), color: info.color, px: info.px };
}
