/**
 * main.js: wires the hero study together. Each effect is a self-contained module with a tiny init API.
 */
import { createInkLandscape } from './ink-landscape.js';
import { paintFallback } from './landscape-fallback.js';
import { inkName } from './ink-name.js';
import { inkButtons } from './ink-button.js';
import { mistReveal } from './mist-reveal.js';
import { params, holdAt, applyDemoParams } from './demo.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// The seal is stamped once per session.
try {
  if (sessionStorage.getItem('sealed') && holdAt === null) document.documentElement.classList.add('sealed');
  else sessionStorage.setItem('sealed', '1');
} catch { /* storage blocked: stamp every time */ }

inkName('ink-name', { reduced, at: holdAt });

// Landscape: WebGL2 wet-ink bloom, else a static 2D painting of the same ridges.
let canvas = document.getElementById('scape');
const fallback = () => {
  const fresh = canvas.cloneNode();
  canvas.replaceWith(fresh);
  canvas = fresh;
  return paintFallback(fresh);
};
let scape = params.has('nogl') ? null : createInkLandscape(canvas, { reduced, onFail: () => { scape = fallback(); } });
if (!scape) scape = fallback();

// Thicken the mist behind the hero copy.
const copy = document.getElementById('hero-copy');
const syncSafe = () => scape?.setSafeRect(copy.getBoundingClientRect(), .5);
syncSafe();
document.fonts?.ready.then(syncSafe);
addEventListener('resize', syncSafe);

inkButtons('.ink-btn', { reduced });
mistReveal('.mist-reveal, .ink-in', { reduced });

// Safety net: an entrance animation must never leave content hidden, even when a browser
// throttles the animation clock (background tabs, embedded webviews, headless capture).
if (holdAt === null) {
  setTimeout(() => {
    for (const a of document.getAnimations()) {
      if (a.timeline === document.timeline && a.playState !== 'finished') a.finish();
    }
  }, 2600);
}

applyDemoParams({ scape });
