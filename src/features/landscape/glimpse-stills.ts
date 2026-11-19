'use client';

/**
 * Images held until the reader nears them: each window's still (components/page/Glimpse) and every `img[data-near]`
 * (Home's portrait, the ending's picture of the next place, the tail's scroll map). Each carries its sources as data
 * attributes and gets them only once it comes within 60 % of a viewport's height, so none joins a page's first load
 * (`loading="lazy"` is not enough: Chrome fetches a lazy image within 1250 px of the viewport at once, and on a phone
 * it would count in Lighthouse's simulated LCP). `data-src-wide` names a second source for 640 px and up. Called by
 * the landscape at its mount (the page, and the tail once: it stays across pages) and by the navigation on every page
 * change (both already client code: no island of its own, no request for one). Without JavaScript a <noscript> twin,
 * where there is one, shows the image from the first paint.
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
    const wide = img.dataset.srcWide && matchMedia('(min-width: 40rem)').matches;
    img.src = (wide ? img.dataset.srcWide : img.dataset.src) || '';
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
