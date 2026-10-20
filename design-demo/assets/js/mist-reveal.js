// mist-reveal.js — one-shot scroll reveals, one behaviour per tier (SPEC-R3 §2.3).
//
//   import { initMistReveal } from '/assets/js/mist-reveal.js';
//   const destroy = initMistReveal(main);                       // every [data-reveal] inside main
//   <h2 class="t-main" data-reveal="bloom">…</h2>              // MAIN below the first screen
//   <p class="t-figure" data-reveal="fade">321%</p>            // SUPPORTING text, figures, years
//   data-reveal-delay="120"                                     // optional stagger, ms
//
//   bloom   an ink bloom, once: opacity + <= 5 px blur + a .55rem settle over --dur-reveal (780 ms)
//   fade    opacity 0 -> 1 over --dur-fade (280 ms): no blur, no shift. A bare data-reveal is a fade.
//   Reduced motion: both are a 280 ms fade. Paragraphs, lists and small print never get data-reveal.
//
// Rules this module guarantees:
//   - Triggered, then timed. Never scrubbed by the scroll position.
//   - Fully settled by the time the element's top is 60% up the viewport (it is finished early if needed).
//   - Anything already on screen (or already scrolled past) at init is never hidden: an element whose
//     top is anywhere above the bottom of the viewport has been painted, and stays. No text can sit
//     hidden or blurred at rest, even after a jump straight past it (End key, a scrollbar drag, a
//     fragment link): the trigger and settle zones reach up without limit, so an element that goes from
//     below the screen to above it in one frame still plays and settles.
//   - Without JS nothing is hidden at all (the waiting state is a class this module adds).
//   - Blur is for MAIN text only (data-reveal="bloom", at most 5 px).
// Idempotent: elements that are already bound are skipped. Returns destroy(), which unbinds and reveals.
//
// Also exports the shared trigger/settle observer pair, onScrollIn() (ink-figures.js and page scripts
// use it), and reached(), the "do not hide this" test every one-shot effect applies at init.
//
// The observers are vertical. An element that enters sideways (inside a pinned, translated track, like
// About's handscroll) with its top already above the settle line gets play and settle in the same
// frame: it simply appears. Place one-shot effects in such tracks below 40% of the viewport height.

export const TRIGGER = 0.9; // start when the element's top crosses 90% of the viewport height
export const SETTLE = 0.4;  // be finished when its top reaches 40% (60% up the viewport)

const bound = new WeakSet();
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const token = (name, fallback) =>
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || fallback;

/**
 * True when the element is already on screen or scrolled past (its top is above the bottom of the
 * viewport): it has been painted, so never hide it. Content that arrives later plays from the 90%
 * trigger line (onScrollIn).
 */
export function reached(el) {
  return el.getBoundingClientRect().top < innerHeight;
}

/**
 * Watch elements once: `play(el)` when they near the viewport, `settle(el)` when they are 60% up.
 * Elements already reached at call time get `settle(el, true)` immediately instead.
 * @returns {{ add(el: Element): void, destroy(): void }}
 */
export function onScrollIn({ play, settle }) {
  // the top margin is unbounded: anything above the line counts as in, however far it was jumped past
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

const isBloom = (el) => el.dataset.reveal === 'bloom';

function frames(el) {
  if (reduced() || !isBloom(el)) return [{ opacity: 0 }, { opacity: 1 }];
  return [
    { opacity: 0, filter: 'blur(5px)', translate: '0 .55rem' },
    { opacity: 1, offset: 0.55 },
    { opacity: 1, filter: 'blur(0px)', translate: '0 0' },
  ];
}

function duration(el) {
  if (reduced()) return 280;
  return isBloom(el) ? token('--dur-reveal', 780) : token('--dur-fade', 280);
}

function easing(el) {
  return isBloom(el) && !reduced() ? 'cubic-bezier(.2, .7, .1, 1)' : 'cubic-bezier(.3, .6, .2, 1)';
}

export function initMistReveal(root = document, { selector = '[data-reveal]' } = {}) {
  if (!('IntersectionObserver' in window)) return () => {};
  const els = [...root.querySelectorAll(selector)].filter((el) => !bound.has(el));
  if (!els.length) return () => {};

  const watcher = onScrollIn({
    play(el) {
      if (!el.classList.contains('is-pending')) return;
      el.classList.remove('is-pending');
      el.animate(frames(el), {
        duration: duration(el),
        delay: Number(el.dataset.revealDelay) || 0,
        easing: easing(el),
        fill: 'backwards',
      });
    },
    settle(el, atInit) {
      if (atInit) return; // reached at init: never hidden, nothing to do
      if (el.classList.contains('is-pending')) { el.classList.remove('is-pending'); return; }
      for (const a of el.getAnimations()) a.finish();
    },
  });

  for (const el of els) {
    bound.add(el);
    if (!reached(el)) el.classList.add('is-pending');
    watcher.add(el);
  }

  return () => {
    watcher.destroy();
    for (const el of els) {
      bound.delete(el);
      el.classList.remove('is-pending');
      for (const a of el.getAnimations()) a.finish();
    }
  };
}
