// transition.js — how one page gives way to the next inside the one painting (SPEC-R4A §13.4, SPEC-R3 §7).
// Called by the demo router (router.js); the Next.js port calls the same functions from its router events.
//
//   import { exit, enter, travel, cut, quiet, restore } from '/assets/js/transition.js';
//   await exit(main, { dir, signal });          // the old text sinks into the mist (160 ms)
//   travel(landscape, { to, distance, presence, dir, back });   // the pan + the pale sweep
//   await enter(main, { dir, signal });         // the new text condenses in (h1 first, the rest 50 ms later)
//
// There is no cover and no dark frame, and the cursor never shows "busy". The painting's sideways pan IS
// the transition: `dir` = sign(destination stretch − current stretch), 1 = travel right (the scenery slides
// left). Text drifts with the scenery: the old text leaves 16 px against the travel, the new text arrives
// from 16 px along it.
//
//   t (ms)   0     the old <main> fades (opacity 1 → 0, cubic-bezier(.5,0,.75,0)) and drifts 16 px; only its h1
//                  also blurs to 3 px. It stops taking the pointer.
//            ≤ 50  landscape.panTo(dest, { duration: 600, ease: 'cubic-out' }) + landscape.sweep({ dir, 420 })
//            160   the router swaps <main>; the new h1 condenses from opacity 0, 3 px blur and 16 px to rest
//                  over 260 ms (--ease-ink); every other block, together, 50 ms later (opacity and drift only)
//            ≈ 350 readable · ≈ 470 settled · ≤ 650 the painting has arrived
//
// The sweep is the engine's pale mist bank (landscape.sweep), never darker than mist-2. (Round 4a retired the
// ?transition=edge variant, its edge() and variant(), and the .ink-wash canvas.)
// Each of the page's painted windows (its strip, its closing) carries the pan wherever it is on screen: a
// click on "Next: …" at the end of a page starts the pan in the closing scene, and after the swap the new
// strip carries it (the engine reads the windows' live rects, SPEC-R4A §7.5).
// Reduced motion or "Still the landscape": a 150 ms cross-fade (exit 60 ms, enter 90 ms, opacity only), the
// painting cuts at the swap (cut()), no sweep.
// Back/forward (router): no exit, no enter; the content is there at once and the painting pans back over
// 400 ms (cubic-out) behind it, or cuts.
//
// No side effects at import: nothing here touches the document or storage until a function is called.

const root = () => document.documentElement;
const token = (name, fallback) => parseFloat(getComputedStyle(root()).getPropertyValue(name)) || fallback;
const px = token;
/** QA only: ?slow=5 plays every route change 5x slower (sessionStorage 'ink:slow'; ?slow=1 resets). */
function slow() {
  try {
    const q = new URLSearchParams(location.search).get('slow');
    if (q) sessionStorage.setItem('ink:slow', q);
    return Math.min(20, Math.max(1, Number(sessionStorage.getItem('ink:slow')) || 1));
  } catch { return 1; }
}
const ms = (name, fallback) => token(name, fallback) * slow();
const EASE_EXIT = 'cubic-bezier(.5, 0, .75, 0)';
const EASE_INK = 'cubic-bezier(.2, .7, .1, 1)';

/** prefers-reduced-motion, or the footer's "Still the landscape": the quiet form of every transition. */
export function quiet() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches || root().classList.contains('is-still');
}

/** The h1 the transition leads with, and every block around it (its siblings at each level up to main). */
function parts(main) {
  const h1 = main.querySelector('h1');
  if (!h1) return { h1: null, rest: [...main.children] };
  const rest = [];
  for (let node = h1; node && node !== main; node = node.parentElement) {
    for (const sib of node.parentElement?.children ?? []) if (sib !== node) rest.push(sib);
  }
  return { h1, rest };
}

function settleAll(anims) {
  return Promise.all(anims.map((a) => a.finished.catch(() => null)));
}

/** Resolves after `ms` on the clock, not on the animation's last frame: the swap must not wait for a slow
    frame (a busy GPU delivers `finished` late, the timer keeps the 160 ms). Abort resolves at once. */
function after(ms, signal) {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, Math.max(0, ms));
    signal?.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
  });
}

/** Cancel this element tree's running route animations (a newer navigation took over). */
function cancelRoute(main) {
  for (const a of main.getAnimations({ subtree: true })) if (a.id === 'route') a.cancel();
}

