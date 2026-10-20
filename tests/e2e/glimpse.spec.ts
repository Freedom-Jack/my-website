import { expect, test, type Page } from '@playwright/test';
import { settle } from './support/pages';

/**
 * Windows into the painting (elements.ts glimpses), below 1200 px: the hard rules on the rendered pages.
 * The page's own rules, whatever the windows paint:
 *   - laptops: no window is laid out, and the page is the approved one (flag on = flag off, "Still the landscape" on);
 *   - phones: every window is painted and scrolling past all of them paints no scene;
 *   - the words keep 40 px of paper: no figure pixel (lum < 190 or C* > 28) within 40 px of a text line;
 *   - reduced motion: a window is its rest pose wherever it stands on the screen;
 * and the windows' own rules:
 *   - nothing in a window is lighter than the paper round it; no figure within 24 px of the screen's sides;
 *   - windows never share a screen: >= 1.1 viewports apart, <= 30 % of any screen;
 *   - a short page's end (Writing, Contact) is uncovered at the end of the page at 390, 768 and 1024;
 *   - the fallback is the window's own still; a phone held sideways lays out no window (the strip and the closing).
 *   - the Résumé's timeline is never cut: its windows stand only before Experience and before Skills.
 * They read the QA build's window.__ink (NEXT_PUBLIC_INK_QA=1), like the other e2e probes.
 */
type S = Record<string, any>;
const PAGES = [
  { path: '/', n: 2, tablet: 1 },
  { path: '/work/', n: 2, tablet: 2 },
  { path: '/resume/', n: 2, tablet: 2 },
];
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const stats = (page: Page) => page.evaluate(() => (window as unknown as { __ink: { stats(): S } }).__ink.stats());
const hardware = async (page: Page) => {
  const s = await stats(page);
  return s.mode === 'webgl' && !s.software;
};
const boxes = (page: Page, sel = '[data-landscape="glimpse"]') =>
  page.evaluate(
    (q) =>
      [...document.querySelectorAll(q)].map((e) => {
        const b = e.getBoundingClientRect();
        return { top: b.top + scrollY, h: b.height, left: b.left, w: b.width };
      }),
    sel,
  );
async function jumpTo(page: Page, y: number) {
  await page.evaluate((t) => window.scrollTo({ top: t, behavior: 'instant' as ScrollBehavior }), y);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(300);
}
/** Visit every window (each is painted at scroll idle once it is near), then wait until all are painted. */
async function paintAll(page: Page, vh: number) {
  for (const b of (await boxes(page)).filter((x) => x.h > 0)) {
    await jumpTo(page, Math.max(0, Math.round(b.top + b.h / 2 - vh / 2)));
    await page.waitForTimeout(700);
  }
  await page.waitForFunction(
    () => {
      const l = (window as any).__ink.stats().glimpses.list.filter((g: S) => Number.isFinite(g.doc) && g.doc > 0);
      return l.every((g: S) => g.painted);
    },
    null,
    { timeout: 15_000 },
  );
}
/** The share of pixels that differ (any channel by more than `thr`) between two same-size screenshots. */
const diffFrac = (page: Page, a: Buffer, b: Buffer, thr: number) =>
  page.evaluate(
    async ([x, y, t]) => {
      const load = async (b64: string) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const cv = document.createElement('canvas');
        cv.width = img.width;
        cv.height = img.height;
        const g = cv.getContext('2d')!;
        g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, cv.width, cv.height).data;
      };
      const [A, B] = await Promise.all([load(x as string), load(y as string)]);
      if (A.length !== B.length) return 1;
      let n = 0;
      for (let k = 0; k < A.length; k += 4)
        if (
          Math.max(Math.abs(A[k] - B[k]), Math.abs(A[k + 1] - B[k + 1]), Math.abs(A[k + 2] - B[k + 2])) > (t as number)
        )
          n++;
      return n / (A.length / 4);
    },
    [a.toString('base64'), b.toString('base64'), thr] as const,
  );
const HIDE_TEXT = `*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important;
  text-decoration-color: transparent !important; caret-color: transparent !important; transition: none !important; }
.seal, .seal *, .site-header, .ink-btn, .brush, svg, img { visibility: hidden !important; }`;
/**
 * One window measured on a viewport screenshot (glyphs hidden): its figure pixels' least distance to any text line
 * on screen (CSS px), its figure pixels within 24 px of the box's sides, and its pixels lighter than the paper just
 * above or below it (any channel above the paper's own brightest grain + 2). Worked out in the page.
 */
