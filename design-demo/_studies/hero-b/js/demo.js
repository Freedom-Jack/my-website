/**
 * demo.js: demo-only helpers for headless screenshots. Not part of the production build.
 *   ?y=<px>  scroll to this offset on load (to capture lower sections)
 *   ?t=<ms>  hold every load animation at this moment (to capture the bloom mid-way)
 */
export const params = new URLSearchParams(location.search);
export const holdAt = params.has('t') ? Math.max(0, Number(params.get('t')) || 0) : null;

export function applyDemoParams({ scape } = {}) {
  const y = Number(params.get('y'));
  if (y) {
    // Headless capture cannot photograph a scrolled window, so the body becomes the scroller.
    // It also produces no animation frames, so scroll-driven reveals would sit at their first
    // keyframe; at this offset a real browser shows them settled, so show them settled.
    document.documentElement.classList.add('demo-scroller', 'demo-still');
    document.body.scrollTop = y;
  }
  if (holdAt !== null) {
    for (const a of document.getAnimations()) {
      if (a.timeline !== document.timeline) continue;
      a.pause();
      a.currentTime = holdAt;
    }
    scape?.freezeAt?.(holdAt / 1000);
  }
}
