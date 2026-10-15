/**
 * mist-reveal.js — scroll language.
 *   mistReveal('.mist-in')   fallback only: CSS view() timelines do this natively
 *   inkIn('[data-ink-in]')   fallback only: adds .is-inked once, so numbers are painted in a
 *                            single timed pass where view() timelines are missing
 */
const once = (els, cls, margin) => {
  if (!els.length) return;
  if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add(cls)); return; }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add(cls);
      io.unobserve(entry.target);
    }
  }, { rootMargin: margin });
  els.forEach((el) => io.observe(el));
};

export function mistReveal(selector = '.mist-in') {
  if (CSS.supports('animation-timeline: view()')) return;
  once([...document.querySelectorAll(selector)], 'is-in', '0px 0px -12% 0px');
}

export function inkIn(selector = '[data-ink-in]') {
  if (CSS.supports('animation-timeline: view()')) return;
  once([...document.querySelectorAll(selector)], 'is-inked', '0px 0px -10% 0px');
}
