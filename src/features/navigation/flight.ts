import manifest from '../../../public/scenes/band/manifest.json';
import { quiet } from '@/features/chrome/still';
import type { PageId } from '@/features/landscape/places';

/**
 * The travel between two pages where the engine does not run (phones, tablets, a laptop without a GPU): the whole
 * scroll, as one strip (public/scenes/band/transit.webp, cut by tools/build-band.ts), flies past in the band from
 * the place being left to the place arrived at, and gives way to the new page's own still once it is there. One
 * image and two transforms, both the compositor's: no frame is drawn by script. The strip is fetched when a visitor
 * first shows where they mean to go (warmFlight, on the first hover or focus of an in-site link) or, since a touch
 * gives no such warning, once the page has loaded and the browser is idle (features/navigation/Navigation).
 * The strip is laid in the band exactly as a still is (styles/band.css .band__transit: one stretch of the scroll is
 * the band's own scale wide, the waterline on the band's own line), so where it starts is the picture already on
 * screen and where it ends is the picture that takes over.
 */
interface Seat {
  left: number;
  inside: number;
  travel: number;
}
interface Transit {
  file: string;
  from: number;
  to: number;
  water: number;
  pages: Partial<Record<PageId, Seat>>;
}
interface Look {
  phone: { a: { x: number } };
  tabletX: number;
}
const M = manifest as unknown as { transit?: Transit; stills: Partial<Record<PageId, Look>> };
const T = M.transit;
const PHONE = '(max-width: 39.99rem)';
const TABLET = '(max-width: 74.99rem)';

let box: HTMLDivElement | null = null;
let ready = false;
let flying: { cancel(): void } | null = null;

/** Fetch the strip (once), so the first flight has it: called when a visitor first reaches for an in-site link. */
export function warmFlight() {
  if (!T || box || typeof document === 'undefined') return;
  const clip = document.querySelector('.band__clip');
  if (!clip) return;
  box = document.createElement('div');
  box.className = 'band__transit';
  box.style.setProperty('--transit-w', String(T.to - T.from));
  box.style.setProperty('--transit-water', String(T.water));
  const img = new Image();
  img.alt = '';
  img.decoding = 'async';
  img.src = `/scenes/band/${T.file}`;
  box.appendChild(img);
  clip.appendChild(box);
  const done = () => {
    ready = true;
  };
  if (typeof img.decode === 'function') img.decode().then(done, done);
  else img.onload = done;
}

/** Where a page's band looks (world x at its left edge) and how close it stands, `progress` of the way along its
 *  own travel, for this window's width class. */
function view(page: PageId, progress: number): { u: number; k: number } | null {
  const seat = T?.pages[page];
  const still = M.stills[page];
  if (!seat || !still) return null;
  const look = matchMedia(PHONE).matches ? still.phone.a.x : matchMedia(TABLET).matches ? still.tabletX : 0;
  return { u: seat.left + look / seat.inside + seat.travel * progress, k: seat.inside };
}

/**
 * Fly from one page's place to another's. `progress`: how far the page being left had been read (0..1: its band
 * has travelled that share of its way). Resolves nothing: the strip lets go by itself once the new page's still is
 * on show (components/layout/BandStill).
 */
export function fly(
  from: PageId,
  to: PageId,
  { progress = 0, duration = 600 }: { progress?: number; duration?: number } = {},
) {
  if (!T || quiet()) return;
  if (!box) warmFlight();
  const a = view(from, Math.min(1, Math.max(0, progress)));
  const b = view(to, 0);
  const el = box;
  const img = el?.firstElementChild as HTMLElement | null;
  // (no strip yet, or a place off the strip: the stills simply change over)
  if (!el || !img || !ready || !a || !b || typeof el.animate !== 'function') return;
  const span = T.to - T.from;
  const s = img.offsetWidth / span; // px per stretch, as laid out (before the band's own scale)
  if (!(s > 0)) return;
  const reach = innerWidth / s; // the window's width in stretches, at full size
  if (a.u < T.from || b.u < T.from || a.u + reach / a.k > T.to || b.u + reach / b.k > T.to) return;
  flying?.cancel();
  const at = (v: { u: number; k: number }) =>
    `translate3d(${(-(v.u - T.from) * s * v.k).toFixed(2)}px, 0, 0) scale(${v.k})`;
  const move = el.animate([{ transform: at(a) }, { transform: at(b) }], {
    duration,
    easing: 'cubic-bezier(.45, .05, .2, 1)',
    fill: 'forwards',
  });
  const show = el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 110, easing: 'linear', fill: 'forwards' });
  el.classList.add('is-flying');
  let over = false;
  const end = () => {
    if (over) return;
    over = true;
    move.cancel();
    show.cancel();
    el.classList.remove('is-flying');
    if (flying === me) flying = null;
  };
  const me = { cancel: end };
  flying = me;
  // arrived: wait (briefly) for the new page's still to be the one on show, then let go
  void move.finished.then(async () => {
    const until = performance.now() + 1500;
    const shown = () => !!document.querySelector(`.band__still[data-page="${to}"]:not(.is-waiting)`);
    while (!over && !shown() && performance.now() < until) await new Promise((r) => requestAnimationFrame(r));
    if (over) return;
    const hide = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'linear', fill: 'forwards' });
    void hide.finished.then(
      () => {
        hide.cancel();
        end();
      },
      () => end(),
    );
  }, end);
}
