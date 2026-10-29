'use client';

/**
 * The scroll, held: whether the sheet is open, and the control that opened it (focus returns there on close). A
 * module store read through useSyncExternalStore (the pattern of chrome/current.ts), never React context across the
 * server/client boundary.
 */
type Listener = () => void;
let open = false;
let opener: HTMLElement | null = null;
let startX = 0; // where the scroll opens: the page's own place, or where the hand last left it (ScrollOpener)
let generation = 0; // counts the openings: the sheet resets its place when it moves
const fns = new Set<Listener>();
const emit = () => fns.forEach((fn) => fn());

export const scrollMode = {
  isOpen: () => open,
  opener: () => opener,
  /** The position the sheet opens at (known before its first render, so the first frame names the right place). */
  startX: () => startX,
  generation: () => generation,
  open(el: HTMLElement | null, x = 0) {
    if (open) return;
    open = true;
    opener = el;
    startX = x;
    generation++;
    emit();
  },
  close() {
    if (!open) return;
    open = false;
    emit();
  },
  subscribe(fn: Listener) {
    fns.add(fn);
    return () => {
      fns.delete(fn);
    };
  },
};
