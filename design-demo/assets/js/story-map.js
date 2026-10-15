// story-map.js — the footer's story map: the whole painting as a thin map of the journey (SPEC-R4A §5).
//
//   import { initStoryMap } from '/assets/js/story-map.js';
//   const map = initStoryMap({ strip });   // { update(), destroy() }
//   map.update();                          // after a route change: move "you are here"
//
// The art is the engine's own stripSVG() of world 0 → 6 (stretches 0–5, six equal columns), drawn as pale ink washes
// in greys (the story map is UI: never pigment; layout.css feathers its edges). It is generated once per session and cached as a string
// (sessionStorage 'ink:strip:v3'). `strip` is a function resolving to the engine's stripSVG, or to null
// when there is none: the art then stays empty (it keeps its room, CSS hides it) and the labels work as
// before. Without JS the art is hidden and only the labels show.
// Each label is li[data-stretch="n"]: Home 0 · Work 1 · (the road 2, unlabelled) · Writing 3 · Résumé 4 ·
// Contact 5. A small tick hangs over every place's centre on the art; the current page's (the label with
// aria-current, markCurrent from nav.js; the Note marks Writing "true"; the 404 marks none) is taller and in
// ink-1, and its label keeps its brush mark.

import { markCurrent } from './nav.js';

const KEY = 'ink:strip:v3';   // v3: the washes (v2 held the flat silhouettes)
const OPTS = { from: 0, to: 6, width: 600, height: 36 };

let live = null;

export function initStoryMap({ strip = null, root = document } = {}) {
  const map = root.querySelector('.story-map');
  if (!map) return { update() {}, destroy() {} };
  if (live) return live;
  const art = map.querySelector('.story-map__art');
  const items = [...map.querySelectorAll('.story-map__list li[data-stretch]')];
  let cancelled = false;

  // one tick per place, in the art (decorative: the art is aria-hidden)
  const ticks = items.map((li) => {
    const t = document.createElement('span');
    t.className = 'story-map__tick';
    t.style.setProperty('--s', String(Number(li.dataset.stretch) || 0));
    return t;
  });

  const update = () => {
    const links = items.map((li) => li.querySelector('a[href]')).filter(Boolean);
    markCurrent(links);
    items.forEach((li, i) => {
      const here = !!li.querySelector('a[aria-current]');
      ticks[i].classList.toggle('is-here', here);
    });
    if (art?.firstElementChild && !ticks[0]?.isConnected) art.append(...ticks);
  };

  async function paint() {
    if (!art) return;
    let svg = null;
    try { svg = sessionStorage.getItem(KEY); } catch { /* private mode: generate every time */ }
    if (!svg || !svg.startsWith('<svg')) {
      try {
        const make = typeof strip === 'function' ? await strip() : null;
        svg = typeof make === 'function' ? String(make(OPTS) || '') : '';
      } catch (err) {
        console.warn('story map: no strip', err);
        svg = '';
      }
      // cache only a painted strip (an engine stub returns an empty <svg>)
      if (/<(path|polygon|polyline)\b/.test(svg)) { try { sessionStorage.setItem(KEY, svg); } catch { /* full or blocked */ } }
    }
    // our own engine's output (a deterministic string), never user input
    if (!cancelled && svg.startsWith('<svg')) {
      art.innerHTML = svg;
      update();                                     // the ticks go in over the painted strip
    }
  }

  update();
  paint();
  try { sessionStorage.removeItem('ink:strip'); sessionStorage.removeItem('ink:strip:v2'); } catch { /* earlier caches: retired */ }

  live = {
    update,
    destroy() { cancelled = true; ticks.forEach((t) => t.remove()); live = null; },
  };
  return live;
}
