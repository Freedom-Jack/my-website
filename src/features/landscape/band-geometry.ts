import { BAND } from './band.ts';
import { framingAt } from './engine/compose.ts';
import { NEXT_PLACE, PLACES, type PageId } from './places.ts';

/**
 * Where a page's band stands on the scroll, from the engine's own framing rule (engine/compose.ts framingAt, the wide
 * class), in stretches of the scroll: what the page's styles need to move the still and to place what is inscribed
 * in the painting exactly as the engine moves and frames the live stage. Pure: computed on the server and by the
 * tools, never shipped to the browser. (Its imports carry their .ts: the tools run it under Node as it is.)
 */
export interface BandGeometry {
  /** World x at the hero's left edge. */
  left: number;
  /** How much closer the page stands than its place's own hero (a case, a note: 1.15; else 1): one stretch is this
   *  many times the window's width. */
  inside: number;
  /** The way to the next place's hero (its left edge, east of this one's); 0 where no place follows. */
  next: number;
  /** The page's travel over its whole scroll (THE UNROLL). */
  travel: number;
}

const [W, H] = [BAND.ref[0], BAND.ref[0] * BAND.ratio];

function hero(page: PageId) {
  const p = PLACES[page];
  const inside = p.inside !== undefined && p.inside !== false;
  return framingAt(p.stretch, 'wide', {
    width: W,
    height: H,
    inside,
    ...(typeof p.inside === 'number' ? { insideU: p.inside } : {}),
  });
}

export function bandGeometry(page: PageId): BandGeometry {
  const a = hero(page);
  const nextPage = NEXT_PLACE[page]?.page;
  // (the next place on the chain, at its own hero, as the engine's travel takes it: engine/index.ts measureSlide)
  const b = nextPage ? framingAt(PLACES[nextPage].stretch, 'wide', { width: W, height: H }) : null;
  const next = b ? Math.max(0, b.worldLeft - a.worldLeft) : 0;
  // (no place follows Contact or the 404: the engine lets the open water run on by its reach)
  const travel = b ? BAND.share * next : BAND.reach;
  const r = (v: number) => Math.round(v * 10000) / 10000;
  return { left: r(a.worldLeft), inside: r(a.scale / W), next: r(next), travel: r(travel) };
}
