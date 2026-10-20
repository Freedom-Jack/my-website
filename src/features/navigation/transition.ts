import type { Place } from '@/features/landscape/places';
import type { LandscapeHandle } from '@/features/landscape/types';
import { quiet } from '@/features/chrome/still';
import { cssTime } from '@/lib/css-time';

/**
 * How one page gives way to the next inside the one painting (SPEC-R4A §13.4). There is no cover and no
 * dark frame: the painting's sideways pan IS the transition. `dir` = sign(destination stretch − current
 * stretch); 1 = travel right (the scenery slides left). Text drifts with the scenery.
 *
 *   t (ms)   0     the old <main> fades and drifts 16 px against the travel; only its h1 also blurs to 3 px
 *            ≤ 50  landscape.panTo(dest, 600 ms, cubic-out) + the pale mist sweep (420 ms)
 *            160   the new page replaces <main>; its h1 condenses in over 260 ms, every other block 50 ms later
 *            ≈ 350 readable · ≈ 470 settled · ≤ 650 the painting has arrived
 *
 * Reduced motion or "Still the landscape": a 150 ms cross-fade (exit 60 ms, enter 90 ms), the painting cuts at
 * the swap, no sweep. Back/forward: no exit or enter; the content is there at once and the painting pans back
 * over 400 ms behind it (or cuts).
 */

const root = () => document.documentElement;
// (the CSS pipeline minifies "600ms" to ".6s": lib/css-time reads seconds as seconds. Before, every route duration was
// read as under 1 ms, so the pan, the sweep and the text's exit and entry never really ran)
const token = (name: string, fallback: number) => cssTime(name, fallback, root()) || fallback;
const EASE_EXIT = 'cubic-bezier(.5, 0, .75, 0)';
const EASE_INK = 'cubic-bezier(.2, .7, .1, 1)';

/** The h1 the transition leads with, and every block around it (its siblings at each level up to main). */
function parts(main: HTMLElement) {
  const h1 = main.querySelector('h1');
  if (!h1) return { h1: null, rest: layers(main, [...main.children]) };
  const rest: Element[] = [];
  for (let node: Element = h1; node && node !== main; node = node.parentElement as Element) {
    for (const sib of node.parentElement?.children ?? []) if (sib !== node) rest.push(sib);
  }
  return { h1, rest: layers(main, rest) };
}

/**
 * What actually fades: `els` themselves, except a block that holds an element blended into the paper (Home's photo,
 * `mix-blend-mode: multiply`). Opacity below 1 or a transform on any of its ancestors makes that ancestor a group
 * of its own, the multiply stops at the group, and the photo's white wall shows as a hard white box. So such a block
 * fades by its children instead, down to the blended element, which fades by its own opacity (multiply at any
 * opacity still turns its white into the paper). Every other block fades as one, as before.
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

/** The old page's blocks as they fade out (or come back): <main> itself, unless it holds a blended element. */
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

/** The old text sinks into the mist. Resolves when it has gone (or at once when aborted). */
export function exit(main: HTMLElement | null, { dir = 0, signal }: { dir?: number; signal?: AbortSignal } = {}) {
  if (!main) return Promise.resolve();
  const els = blocks(main);
  const from = opacityOf(els);
  cancelRoute(main);
  main.style.pointerEvents = 'none';
  main.inert = true;
  if (quiet()) {
    const d = 60 * from;
    for (const el of els)
      el.animate([{ opacity: from }, { opacity: 0 }], { id: 'route', duration: d, easing: 'linear', fill: 'forwards' });
    return after(d, signal);
  }
  const dur = token('--dur-route-exit', 160);
  const shift = -Math.sign(dir) * token('--route-shift', 16);
  for (const el of els)
    el.animate(
      [
        { opacity: from, translate: '0 0' },
        { opacity: 0, translate: `${shift}px 0` },
      ],
      { id: 'route', duration: dur * from, easing: EASE_EXIT, fill: 'forwards' },
    );
  main.querySelector('h1')?.animate([{ filter: 'blur(0px)' }, { filter: `blur(${token('--route-blur', 3)}px)` }], {
    id: 'route',
    duration: dur * from,
    easing: EASE_EXIT,
    fill: 'forwards',
  });
  return after(dur * from, signal);
}

/** A navigation was called off before its swap: the text that was sinking comes back (120 ms). */
export function restore(main: HTMLElement | null) {
  if (!main) return;
  const els = blocks(main);
  const from = opacityOf(els);
  cancelRoute(main);
  main.inert = false;
  main.style.pointerEvents = '';
  if (from < 1 && !quiet())
    for (const el of els)
      el.animate([{ opacity: from }, { opacity: 1 }], { id: 'route', duration: 120, easing: EASE_INK });
}

/** The new text condenses in: the h1 first, every other block together 50 ms later. */
export function enter(main: HTMLElement | null, { dir = 0, signal }: { dir?: number; signal?: AbortSignal } = {}) {
  if (!main) return Promise.resolve();
  const { h1, rest } = parts(main);
  const anims: Animation[] = [];
  if (quiet()) {
    for (const el of blocks(main))
      anims.push(
        el.animate([{ opacity: 0 }, { opacity: 1 }], {
          id: 'route',
          duration: 90,
          easing: 'linear',
          fill: 'backwards',
        }),
      );
  } else {
    const dur = token('--dur-route-enter', 260);
    const step = token('--route-step', 50);
    const shift = Math.sign(dir) * token('--route-shift', 16);
    if (h1) {
      anims.push(
        h1.animate(
          [
            { opacity: 0, filter: `blur(${token('--route-blur', 3)}px)`, translate: `${shift}px 0` },
            { opacity: 1, filter: 'blur(0px)', translate: '0 0' },
          ],
          { id: 'route', duration: dur, easing: EASE_INK, fill: 'backwards' },
        ),
      );
    }
    for (const el of rest) {
      anims.push(
        el.animate(
          [
            { opacity: 0, translate: `${shift}px 0` },
            { opacity: 1, translate: '0 0' },
          ],
          {
            id: 'route',
            duration: dur,
            delay: step,
            easing: EASE_INK,
            fill: 'backwards',
          },
        ),
      );
    }
  }
  signal?.addEventListener('abort', () => anims.forEach((a) => a.finish()), { once: true });
  return Promise.all(anims.map((a) => a.finished.catch(() => null))).then(() => {});
}

type Where = Pick<Place, 'stretch' | 'distance' | 'presence'>;

/** The painting travels to the new page's stretch: a pan plus the pale mist sweep (back/forward: a 400 ms pan). */
export function travel(
  land: LandscapeHandle | null,
  to: Where,
  { dir = 0, back = false }: { dir?: number; back?: boolean } = {},
) {
  if (!land || quiet()) return;
  const duration = back ? token('--dur-route-back-pan', 400) : token('--dur-route-pan', 600);
  void land.panTo(to.stretch, { duration, ease: 'cubic-out', distance: to.distance, presence: to.presence });
  if (back) return;
  void land.sweep({ dir: dir < 0 ? -1 : 1, duration: token('--dur-route-sweep', 340) });
}

/** The quiet form: the painting simply is at the new stretch (at the swap). */
export function cut(land: LandscapeHandle | null, to: Where) {
  void land?.panTo(to.stretch, { duration: 0, distance: to.distance, presence: to.presence });
}
