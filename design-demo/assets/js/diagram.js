// diagram.js — diagram strokes draw in, once (SPEC-R4A §9.7; they are not text, so they keep their draw-in).
//
//   import { initDiagrams } from '/assets/js/diagram.js';
//   const destroy = initDiagrams(main);      // every [data-draw] inside main (diagrams, rules)
//
//   <svg … data-draw>
//     <path class="diagram__edge" pathLength="1" data-order="1" d="…"/>   // strokes with data-order draw;
//     <path class="diagram__edge" pathLength="1" data-order="2" d="…"/>   // everything else never moves
//   </svg>
//   <hr class="…" data-draw>                                              // an HTML rule draws left to right
//
// When the element nears the viewport (its top crosses 90 % of the viewport height) its strokes draw in flow
// order: stroke-dashoffset 1 -> 0 over --dur-draw each, --draw-step apart (strokes that share a data-order
// draw together). Everything is drawn by the time the element is 60 % up the viewport, or at once if it was
// jumped past. Anything already on screen at init is drawn at rest.
// Drawn at rest: reduced motion, "Still the landscape" (html.is-still), no JS, print, forced colours.
// Print: every "Read as steps" list prints, open or closed (components.css + printSteps() below).
// Labels, nodes and bands never move, and no animated path carries a filter.
// (Round 4a: text never animates on scroll, so the round-3 mist-reveal.js is no longer loaded; the small
// trigger/settle observer pair it shared now lives here.)

const TRIGGER = 0.9; // start when the element's top crosses 90% of the viewport height
const SETTLE = 0.4;  // be finished when its top reaches 40% (60% up the viewport)

/** Already on screen or scrolled past (its top is above the bottom of the viewport): never hold it back. */
const reached = (el) => el.getBoundingClientRect().top < innerHeight;

/**
 * Watch elements once: `play(el)` when they near the viewport, `settle(el)` when they are 60% up. The top
 * margins are unbounded, so an element jumped straight past (End key, a fragment link) still plays and settles.
 * Elements already reached at call time get `settle(el, true)` immediately instead.
 */
function onScrollIn({ play, settle }) {
  const zone = (f) => `100000px 0px -${Math.round((1 - f) * 100)}% 0px`;
  const trig = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      trig.unobserve(e.target);
      play(e.target);
    }
  }, { rootMargin: zone(TRIGGER) });
  const done = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      done.unobserve(e.target);
      trig.unobserve(e.target);
      settle(e.target, false);
    }
  }, { rootMargin: zone(SETTLE) });
  return {
    add(el) {
      if (reached(el)) { settle(el, true); return; }
      trig.observe(el);
      done.observe(el);
    },
    destroy() { trig.disconnect(); done.disconnect(); },
  };
}

const bound = new WeakSet();
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const still = () => document.documentElement.classList.contains('is-still');
const token = (name, fallback) =>
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || fallback;

/** The element's strokes, grouped by data-order, in order. */
function groups(el) {
  const by = new Map();
  for (const s of el.querySelectorAll('[data-order]')) {
    const k = Number(s.getAttribute('data-order')) || 0;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(s);
  }
  return [...by.keys()].sort((a, b) => a - b).map((k) => by.get(k));
}

function draw(el) {
  const dur = token('--dur-draw', 520);
  const step = token('--draw-step', 90);
  const easing = 'cubic-bezier(.2, .7, .1, 1)';   // --ease-ink
  const strokes = groups(el);
  if (!strokes.length) {
    // an HTML rule: it draws in the reading direction
    el.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }],
      { duration: dur, easing, fill: 'backwards' });
    return;
  }
  strokes.forEach((group, i) => {
    for (const s of group) {
      s.animate([
        { strokeDasharray: '1 2', strokeDashoffset: 1.001 },
        { strokeDasharray: '1 2', strokeDashoffset: 0 },
      ], { duration: dur, delay: i * step, easing, fill: 'backwards' });
    }
  });
}

function animations(el) {
  return [el, ...el.querySelectorAll('[data-order]')].flatMap((n) => n.getAnimations());
}

/**
 * "Read as steps" prints whatever its toggle says: components.css opens the closed <details>' content slot in
 * print (::details-content), and this opens every closed one on beforeprint and closes it again on afterprint
 * (for engines without ::details-content). Returns its destroy().
 */
function printSteps(root) {
  const steps = [...root.querySelectorAll('details.diagram__steps')];
  if (!steps.length) return () => {};
  let opened = [];
  const before = () => {
    opened = steps.filter((d) => d.isConnected && !d.open);
    for (const d of opened) d.open = true;
  };
  const after = () => { for (const d of opened.splice(0)) d.open = false; };
  addEventListener('beforeprint', before);
  addEventListener('afterprint', after);
  return () => {
    removeEventListener('beforeprint', before);
    removeEventListener('afterprint', after);
    after();
  };
}

export function initDiagrams(root = document) {
  const unprint = printSteps(root);
  const els = [...root.querySelectorAll('[data-draw]')].filter((el) => !bound.has(el));
  if (!els.length) return unprint;
  for (const el of els) bound.add(el);
  // drawn at rest: nothing to hold back
  if (reduced() || still() || !('IntersectionObserver' in window)) {
    return () => { unprint(); for (const el of els) bound.delete(el); };
  }

  const watcher = onScrollIn({
    play(el) {
      if (!el.classList.contains('is-pending')) return;
      el.classList.remove('is-pending');
      draw(el);
    },
    settle(el, atInit) {
      if (atInit) return;                                        // reached at init: drawn at rest
      if (el.classList.contains('is-pending')) { el.classList.remove('is-pending'); return; }
      for (const a of animations(el)) a.finish();
    },
  });

  for (const el of els) {
    if (!reached(el)) el.classList.add('is-pending');
    watcher.add(el);
  }

  return () => {
    unprint();
    watcher.destroy();
    for (const el of els) {
      bound.delete(el);
      el.classList.remove('is-pending');
      for (const a of animations(el)) a.finish();
    }
  };
}