async function measure(page: Page, box: { top: number; h: number; left: number; w: number }, dpr: number) {
  const lines = await page.evaluate(() => {
    const out: number[][] = [];
    const main = document.querySelector('main');
    if (!main) return out;
    const tw = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (!n.textContent || !n.textContent.trim()) continue;
      const el = n.parentElement;
      if (!el || el.closest('[aria-hidden="true"], .visually-hidden')) continue;
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      // (the part of a line its clipping ancestors let show: a collapsed list's rows have boxes but no pixels)
      let clip = [-1e9, -1e9, 1e9, 1e9];
      for (let a: Element | null = el; a && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible' || cs.clipPath !== 'none') {
          const c = a.getBoundingClientRect();
          clip = [
            Math.max(clip[0], c.left),
            Math.max(clip[1], c.top),
            Math.min(clip[2], c.right),
            Math.min(clip[3], c.bottom),
          ];
        }
      }
      const r = document.createRange();
      r.selectNodeContents(n);
      for (const q of r.getClientRects()) {
        const x0 = Math.max(q.left, clip[0]),
          y0 = Math.max(q.top, clip[1]),
          x1 = Math.min(q.right, clip[2]),
          y1 = Math.min(q.bottom, clip[3]);
        if (x1 - x0 > 0.5 && y1 - y0 > 0.5) out.push([x0, y0, x1, y1]);
      }
    }
    return out;
  });
  const sy = await page.evaluate(() => scrollY);
  const hide = await page.addStyleTag({ content: HIDE_TEXT });
  await page.waitForTimeout(150);
  const png = await page.screenshot();
  await hide.evaluate((e) => (e as HTMLElement).remove());
  const top = box.top - sy;
  return page.evaluate(
    async ([b64, bx, ls, k]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const cv = document.createElement('canvas');
      cv.width = img.width;
      cv.height = img.height;
      const g = cv.getContext('2d')!;
      g.drawImage(img, 0, 0);
      const D = g.getImageData(0, 0, cv.width, cv.height).data;
      const W = cv.width;
      const [bt, bh, bl, bw] = bx as unknown as number[];
      const head = 72; // (never the header's rows)
      const y0 = Math.max(Math.round(head * (k as number)), Math.round(bt * (k as number)));
      const y1 = Math.min(cv.height, Math.round((bt + bh) * (k as number)));
      const x0 = Math.max(0, Math.round(bl * (k as number))),
        x1 = Math.min(W, Math.round((bl + bw) * (k as number)));
      const px = (x: number, y: number) => {
        const o = (y * W + x) * 4;
        return [D[o], D[o + 1], D[o + 2]];
      };
      const lab = (r: number, gg: number, b: number) => {
        const f = (c: number) => {
          c /= 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        };
        const [R, G, B] = [f(r), f(gg), f(b)];
        const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047,
          Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
        const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
        const h = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
        return Math.hypot(500 * (h(X) - h(Y)), 200 * (h(Y) - h(Z)));
      };
      // the paper's own brightest grain round the box
      const ref = [0, 0, 0];
      for (const [a0, a1] of [
        [
          Math.max(Math.round(head * (k as number)), y0 - Math.round(42 * (k as number))),
          y0 - Math.round(2 * (k as number)),
        ],
        [y1 + Math.round(2 * (k as number)), Math.min(cv.height, y1 + Math.round(42 * (k as number)))],
      ])
        for (let y = a0; y < a1; y++)
          for (let x = x0; x < x1; x++) {
            const p = px(x, y);
            for (let c = 0; c < 3; c++) ref[c] = Math.max(ref[c], p[c]);
          }
      let light = 0,
        edge = 0,
        clear = 999,
        worst: number[] = [];
      const e = Math.round(24 * (k as number));
      const near = (ls as number[][]).filter((l) => l[3] > bt - 200 && l[1] < bt + bh + 200);
      for (let y = y0; y < y1; y += 1)
        for (let x = x0; x < x1; x += 1) {
          const [r, gg, b] = px(x, y);
          if (r > ref[0] + 2 || gg > ref[1] + 2 || b > ref[2] + 2) light++;
          const fig = 0.299 * r + 0.587 * gg + 0.114 * b < 190 || lab(r, gg, b) > 28;
          if (!fig) continue;
          if (x - x0 < e || x1 - 1 - x < e) edge++;
          const cx = x / (k as number),
            cy = y / (k as number);
          for (const l of near) {
            const dx = Math.max(l[0] - cx, cx - l[2], 0),
              dy = Math.max(l[1] - cy, cy - l[3], 0);
            const dd = Math.hypot(dx, dy);
            if (dd < clear) {
              clear = dd;
              worst = [...l, cx, cy];
            }
          }
        }
      return { light, edge, clear, worst };
    },
    [png.toString('base64'), [top, box.h, box.left, box.w], lines, dpr] as const,
  );
}
const still = (page: Page) =>
  page.addInitScript(() => {
    try {
      localStorage.setItem('ink:still', '1');
      sessionStorage.setItem('ink:morning', '1');
      sessionStorage.setItem('ink:swash', '1');
    } catch {
      /* private mode */
    }
  });
