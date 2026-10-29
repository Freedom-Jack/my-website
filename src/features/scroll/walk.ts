/**
 * The scroll, held: the arithmetic of the hand (pure; tests/unit/scroll.test.ts). World x is in stretches along the
 * handscroll: Home 0, Work 1, Writing 2, Résumé 3, Contact 4 (places.ts STORY_MAP). The hand never wanders past the
 * crossing into the 404's mist.
 */
export const FIRST = 0;
export const LAST = 4;

/** A position on the map, clamped to it (NaN and friends land at Home). */
export const clampX = (x: number): number => Math.min(LAST, Math.max(FIRST, Number.isFinite(x) ? x : FIRST));

/** The place nearest to a position. */
export const nearest = (x: number): number => Math.round(clampX(x));

/** The detent: a release within `r` of a place settles there; otherwise null (the scroll rests where the hand left it). */
export const detent = (x: number, r = 0.3): number | null => {
  const k = nearest(x);
  return Math.abs(clampX(x) - k) <= r + 1e-9 ? k : null;
};

/** The next place in a direction (the arrow keys; a drag's end under reduced motion or Still): from 1.4, right is 2
 *  and left is 1; from a place, the neighbour; at the ends, the end. */
export const stepFrom = (x: number, dir: 1 | -1): number => {
  const c = clampX(x);
  return clampX(dir > 0 ? Math.floor(c + 1e-6) + 1 : Math.ceil(c - 1e-6) - 1);
};

/** A walk's length in ms: a walking pace, 1.1 s per stretch, never under 300 ms nor over 4.4 s. */
export const durationFor = (dx: number): number => Math.min(4400, Math.max(300, Math.abs(dx) * 1100));

/** CSS px dragged → stretches. The painting follows the hand: dragging it left moves the camera right. */
export const dxToStretch = (px: number, scale: number): number => (scale > 0 && Number.isFinite(px) ? -px / scale : 0);
