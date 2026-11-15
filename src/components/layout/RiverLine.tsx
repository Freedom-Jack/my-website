'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { ELEMENTS } from '@/features/landscape/elements';
import { placeForPath } from '@/features/landscape/places';

/**
 * The river line (elements.ts riverMark): under the header's row, a hairline the header's width with five ticks,
 * one under each stop (the home link, then the four nouns, the painting's order), and the mark: a jade dot that
 * stands under the current page's tick and travels to the next stop as the page scrolls, so it is the reader's
 * "you are here" on the whole scroll, and the current page's one mark. The travel is a CSS scroll-driven animation
 * on `translate` alone (layout.css: the compositor, no script per frame); this effect only measures the ticks' x
 * once per route, resize and font load and writes them as custom properties. Without scroll timelines, under
 * reduced motion and under Still the dot simply stands under the current stop (the finished state is the default
 * CSS). The current link's aria-current is the accessible "you are here"; the line is decoration for assistive
 * technology (aria-hidden). The 404 is off the map: its line carries the ticks and no mark.
 */
const STOPS = 5;

export function RiverLine() {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const line = ref.current;
    const header = line?.closest<HTMLElement>('.site-header');
    if (!line || !header) return;
    const place = placeForPath(pathname || '/');
    const here = place.stretch > 4 ? -1 : place.stretch; // (the 404 is off the map: no mark)
    const next = here < 0 ? -1 : Math.min(STOPS - 1, here + 1);
    let raf = 0;
    const measure = () => {
      raf = 0;
      const inner = header.querySelector<HTMLElement>('.site-header__inner');
      const home = header.querySelector<HTMLElement>('.home-link');
      const nouns = [...header.querySelectorAll<HTMLElement>('.site-nav__list a')];
      if (!inner || !home || nouns.length < STOPS - 1) return;
      const base = inner.getBoundingClientRect();
      const centre = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        return r.left - base.left + r.width / 2;
      };
      // (the home link's tick stands at its words' start, not its centre: the name is the first stop's left edge)
      const homeRect = home.getBoundingClientRect();
      const xs = [
        homeRect.left - base.left + Math.min(10, homeRect.width / 2),
        ...nouns.slice(0, STOPS - 1).map(centre),
      ];
      xs.forEach((x, i) => line.style.setProperty(`--tick-${i}`, `${x.toFixed(1)}px`));
      line.style.setProperty('--x0', `${(here < 0 ? xs[0] : xs[here]!).toFixed(1)}px`);
      line.style.setProperty('--x1', `${(next < 0 ? xs[0] : xs[next]!).toFixed(1)}px`);
      line.dataset.here = here < 0 ? '' : String(here);
    };
    const soon = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(soon) : null;
    ro?.observe(header);
    document.fonts?.addEventListener?.('loadingdone', soon);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      document.fonts?.removeEventListener?.('loadingdone', soon);
    };
  }, [pathname]);

  if (!ELEMENTS.riverMark) return null;
  return (
    <div className="river" ref={ref} aria-hidden="true">
      {Array.from({ length: STOPS }, (_, i) => (
        <span key={i} className="river__tick" data-stop={i} />
      ))}
      <span className="river__mark" />
    </div>
  );
}
