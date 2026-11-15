'use client';

/**
 * The windows' stills (components/page/Glimpse; the lead's ruling R5): each window's <img> carries its sources as data
 * attributes and gets them only once the window comes within half a viewport, so no window still joins the first
 * load. `loading="lazy"` alone does not do it: Chrome fetches a lazy image within 1250 px of the viewport at once, and
 * Home's first window on a phone stands about 650 px below the fold. Home's portrait (`img[data-near]`, P6) is held the same way: as a
 * lazy image it joined Home's first load on a 412 px phone (66 KB, before the painting), and Lighthouse's simulated
 * LCP counted it. Called by the landscape at its mount and by the
 * navigation on every page change (both already client code: no island of its own, no request for one); without
 * JavaScript the <noscript> twin shows the still from the first paint.
 */
export function watchGlimpseStills(main: HTMLElement | null): () => void {
  if (!main) return () => {};
  const imgs = [
    ...main.querySelectorAll<HTMLImageElement>('[data-landscape="glimpse"] img[data-src], img[data-near][data-src]'),
  ].filter((img) => !img.getAttribute('src'));
  if (!imgs.length) return () => {};
  const show = (img: HTMLImageElement) => {
    if (img.getAttribute('src')) return;
    const set = img.dataset.srcset;
    if (set) img.srcset = set;
    img.src = img.dataset.src || '';
  };
  if (typeof IntersectionObserver !== 'function') {
    imgs.forEach(show);
    return () => {};
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        show(e.target as HTMLImageElement);
        io.unobserve(e.target);
      }
    },
    { rootMargin: '60% 0px 60% 0px' },
  );
  imgs.forEach((img) => io.observe(img));
  return () => io.disconnect();
}
