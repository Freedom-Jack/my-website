import { expect, test, type Page } from '@playwright/test';
import { ROUTES, settle } from './support/pages';

/**
 * The scroll (elements.ts cameraTravels + air): the hard rules on the rendered pages.
 *   - reduced motion and "Still the landscape": no scroll-linked motion. A frame taken while the page is still scrolling
 *     equals the rest frame at the same place (the painting may switch between rest states, never animate), the stage's
 *     pose is only ever a rest state (0 or 1), and the air is off;
 *   - the scroll's air settles: within 1.5 s of the last wheel tick nothing in it moves, and the loop goes back to the
 *     ambient pace (<= 15 fps) or sleeps;
 *   - smooth: rAF intervals while wheel-scrolling top to bottom (hardware GPU only: a software rasteriser keeps the
 *     plain strips and is not timed here);
 *   - the parted windows below 1200 px: the strip parts as it leaves, the closing arrives through mist that has wholly
 *     parted at the page's end (the closing at rest);
 *   - the stage on Writing, Résumé and Contact (living with the camera travel): the story map and the footer's lines
 *     sit on clean paper at the page's end, and its memory stays in budget.
 * They read the QA build's window.__ink (NEXT_PUBLIC_INK_QA=1), like the other e2e probes.
 */
type S = Record<string, any>;
const MAP = ROUTES.filter((r) => ['home', 'work', 'writing', 'resume', 'contact'].includes(r.id));
const stats = (page: Page) => page.evaluate(() => (window as unknown as { __ink: { stats(): S } }).__ink.stats());
const hardware = async (page: Page) => {
  const s = await stats(page);
  return s.mode === 'webgl' && !s.software;
};
/** Wheel the page down to y in ticks of `tick` px (a scroll in progress), without waiting for it to settle. */
async function wheelTo(page: Page, y: number, tick = 120) {
  for (let i = 0; i < 40; i++) {
    const now = await page.evaluate(() => scrollY);
    if (Math.abs(now - y) < 2) break;
    await page.mouse.wheel(0, Math.max(-tick, Math.min(tick, y - now)));
    await page.waitForTimeout(16);
  }
}
/** Jump to y at once (no smooth tail) and let the painting take the new scroll (two frames and a breath): a
 *  stats() read or a shot before that would see the old state. */
async function jumpTo(page: Page, y: number | 'end') {
  await page.evaluate((t) => {
    const top = t === 'end' ? document.documentElement.scrollHeight : t;
    window.scrollTo({ top, behavior: 'instant' as ScrollBehavior });
  }, y);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(250);
}
/** How many pixels differ (any channel by more than 2) between two same-size screenshots, decoded in the page. */
async function diffPx(page: Page, a: Buffer, b: Buffer) {
  return page.evaluate(
    async ([x, y]) => {
      const load = async (b64: string) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const g = c.getContext('2d')!;
        g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, c.width, c.height).data;
      };
      const [A, B] = await Promise.all([load(x), load(y)]);
      if (A.length !== B.length) return -1;
      let n = 0;
      for (let k = 0; k < A.length; k += 4)
        if (Math.max(Math.abs(A[k] - B[k]), Math.abs(A[k + 1] - B[k + 1]), Math.abs(A[k + 2] - B[k + 2])) > 2) n++;
      return n;
    },
    [a.toString('base64'), b.toString('base64')],
  );
}

