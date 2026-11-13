'use client';

import { useSyncExternalStore } from 'react';
import { site } from '@content/site';
import { isStill, setStill } from '@/features/chrome/still';

const subscribe = (fn: () => void) => {
  document.addEventListener('ink:still', fn);
  return () => document.removeEventListener('ink:still', fn);
};

/**
 * The tail's "Still the landscape": a toggle (aria-pressed) whose label never changes; pressed, its underline stays
 * in the burnt ink. Hidden without JS (it does nothing without it).
 */
export function StillToggle() {
  const on = useSyncExternalStore(subscribe, isStill, () => false);
  return (
    <>
      <button
        className="still-toggle"
        type="button"
        aria-pressed={on}
        aria-describedby="still-hint"
        title={site.stillHint}
        onClick={() => setStill(!on)}
      >
        Still the landscape
      </button>
      <span className="visually-hidden" id="still-hint">
        {site.stillHint}
      </span>
    </>
  );
}
