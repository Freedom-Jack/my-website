// pages/article.js — the Note's two reading aids (SPEC-R4A §10.6). A page module: no side effects at import.
//
//   <script type="module" src="/assets/js/pages/article.js" data-page-module></script>
//   main.js (or the demo router, after a swap) calls:
//     page.init({ main, config, landscape, signal });   // idempotent
//     page.destroy();                                   // undoes everything init() did; safe to call twice
//
// 1. Reading progress: only where CSS scroll-driven animations are missing, sets --read on .read-progress
//    from the note's position (the CSS does the drawing; same range as the CSS: cover 0% → contain 100%).
// 2. The author's seal at the end is stamped once, as it comes into view: triggered when its top passes
//    90% of the viewport, so the 680 ms stamp has landed well before the seal is 60% up the screen.
//    Already on screen (or scrolled past) at init, under "Still the landscape", or without
//    IntersectionObserver: it simply sits there. Reduced motion: article.css turns the stamp into a fade.
//    The seal is an image, not text: no text on this page moves (round 4a).
// Nothing here hides text. Without JS the stroke stays undrawn (where CSS can't drive it) and the seal
// simply sits there. (Round 3 borrowed the observer from mist-reveal.js; that module is retired, so the
// few lines it needed live here.)

let teardown = null;

function bind(main, signal) {
  const offs = [];
  const prose = main.querySelector('.prose');
  const bar = main.querySelector('.read-progress');

  // ---------------------------------------------------------------- reading progress (fallback only)
  const native = typeof CSS !== 'undefined' && CSS.supports?.('animation-timeline: view()');
  let raf = 0;
  if (!native && bar && prose) {
    const progress = () => {
      raf = 0;
      const r = prose.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (innerHeight - r.top) / Math.max(1, r.height)));
      bar.style.setProperty('--read', `${(p * 100).toFixed(2)}%`);
    };
    const update = () => { if (!raf) raf = requestAnimationFrame(progress); };
    addEventListener('scroll', update, { passive: true, signal });
    addEventListener('resize', update, { passive: true, signal });
    progress();
    offs.push(() => { cancelAnimationFrame(raf); raf = 0; bar.style.removeProperty('--read'); });
  }

  // ---------------------------------------------------------------- the author's seal
  const seal = main.querySelector('.colophon__seal');
  const still = document.documentElement.classList.contains('is-still');
  const reached = (el) => el.getBoundingClientRect().top < innerHeight * 0.9;
  if (seal && !still && 'IntersectionObserver' in window && !reached(seal)) {
    seal.classList.add('is-pending');
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.disconnect();
        seal.classList.remove('is-pending');
        seal.classList.add('is-stamping');
      }
    }, { rootMargin: '0px 0px -10% 0px' });
    io.observe(seal);
    // "Still the landscape" turned on while it waits: it simply appears
    const onStill = (e) => {
      if (!e.detail?.on) return;
      io.disconnect();
      seal.classList.remove('is-pending');
    };
    document.addEventListener('ink:still', onStill, { signal });
    offs.push(() => {
      io.disconnect();
      seal.classList.remove('is-pending', 'is-stamping');
    });
  }

  return () => offs.splice(0).forEach((off) => off());
}

export default {
  /** Bind the reading aids inside `main`. Idempotent. */
  init({ main, signal }) {
    if (teardown || !main || signal?.aborted) return;
    const ctrl = new AbortController();
    const off = bind(main, ctrl.signal);
    const done = () => {
      if (teardown !== done) return;
      teardown = null;
      signal?.removeEventListener('abort', done);
      ctrl.abort();
      off();
    };
    teardown = done;
    signal?.addEventListener('abort', done, { once: true });   // the host's signal tears it down too
  },
  /** Undo everything init() did. Safe to call twice. */
  destroy() {
    teardown?.();
  },
};