for (const quiet of ['reduced motion', 'Still the landscape'] as const) {
  test.describe(`scroll: ${quiet} = no scroll-linked motion`, () => {
    for (const vp of [
      { width: 1440, height: 900, dpr: 1, mobile: false },
      { width: 768, height: 1024, dpr: 2, mobile: true }, // (tablets too)
      { width: 390, height: 844, dpr: 3, mobile: true },
    ]) {
      test.describe(`${vp.width}`, () => {
        test.use({
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: vp.dpr,
          isMobile: vp.mobile,
          hasTouch: vp.mobile,
        });
        for (const r of MAP) {
          test(r.id, async ({ page }) => {
            if (quiet === 'reduced motion') await page.emulateMedia({ reducedMotion: 'reduce' });
            else await page.addInitScript(() => localStorage.setItem('ink:still', '1'));
            await page.goto(r.path);
            await settle(page);
            const H = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
            for (const f of [0.3, 0.7, 1]) {
              // (reached by wheel ticks, a scroll in progress, then pinned there: the shot at once and the one 350 ms
              // later must be the same frame, whatever the scroll just did)
              await wheelTo(page, Math.round(H * f));
              // (let the wheel's smooth-scroll tail land first: pinned too early, the page itself moves a pixel or two
              // between the two shots, text and story map included, while the painting, a fixed canvas, does not)
              await page.waitForFunction(
                () =>
                  new Promise((r) => {
                    const y0 = scrollY;
                    setTimeout(() => r(scrollY === y0), 150);
                  }),
                undefined,
                { timeout: 5000, polling: 50 },
              );
              await page.evaluate(
                (t) => window.scrollTo({ top: t, behavior: 'instant' as ScrollBehavior }),
                Math.round(H * f),
              );
              await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
              const s = await stats(page);
              expect(s.air?.on ?? false, `${r.id}: the air is off`).toBe(false);
              if (s.stage?.on) {
                for (const k of ['prog', 'desc', 'step', 'stair'] as const)
                  expect([0, 1], `${r.id} ${f}: the stage's ${k} is a rest state`).toContain(
                    Math.round((s.stage[k] ?? 0) * 1000) / 1000,
                  );
              }
              expect(s.windows?.strip?.parted ?? false, `${r.id}: no parting`).toBe(false);
              // (a figure layer the jump brings into view may still be on its way; it is not scroll-linked motion)
              await page.waitForFunction(
                () =>
                  !Object.values((window as unknown as { __ink: { stats(): S } }).__ink.stats().figures || {}).includes(
                    'pending',
                  ),
                undefined,
                { timeout: 10_000, polling: 50 },
              );
              // (the frame below the site header's band: the sticky header's own slide belongs to the interface, not
              // the painting, and "Still the landscape" does not govern it)
              const clip = await page.evaluate(() => {
                const h = document.querySelector('.site-header')?.getBoundingClientRect();
                const top = Math.min(innerHeight - 8, Math.max(0, Math.ceil((h?.bottom ?? 0) + 2), 72));
                return { x: 0, y: top, width: innerWidth, height: innerHeight - top };
              });
              const a = await page.screenshot({ clip });
              await page.waitForTimeout(350);
              const b = await page.screenshot({ clip });
              expect(await diffPx(page, a, b), `${r.id} ${f}: the painting moved after the scroll`).toBeLessThan(64);
            }
          });
        }
      });
    }
  });
}

test.describe('scroll: the air settles within 1.5 s and the loop sleeps', () => {
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  for (const r of MAP.filter((x) => ['home', 'work', 'contact'].includes(x.id))) {
    test(r.id, async ({ page }) => {
      await page.goto(r.path);
      await settle(page);
      test.skip(!(await hardware(page)), 'the air runs on a hardware GPU only');
      await page.mouse.move(720, 450);
      for (let i = 0; i < 8; i++) {
        await page.mouse.wheel(0, 120);
        await page.waitForTimeout(40);
      }
      const t0 = Date.now();
      await page.waitForFunction(
        () => !(window as unknown as { __ink: { stats(): S } }).__ink.stats().air?.live,
        undefined,
        { timeout: 3000, polling: 50 },
      );
      expect(Date.now() - t0, `${r.id}: the air settled`).toBeLessThan(1600);
      const f0 = (await stats(page)).frames as number;
      await page.waitForTimeout(1000);
      const f1 = (await stats(page)).frames as number;
      expect(f1 - f0, `${r.id}: frames in the second after the air settled`).toBeLessThanOrEqual(20); // (the ambient pace, <= 15 fps, not the display's 60)
    });
  }
});