const noMorning = (page: Page) =>
  page.addInitScript(() => {
    try {
      sessionStorage.setItem('ink:morning', '1');
      sessionStorage.setItem('ink:swash', '1');
    } catch {
      /* private mode */
    }
  });

test.describe('glimpses: laptops are the approved page', () => {
  for (const vp of [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
  ]) {
    test(`${vp.width}: no window, flag on = flag off`, async ({ browser }) => {
      for (const p of PAGES) {
        const shots: Buffer[] = [];
        const heights: number[] = [];
        for (const off of [false, true]) {
          const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
          const page = await ctx.newPage();
          await still(page);
          if (off) await page.addInitScript(() => Object.assign(window, { __elOff: ['glimpses'] }));
          await page.goto(p.path);
          await settle(page);
          if (!off) expect((await boxes(page)).every((b) => b.h === 0)).toBe(true);
          heights.push(await page.evaluate(() => document.documentElement.scrollHeight));
          await jumpTo(page, Math.round(heights[heights.length - 1] * 0.4));
          await settle(page);
          await page.waitForTimeout(600);
          shots.push(await page.screenshot());
          await ctx.close();
        }
        expect(heights[0]).toBe(heights[1]);
        // (the same frame: at most a breath of load-to-load noise, never a window)
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        expect(await diffFrac(page, shots[0], shots[1], 8)).toBeLessThan(0.005);
        await ctx.close();
      }
    });
  }
});

test.describe('glimpses: phones', () => {
  test.use(PHONE);
  for (const p of PAGES) {
    test(`${p.path}: every window painted, and no scene while scrolling past them`, async ({ page }) => {
      await noMorning(page);
      await page.goto(p.path);
      await settle(page);
      test.skip(!(await hardware(page)), 'a software rasteriser shows the stills');
      const bx = (await boxes(page)).filter((b) => b.h > 0);
      expect(bx.length).toBe(p.n);
      await paintAll(page, 844);
      await page.waitForTimeout(800);
      const s0 = (await stats(page)).scenes;
      for (const b of bx)
        for (const q of [0.8, 0.5, 0.2]) {
          await page.evaluate(
            (y) => window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior }),
            Math.round(b.top + b.h / 2 - q * 844),
          );
          await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        }
      const s = await stats(page);
      expect(s.glimpses.on).toBe(true);
      expect(s.scenes - s0).toBe(0);
    });
    test(`${p.path}: the words keep 40 px; nothing lighter than the paper; nothing at the screen's sides`, async ({
      page,
    }) => {
      await noMorning(page);
      await page.goto(p.path);
      await settle(page);
      test.skip(!(await hardware(page)), 'a software rasteriser shows the stills');
      await paintAll(page, 844);
      const n = (await boxes(page)).filter((x) => x.h > 0).length;
      for (let i = 0; i < n; i++)
        for (const q of [0.3, 0.5, 0.7]) {
          const b0 = (await boxes(page)).filter((x) => x.h > 0)[i];
          await jumpTo(page, Math.max(0, Math.round(b0.top + b0.h / 2 - q * 844)));
          await page.waitForTimeout(500);
          const b = (await boxes(page)).filter((x) => x.h > 0)[i]; // (where it stands now: a details row may open)
          const m = await measure(page, b, 3);
          expect(
            m.clear,
            `${p.path} window at ${b.top} q ${q}: text -> figure ${JSON.stringify(m.worst)}`,
          ).toBeGreaterThanOrEqual(40);
          expect(m.light, `${p.path} window at ${b.top} q ${q}: lighter than paper`).toBe(0);
          expect(m.edge, `${p.path} window at ${b.top} q ${q}: figure at the sides`).toBe(0);
        }
    });
    test(`${p.path}: windows never share a screen`, async ({ page }) => {
      await page.goto(p.path);
      const bx = (await boxes(page)).filter((b) => b.h > 0);
      const H = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      for (let i = 1; i < bx.length; i++) expect(bx[i].top - bx[i - 1].top).toBeGreaterThanOrEqual(1.1 * 844);
      for (let y = 0; y <= H; y += 844 / 8) {
        const vis = bx.reduce((n, b) => n + Math.max(0, Math.min(b.top + b.h, y + 844) - Math.max(b.top, y)), 0);
        expect(vis / 844).toBeLessThanOrEqual(0.3);
      }
    });
  }
  test('reduced motion: a window is its rest pose wherever it stands', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await settle(page);
    test.skip(!(await hardware(page)), 'a software rasteriser shows the stills');
    await paintAll(page, 844);
    const [b] = (await boxes(page)).filter((x) => x.h > 0);
    const crop = async (q: number) => {
      const y = Math.round(b.top + b.h / 2 - q * 844);
      await jumpTo(page, y);
      await settle(page);
      await page.waitForTimeout(400);
      const top = b.top - (await page.evaluate(() => scrollY));
      return page.screenshot({ clip: { x: 0, y: top, width: 390, height: b.h }, animations: 'disabled' });
    };
    const a = await crop(0.3);
    const c = await crop(0.7);
    const d = await diffFrac(page, a, c, 12);
    // (the paper grain is anchored to the screen by design: it moves a pixel by at most ~12/255; the painting moving
    // would differ by far more)
    expect(d).toBeLessThan(0.002);
  });
  test('fallback: each window shows its own still until it is painted', async ({ page }) => {
    await page.goto('/');
    const bg = await page.evaluate(() =>
      [...document.querySelectorAll('[data-landscape="glimpse"]')].map(
        (e) => getComputedStyle(e, '::before').backgroundImage,
      ),
    );
    expect(bg[0]).toContain('/scenes/glimpse/home-0');
    expect(bg[1]).toContain('/scenes/glimpse/home-1');
  });
});

