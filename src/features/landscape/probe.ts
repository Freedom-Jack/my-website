'use client';

/**
 * The live probe (01-budgets.md "The painting's rules", as amended after the attack; the plain direction's probe):
 * on every device the painting is a pre-cut still first (components/page/Strip). Every "should the painting run"
 * check runs BEFORE the engine is imported, so a page that will not paint fetches 0 engine bytes:
 *   1. reduced motion, or "Still the landscape" (features/chrome/still): the still IS the quiet form;
 *   2. Save-Data: the visitor asked for less, the still is enough;
 *   3. a WebGL2 context that the browser does not flag as a major performance caveat (a software rasteriser, a
 *      blocklisted GPU) and whose renderer is not named as software (headless Chrome's SwiftShader carries no caveat):
 *      without one the still stays (Canvas2D remains the engine's fallback for a context lost later);
 *   4. the cadence: 1.5 s of requestAnimationFrame deltas with the main thread idle, none over 20 ms (one retry).
 * Only then is the engine's module asked for (Landscape.tsx). Once live, two rAF deltas over 20 ms inside a rolling
 * second (watchFrames) hand the page back to the still and pause the painting; frames during the painting's own
 * motion (a pan, an arrival, a sweep) count at 33 ms, and none while the engine is pending for another reason
 * (01-budgets.md, the amendment after P1: R4).
 *
 * The result is one attribute on <html>, `data-live`, which layout.css reads to show or fade each page's still:
 *   (none)     server-rendered, or JS still deciding: the still stands;
 *   probing    the checks are running: the still stands;
 *   on         the painting may show: the strip's still fades out once the engine's first frame lands under it
 *              (the engine marks the strip's box `data-live` at that present);
 *   still      no live painting here: the still stands, and on phones the sharp phone still replaces the inline seed.
 * Nothing here touches the words.
 */

type LiveState = 'probing' | 'on' | 'still';

export const setLive = (s: LiveState) => document.documentElement.setAttribute('data-live', s);

/** Save-Data: the visitor asked for less; the still is enough. */
export function saveData(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !!c?.saveData;
}

/** Reduced motion, or "Still the landscape" (html.is-still, set by the boot script before first paint). */
export const quietNow = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('is-still');

/**
 * A software rasteriser, by its renderer's name (the browser tests' isSoftware reads the same names). Headless Chrome
 * on a machine with no GPU hands WebGL a SwiftShader context WITHOUT the major-performance-caveat flag, so there the
 * name is the only sign (CI's first budgets run, 2026-11-14: the probe passed, the engine booted on SwiftShader and held
 * the main thread for seconds on every route).
 */
export const softwareRenderer = (name: string): boolean =>
  /swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen|\bwarp\b/i.test(name);

/** The context's renderer: RENDERER where the browser names the GPU there (Firefox), else the debug extension's. */
function rendererOf(gl: WebGL2RenderingContext): string {
  try {
    const name = String(gl.getParameter(gl.RENDERER) ?? '');
    if (!/^(webkit webgl|mozilla)$/i.test(name.trim())) return name;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? '') : name;
  } catch {
    return '';
  }
}

/**
 * Can this browser paint the landscape with a hardware GPU? A WebGL2 context asked for with
 * `failIfMajorPerformanceCaveat` (null on a software rasteriser or a blocklisted GPU) whose renderer is not named as
 * software (softwareRenderer). Otherwise the still stays and the engine's chunk is never fetched. The probe context is
 * lost at once so the engine's own context is the only one kept.
 */
export function gpuOK(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true, antialias: false, depth: false });
    if (!gl) return false;
    const software = softwareRenderer(rendererOf(gl));
    try {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      /* the context goes with the canvas */
    }
    return !software;
  } catch {
    return false;
  }
}

/** Resolves once the document is visible (a tab opened in the background measures nothing until it is looked at). */
function whenVisible(): Promise<void> {
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

/** The frame limit (ms) of a settled painting: a frame over it is a slow one (a slow place to read). */
const LIMIT = 20;
/** The cadence's length (ms). */
const CADENCE_MS = 1500;
/** The watch: two slow frames inside this rolling window (ms) hand the page back to its still... */
const SPAN = 1000;
/** ...and it sleeps once the visitor has given no input for this long (ms; the engine's own loop sleeps on the same
 *  rule). */
const IDLE = 45000;

/**
 * CADENCE_MS of requestAnimationFrame deltas: true when no frame (after the first two) is over LIMIT ms. Resolves
 * early with false on the first bad frame, so a struggling phone is answered at once; a hidden document waits to be
 * seen.
 */
export async function cadence(): Promise<boolean> {
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
      if (n > 2 && d > LIMIT) return resolve(false);
      if (t - start >= CADENCE_MS) return resolve(true);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/**
 * R4 (01-budgets.md, the amendment after P1): the frame limit for the engine's state now. 0 while the engine is
 * pending for a reason other than its own motion (a scene or a layer on its way: there are no engine frames then, so
 * none are counted); 33 ms during the painting's own motion (a pan, an arrival, a sweep: a phone that janks only
 * during pans is handed back to its still too); 20 ms once settled (a slow place to read). The engine's stats() is
 * read each frame (Landscape.tsx); without stats, 20.
 */
export function limitFor(
  s: { panning?: boolean; arriving?: boolean; sweeping?: boolean; pending?: boolean } | null | undefined,
): number {
  if (!s) return 20;
  if (s.panning || s.arriving || s.sweeping) return 33;
  if (s.pending) return 0;
  return 20;
}

/**
 * While live: two rAF deltas over the limit inside a rolling SPAN ms call `onSlow` once and stop. The limit is LIMIT
 * ms (a slow place to read), or what `limitFor()` answers for this frame: 33 while the engine is in its own motion (a
 * pan, an arrival, a sweep: R4), 0 while it is pending for another reason (no engine frames then: not counted). The
 * loop runs only while the visitor is active (an input within IDLE ms) and the document is visible, so an idle page
 * costs no frames. `onSlow(motion)` says whether one of the two frames was a motion frame. Returns the stop function.
 */
export function watchFrames(
  onSlow: (motion: boolean) => void,
  { limitFor }: { limitFor?: () => number } = {},
): () => void {
  let raf = 0;
  let last = 0;
  let lastInput = performance.now();
  let stopped = false;
  const slow: { t: number; motion: boolean }[] = [];
  const step = (t: number) => {
    raf = 0;
    if (stopped) return;
    if (document.visibilityState === 'hidden' || t - lastInput > IDLE) {
      last = 0;
      return; // (asleep: the next input wakes it)
    }
    if (last) {
      const d = t - last;
      const lim = limitFor ? limitFor() : LIMIT;
      if (lim > 0 && d > lim) {
        slow.push({ t, motion: lim !== LIMIT });
        while (slow.length && t - slow[0]!.t > SPAN) slow.shift();
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
