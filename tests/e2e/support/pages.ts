import type { Page } from '@playwright/test';

/**
 * Every kind of page the site serves, and what each must be. `page` is its place on the scroll (<main data-page>, the
 * band's still for it: public/scenes/band/<page>-*.webp); `current` is the header's word marked "you are here".
 */
export const ROUTES = [
  { id: 'home', path: '/', title: 'Qijin (Jack) Xu · Lead AI/ML Architect', page: 'home', current: '/' },
  { id: 'work', path: '/work/', title: 'Qijin (Jack) Xu · Work', page: 'work', current: '/work/' },
  {
    id: 'case',
    path: '/work/rag-assistant/',
    title: 'Qijin (Jack) Xu · Enterprise RAG assistant for insurance support',
    page: 'case',
    current: '/work/',
  },
  { id: 'writing', path: '/writing/', title: 'Qijin (Jack) Xu · Writing', page: 'writing', current: '/writing/' },
  {
    id: 'note',
    path: '/writing/what-is-an-ai-agent/',
    title: 'Qijin (Jack) Xu · What is an AI agent?',
    page: 'article',
    current: '/writing/',
  },
  { id: 'resume', path: '/resume/', title: 'Qijin (Jack) Xu · Résumé', page: 'resume', current: '/resume/' },
  { id: 'contact', path: '/contact/', title: 'Qijin (Jack) Xu · Contact', page: 'contact', current: '/contact/' },
  { id: '404', path: '/no-such-page/', title: 'Qijin (Jack) Xu · Page not found', page: 'not-found', current: null },
] as const;
export type Route = (typeof ROUTES)[number];

/** A phone: 390 × 844 at DPR 3, touch (test.use or newContext options). */
export const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
/** The narrowest phone the site is laid out for: 360 × 800 at DPR 3, touch. */
export const SMALL_PHONE = {
  viewport: { width: 360, height: 740 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
};
/** A tablet, upright. */
export const TABLET = { viewport: { width: 768, height: 1024 } };

/** The engine's shaders open with this line, and nothing else on the site holds it: a script whose body has it is the
 *  engine's chunk (band.spec.ts proves it on a GPU, so the mark cannot go stale unseen). */
export const ENGINE_MARK = '#version 300 es';

/**
 * Whether this browser paints with a software rasteriser (SwiftShader, llvmpipe...), probed on the blank page before
 * the app loads. The site's own probe keeps such a browser on the band's still (features/landscape/probe.ts), so a
 * test about the live engine skips here; every other test must pass both ways.
 */
export async function isSoftware(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as WebGLRenderingContext | null;
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
      return /swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen|warp/i.test(name);
    } catch {
      return true;
    }
  });
}

/** Wait until the fonts are loaded and the document complete: for the tests that read the page's words and boxes. */
export async function fontsReady(page: Page, timeout = 30_000) {
  await page.waitForFunction(
    () => document.readyState === 'complete' && (!document.fonts || document.fonts.status === 'loaded'),
    undefined,
    { timeout, polling: 100 },
  );
}

/**
 * Wait until the page and its painting have settled: the document complete, the fonts loaded, the probe decided
 * (html[data-live] is "still" or "on") and, where the engine is live (the QA build's window.__ink), nothing arriving,
 * pending or panning. Never a fixed wait.
 */
export async function settle(page: Page, timeout = 30_000) {
  await page.waitForFunction(
    () => {
      if (document.readyState !== 'complete') return false;
      if (document.fonts && document.fonts.status !== 'loaded') return false;
      const live = document.documentElement.getAttribute('data-live');
      if (live === 'still') return true;
      if (live !== 'on') return false;
      const L = (window as unknown as { __ink?: { stats(): Record<string, unknown> } }).__ink;
      if (!L) return true;
      const s = L.stats();
      return !s.arriving && !s.pending && !s.panning && !s.sweeping;
    },
    undefined,
    { timeout, polling: 100 },
  );
}

/**
 * What goes wrong on a page while it is watched: console errors, uncaught errors, requests that failed or answered
 * 400 and up. The 404 page's own document answers 404 (and the browser logs it); a request the browser itself called
 * off (a page change, a still no longer needed) is not a failure.
 */
export function watch(page: Page, { allow404 = false }: { allow404?: boolean } = {}) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() !== 'error' || /GPU stall due to ReadPixels/.test(m.text())) return;
    if (allow404 && /status of 404/.test(m.text())) return;
    errors.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`uncaught: ${String(e)}`));
  page.on('requestfailed', (r) => {
    const why = r.failure()?.errorText ?? '';
    if (/ERR_ABORTED/.test(why)) return;
    errors.push(`failed: ${r.url()} ${why}`);
  });
  page.on('response', (r) => {
    if (r.status() < 400) return;
    if (allow404 && r.status() === 404 && r.request().resourceType() === 'document') return;
    errors.push(`${r.status()}: ${r.url()}`);
  });
  return errors;
}

/** Every request the page makes from now on. */
export function requests(page: Page) {
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  return urls;
}

/** Scroll the window at once (no smooth scroll), and let the compositor show it. */
export async function scrollTo(page: Page, y: number) {
  await page.evaluate(async (top) => {
    window.scrollTo({ top, behavior: 'instant' });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, y);
}