test.describe('glimpses: a short page ends on its place, uncovered', () => {
  for (const vp of [
    { width: 390, height: 844, dpr: 3, mobile: true },
    { width: 768, height: 1024, dpr: 2, mobile: true },
    { width: 1024, height: 768, dpr: 1, mobile: false },
  ])
    for (const path of ['/writing/', '/contact/'])
      test(`${path} at ${vp.width}: the end painted at the page's end`, async ({ browser }) => {
        const ctx = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: vp.dpr,
          isMobile: vp.mobile,
          hasTouch: vp.mobile,
        });
        const page = await ctx.newPage();
        await noMorning(page);
        await page.goto(path);
        await settle(page);
        test.skip(!(await hardware(page)), 'a software rasteriser shows the stills');
        const H = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
        await jumpTo(page, H);
        await settle(page);
        await page.waitForFunction(() => (window as any).__ink.stats().glimpses.list.every((g: S) => g.painted), null, {
          timeout: 15_000,
        });
        await page.waitForTimeout(600);
        const [b] = await boxes(page, '[data-glimpse="end"]');
        const top = b.top - (await page.evaluate(() => scrollY));
        const png = await page.screenshot({ clip: { x: 0, y: Math.max(0, top), width: vp.width, height: b.h } });
        const share = await page.evaluate(async (b64) => {
          const img = new Image();
          img.src = `data:image/png;base64,${b64}`;
          await img.decode();
          const cv = document.createElement('canvas');
          cv.width = img.width;
          cv.height = img.height;
          const g = cv.getContext('2d')!;
          g.drawImage(img, 0, 0);
          const D = g.getImageData(0, 0, cv.width, cv.height).data;
          let n = 0;
          for (let k = 0; k < D.length; k += 4)
            if (Math.max(Math.abs(D[k] - 239), Math.abs(D[k + 1] - 241), Math.abs(D[k + 2] - 238)) > 10) n++;
          return n / (D.length / 4);
        }, png.toString('base64'));
        expect(share).toBeGreaterThan(0.25);
        await ctx.close();
      });
});

test.describe('glimpses: a phone held sideways', () => {
  test.use({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  for (const p of PAGES)
    test(`${p.path}: no window mid-page`, async ({ page }) => {
      await noMorning(page);
      await page.goto(p.path);
      await settle(page);
      expect((await boxes(page)).filter((b) => b.h > 0).length).toBe(0);
    });
});

test.describe('glimpses: tablets', () => {
  test.use({ viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  for (const p of PAGES)
    test(`${p.path}: the column's width, one window to a screen`, async ({ page }) => {
      await page.goto(p.path);
      const bx = (await boxes(page)).filter((b) => b.h > 0);
      expect(bx.length).toBe(p.tablet);
      for (const b of bx) expect(b.w).toBeLessThanOrEqual(640);
      for (let i = 1; i < bx.length; i++) expect(bx[i].top - bx[i - 1].top).toBeGreaterThanOrEqual(1.1 * 1024);
    });
});
