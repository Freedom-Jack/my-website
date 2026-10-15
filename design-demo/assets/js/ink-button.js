// ink-button.js — ink blooms from where the pointer enters, and drains out where it leaves.
//
//   import { initInkButtons } from '/assets/js/ink-button.js';
//   const destroy = initInkButtons();               // binds .ink-btn and .ink-row in the document
//
//   <a class="ink-btn" href="/work/">
//     <span class="ink-btn__ink" aria-hidden="true"></span>
//     <span class="ink-btn__label">See the work<span class="ink-btn__arrow" aria-hidden="true"></span></span>
//   </a>
//
// CSS does the bloom (effects.css: registered --ink-r on a radial gradient, feathered by #ink-feather,
// masked by the swash stroke). This module only moves the bloom's origin (--x/--y), sizes its reach
// (--rmax), keeps the arrow's label colour in register (--ax/--ay), blooms keyboard focus from the
// centre, and drops 2–3 decaying rings on press (WAAPI). Without JS the bloom grows from the centre.
// A button's ink reaches past its farthest corner (it fills the stroke). A row's wash stops short: its
// front comes to rest ~80% of the way to the row's far edge, so the tide line stays in view.
//
// Holding still under the page wash: when a press on a control starts the page-transition flood,
// ink-transition.js dispatches 'ink:cover' on the pressed link. The control then holds exactly as it
// is: its press rings lift (the flood from the same point is the press feedback now) and every
// transitioned property of it and its descendants is pinned at its current value. The blocking wash
// takes the pointer's hover away, and without the hold the bloom would recede, the arrow slide back
// and the brush lift under the flood, re-rasterising the SVG-filtered ink on every frame of it, and
// the flood would stutter. 'ink:reveal' (the wash receding, e.g. back from the bfcache) lets go, and
// the control then eases from where it was held to its current state.
// Idempotent; returns destroy().

const bound = new WeakSet();
const held = new Map();   // control -> pins [node, property, previous inline value, previous priority]
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Pin every transitioned property of el and its descendants at its current value; lift the rings. */
function hold(el) {
  if (held.has(el)) return;
  for (const ring of el.querySelectorAll('.ink-btn__ring')) {
    ring.getAnimations().forEach((a) => a.cancel());
    ring.remove();
  }
  // read everything first: writing `transition: none` and then reading would end a running
  // transition at its target value, which is the jump this avoids
  const reads = [];
  for (const node of [el, ...el.querySelectorAll('*')]) {
    const cs = getComputedStyle(node);
    const props = cs.transitionProperty.split(',').map((p) => p.trim()).filter((p) => p && p !== 'none' && p !== 'all');
    if (props.length) reads.push([node, props.map((p) => [p, cs.getPropertyValue(p)])]);
  }
  const pins = [];
  const pin = (node, p, v) => {
    pins.push([node, p, node.style.getPropertyValue(p), node.style.getPropertyPriority(p)]);
    node.style.setProperty(p, v);
  };
  for (const [node, values] of reads) {
    pin(node, 'transition', 'none');
    for (const [p, v] of values) pin(node, p, v);
  }
  held.set(el, pins);
}

/** Undo hold(): restore the inline styles in one change, so the CSS transitions run from the held values. */
function release(el) {
  const pins = held.get(el);
  if (!pins) return;
  held.delete(el);
  for (const [node, p, v, priority] of pins.reverse()) {
    if (v) node.style.setProperty(p, v, priority);
    else node.style.removeProperty(p);
  }
}

const RINGS = [
  { delay: 0, dur: 720, to: 1.05, alpha: 0.9 },
  { delay: 110, dur: 860, to: 0.78, alpha: 0.55 },
  { delay: 230, dur: 980, to: 0.56, alpha: 0.3 },
];

