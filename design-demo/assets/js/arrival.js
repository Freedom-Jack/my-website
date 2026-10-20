// arrival.js — the name's ink settle on a full page load (SPEC-R4A §9.1).
//
//   import { initArrival } from '/assets/js/arrival.js';
//   const entrance = initArrival();   // { release(), finish(), seek(ms), destroy() }
//   entrance.finish();                // settle at once (main.js's 2.5 s safety net)
//   entrance.seek(ms);                // DEMO ONLY (demo.js ?t=): freeze the settle at one moment
//
// Round 4a: nothing on the first screen is hidden, faded or blurred at first paint. The name
// ([data-arrive="name"], Home only) is readable the moment it is painted: it only wears a feathered ink
// edge (the #ink-arrive filter, effects.css) whose displacement this module relaxes from 8 to 0 over
// --dur-settle (400 ms), then html.is-arrived drops the filter. Every other data-arrive is retired and
// does nothing. Reduced motion: no edge at all. After a route change (html.is-routed) CSS drops it.
// If this module never runs, the inline boot script adds .is-arrived after 3 s.

const FEATHER_MAX = 8;      // px of displacement at the very start (the markup's initial scale)
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const settleMs = () =>
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dur-settle')) || 400;

export function initArrival() {
  const html = document.documentElement;
  const name = document.querySelector('[data-arrive="name"]');
  const map = document.querySelector('#ink-arrive feDisplacementMap');
  let raf = 0;
  let last = -1;
  let t0 = 0;
  const dur = settleMs();

  const setFeather = (px) => {
    const v = Math.round(px * 100) / 100;
    if (v !== last) { map?.setAttribute('scale', String(v)); last = v; }
  };
  const settle = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    setFeather(0);
    html.classList.add('is-arrived');
  };
  const tick = (now) => {
    if (!t0) t0 = now;
    const t = Math.min(1, (now - t0) / dur);
    setFeather(FEATHER_MAX * (1 - easeOut(t)));
    if (t >= 1) { settle(); return; }
    raf = requestAnimationFrame(tick);
  };

  if (!name || !map || reduced() || html.classList.contains('is-arrived')) settle();
  else raf = requestAnimationFrame(tick);

  return {
    release() { /* round-2 API: nothing is ever held now */ },
    finish() { settle(); },
    seek(ms) {
      cancelAnimationFrame(raf);
      raf = 0;
      if (reduced() || !name) return;
      html.classList.remove('is-arrived');
      setFeather(FEATHER_MAX * (1 - easeOut(Math.min(1, Math.max(0, ms) / dur))));
    },
    destroy() { settle(); },
  };
}
