'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { initArrival } from './arrival';
import { initBrushLinks } from './brush-link';
import { initDiagrams } from './diagram';
import { initFinish } from './finish';
import { initInkButtons } from './ink-button';
import { updateNavMark } from './nav-mark';
import { initSeal } from './seal';
import { initSwash } from './swash';

/**
 * The small ink effects, bound to the DOM the server rendered (it reads the same without them):
 * once per visit the chrome's (the seal's stamp, the name's settle, the header's and footer's brush links), and
 * per page its <main>'s (brush links, ink buttons and rows, diagram draw-ins), unbound when the page goes.
 * Rendered last in the root layout, so it runs after the page's own components have laid out.
 */
export function Effects() {
  const pathname = usePathname();

  useEffect(() => {
    const header = document.querySelector('.site-header');
    const footer = document.querySelector('.site-footer');
    const offs = [
      initSeal(),
      initArrival(),
      initSwash(),
      header ? initBrushLinks(header) : null,
      footer ? initBrushLinks(footer) : null,
    ];
    return () => offs.forEach((off) => off?.());
  }, []);

  // navMark: a route change no click announced (back/forward) lifts and lays the nav's mark here (nav-mark.ts)
  useEffect(() => {
    updateNavMark();
  }, [pathname]);

  useEffect(() => {
    const main = document.getElementById('main');
    if (!main) return;
    const offs = [initBrushLinks(main), initInkButtons(main), initDiagrams(main), initFinish(main)];
    return () => offs.reverse().forEach((off) => off());
  }, [pathname]);

  return null;
}
