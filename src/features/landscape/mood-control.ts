'use client';

/**
 * The mood on show (round 6): the clock's own (elements.ts `hours`: the painting keeps the visitor's hour), or one
 * that was asked for (the ask line: "snow at dusk, the lanterns lit"; the preview's panel). One place decides, so
 * the clock never takes back a scene a visitor has just asked for.
 */
import { elementOn } from './elements';
import { moodAt } from './mood';
import { landscape } from './store';
import type { Mood } from './types';

const KEY = 'ink-mood'; // sessionStorage: a scene asked for holds while the tab lives (a page change keeps it)
let asked: Mood | null = null;
let timer = 0;
const listeners = new Set<(m: Mood, asked: boolean) => void>();

const zone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
};
const byClock = (): Mood => (elementOn('hours') ? moodAt(new Date(), zone()) : {});
const current = (): Mood => asked ?? byClock();

function apply(ms: number) {
  const m = current();
  landscape.get()?.setMood?.(m, ms);
  // (the page's own layers follow the mood too: the falling snow, the rain: plates.css reads these)
  const html = document.documentElement;
  html.dataset.mood = (m.night ?? 0) > 0.5 ? 'night' : (m.dusk ?? 0) > 0.5 ? 'dusk' : (m.dawn ?? 0) > 0.5 ? 'dawn' : 'day';
  html.toggleAttribute('data-snow', (m.snow ?? 0) > 0.3);
  html.toggleAttribute('data-rain', (m.rain ?? 0) > 0.3);
  for (const f of listeners) f(m, !!asked);
}

export const moods = {
  /** The painting is live: take it to the mood on show, at once, and keep the clock. */
  start() {
    try {
      const s = sessionStorage.getItem(KEY);
      asked = s ? (JSON.parse(s) as Mood) : null;
    } catch {
      asked = null;
    }
    apply(0);
    clearInterval(timer);
    timer = window.setInterval(() => {
      if (!asked && document.visibilityState === 'visible') apply(6000);
    }, 240000);
  },
  stop() {
    clearInterval(timer);
    timer = 0;
  },
  /** A scene was asked for (null: back to the clock's own). */
  ask(mood: Mood | null, ms = 1600) {
    asked = mood;
    try {
      if (mood) sessionStorage.setItem(KEY, JSON.stringify(mood));
      else sessionStorage.removeItem(KEY);
    } catch {
      /* it holds for this page only */
    }
    apply(ms);
  },
  get current() {
    return current();
  },
  get asked() {
    return !!asked;
  },
  onChange(f: (m: Mood, asked: boolean) => void) {
    listeners.add(f);
    return () => listeners.delete(f);
  },
};