function place(el, clientX, clientY) {
  const r = el.getBoundingClientRect();
  const x = clientX - r.left;
  const y = clientY - r.top;
  el.style.setProperty('--x', `${x.toFixed(1)}px`);
  el.style.setProperty('--y', `${y.toFixed(1)}px`);
  if (el.classList.contains('ink-row')) {
    // the wash spills into the margin (its ::before is inset by --bleed, a negative length); it comes
    // to rest at 80% of the way from the entry point to the far edge of that bleed box
    const bleed = Math.abs(parseFloat(getComputedStyle(el, '::before').left) || 0);
    const far = Math.max(x, r.width - x) + bleed;
    el.style.setProperty('--rmax', `${Math.round(far * 0.8)}px`);
  } else {
    // reach the farthest corner of the ink layer, plus the feathered rim
    const cs = getComputedStyle(el);
    const dx = parseFloat(cs.getPropertyValue('--ink-dx')) || 26;     // left overhang of the ink layer
    const tail = parseFloat(cs.getPropertyValue('--ink-tail')) || dx; // right overhang
    const dy = parseFloat(cs.getPropertyValue('--ink-dy')) || 15;
    const fx = Math.max(x + dx, r.width - x + tail);
    const fy = Math.max(y, r.height - y) + dy;
    el.style.setProperty('--rmax', `${Math.round(Math.hypot(fx, fy) + 46)}px`);
  }
  const arrow = el.querySelector('.ink-btn__arrow');
  if (arrow) {
    const a = arrow.getBoundingClientRect();
    el.style.setProperty('--ax', `${(a.left - r.left).toFixed(1)}px`);
    el.style.setProperty('--ay', `${(a.top - r.top).toFixed(1)}px`);
  }
}

function centre(el) {
  const r = el.getBoundingClientRect();
  place(el, r.left + r.width / 2, r.top + r.height / 2);
}

function rings(btn, clientX, clientY) {
  if (reduced()) return;
  const ink = btn.querySelector('.ink-btn__ink');
  if (!ink) return;
  const r = ink.getBoundingClientRect();
  // paper rings on a bloomed (dark) stroke, ink rings on the pale resting wash (e.g. a touch tap)
  const dark = btn.matches(':hover, :focus-visible');
  for (const ring of RINGS) {
    const el = document.createElement('span');
    el.className = 'ink-btn__ring';
    el.style.left = `${clientX - r.left}px`;
    el.style.top = `${clientY - r.top}px`;
    if (!dark) el.style.setProperty('--ring', 'rgb(17 20 22 / .38)');
    ink.append(el);
    el.animate(
      [{ transform: 'scale(.08)', opacity: ring.alpha }, { transform: `scale(${ring.to})`, opacity: 0 }],
      { duration: ring.dur, delay: ring.delay, easing: 'cubic-bezier(.2, .7, .1, 1)', fill: 'both' },
    ).finished.then(() => el.remove(), () => el.remove());
  }
}

export function initInkButtons(root = document, selector = '.ink-btn, .ink-row') {
  const els = [...root.querySelectorAll(selector)].filter((el) => !bound.has(el));
  const mine = new Set(els);
  const offs = [];
  const listen = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); offs.push(() => target.removeEventListener(type, fn, opts)); };
  for (const el of els) {
    bound.add(el);
    const isBtn = el.classList.contains('ink-btn');
    // while the control holds still under the page wash, it ignores the pointer and the keyboard
    const on = (type, fn) => listen(el, type, (e) => { if (!held.has(el)) fn(e); });
    on('pointerenter', (e) => place(el, e.clientX, e.clientY));
    on('pointerleave', (e) => place(el, e.clientX, e.clientY));
    on('focusin', () => { if (el.matches(':focus-visible, :has(:focus-visible)')) centre(el); });
    if (isBtn) {
      on('pointerdown', (e) => { if (e.button === 0) rings(el, e.clientX, e.clientY); });
      on('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const r = el.getBoundingClientRect();
        rings(el, r.left + r.width / 2, r.top + r.height / 2);
      });
    }
  }
  if (els.length) {
    // ink-transition.js: the flood starts from a press inside one of these controls / the wash recedes
    listen(document, 'ink:cover', (e) => {
      const el = e.target instanceof Element ? e.target.closest(selector) : null;
      if (el && mine.has(el)) hold(el);
    });
    listen(document, 'ink:reveal', () => { for (const el of [...held.keys()]) if (mine.has(el)) release(el); });
  }
  return () => {
    offs.forEach((off) => off());
    els.forEach((el) => { release(el); bound.delete(el); });
  };
}
