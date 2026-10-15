// still.js — "Still the landscape" (SPEC-R3 §4.7; WCAG 2.2.2 Pause, Stop, Hide).
//
//   import { initStill, isStill } from '/assets/js/still.js';
//   const still = initStill({ getLandscape: () => handle });   // { on, apply(handle), destroy() }
//
// A toggle button in the footer with a constant label and aria-pressed. Pressed: all ambient motion stops
// for the rest of the session: the landscape's drift, wake, sweeps, bloom and pans (landscape.setStill;
// scroll-driven states and veils still follow the text, without animation), and route changes take the
// reduced-motion form (transition.js reads isStill()). Its brush mark stays drawn while pressed.
// Stored in sessionStorage 'ink:still' = '1'; the inline boot script adds html.is-still before first paint.
// Hidden without JS (it does nothing without it). Dispatches 'ink:still' ({ detail: { on } }) on document.

const KEY = 'ink:still';
const html = () => document.documentElement;

/** True while the landscape is stilled for this session (the toggle, not prefers-reduced-motion). */
export const isStill = () => html().classList.contains('is-still');

let live = null;

export function initStill({ getLandscape = () => null, root = document } = {}) {
  if (live) return live;
  const btn = root.querySelector('.still-toggle');
  let on = isStill();

  const apply = (land = getLandscape()) => {
    // setStill is the engine's round-3 method; until it lands the landscape simply keeps its drift
    // (pause() would freeze the veils too, which would leave text over bare painting while scrolling)
    if (land && typeof land.setStill === 'function') land.setStill(on);
  };
  const render = () => {
    html().classList.toggle('is-still', on);
    btn?.setAttribute('aria-pressed', String(on));
  };
  const onClick = () => {
    on = !on;
    try { if (on) sessionStorage.setItem(KEY, '1'); else sessionStorage.removeItem(KEY); } catch { /* not remembered */ }
    render();
    apply();
    document.dispatchEvent(new CustomEvent('ink:still', { detail: { on } }));
  };

  render();
  btn?.addEventListener('click', onClick);

  live = {
    get on() { return on; },
    apply,
    destroy() { btn?.removeEventListener('click', onClick); live = null; },
  };
  return live;
}
