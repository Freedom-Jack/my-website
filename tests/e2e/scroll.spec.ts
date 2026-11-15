import { expect, test, type Page } from '@playwright/test';
import { isSoftware, ROUTES, settle } from './support/pages';

/**
 * The scroll (elements.ts unroll; the vanguard round, 05-synthesis.md "The scroll motion"): the hard rules on the
 * rendered pages.
 *   - reduced motion and "Still the landscape": no scroll-linked motion. A frame taken while the page is still scrolling
 *     equals the rest frame at the same place (the painting may switch between rest states, never animate), the stage's
 *     pose is only ever a rest state (0 or 1: the unroll is one cut, to the end pose once the ending is on screen), and
 *     the air is off. (On a load the live probe keeps such a page on its still and fetches no engine, which
 *     probe.spec.ts asserts; the engine's own quiet mode is what a visitor gets when Still is switched on while the
 *     painting is live, so these tests ask the QA build for the engine anyway: window.__inkLive.)
 *   - after a scroll the loop sleeps: nothing scroll-driven keeps asking for frames (the ambient pace at most);
 *   - smooth and present-only: rAF intervals while wheel-scrolling top to bottom, and 0 scenes painted meanwhile
 *     (hardware GPU only: a software rasteriser keeps the plain strips and is not timed here);
 *   - the unroll on wide screens: the slide is linear with the page's scroll, from the hero (0) to the page's travel
 *     (1), the hero at rest is the approved frame whatever the flag, and the page change's pan starts where the slide
 *     left the painting and never steps back west;
 *   - below 1200 px the strip's painting rides with its box and drifts west as it leaves; the closing's comes in from
 *     the east and stands at rest at the page's end (no lag, no parting, no mist);
 *   - the stage on Writing, Résumé and Contact: the tail's lines sit on clean paper at the page's end, no straight seam
 *     stands in the sky at any page's end, and the engine's memory stays in budget.
 * They read the QA build's window.__ink (NEXT_PUBLIC_INK_QA=1), like the other e2e probes.
 */
type S = Record<string, any>;
const MAP = ROUTES.filter((r) => ['home', 'work', 'writing', 'resume', 'contact'].includes(r.id));
const stats = (page: Page) => page.evaluate(() => (window as unknown as { __ink: { stats(): S } }).__ink.stats());
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
/** How many pixels differ (any channel by more than 2) between two same-size screenshots, decoded in the page, and
 *  the box they lie in (device px: x0, y0, x1, y1), with the shot's width. Pixels inside `mask` (CSS viewport rects
 *  [left, top, right, bottom]; the shots were clipped from `top` CSS px down) are not compared: the words' own raster
 *  is not the painting's. */
async function diffPx(page: Page, a: Buffer, b: Buffer, mask: { rects: number[][]; top: number } | null = null) {
  return page.evaluate(
    async ([x, y, m]) => {
      const load = async (b64: string) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const g = c.getContext('2d')!;
        g.drawImage(img, 0, 0);
        return { d: g.getImageData(0, 0, c.width, c.height).data, w: c.width };
      };
      const [A, B] = await Promise.all([load(x as string), load(y as string)]);
      const w = A.w;
      if (A.d.length !== B.d.length) return { n: -1, box: [0, 0, 0, 0] as [number, number, number, number], w };
      const dpr = w / innerWidth;
      const M = m as { rects: number[][]; top: number } | null;
      const masked = (px: number, py: number) => {
        if (!M) return false;
        const cx = px / dpr;
        const cy = py / dpr + M.top;
        for (const r of M.rects) if (cx >= r[0] && cx <= r[2] && cy >= r[1] && cy <= r[3]) return true;
        return false;
      };
      let n = 0;
      const box: [number, number, number, number] = [w, 1e9, -1, -1];
      for (let k = 0; k < A.d.length; k += 4)
        if (
          Math.max(Math.abs(A.d[k] - B.d[k]), Math.abs(A.d[k + 1] - B.d[k + 1]), Math.abs(A.d[k + 2] - B.d[k + 2])) > 2
        ) {
          const p = k / 4;
          const px = p % w;
          const py = Math.floor(p / w);
          if (masked(px, py)) continue;
          n++;
          box[0] = Math.min(box[0], px);
          box[1] = Math.min(box[1], py);
          box[2] = Math.max(box[2], px);
          box[3] = Math.max(box[3], py);
        }
      return { n, box, w };
    },
    [a.toString('base64'), b.toString('base64'), mask] as const,
  );
}
/** The words' line boxes and the page's own images (the portrait; never the painting's: the strip's stills and the
 *  windows' sit inside [data-landscape] boxes and stay judged), CSS viewport px, 2 px wide: what Chrome may re-raster
 *  on its own after a scroll (a glyph of the variable reading face at its exact sub-pixel phase, the multiply-blended
 *  portrait's edge) and the painting's judge leaves out. */
