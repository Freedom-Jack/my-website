'use client';

/**
 * The live probe (01-budgets.md "The painting's rules", as amended after the attack; the plain direction's probe):
 * on every device the painting is a pre-cut still first (components/page/Strip). Every "should the painting run"
 * check runs BEFORE the engine is imported, so a page that will not paint fetches 0 engine bytes:
 *   1. reduced motion, or "Still the landscape" (features/chrome/still): the still IS the quiet form;
 *   2. Save-Data: the visitor asked for less, the still is enough;
 *   3. a WebGL2 context that the browser does not flag as a major performance caveat (a software rasteriser, a
 *      blocklisted GPU): without one the still stays (Canvas2D remains the engine's fallback for a context lost later);
 *   4. the cadence: 1.5 s of requestAnimationFrame deltas with the main thread idle, none over 20 ms (one retry).
 * Only then is the engine's module asked for (Landscape.tsx). Once live, two rAF deltas over 20 ms inside a rolling
 * second (watchFrames) hand the page back to the still and pause the painting; frames during the painting's own
 * motion (a pan, an arrival, a sweep) count at 33 ms, and none while the engine is pending for another reason or
 * deferred (01-budgets.md, the amendment after P1: R4).
 *
 * The result is one attribute on <html>, `data-live`, which layout.css reads to show or fade each page's still:
 *   (none)     server-rendered, or JS still deciding: the still stands;
 *   probing    the checks are running: the still stands;
 *   on         the painting may show: the strip's still fades out once the engine's first frame lands under it
 *              (the engine marks the strip's box `data-live` at that present);
 *   still      no live painting here: the still stands, and on phones the sharp phone still replaces the inline seed.
 * Nothing here touches the words.
 */

export type LiveState = 'probing' | 'on' | 'still';

export const setLive = (s: LiveState) => document.documentElement.setAttribute('data-live', s);
export const liveState = (): LiveState | null => document.documentElement.getAttribute('data-live') as LiveState | null;

/** Save-Data: the visitor asked for less; the still is enough. */
export function saveData(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !!c?.saveData;
}

/** Reduced motion, or "Still the landscape" (html.is-still, set by the boot script before first paint). */
export const quietNow = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('is-still');

/**
 * Can this browser paint the landscape with a hardware GPU? A WebGL2 context asked for with
 * `failIfMajorPerformanceCaveat`: null on a software rasteriser or a blocklisted GPU (the still stays, the engine's
 * chunk is never fetched). The probe context is lost at once so the engine's own context is the only one kept.
 */
export function gpuOK(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true, antialias: false, depth: false });
    if (!gl) return false;
    try {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      /* the context goes with the canvas */
    }
    return true;
  } catch {
    return false;
  }
}

/** Resolves once the document is visible (a tab opened in the background measures nothing until it is looked at). */
export function whenVisible(): Promise<void> {
  return new Promise((resolve) => {
    if (document.visibilityState !== 'hidden') return resolve();
    const on = () => {
      if (document.visibilityState === 'hidden') return;
      document.removeEventListener('visibilitychange', on);
      resolve();
    };
    document.addEventListener('visibilitychange', on);
  });
}

/**
 * `ms` of requestAnimationFrame deltas: true when no frame (after the first two) is over `limit` ms. Resolves early
 * with false on the first bad frame, so a struggling phone is answered at once; a hidden document waits to be seen.
 */
export async function cadence(ms = 1500, limit = 20): Promise<boolean> {
  await whenVisible();
  return new Promise((resolve) => {
    const start = performance.now();
    let last = start;
    let n = 0;
    const step = (t: number) => {
      const d = t - last;
      last = t;
      n++;
      if (document.visibilityState === 'hidden') return resolve(false);
      if (n > 2 && d > limit) return resolve(false);
      if (t - start >= ms) return resolve(true);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/**
 * R4 (01-budgets.md, the amendment after P1): the frame limit for the engine's state now. 0 while the engine is
 * deferred, or pending for a reason other than its own motion (a scene or a layer on its way: there are no engine
 * frames then, so none are counted); 33 ms during the painting's own motion (a pan, an arrival, a sweep: a phone that
 * janks only during pans is handed back to its still too); 20 ms once settled (a slow place to read). The engine's
 * stats() is read each frame (Landscape.tsx); without stats, 20.
 */
export function limitFor(
  s:
    | { deferred?: boolean; panning?: boolean; arriving?: boolean; sweeping?: boolean; pending?: boolean }
    | null
    | undefined,
): number {
  if (!s) return 20;
  if (s.deferred) return 0;
  if (s.panning || s.arriving || s.sweeping) return 33;
  if (s.pending) return 0;
  return 20;
}

/**
 * While live: two rAF deltas over the limit inside a rolling `window` ms call `onSlow` once and stop. The limit is
 * `limit` ms (20: a slow place to read), or what `limitFor()` answers for this frame: 33 while the engine is in its own
 * motion (a pan, an arrival, a sweep: R4), 0 while it is pending for another reason or deferred (no engine frames then:
 * not counted). The loop runs only while the visitor is active (an input within `idle` ms; the engine's own loop sleeps
 * on the same rule) and the document is visible, so an idle page costs no frames. `onSlow(motion)` says whether one of
 * the two frames was a motion frame (the mark's reason). Returns the stop function.
 */
export function watchFrames(
  onSlow: (motion: boolean) => void,
  {
    limit = 20,
    window: span = 1000,
    idle = 45000,
    limitFor,
  }: { limit?: number; window?: number; idle?: number; limitFor?: () => number } = {},
): () => void {
  let raf = 0;
  let last = 0;
  let lastInput = performance.now();
  let stopped = false;
  const slow: { t: number; motion: boolean }[] = [];
  const step = (t: number) => {
    raf = 0;
    if (stopped) return;
    if (document.visibilityState === 'hidden' || t - lastInput > idle) {
      last = 0;
      return; // (asleep: the next input wakes it)
    }
    if (last) {
      const d = t - last;
      const lim = limitFor ? limitFor() : limit;
      if (lim > 0 && d > lim) {
        slow.push({ t, motion: lim !== limit });
        while (slow.length && t - slow[0]!.t > span) slow.shift();
        if (slow.length >= 2) {
          const motion = slow.some((s) => s.motion);
          stop();
          onSlow(motion);
          return;
        }
      }
    }
    last = t;
    raf = requestAnimationFrame(step);
  };
  const wake = () => {
    lastInput = performance.now();
    if (!stopped && !raf && document.visibilityState !== 'hidden') {
      last = 0; // (the first delta after a sleep is not a frame)
      raf = requestAnimationFrame(step);
    }
  };
  const opts = { passive: true } as const;
  const events = ['pointermove', 'pointerdown', 'wheel', 'scroll', 'keydown', 'touchstart'] as const;
  for (const e of events) addEventListener(e, wake, opts);
  document.addEventListener('visibilitychange', wake);
  function stop() {
    stopped = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    for (const e of events) removeEventListener(e, wake);
    document.removeEventListener('visibilitychange', wake);
  }
  wake();
  return stop;
}
