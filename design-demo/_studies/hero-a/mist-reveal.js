// mist-reveal.js — fallback for browsers without scroll-driven animations (Firefox today):
// toggles .is-in as elements enter, so they still emerge from the mist (and dissolve on the way out).
// With `animation-timeline: view()` support this module does nothing; CSS drives the reveal.

export function mistReveal(selector = '.mist-in, .ink-in') {
  if (CSS.supports('animation-timeline: view()')) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const els = document.querySelectorAll(selector);
  if (!els.length || !('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('io-reveal');
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.target.classList.toggle('is-in', e.isIntersecting)),
    { rootMargin: '0px 0px -18% 0px', threshold: 0 },
  );
  els.forEach((el) => io.observe(el));
}
