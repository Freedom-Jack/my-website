import type { Page } from '@playwright/test';

/** Every route the site serves, and what each must be. */
export const ROUTES = [
  { id: 'home', path: '/', title: 'Qijin (Jack) Xu · Lead AI/ML Architect', page: 'home' },
  { id: 'work', path: '/work/', title: 'Qijin (Jack) Xu · Work', page: 'work' },
  {
    id: 'case',
    path: '/work/rag-assistant/',
    title: 'Qijin (Jack) Xu · Enterprise RAG assistant for insurance support',
    page: 'case',
  },
  { id: 'resume', path: '/resume/', title: 'Qijin (Jack) Xu · Résumé', page: 'resume' },
  { id: 'contact', path: '/contact/', title: 'Qijin (Jack) Xu · Contact', page: 'contact' },
  { id: 'writing', path: '/writing/', title: 'Qijin (Jack) Xu · Writing', page: 'writing' },
  {
    id: 'note',
    path: '/writing/what-is-an-ai-agent/',
    title: 'Qijin (Jack) Xu · What is an AI agent?',
    page: 'article',
  },
  { id: '404', path: '/no-such-page/', title: 'Qijin (Jack) Xu · Page not found', page: 'not-found' },
] as const;

/** The viewports the budgets are set for (DESIGN §6): 1440 × 900, 1280 × 720, 390 × 844 at DPR 3. */
export const VIEWPORTS = {
  '1440': { width: 1440, height: 900, dpr: 1, mobile: false },
  '1280': { width: 1280, height: 720, dpr: 1, mobile: false },
  '390': { width: 390, height: 844, dpr: 3, mobile: true },
} as const;

/**
 * Wait until the painting has settled (the demo's cdp.SETTLE_JS on the QA build's window.__ink): no bloom, pan or
 * sweep, nothing pending, figure layers ready, the newest scene a full-quality one, the fonts loaded. Never a fixed
 * wait. Without a renderer (software-less CI machines may lack WebGL) the static page counts as settled.
 */
export async function settle(page: Page, timeout = 30_000) {
  await page.waitForFunction(
    () => {
      if (document.readyState !== 'complete') return false;
      if (document.fonts && document.fonts.status !== 'loaded') return false;
      if (document.documentElement.classList.contains('no-landscape')) return true;
      const L = (window as unknown as { __ink?: { stats(): Record<string, unknown> } }).__ink;
      if (!L) return performance.now() > 15_000;
      const s = L.stats() as Record<string, any>;
      if (!s || s.mode === 'static') return true;
      if (s.arriving || s.pending || s.sweeping || s.deferred) return false;
      if (Object.values(s.figures || {}).includes('pending')) return false;
      const w = s.windows || {};
      const anyVis = (w.strip && w.strip.visible) || (w.closing && w.closing.visible) || s.hzK > 0;
      if (anyVis && (!(s.fullAt > 0) || s.draftAt > s.fullAt || performance.now() - s.draftAt < 400)) return false;
      return true;
    },
    undefined,
    { timeout, polling: 250 },
  );
}