test.describe('scroll: frame time while wheel-scrolling (hardware GPU)', () => {
  for (const vp of [
    { width: 1440, height: 900, dpr: 1, mobile: false },
    { width: 390, height: 844, dpr: 3, mobile: true },
  ]) {
    test.describe(`${vp.width}`, () => {
      test.use({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.dpr,
        isMobile: vp.mobile,
        hasTouch: vp.mobile,
      });
      for (const r of MAP) {
        test(r.id, async ({ page }) => {
          await page.goto(r.path);
          await settle(page);
          test.skip(!(await hardware(page)), 'timed on a hardware GPU only');
          const H = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
          await page.evaluate(() => {
            const R = ((window as unknown as { __qaF: S }).__qaF = { iv: [] as number[], on: true, s0: 0 });
            let last = performance.now();
            const f = (t: number) => {
              if (!R.on) return;
              R.iv.push(t - last);
              last = t;
              requestAnimationFrame(f);
            };
            requestAnimationFrame(f);
            R.s0 = (window as unknown as { __ink: { stats(): S } }).__ink.stats().scenes;
          });
          await page.mouse.move(vp.width / 2, vp.height / 2);
          for (let y = 0; y < H; y += 100) {
            await page.mouse.wheel(0, 100);
            await page.waitForTimeout(50);
          }
          await page.waitForTimeout(500);
          const res = await page.evaluate(() => {
            const R = (window as unknown as { __qaF: S }).__qaF;
            R.on = false;
            const iv = (R.iv as number[]).slice(1).sort((a, b) => a - b);
            const pc = (p: number) => iv[Math.min(iv.length - 1, Math.floor(p * (iv.length - 1)))];
            return {
              p50: pc(0.5),
              p95: pc(0.95),
              scenes: (window as unknown as { __ink: { stats(): S } }).__ink.stats().scenes - R.s0,
            };
          });
          expect(res.p95, `${r.id} at ${vp.width}: rAF p95 ${res.p95.toFixed(1)} ms`).toBeLessThan(20);
          // (nothing is repainted while the page scrolls, at any width: the closing is painted ahead, off screen,
          // once what it shows is ready, so its arrival on a phone never paints a scene)
          expect(res.scenes, `${r.id}: scenes painted while scrolling`).toBe(0);
        });
      }
    });
  }
});

test.describe('scroll: the parted windows below 1200 px', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  for (const r of MAP) {
    test(r.id, async ({ page }) => {
      await page.goto(r.path);
      await settle(page);
      test.skip(!(await hardware(page)), 'the parting runs on a hardware GPU only');
      const s0 = await stats(page);
      const h = s0.windows.strip.height as number;
      await jumpTo(page, Math.round(h * 0.6));
      await settle(page);
      const s1 = await stats(page);
      expect(s1.windows.strip.parted, `${r.id}: the strip parts as it leaves`).toBe(true);
      // (sink = how far a layer's painting stays behind its box: the back lingers, so it sinks more than the front)
      expect(s1.windows.strip.sink[0], `${r.id}: the back lags the front`).toBeGreaterThan(s1.windows.strip.sink[1]);
      expect(s1.windows.strip.mist, `${r.id}: the bank never covers more than the visible part`).toBeLessThanOrEqual(
        0.92,
      );
      await jumpTo(page, 'end');
      await settle(page);
      const s2 = await stats(page);
      expect(s2.windows.closing.mist, `${r.id}: the closing's mist has parted at the page's end`).toBe(0);
      expect(s2.windows.closing.sink[1], `${r.id}: the closing at rest`).toBe(0);
    });
  }
});

