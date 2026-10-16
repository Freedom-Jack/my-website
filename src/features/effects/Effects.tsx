'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { initArrival } from './arrival';
import { initBrushLinks } from './brush-link';
import { initDiagrams } from './diagram';
import { initInkButtons } from './ink-button';
import { initSeal } from './seal';

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
      header ? initBrushLinks(header) : null,
      footer ? initBrushLinks(footer) : null,
    ];
    return () => offs.forEach((off) => off?.());
  }, []);

  useEffect(() => {
    const main = document.getElementById('main');
    if (!main) return;
    const offs = [initBrushLinks(main), initInkButtons(main), initDiagrams(main)];
    return () => offs.reverse().forEach((off) => off());
  }, [pathname]);

  return null;
}
