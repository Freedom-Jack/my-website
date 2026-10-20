import { elementOn } from './elements';
import type { Distance } from './places';
import type { LandscapeTargets } from './types';

const num = (v: string | undefined, d: number) =>
  v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v);

/** The page's own place, as its <main> declares it (components/page/PageMain). */
export interface MainPlace {
  stretch: number;
  distance: Distance;
  presence: number;
  horizon: number;
  ground: 'living' | '';
}

export function placeOf(main: HTMLElement): MainPlace {
  const d = main.dataset;
  return {
    stretch: num(d.stretch, 0),
    distance: d.distance === 'high' || d.distance === 'deep' ? d.distance : 'level',
    presence: num(d.presence, 1),
    horizon: num(d.horizon, 0.6),
    ground: d.ground === 'living' ? 'living' : '',
  };
}

/** The elements of one <main> the painting reads (a new engine attribute takes three edits: here, rebind, JSDoc). */
export function targetsOf(main: HTMLElement): LandscapeTargets {
  const place = placeOf(main);
  return {
    strip: main.querySelector('[data-landscape="strip"]'),
    closing: main.querySelector('[data-landscape="closing"]'),
    keepout: main.querySelectorAll('[data-landscape="keepout"]'),
    // (N1: the windows into the painting at the page's section breaks; none when the flag is off)
    glimpse: elementOn('glimpses') ? main.querySelectorAll('[data-landscape="glimpse"], [data-glimpse="end"]') : [],
    // (S1: the footer's lines are veiled too: on a short living page the sea of mist reaches under them)
    veil: [
      ...main.querySelectorAll('[data-veil]'),
      ...(elementOn('cameraTravels')
        ? document.querySelectorAll('.site-footer .story-map__list, .site-footer__base')
        : []),
    ],
    wake: main.querySelectorAll('[data-wake]'),
    horizon: place.horizon,
    ground: place.ground,
  };
}

export const currentMain = () => document.getElementById('main');