/** The stage at the end of Writing, Résumé and Contact: the story map's labels and the footer's line sit on paper. */
const PAPER_CHROMA = 3;
test.describe('scroll: the footer on clean paper at the end of Writing, the Résumé and Contact (1440)', () => {
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  for (const r of MAP.filter((x) => ['writing', 'resume', 'contact'].includes(x.id))) {
    test(r.id, async ({ page }) => {
      await page.goto(r.path);
      await settle(page);
      await jumpTo(page, 'end');
      await settle(page);
      const box = await page.evaluate(() => {
        const a = document.querySelector('.site-footer .story-map__list')?.getBoundingClientRect();
        const b = document.querySelector('.site-footer__base')?.getBoundingClientRect();
        return a && b ? { x: a.left, y: a.top, w: a.width, h: b.bottom - a.top } : null;
      });
      expect(box, `${r.id}: footer boxes`).not.toBeNull();
      await page.addStyleTag({
        content: '.site-footer *{color:transparent!important;text-decoration-color:transparent!important}',
      });
      const png = await page.screenshot({ clip: { x: box!.x, y: box!.y, width: box!.w, height: Math.max(8, box!.h) } });
      const chroma = await page.evaluate(async (b64) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const x = c.getContext('2d')!;
        x.drawImage(img, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height).data;
        let s = 0;
        for (let i = 0; i < d.length; i += 4)
          s += Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
        return s / (d.length / 4);
      }, png.toString('base64'));
      expect(
        Math.abs(chroma - PAPER_CHROMA),
        `${r.id}: mean chroma under the footer ${chroma.toFixed(2)}`,
      ).toBeLessThanOrEqual(2);
      const mem = ((await stats(page)).memory ?? null) as Record<string, number> | null;
      if (mem) {
        const total = Number(mem.total) || 0; // (bytes: the views and the figure layers)
        expect(total / 2 ** 20, `${r.id}: engine memory MB`).toBeLessThan(40);
      }
    });
  }
});

/** The scroll's flags and visited (elements.ts): all of them off is Spring ink without the scroll (window.__elOff). */
const SCROLL_FLAGS = ['cameraTravels', 'air', 'visited'];
/** How many pixels differ by more than `t` (any channel) between two same-size screenshots, decoded in the page. */
async function diffOver(page: Page, a: Buffer, b: Buffer, t: number) {
  return page.evaluate(
    async ([x, y, th]) => {
      const load = async (b64: string) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const g = c.getContext('2d')!;
        g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, c.width, c.height).data;
      };
      const [A, B] = await Promise.all([load(x as string), load(y as string)]);
      if (A.length !== B.length) return 1;
      let n = 0;
      for (let k = 0; k < A.length; k += 4)
        if (
          Math.max(Math.abs(A[k] - B[k]), Math.abs(A[k + 1] - B[k + 1]), Math.abs(A[k + 2] - B[k + 2])) > (th as number)
        )
          n++;
      return n / (A.length / 4);
    },
    [a.toString('base64'), b.toString('base64'), t] as const,
  );
}
/** Pinned at y with the air settled and every figure layer in: the frame a reader stops on. */
async function restAt(page: Page, y: number) {
  await jumpTo(page, y);
  await page.waitForFunction(
    () => {
      const s = (window as unknown as { __ink: { stats(): S } }).__ink.stats();
      return !s.air?.live && !Object.values(s.figures || {}).includes('pending') && !s.pending;
    },
    undefined,
    { timeout: 10_000, polling: 50 },
  );
  await page.waitForTimeout(400);
}

test.describe("scroll: Work keeps its approved poses (1440, the scroll's flags on vs off)", () => {
  // (the footer's veils, which come with cameraTravels, are not the reading column: counted as one, they would put
  // Work's curtain at 1412 px at 1440 and hide the river town and its willow for most of the read)
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  test('work', async ({ browser }) => {
    const shots: Buffer[][] = [];
    for (const off of [[], SCROLL_FLAGS]) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      await page.addInitScript((o) => ((window as unknown as { __elOff: string[] }).__elOff = o), off);
      await page.goto(MAP.find((x) => x.id === 'work')!.path);
      await settle(page);
      if (!(await hardware(page))) {
        await ctx.close();
        test.skip(true, 'the stage runs on a hardware GPU only');
      }
      const H = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      const row: Buffer[] = [];
      for (const f of [0.3, 0.45, 0.6, 0.75]) {
        await restAt(page, Math.round(H * f));
        row.push(await page.screenshot());
      }
      shots.push(row);
      await ctx.close();
    }
    for (let i = 0; i < 4; i++) {
      const page = await browser.newPage();
      const d = await diffOver(page, shots[0][i], shots[1][i], 8);
      await page.close();
      expect(d, `work stop ${i}: share of pixels off by more than 8/255`).toBeLessThan(0.005);
    }
  });
});