const textRects = (page: Page) =>
  page.evaluate(() => {
    const out: number[][] = [];
    const push = (r: DOMRect) => {
      if (r.width > 0 && r.height > 0) out.push([r.left - 2, r.top - 2, r.right + 2, r.bottom + 2]);
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) {
      if (!n.textContent || !n.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) push(r);
    }
    for (const img of document.querySelectorAll<HTMLImageElement>('img'))
      if (!img.closest('[data-landscape]')) push(img.getBoundingClientRect());
    return out;
  });
/** What the engine did, read before and after a pair of shots: its presents, scenes and window paints, the figure
 *  layers that became ready (the QA marks), the fonts' state and the window stills loaded. A failure names the delta,
 *  so a change between two shots is told apart: an engine frame, a late layer, or none of these (the page's raster). */
const engineTrace = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as { __ink: { stats(): S } }).__ink.stats();
    return {
      presents: Number(s.presents) || 0,
      scenes: Number(s.scenes) || 0,
      paints: Number(s.glimpses?.paints ?? 0) || 0,
      ready: performance.getEntriesByName('ink:figure:ready').length,
      pending: Object.values(s.figures || {}).filter((v) => v === 'pending').length,
      fonts: document.fonts?.status ?? 'n/a',
      stills: [...document.querySelectorAll<HTMLImageElement>('[data-landscape="glimpse"] img')].filter(
        (i) => !!i.getAttribute('src') && i.complete,
      ).length,
    };
  });

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
            // (the two screenshots must be the same frame, judged on a real GPU: a software rasteriser paints so
            // slowly that no frame finishes within the test's time)
            test.skip(await isSoftware(page), 'the painting is judged on a hardware GPU');
            if (quiet === 'reduced motion') await page.emulateMedia({ reducedMotion: 'reduce' });
            else await page.addInitScript(() => localStorage.setItem('ink:still', '1'));
            // (the engine's quiet mode is under test, not the probe's refusal: QA builds mount on __inkLive)
            await page.addInitScript(() => {
              (window as unknown as { __inkLive?: boolean }).__inkLive = true;
            });
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
                // (the unroll is one cut: the hero pose until the ending is within 0.6 viewports, then the end pose)
                if (s.stage.unroll) {
                  const want = await page.evaluate(() =>
                    scrollY >= document.documentElement.scrollHeight - innerHeight - innerHeight * 0.6 ? 1 : 0,
                  );
                  expect(s.stage.unroll.slide, `${r.id} ${f}: the unroll's slide is a rest pose`).toBe(want);
                }
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
              // (a window's still within reach of this scroll is loading (R5: it is fetched only once the window comes
              // within 60 % of a viewport, features/landscape/glimpse-stills.ts): its arrival is one change, not the
              // painting moving; every still inside that margin is waited for, source set and loaded, as the figure
              // layers are)
              await page
                .waitForFunction(
                  () =>
                    [...document.querySelectorAll<HTMLImageElement>('[data-landscape="glimpse"] img[data-src]')]
                      .filter((i) => {
                        const b = i.getBoundingClientRect();
                        return b.bottom > -innerHeight * 0.6 && b.top < innerHeight * 1.6;
                      })
                      .every((i) => !!i.getAttribute('src') && i.complete),
                  undefined,
                  { timeout: 8000, polling: 50 },
                )
                .catch(() => {});
              // (and the engine's own frame after those arrivals: a layer or a still that has just landed is composited
              // on the loop's next frame, which at 2 workers has fallen between the two shots (a hundred pixels of
              // figures); the loop is let go quiet first: no present, scene or window paint across a quarter second)
              await page
                .waitForFunction(
                  () =>
                    new Promise<boolean>((r) => {
                      const read = () => {
                        const s = (window as unknown as { __ink: { stats(): S } }).__ink.stats();
                        return `${s.presents}|${s.scenes}|${s.glimpses?.paints ?? 0}`;
                      };
                      const was = read();
                      setTimeout(() => r(read() === was), 250);
                    }),
                  undefined,
                  { timeout: 8000, polling: 50 },
                )
                .catch(() => {});
              // (the frame below the site header's band: the sticky header's own slide belongs to the interface, not
              // the painting, and "Still the landscape" does not govern it)
              const clip = await page.evaluate(() => {
                const h = document.querySelector('.site-header')?.getBoundingClientRect();
                const top = Math.min(innerHeight - 8, Math.max(0, Math.ceil((h?.bottom ?? 0) + 2), 72));
                return { x: 0, y: top, width: innerWidth, height: innerHeight - top };
              });
              // (a settled frame first: Chrome's first raster after a scroll can redraw a glyph or two of the variable
              // reading face at its exact sub-pixel offset, and the multiply-blended portrait's edge with it; the
              // next frames are byte-identical, and it is the painting that is judged here, not the text's raster)
              await page.screenshot({ clip });
              await page.waitForTimeout(350);
              // (the words' line boxes and the page's images are left out of the comparison: Chrome re-rasters them on
              // its own a moment after a scroll ends, a glyph or a block of lines at another sub-pixel phase (~150
              // device pixels of one "u" on Home at 390; 125 across a column of the Résumé's lines at 768), the engine
              // having drawn no frame meanwhile. The painting lies outside them, dissolved into their paper under
              // them; a painting that moved with the scroll changes pixels across the frame. What the engine did
              // between the shots is read too, so a failure names it.)
              const mask = { rects: await textRects(page), top: clip.y };
              const e0 = await engineTrace(page);
              const a = await page.screenshot({ clip });
              await page.waitForTimeout(350);
              const b = await page.screenshot({ clip });
              const e1 = await engineTrace(page);
              const d = await diffPx(page, a, b, mask);
              const did =
                `between the shots the engine presented ${e1.presents - e0.presents} frames, painted ` +
                `${e1.scenes - e0.scenes} scenes and ${e1.paints - e0.paints} windows, ${e1.ready - e0.ready} layers ` +
                `became ready (${e1.pending} pending), fonts ${e0.fonts} → ${e1.fonts}, window stills loaded ` +
                `${e0.stills} → ${e1.stills}`;
              // (every pair's reading is kept in the report, pass or fail: a run's annotations say how often anything
              // happened between two shots at all)
              test.info().annotations.push({ type: 'quiet-trace', description: `${r.id} ${f}: ${d.n} px; ${did}` });
              expect(
                d.n,
                `${r.id} ${f}: the painting moved after the scroll (${d.n} px changed outside the words, in [${d.box.join(', ')}]; ${did})`,
              ).toBeLessThan(64);
            }
          });
        }
      });
    }
  });
}

