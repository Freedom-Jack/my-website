'use client';

import { type RefObject, useEffect } from 'react';

/**
 * The returning header (SPEC-R4A §4). At rest at the top the header sits in normal flow, on paper, above the
 * strip. Once the strip's art box ([data-landscape="strip"]) has scrolled away (its bottom <= 0) it is armed:
 * sticky and hidden (.is-unpinned, placed without a slide because it is off screen then). From then on,
 * scrolling up >= 8 px (24 on a touch screen) brings it back SOLID (.is-pinned: paper and a 1 px mist rule,
 * layout.css) and scrolling down >= 8 px (24) slides it away. Back at the very top it is static again. Sticky, never fixed: nothing below it
 * moves. Never visibility:hidden or inert: focus inside pins it. Reduced motion: CSS makes the slide a fade.
 * After a route change (`key` changes) it is static again and re-reads the new page's strip.
 */
const STEP_FINE = 8;
const STEP_COARSE = 24; // a finger's small reversals never flip it
const ANCHORS = ['[data-landscape="strip"]', 'main > *'];

export function useReturningHeader(ref: RefObject<HTMLElement | null>, key: string | null) {
  useEffect(() => {
    const header = ref.current;
    if (!header) return;
    let state: 'static' | 'pinned' | 'unpinned' = 'static';
    let anchor: Element | null = null;
    let lastY = scrollY;
    let travel = 0;
    let raf = 0;
    let instantRaf = 0;
    const STEP = matchMedia('(pointer: coarse)').matches ? STEP_COARSE : STEP_FINE;

    const findAnchor = () => {
      for (const sel of ANCHORS) {
        const el = document.querySelector(sel);
        if (el) return el;
      }
      return null;
    };
    const anchorGone = () => {
      if (!anchor || !anchor.isConnected) anchor = findAnchor();
      return (anchor || header).getBoundingClientRect().bottom <= 0;
    };
    const focusInside = () => header.contains(document.activeElement) && document.activeElement !== document.body;

    const set = (next: typeof state, instant = false) => {
      if (next === state) return;
      state = next;
      cancelAnimationFrame(instantRaf);
      if (instant) {
        header.classList.add('is-instant');
        // two frames: the new state is styled (and painted) before transitions come back
        instantRaf = requestAnimationFrame(() => {
          instantRaf = requestAnimationFrame(() => header.classList.remove('is-instant'));
        });
      }
      header.classList.toggle('is-pinned', next === 'pinned');
      header.classList.toggle('is-unpinned', next === 'unpinned');
    };

    const update = () => {
      raf = 0;
      const y = scrollY;
      const dy = y - lastY;
      lastY = y;
      if (y <= 0) {
        set('static', true);
        travel = 0;
        return;
      }
      if (state === 'static') {
        if (anchorGone()) {
          set('unpinned', true);
          travel = 0;
        }
        return;
      }
      if (dy === 0) return;
      travel = Math.sign(dy) === Math.sign(travel) ? travel + dy : dy;
      if (travel <= -STEP && state !== 'pinned') set('pinned');
      else if (travel >= STEP && state !== 'unpinned' && !focusInside()) set('unpinned');
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const onFocusIn = () => {
      if (state !== 'static') set('pinned');
    };

    // a new page: static at the top again
    header.classList.add('is-instant');
    header.classList.remove('is-pinned', 'is-unpinned');
    instantRaf = requestAnimationFrame(() => {
      instantRaf = requestAnimationFrame(() => header.classList.remove('is-instant'));
    });
    addEventListener('scroll', onScroll, { passive: true });
    header.addEventListener('focusin', onFocusIn);
    update();

    return () => {
      removeEventListener('scroll', onScroll);
      header.removeEventListener('focusin', onFocusIn);
      cancelAnimationFrame(raf);
      cancelAnimationFrame(instantRaf);
      header.classList.remove('is-pinned', 'is-unpinned', 'is-instant');
    };
  }, [ref, key]);
}