/**
 * The old text sinks into the mist. Resolves when it has gone (or at once when aborted).
 * The element stays where it is; the router replaces it.
 */
export function exit(main, { dir = 0, signal } = {}) {
  if (!main) return Promise.resolve();
  // a navigation that replaces one still in flight: carry on from what is on screen
  const from = Number(getComputedStyle(main).opacity) || 0;
  cancelRoute(main);
  main.style.pointerEvents = 'none';
  main.inert = true;              // nothing in the departing text can be focused or clicked
  if (quiet()) {
    const d = 60 * slow() * from;
    main.animate([{ opacity: from }, { opacity: 0 }], { id: 'route', duration: d, easing: 'linear', fill: 'forwards' });
    return after(d, signal);
  }
  const dur = ms('--dur-route-exit', 160);
  const shift = -Math.sign(dir) * px('--route-shift', 16);
  main.animate(
    [{ opacity: from, translate: '0 0' }, { opacity: 0, translate: `${shift}px 0` }],
    { id: 'route', duration: dur * from, easing: EASE_EXIT, fill: 'forwards' },
  );
  main.querySelector('h1')?.animate([{ filter: 'blur(0px)' }, { filter: `blur(${px('--route-blur', 3)}px)` }],
    { id: 'route', duration: dur * from, easing: EASE_EXIT, fill: 'forwards' });
  return after(dur * from, signal);
}

/** A navigation was called off before its swap: the text that was sinking comes back (120 ms). */
export function restore(main) {
  if (!main) return;
  const from = Number(getComputedStyle(main).opacity);
  cancelRoute(main);
  main.inert = false;
  main.style.pointerEvents = '';
  if (from < 1 && !quiet()) main.animate([{ opacity: from }, { opacity: 1 }], { id: 'route', duration: 120 * slow(), easing: EASE_INK });
}

/**
 * The new text condenses in: the h1 first (opacity, 3 px blur, 16 px drift along the travel), every other
 * block together 50 ms later (opacity and drift). Resolves when settled; abort finishes it at once.
 */
export function enter(main, { dir = 0, signal } = {}) {
  if (!main) return Promise.resolve();
  const { h1, rest } = parts(main);
  const anims = [];
  if (quiet()) {
    anims.push(main.animate([{ opacity: 0 }, { opacity: 1 }], { id: 'route', duration: 90 * slow(), easing: 'linear', fill: 'backwards' }));
  } else {
    const dur = ms('--dur-route-enter', 260);
    const step = ms('--route-step', 50);
    const shift = Math.sign(dir) * px('--route-shift', 16);
    if (h1) {
      anims.push(h1.animate([
        { opacity: 0, filter: `blur(${px('--route-blur', 3)}px)`, translate: `${shift}px 0` },
        { opacity: 1, filter: 'blur(0px)', translate: '0 0' },
      ], { id: 'route', duration: dur, easing: EASE_INK, fill: 'backwards' }));
    }
    for (const el of rest) {
      anims.push(el.animate([
        { opacity: 0, translate: `${shift}px 0` },
        { opacity: 1, translate: '0 0' },
      ], { id: 'route', duration: dur, delay: step, easing: EASE_INK, fill: 'backwards' }));
    }
  }
  signal?.addEventListener('abort', () => anims.forEach((a) => a.finish()), { once: true });
  return settleAll(anims).then(() => {});
}

/**
 * The painting travels to the new page's stretch: a pan plus the pale mist sweep.
 * Back/forward: `back` pans over 400 ms with no sweep. Quiet: nothing here (the router cuts at the swap).
 * Feature-detects the engine's methods; an older engine simply pans.
 */
export function travel(land, { to, distance, presence, dir = 0, back = false } = {}) {
  if (!land || quiet()) return;
  const duration = back ? ms('--dur-route-back-pan', 400) : ms('--dur-route-pan', 600);
  land.panTo?.(to, { duration, ease: 'cubic-out', distance, presence });
  if (back) return;
  land.sweep?.({ dir: dir < 0 ? -1 : 1, duration: ms('--dur-route-sweep', 420) });
}

/** The quiet form: the painting simply is at the new stretch (at the swap). */
export function cut(land, { to, distance, presence } = {}) {
  land?.panTo?.(to, { duration: 0, distance, presence });
}
