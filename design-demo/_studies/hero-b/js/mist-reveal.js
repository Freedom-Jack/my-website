/**
 * mist-reveal.js
 * Scroll emergence. Browsers with scroll-driven animations do this in CSS (animation-timeline: view()).
 * Elsewhere, an IntersectionObserver toggles .is-in once per element.
 */
export function mistReveal(selector = '.mist-reveal, .ink-in', { reduced = false } = {}) {
  if (reduced || CSS.supports('animation-timeline: view()') || !('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('reveal-io');
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }
  }, { rootMargin: '0px 0px -18% 0px', threshold: .2 });
  document.querySelectorAll(selector).forEach((el) => io.observe(el));
}
