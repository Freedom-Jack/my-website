'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { initDiagrams } from './diagram';
import { initFinish } from './finish';

/**
 * The small effects, bound to the DOM the server rendered (it reads the same without them): per page, its
 * <main>'s diagram draw-ins and the finish (the row rule, the diagram's flow dot), unbound when the page goes.
 * The vanguard round retired the seal's stamp, the name's settle and swash, the brush links, the ink buttons and
 * the nav's mark: the first screen is finished at first paint, and jade is a mark, never a gesture.
 * Rendered last in the root layout, so it runs after the page's own components have laid out.
 */
export function Effects() {
  const pathname = usePathname();

  useEffect(() => {
    const main = document.getElementById('main');
    if (!main) return;
    const offs = [initDiagrams(main), initFinish(main)];
    return () => offs.reverse().forEach((off) => off());
  }, [pathname]);

  return null;
}
