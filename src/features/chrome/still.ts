'use client';

import { landscape } from '@/features/landscape/store';

/**
 * "Still the landscape" (WCAG 2.2.2 Pause, Stop, Hide): stops all ambient motion (the drift, the wake, the
 * sweeps, the bloom, the pans, the small life) and turns route changes into their quiet form. Remembered across
 * visits (Jack, DESIGN §11.E answer 9: "have an option to toggle it off"): localStorage 'ink:still' = '1';
 * the boot script puts html.is-still on before first paint. Dispatches 'ink:still' ({ detail: { on } }).
 */
export const STILL_KEY = 'ink:still';

export const isStill = () => document.documentElement.classList.contains('is-still');

export function setStill(on: boolean) {
  document.documentElement.classList.toggle('is-still', on);
  try {
    if (on) localStorage.setItem(STILL_KEY, '1');
    else localStorage.removeItem(STILL_KEY);
  } catch {
    /* not remembered: private mode */
  }
  landscape.get()?.setStill(on);
  document.dispatchEvent(new CustomEvent('ink:still', { detail: { on } }));
}

/** prefers-reduced-motion, or Still: the quiet form of every transition. */
export function quiet(): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches || isStill();
}