test.describe('scroll: no straight seam in the sky at the end of a living page (1440)', () => {
  // (a far layer's edge in the sky would read as a vertical seam)
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  for (const r of MAP) {
    test(r.id, async ({ page }) => {
      await page.goto(r.path);
      await settle(page);
      test.skip(!(await hardware(page)), 'the stage runs on a hardware GPU only');
      await restAt(page, await page.evaluate(() => document.documentElement.scrollHeight));
      const x0 = Math.max(720, Math.round(((await stats(page)).stage?.colR ?? 720) + 60));
      await page.addStyleTag({ content: '*{color:transparent!important;text-decoration-color:transparent!important}' });
      await page.waitForTimeout(150);
      const png = await page.screenshot();
      const worst = await page.evaluate(
        async ([b64, X0]) => {
          const img = new Image();
          img.src = `data:image/png;base64,${b64}`;
          await img.decode();
          const W = img.width,
            H = img.height;
          const c = document.createElement('canvas');
          c.width = W;
          c.height = H;
          const g = c.getContext('2d')!;
          g.drawImage(img, 0, 0);
          const d = g.getImageData(0, 0, W, H).data;
          // luminance and warmth (max(g, r) - b), each smoothed over 9 rows (the paper's grain)
          const L = new Float32Array(W * H),
            C = new Float32Array(W * H);
          for (let i = 0; i < W * H; i++) {
            L[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
            C[i] = Math.max(d[i * 4 + 1], d[i * 4]) - d[i * 4 + 2];
          }
          const vb = (A: Float32Array) => {
            const o = new Float32Array(W * H);
            for (let x = 0; x < W; x++)
              for (let y = 0; y < H; y++) {
                let s = 0,
                  n = 0;
                for (let k = Math.max(0, y - 4); k <= Math.min(H - 1, y + 4); k++) {
                  s += A[k * W + x];
                  n++;
                }
                o[y * W + x] = s / n;
              }
            return o;
          };
          const s = vb(L),
            w = vb(C);
          const m = (y: number, a: number, b: number) => {
            let t = 0;
            for (let x = a; x <= b; x++) t += s[y * W + x];
            return t / (b - a + 1);
          };
          // a straight seam: a step of >= 3/255 between the 5 px either side of x, the same sign down a run, smooth
          // pale cool air on both sides (a glyph, a reed, a strand or a painted flank is not smooth on both sides)
          let best = 0;
          for (let x = Math.max(12, X0 as number); x < W - 13; x++)
            for (const sg of [1, -1]) {
              let run = 0,
                gap = 0;
              for (let y = 0; y < H; y++) {
                const l = m(y, x - 5, x - 1),
                  r = m(y, x + 2, x + 6);
                const ok =
                  sg * (r - l) >= 3 &&
                  Math.abs(m(y, x - 11, x - 7) - l) < 1.8 &&
                  Math.abs(m(y, x + 8, x + 12) - r) < 1.8 &&
                  l >= 200 &&
                  r >= 200 &&
                  w[y * W + x - 3] <= 4 &&
                  w[y * W + x + 4] <= 4;
                if (ok) {
                  gap = 0;
                  run++;
                  best = Math.max(best, run);
                } else if (++gap > 3) run = 0;
                else if (run) run++;
              }
            }
          return best;
        },
        [png.toString('base64'), x0] as const,
      );
      expect(worst, `${r.id}: the longest straight seam in the sky (px)`).toBeLessThan(40);
    });
  }
});

test.describe('scroll: Home stays in its memory budget at DPR 2', () => {
  // (stats().memory.total, the engine's views and figure layers in bytes; with the scroll's flags off: 42.4 MB)
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  test('home', async ({ page }) => {
    await page.goto(MAP.find((x) => x.id === 'home')!.path);
    await settle(page);
    test.skip(!(await hardware(page)), 'the stage runs on a hardware GPU only');
    for (const f of [0, 0.5, 1]) {
      const H = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      await restAt(page, Math.round(H * f));
      const mem = ((await stats(page)).memory ?? null) as Record<string, number> | null;
      if (mem) expect((Number(mem.total) || 0) / 2 ** 20, `home at ${f}: engine memory MB at DPR 2`).toBeLessThan(45);
    }
  });
});
