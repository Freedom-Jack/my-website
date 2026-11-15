import type { Place } from '@/features/landscape/places';
import type { LandscapeHandle } from '@/features/landscape/types';
import { quiet } from '@/features/chrome/still';
import { cssTime } from '@/lib/css-time';

/**
 * How one page gives way to the next inside the one painting: one grammar, the river's (the vanguard round, A10).
 * The painting pans to the destination's place (P3: from where the unroll left it) and the words cross-fade under
 * it, plainly: no drift, no blur, no mist sweep, no stagger.
 *
 *   t (ms)   0     the old <main> fades (160 ms)
 *            ≤ 50  landscape.panTo(dest, 600 ms, cubic-out; under the unroll from where the page's slide left the
 *                  painting, in proportion to the way left: a page read to its end settles in ~300 ms)
 *            160   the new page replaces <main>; it fades in over 260 ms
 *            ≈ 420 readable · ≤ 650 the painting has arrived
 *
 * A long jump (Home to Contact) pans the whole way, 120 ms longer per stretch beyond the first: no splice, no mist
 * (A10: one grammar, the river's). Reduced motion or "Still the landscape": a 150 ms cross-fade (exit 60 ms, enter
 * 90 ms), the painting cuts at the swap. Back/forward: no exit or enter; the content is there at once and the
 * painting pans back over 400 ms behind it (or cuts).
 */

const root = () => document.documentElement;
// (the CSS pipeline minifies "600ms" to ".6s": lib/css-time reads seconds as seconds)
const token = (name: string, fallback: number) => cssTime(name, fallback, root()) || fallback;
const EASE_OUT = 'cubic-bezier(.3, .6, .2, 1)';

/**
 * What actually fades: `els` themselves, except a block that holds an element blended into the paper (Home's photo,
 * `mix-blend-mode: multiply`). Opacity below 1 or a transform on any of its ancestors makes that ancestor a group
 * of its own, the multiply stops at the group, and the photo's white wall shows as a hard white box. So such a block
 * fades by its children instead, down to the blended element, which fades by its own opacity (multiply at any
 * opacity still turns its white into the paper). Every other block fades as one.
 */
function layers(main: HTMLElement, els: Element[]): Element[] {
  const blended = [...main.querySelectorAll('*')].filter((el) => getComputedStyle(el).mixBlendMode !== 'normal');
  if (!blended.length) return els;
  const split = (list: Iterable<Element>): Element[] =>
    [...list].flatMap((el) => {
      if (blended.some((b) => b !== el && el.contains(b))) return split(el.children);
      return getComputedStyle(el).display === 'none' ? [] : [el]; // (<main>'s JSON-LD and print-only lines)
    });
  return split(els);
}

/** The page's blocks as they fade: <main> itself, unless it holds a blended element. */
const blocks = (main: HTMLElement) => layers(main, [main]);
const opacityOf = (els: Element[]) => Math.max(0, ...els.map((el) => Number(getComputedStyle(el).opacity) || 0));

/** Resolves after `ms` on the clock, not on the animation's last frame (a busy GPU delivers `finished` late). */
function after(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    const t = setTimeout(resolve, Math.max(0, ms));
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
  });
}

function cancelRoute(main: HTMLElement) {
  for (const a of main.getAnimations({ subtree: true })) if (a.id === 'route') a.cancel();
}

/** The old words fade. Resolves when they have gone (or at once when aborted). */
export function exit(main: HTMLElement | null, { signal }: { signal?: AbortSignal } = {}) {
  if (!main) return Promise.resolve();
  const els = blocks(main);
  const from = opacityOf(els);
  cancelRoute(main);
  main.style.pointerEvents = 'none';
  main.inert = true;
  const dur = (quiet() ? 60 : token('--dur-route-exit', 160)) * from;
  for (const el of els)
    el.animate([{ opacity: from }, { opacity: 0 }], { id: 'route', duration: dur, easing: 'linear', fill: 'forwards' });
  return after(dur, signal);
}

/** A navigation was called off before its swap: the words that were fading come back (120 ms). */
export function restore(main: HTMLElement | null) {
  if (!main) return;
  const els = blocks(main);
  const from = opacityOf(els);
  cancelRoute(main);
  main.inert = false;
  main.style.pointerEvents = '';
  if (from < 1 && !quiet())
    for (const el of els)
      el.animate([{ opacity: from }, { opacity: 1 }], { id: 'route', duration: 120, easing: EASE_OUT });
}

/** The new words fade in, as one. */
export function enter(main: HTMLElement | null, { signal }: { signal?: AbortSignal } = {}) {
  if (!main) return Promise.resolve();
  const dur = quiet() ? 90 : token('--dur-route-enter', 260);
  const anims = blocks(main).map((el) =>
    el.animate([{ opacity: 0 }, { opacity: 1 }], {
      id: 'route',
      duration: dur,
      easing: quiet() ? 'linear' : EASE_OUT,
      fill: 'backwards',
    }),
  );
  signal?.addEventListener('abort', () => anims.forEach((a) => a.finish()), { once: true });
  return Promise.all(anims.map((a) => a.finished.catch(() => null))).then(() => {});
}

type Where = Pick<Place, 'stretch' | 'distance' | 'presence'>;

/** The painting travels to the new page's stretch: a pan (back/forward: a 400 ms pan), the whole way however far
 *  (`cloud: false`: no long-jump splice, no mist bank), 120 ms longer per stretch beyond the first. */
export function travel(land: LandscapeHandle | null, to: Where, { back = false }: { back?: boolean } = {}) {
  if (!land || quiet()) return;
  let far = 0;
  try {
    far = Math.max(0, Math.abs(to.stretch - Math.round(Number(land.stats().stretch) || 0)) - 1);
  } catch {
    far = 0;
  }
  const duration = (back ? token('--dur-route-back-pan', 400) : token('--dur-route-pan', 600)) + 120 * far;
  void land.panTo(to.stretch, {
    duration,
    ease: 'cubic-out',
    distance: to.distance,
    presence: to.presence,
    cloud: false,
  });
}

/** The quiet form: the painting simply is at the new stretch (at the swap). */
export function cut(land: LandscapeHandle | null, to: Where) {
  void land?.panTo(to.stretch, { duration: 0, distance: to.distance, presence: to.presence });
}
