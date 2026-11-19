'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { initDiagrams } from './diagram';
import { initFinish } from './finish';

/**
 * The small effects, bound to the DOM the server rendered (it reads the same without them): per page, its
 * <main>'s diagram draw-ins and the finish (the row rule, the diagram's flow dot, the rows' wash), unbound when the
 * page goes.
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
