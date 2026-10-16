// story-map.js — the footer's story map: "you are here" on the map of the whole painting (SPEC-R4A §5, DESIGN 11.B).
//
//   import { initStoryMap } from '/assets/js/story-map.js';
//   const map = initStoryMap();            // { update(), destroy() }
//   map.update();                          // after a route change: move "you are here"
//
// The map is static now. Its art is five build-time stills of each place's own opening scene
// (tools/build-stills.py → assets/img/scenes/), written into the shared footer with a tick over each place, so it
// shows without JS; CSS lifts the current place's tick from its label's aria-current (:has()). This module draws
// nothing: after an in-site page change it moves aria-current (markCurrent from nav.js; the Note marks Writing
// "true"; the 404 marks none) and mirrors it as .is-here on the ticks, for browsers without :has(). It also makes
// the ticks for an older footer that has none.
// Retired: painting the engine's stripSVG() into the art, and its sessionStorage cache ('ink:strip:v3'). The
// `strip` option main.js still passes is accepted and ignored (the engine's export stays, for the lab).
// Each label is li[data-stretch="n"]: Home 0 · Work 1 · (the road 2, unlabelled) · Writing 3 · Résumé 4 ·
// Contact 5.

import { markCurrent } from './nav.js';

const RETIRED = ['ink:strip', 'ink:strip:v2', 'ink:strip:v3'];   // the stripSVG caches

let live = null;

export function initStoryMap({ root = document } = {}) {
  const map = root.querySelector('.story-map');
  if (!map) return { update() {}, destroy() {} };
  if (live) return live;
  const art = map.querySelector('.story-map__art');
  const items = [...map.querySelectorAll('.story-map__list li[data-stretch]')];
  const made = [];

  // one tick per place, over its column of the art (decorative: the art is aria-hidden); the footer carries them
  const tickOf = (s) => {
    let t = art?.querySelector(`.story-map__tick[data-stretch="${s}"]`);
    if (!t && art) {
      t = document.createElement('span');
      t.className = 'story-map__tick';
      t.dataset.stretch = s;
      art.append(t);
      made.push(t);
    }
    return t;
  };
  const ticks = items.map((li) => tickOf(li.dataset.stretch));

  const update = () => {
    markCurrent(items.map((li) => li.querySelector('a[href]')).filter(Boolean));
    items.forEach((li, i) => ticks[i]?.classList.toggle('is-here', !!li.querySelector('a[aria-current]')));
  };

  update();
  try { RETIRED.forEach((k) => sessionStorage.removeItem(k)); } catch { /* blocked storage: nothing to retire */ }

  live = {
    update,
    destroy() {
      made.forEach((t) => t.remove());
      ticks.forEach((t) => t?.classList.remove('is-here'));
      live = null;
    },
  };
  return live;
}
