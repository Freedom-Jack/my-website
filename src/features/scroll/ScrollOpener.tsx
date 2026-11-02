'use client';

import { useSyncExternalStore } from 'react';
import { site } from '@content/site';
import { fxOn } from '@/features/landscape/elements';
import { landscape } from '@/features/landscape/store';
import { currentMain, placeOf } from '@/features/landscape/targets';
import { scrollMode } from './store';
import { clampX } from './walk';

const AT_KEY = 'ink:at'; // (ScrollSheet keeps the last held position here, for this tab)
/** Where the scroll opens: where the hand last left it in this tab, else the page's own place. */
function startAt(): number {
  try {
    const v = sessionStorage.getItem(AT_KEY);
    if (v !== null && Number.isFinite(+v)) return clampX(+v);
  } catch {
    /* no storage: the page's own place */
  }
  const main = currentMain();
  return main ? clampX(placeOf(main).stretch) : 0;
}

/**
 * The footer's "Open the scroll" (elements.ts scroll): one quiet brush link after "Still the landscape" that opens the
 * handscroll in the hand (ScrollSheet). Hidden without JS, without the painting, and with the element off (scroll.css).
 * With no live painting (the engine failed, or is static) the click does nothing: there is nothing to hold.
 */
export function ScrollOpener() {
  const open = useSyncExternalStore(scrollMode.subscribe, scrollMode.isOpen, () => false);
  return (
    <>
      <button
        className="scroll-opener brush"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby="scroll-hint"
        onClick={(e) => {
          const land = landscape.get();
          if (!fxOn('scroll') || !land || land.mode === 'static') return;
          scrollMode.open(e.currentTarget, startAt());
        }}
      >
        {site.scroll.open}
      </button>
      <span className="visually-hidden" id="scroll-hint">
        {site.scroll.hint}
      </span>
    </>
  );
}
