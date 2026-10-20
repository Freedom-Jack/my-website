import { quiet } from '@/features/chrome/still';
import { elementOn } from '@/features/landscape/elements';
import { normPath } from '@/features/landscape/places';

/**
 * navMark (features/landscape/elements.ts): the nav's current-page brush mark is lifted off the old page's word and
 * laid again under the new one (the drawing is CSS: jade.css, "navMark"). It starts AT THE CLICK (liftNavMark, from
 * Navigation's navigate(), so it rides inside the 600 ms pan); a route that commits without a click (back/forward) is
 * caught after the commit (updateNavMark). The first call only records the current link (on a full load the mark
 * simply sits there). Quiet (reduced motion, Still): nothing animates. The direction of travel is the painting's.
 */
let last: HTMLElement | null | undefined;
const T_OUT = 1400;

const navLinks = () => {
  const list = document.querySelector('.site-nav__list');
  return list ? [...list.querySelectorAll<HTMLElement>('a.brush')] : [];
};

function play(prev: HTMLElement | null, now: HTMLElement | null, dir: number) {
  if (prev && prev.isConnected) {
    prev.classList.remove('is-laying');
    prev.classList.add('is-lifting');
    prev.classList.toggle('lift-l', dir < 0);
    setTimeout(() => prev.classList.remove('is-lifting', 'lift-l'), T_OUT);
  }
  if (now) {
    now.classList.remove('is-lifting', 'lift-l', 'is-laying');
    void now.offsetWidth; // (restart the laying if the same word is laid twice in a row)
    now.classList.add('is-laying');
    setTimeout(() => now.classList.remove('is-laying'), T_OUT);
  }
}

/** At the click: lift the current mark toward the travel (dir: the painting's, -1 / 0 / 1) and lay the destination's. */
export function liftNavMark(pathname: string, dir: number): void {
  const links = navLinks();
  if (!links.length) return;
  const prev = links.find((a) => a.hasAttribute('aria-current')) ?? null;
  const want = normPath(pathname);
  const now =
    links.find((a) => normPath(new URL(a.getAttribute('href') || '/', location.href).pathname) === want) ?? null;
  last = now;
  if (prev === now || !elementOn('navMark') || quiet()) return;
  play(prev, now, dir || 1);
}

/** After every route commit: a change no click announced (back/forward) lifts and lays here instead. */
export function updateNavMark(): void {
  const links = navLinks();
  if (!links.length) return;
  const now = links.find((a) => a.hasAttribute('aria-current')) ?? null;
  const prev = last;
  last = now;
  if (prev === undefined || prev === now || !elementOn('navMark') || quiet()) return;
  const i0 = prev ? links.indexOf(prev) : -1;
  const i1 = now ? links.indexOf(now) : -1;
  play(prev, now, i1 >= i0 ? 1 : -1);
}
