'use client';

import { type RefObject, useEffect } from 'react';

/**
 * .site-header.is-stacked while the nav sits on a row of its own under the home link (below 340 px), so CSS
 * can tell the two layouts apart.
 */
export function useStackedHeader(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const header = ref.current;
    const home = header?.querySelector<HTMLElement>('.home-link');
    const nav = header?.querySelector<HTMLElement>('.site-nav');
    if (!header || !home || !nav || typeof ResizeObserver !== 'function') return;
    const check = () => header.classList.toggle('is-stacked', nav.offsetTop >= home.offsetTop + home.offsetHeight - 1);
    const ro = new ResizeObserver(check);
    ro.observe(header);
    return () => {
      ro.disconnect();
      header.classList.remove('is-stacked');
    };
  }, [ref]);
}
