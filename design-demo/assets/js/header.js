// header.js — the returning header (SPEC-R4A §4).
//
//   import { initHeader } from '/assets/js/header.js';
//   const header = initHeader();   // { reset(), destroy() }
//   header.reset();                // after a route change: static again, re-reads the page's strip
//
// At rest at the top the header sits in normal flow, on paper, above the strip. Once the strip's art box
// ([data-landscape="strip"]) has scrolled away (its bottom <= 0) the header is armed: it turns sticky and
// hidden (.is-unpinned, placed without a slide because it is off screen at that moment). From then on,
// scrolling up >= 8 px brings it back SOLID (.is-pinned: paper and a 1 px mist rule, layout.css) and
// scrolling down >= 8 px slides it away again. Back at the very top it is static again.
// Sticky, never fixed: it never leaves the flow, so nothing below it moves when it changes state.
// Keyboard: never visibility:hidden or inert. Focus inside it pins it (and keeps it pinned while focus
// stays there); html's scroll-padding-top keeps anchors and focused elements clear of it.
// Reduced motion: CSS turns the slide into a 120 ms fade.

const STEP = 8;   // px of travel in one direction before the header reacts
// what arms the header, in order: the strip's art, a round-3 page head (alias for one round), main's first block
const ANCHORS = ['[data-landscape="strip"]', '[data-landscape="head"]', 'main > *'];

let live = null;

export function initHeader(root = document) {
  const header = root.querySelector('.site-header');
  if (!header) return { reset() {}, destroy() {} };
  if (live) return live;

  let state = 'static';     // 'static' | 'pinned' | 'unpinned'
  let anchor = null;
  let lastY = scrollY;
  let travel = 0;           // signed px moved in the current direction
  let raf = 0;
  let instantRaf = 0;

  const findAnchor = () => {
    for (const sel of ANCHORS) { const el = document.querySelector(sel); if (el) return el; }
    return null;
  };
  const anchorGone = () => {
    if (!anchor || !anchor.isConnected) anchor = findAnchor();
    return (anchor || header).getBoundingClientRect().bottom <= 0;
  };
  const focusInside = () => header.contains(document.activeElement) && document.activeElement !== document.body;

  function set(next, { instant = false } = {}) {
    if (next === state) return;
    state = next;
    cancelAnimationFrame(instantRaf);
    if (instant) {
      header.classList.add('is-instant');
      // two frames: the new state is styled (and painted) before transitions come back
      instantRaf = requestAnimationFrame(() => { instantRaf = requestAnimationFrame(() => header.classList.remove('is-instant')); });
    }
    header.classList.toggle('is-pinned', next === 'pinned');
    header.classList.toggle('is-unpinned', next === 'unpinned');
  }

  function update() {
    raf = 0;
    const y = scrollY;
    const dy = y - lastY;
    lastY = y;
    if (y <= 0) { set('static', { instant: true }); travel = 0; return; }
    if (state === 'static') {
      if (anchorGone()) { set('unpinned', { instant: true }); travel = 0; }
      return;
    }
    if (dy === 0) return;
    travel = Math.sign(dy) === Math.sign(travel) ? travel + dy : dy;
    if (travel <= -STEP && state !== 'pinned') set('pinned');
    else if (travel >= STEP && state !== 'unpinned' && !focusInside()) set('unpinned');
  }
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
  const onFocusIn = () => { if (state !== 'static') set('pinned'); };

  addEventListener('scroll', onScroll, { passive: true });
  header.addEventListener('focusin', onFocusIn);
  update();

  live = {
    /** Static at the top again (after a route change); the next scroll re-arms it from the new strip. */
    reset() {
      cancelAnimationFrame(raf);
      raf = 0;
      anchor = null;
      lastY = scrollY;
      travel = 0;
      set('static', { instant: true });
      update();
    },
    destroy() {
      removeEventListener('scroll', onScroll);
      header.removeEventListener('focusin', onFocusIn);
      cancelAnimationFrame(raf);
      cancelAnimationFrame(instantRaf);
      header.classList.remove('is-pinned', 'is-unpinned', 'is-instant');
      live = null;
    },
  };
  return live;
}