test.describe('scroll: after a scroll the loop sleeps (nothing scroll-driven keeps asking for frames)', () => {
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  for (const r of MAP.filter((x) => ['home', 'work', 'contact'].includes(x.id))) {
    test(r.id, async ({ page }) => {
      test.skip(await isSoftware(page), 'judged on a hardware GPU only');
      await page.goto(r.path);
      await settle(page);
      await page.mouse.move(720, 450);
      for (let i = 0; i < 8; i++) {
        await page.mouse.wheel(0, 120);
        await page.waitForTimeout(40);
      }
      // (the air, a second scroll motion, is off: elements.ts)
      const s = await stats(page);
      expect(s.air?.on ?? false, `${r.id}: the air is off`).toBe(false);
      await page.waitForTimeout(400);
      const f0 = (await stats(page)).frames as number;
      await page.waitForTimeout(1000);
      const f1 = (await stats(page)).frames as number;
      expect(f1 - f0, `${r.id}: frames in the second after the scroll`).toBeLessThanOrEqual(20); // (the ambient pace, <= 15 fps, not the display's 60)
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
          test.skip(await isSoftware(page), 'timed on a hardware GPU only');
          await page.goto(r.path);
          await settle(page);
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

test.describe('scroll: below 1200 px the strip drifts west as it leaves, the closing comes in from the east', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  for (const r of MAP) {
    test(r.id, async ({ page }) => {
      test.skip(await isSoftware(page), 'the drift runs on a hardware GPU only');
      await page.goto(r.path);
      await settle(page);
      const s0 = await stats(page);
      const h = s0.windows.strip.height as number;
      expect(s0.windows.strip.drift, `${r.id}: no drift at the top`).toBe(0);
      await jumpTo(page, Math.round(h * 0.6));
      await settle(page);
      const s1 = await stats(page);
      // (two views, the back filling in behind the front as it drifts, so no edge of the painting shows; no lag, no mist)
      expect(s1.windows.strip.parted, `${r.id}: the strip's two views`).toBe(true);
      expect(s1.windows.strip.drift, `${r.id}: the strip's painting has drifted west`).toBeLessThan(-0.02);
      expect(s1.windows.strip.drift, `${r.id}: ...by at most 9 % of its width`).toBeGreaterThanOrEqual(-0.09);
      expect(s1.windows.strip.sink, `${r.id}: the painting rides with its box (no lag)`).toEqual([0, 0]);
      expect(s1.windows.strip.mist, `${r.id}: no mist between the views`).toBe(0);
      await jumpTo(page, 'end');
      await settle(page);
      const s2 = await stats(page);
      expect(s2.windows.closing.mist, `${r.id}: no mist over the closing at the page's end`).toBe(0);
      expect(s2.windows.closing.sink, `${r.id}: the closing at rest`).toEqual([0, 0]);
      expect(s2.windows.closing.drift, `${r.id}: the closing's painting has arrived (no drift left)`).toBe(0);
    });
  }
});

/** The stage at the end of Writing, Résumé and Contact: the tail's lines (the colophon, the stamp, Still and the
 *  names) sit on paper. */
const PAPER_CHROMA = 3;
test.describe('scroll: the footer on clean paper at the end of Writing, the Résumé and Contact (1440)', () => {
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  for (const r of MAP.filter((x) => ['writing', 'resume', 'contact'].includes(x.id))) {
    test(r.id, async ({ page }) => {
      // (reads the painting's own pixels behind the tail: judged on a real GPU, DESIGN §13)
      test.skip(await isSoftware(page), 'the painting is judged on a hardware GPU');
      await page.goto(r.path);
      await settle(page);
      await jumpTo(page, 'end');
      await settle(page);
      const box = await page.evaluate(() => {
        const a = document.querySelector('.site-footer .tail__colophon')?.getBoundingClientRect();
        const b = document.querySelector('.site-footer .tail__base')?.getBoundingClientRect();
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
        const total = Number(mem.total) || 0; // (bytes: the views and the figure layers; MB = 10^6, as in 01-budgets.md)
        expect(total / 1e6, `${r.id}: engine memory MB`).toBeLessThan(40);
      }
    });
  }
});

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
/** The share of a screenshot's pixels that sit on an edge: a luminance step of more than `t` levels to the pixel
 *  ~1.5 CSS px right or below (the paper's grain is a fine noise of a few levels; a drawn thing, even the terraces'
 *  pale washes, has edges; mist and open water have none). Decoded in the page. */
async function edgeShare(page: Page, png: Buffer, t: number) {
  return page.evaluate(
    async ([b64, th]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64 as string}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d')!;
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const W = c.width;
      const H = c.height;
      const step = Math.max(2, Math.round(1.5 * devicePixelRatio));
      const L = (i: number) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      let n = 0;
      let e = 0;
      for (let y = 0; y < H - step; y++)
        for (let x = 0; x < W - step; x++) {
          const i = (y * W + x) * 4;
          const l = L(i);
          n++;
          if (Math.abs(l - L(i + step * 4)) > (th as number) || Math.abs(l - L(i + step * W * 4)) > (th as number)) e++;
        }
      return n ? e / n : 0;
    },
    [png.toString('base64'), t] as const,
  );
}
/** The margin band right of the standing curtain, CSS px: from 100 px past the curtain's edge (its feather) to the
 *  viewport's right edge, from under the header down to 0.64 of the viewport's height: the same band at every stop
 *  (the floor was calibrated on the end pose's band above the tail, which begins at 0.72; below that line the margin
 *  is the river's water and the paper by the grammar, at a mid-page stop as at the end, and a band run to the
 *  viewport's bottom mid-page diluted the Résumé's share below the floor). */
const marginBand = (page: Page, curtX: number) =>
  page.evaluate((curt) => {
    const hb = document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 60;
    const ft = document.querySelector('.site-footer')?.getBoundingClientRect();
    const bottom = Math.min(innerHeight * 0.64, ft && ft.top > 0 ? ft.top - 8 : innerHeight);
    const x = Math.round(curt + 100);
    const y = Math.round(hb + 8);
    return { x, y, width: innerWidth - 8 - x, height: Math.round(bottom - y) };
  }, curtX);
/** Pinned at y with every figure layer in and nothing pending: the frame a reader stops on. */
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

/** Every page that stands in the painting on a wide screen (the five places, a case inside the town, the note on the
 *  lake): the unroll's rules hold on each. */
const LIVING = ROUTES.filter((r) => ['home', 'work', 'case', 'writing', 'note', 'resume', 'contact'].includes(r.id));

test.describe('scroll: the unroll on wide screens (1440)', () => {
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  for (const r of LIVING) {
    test(`${r.id}: the slide is linear with the scroll, present-only, and the reach shows a drawn place`, async ({
      page,
    }) => {
      test.skip(await isSoftware(page), 'the stage runs on a hardware GPU only');
      await page.goto(r.path);
      await settle(page);
      const H = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      const s0 = await stats(page);
      expect(s0.stage?.on, `${r.id}: the stage`).toBe(true);
      expect(s0.stage.unroll, `${r.id}: the unroll`).not.toBeNull();
      // the page's travel (CSS px, west) is bounded: never more than 0.75 px per px of scroll, never a whole stretch
      expect(-s0.stage.unroll.px).toBeGreaterThan(100);
      expect(-s0.stage.unroll.px).toBeLessThanOrEqual(Math.min(0.75 * H, 1440) + 1);
      // the layers are painted wider than the viewport by the travel and a margin: no cut edge can come into view
      expect(s0.stage.unroll.ext).toBeGreaterThanOrEqual(-s0.stage.unroll.px + 60);
      const scenes0 = s0.scenes as number;
      for (const f of [0, 0.25, 0.5, 0.75, 1]) {
        await restAt(page, Math.round(H * f));
        const s = await stats(page);
        expect(Math.abs(s.stage.unroll.slide - f), `${r.id} at ${f}: the slide follows the scroll`).toBeLessThan(0.02);
        // the standing curtain stands once the reading has started, and never at the hero
        expect(s.stage.unroll.curtain?.[1] ?? 0, `${r.id} at ${f}: the curtain`).toBe(f === 0 ? 0 : 1);
        // no lift, no descent, no stairs: the unroll is the one motion
        for (const k of ['prog', 'desc', 'stair', 'cloud'] as const) expect(s.stage[k] ?? 0, `${r.id}: ${k}`).toBe(0);
        // the reach is composed, never blank: from the page's middle to its end the margin right of the curtain shows
        // a drawn place (the place's own last named thing held there, or the next place arrived), judged as the share
        // of the band's pixels on an edge of more than 16 levels (05-synthesis.md: "the unroll always shows a drawn
        // place (no cut edge, no blue stain)". The floor, 0.5 %, was set on the build before the hold: Work's end
        // margin, the lake's open water and mist, measured 0.003 % and its half 0.38 %, the Résumé's end 0.04 %;
        // with the hold, the Résumé's end, the right hill's pale washes, is the thinnest at 0.65 %, Home's end, the
        // town's west end, 8.6 %)
        if (f >= 0.5) {
          const band = await marginBand(page, s.stage.unroll.curtain?.[0] ?? 872);
          expect(band.height, `${r.id} at ${f}: the margin band above the footer`).toBeGreaterThan(160);
          const share = await edgeShare(page, await page.screenshot({ clip: band }), 16);
          expect(share, `${r.id} at ${f}: the margin's drawn share (edges)`).toBeGreaterThan(0.005);
        }
      }
      expect((await stats(page)).scenes - scenes0, `${r.id}: scenes painted while the page was read`).toBe(0);
    });
  }
  test('the hero at rest is the approved frame (the unroll on = off)', async ({ browser }) => {
    const probe = await browser.newContext();
    const probePage = await probe.newPage();
    const sw = await isSoftware(probePage);
    await probe.close();
    test.skip(sw, 'the stage runs on a hardware GPU only');
    const shots: Buffer[] = [];
    for (const off of [[], ['unroll']]) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      await page.addInitScript((o) => ((window as unknown as { __elOff: string[] }).__elOff = o), off);
      await page.goto(MAP.find((x) => x.id === 'home')!.path);
      await settle(page);
      await restAt(page, 0);
      shots.push(await page.screenshot());
      await ctx.close();
    }
    const page = await browser.newPage();
    // (the layers are painted wider and cropped differently under the unroll, so their resampling into the viewport
    // differs by a sub-pixel phase at ink edges: a few per cent of pixels by a few levels, a few by more. A change of
    // the composition (a figure gone, a mountain moved) moves whole regions by far more: judged over 24 levels)
    const d = await diffOver(page, shots[0], shots[1], 24);
    await page.close();
    expect(d, 'home at rest: share of pixels off by more than 24/255 with the unroll on against off').toBeLessThan(
      0.003,
    );
  });
  test('the page change starts where the slide left the painting and never steps back (Home read to its end, then Work)', async ({
    page,
  }) => {
    test.skip(await isSoftware(page), 'the stage runs on a hardware GPU only');
    await page.goto(MAP.find((x) => x.id === 'home')!.path);
    await settle(page);
    await restAt(page, await page.evaluate(() => document.documentElement.scrollHeight));
    const before = await stats(page);
    expect(before.stage.unroll.slide).toBe(1);
    // the ending's link, clicked where the reader stands; the pan's frames sampled: the camera's effective world x (the
    // framing's left plus the slide still standing) must never move west, and ends on Work's hero
    const samples = await page.evaluate(async () => {
      const a = document.querySelector<HTMLAnchorElement>('main .next a[href]');
      const S: { t: number; eff: number | null; path: string; stretch: number }[] = [];
      const t0 = performance.now();
      a!.click();
      await new Promise<void>((res) => {
        const step = () => {
          const s = (window as unknown as { __ink: { stats(): S } }).__ink.stats();
          const u = s.stage?.unroll,
            fr = s.stage?.framing;
          S.push({
            t: Math.round(performance.now() - t0),
            eff: fr && u ? fr.worldLeft + (-u.px * u.slide) / fr.scale : null,
            path: location.pathname,
            stretch: Number(s.stretch),
          });
          if (performance.now() - t0 < 1500) requestAnimationFrame(step);
          else res();
        };
        requestAnimationFrame(step);
      });
      return S;
    });
    const effs = samples.map((x) => x.eff).filter((v): v is number => v !== null);
    expect(effs.length).toBeGreaterThan(20);
    let back = 0;
    for (let i = 1; i < effs.length; i++) back = Math.max(back, effs[i - 1]! - effs[i]!);
    expect(back, 'the largest step west during the pan (stretches)').toBeLessThan(0.01);
    expect(effs[0]!, 'the pan starts from the slide').toBeGreaterThan(0.35);
    const last = samples[samples.length - 1]!;
    expect(last.path).toBe('/work/');
    expect(last.stretch).toBe(1);
    await expect.poll(() => page.evaluate(() => (window as any).__ink.stats().panning), { timeout: 5000 }).toBe(false);
  });
});

test.describe('scroll: no straight seam in the sky at the end of a living page (1440)', () => {
  // (a far layer's edge in the sky would read as a vertical seam)
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  for (const r of MAP) {
    test(r.id, async ({ page }) => {
      test.skip(await isSoftware(page), 'the stage runs on a hardware GPU only');
      await page.goto(r.path);
      await settle(page);
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
  test('home, at rest down the page', async ({ page }) => {
    test.skip(await isSoftware(page), 'the stage runs on a hardware GPU only');
    await page.goto(MAP.find((x) => x.id === 'home')!.path);
    await settle(page);
    for (const f of [0, 0.5, 1]) {
      const H = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      await restAt(page, Math.round(H * f));
      const mem = ((await stats(page)).memory ?? null) as Record<string, number> | null;
      if (mem) expect((Number(mem.total) || 0) / 1e6, `home at ${f}: engine memory MB at DPR 2`).toBeLessThan(45);
    }
  });
  test('home, read to the end with the wheel and the pointer over the page, 5 s on (three runs)', async ({
    page,
    context,
  }) => {
    // (a real read: the pointer parked mid-page crosses the page's links on the way down, and the navigation's intent
    // prefetch asks the engine for their places' layers, which land in whatever order the worker finishes them; the
    // trim must still hold the gate 5 s later. The vanguard round's review found 46.4 MB in two runs of five: a layer
    // let go while its upload waited for a quiet moment was uploaded anyway, a leak of one layer.)
    test.setTimeout(240_000);
    test.skip(await isSoftware(page), 'the stage runs on a hardware GPU only');
    const totals: number[] = [];
    for (let run = 0; run < 3; run++) {
      const p = run === 0 ? page : await context.newPage();
      await p.goto(MAP.find((x) => x.id === 'home')!.path);
      await settle(p);
      const H = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      await p.mouse.move(720, 450);
      for (let y = 0; y < H; y += 100) {
        await p.mouse.wheel(0, 100);
        await p.waitForTimeout(16);
      }
      await p.waitForTimeout(5000);
      const mem = ((await stats(p)).memory ?? null) as Record<string, number> | null;
      totals.push(mem ? (Number(mem.total) || 0) / 1e6 : 0);
      if (p !== page) await p.close();
    }
    for (const t of totals)
      expect(
        t,
        `home after a pointer read, 5 s on: engine memory MB at DPR 2 (runs: ${totals.map((v) => v.toFixed(1)).join(', ')})`,
      ).toBeLessThan(45);
  });
});

test.describe("scroll: the camera's travel, the QA alternative (elements.ts cameraTravels), still runs", () => {
  // (the approved motion of round 5 stays switchable in QA builds until Jack has chosen between it and the unroll
  // (05-synthesis.md "The scroll motion"); nothing else exercises its paths (the lift, the parting, the stairs, the
  // crossing) now that the unroll is the production motion. One smoke test: hero, end, the page change. The loser goes
  // once he has chosen, and this test with it.)
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  test('home: the camera lifts as the page is read and the page change pans to Work', async ({ page }) => {
    test.skip(await isSoftware(page), 'the stage runs on a hardware GPU only');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      const w = window as unknown as { __elOff?: string[]; __elOn?: string[] };
      w.__elOff = ['unroll'];
      w.__elOn = ['cameraTravels'];
    });
    await page.goto(MAP.find((x) => x.id === 'home')!.path);
    await settle(page);
    const H = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const s0 = await stats(page);
    expect(s0.stage?.on, 'the stage').toBe(true);
    expect(s0.stage.unroll, 'the unroll is off').toBeNull();
    expect(s0.stage.prog ?? 0, 'the hero: the camera at rest').toBe(0);
    await restAt(page, Math.round(H * 0.5));
    const sm = await stats(page);
    expect(sm.stage.prog ?? 0, 'mid-page: the camera has lifted').toBeGreaterThan(0);
    await restAt(page, H);
    const link = page.locator('main .next a[href]').first();
    await expect(link).toBeVisible();
    await link.click();
    await expect.poll(() => page.evaluate(() => location.pathname), { timeout: 10_000 }).toBe('/work/');
    await expect
      .poll(() => page.evaluate(() => (window as any).__ink.stats().panning), { timeout: 10_000 })
      .toBe(false);
    const s1 = await stats(page);
    expect(Number(s1.stretch), 'the pan landed on Work').toBe(1);
    expect(errors, 'no page errors on the camera path').toEqual([]);
  });
});
