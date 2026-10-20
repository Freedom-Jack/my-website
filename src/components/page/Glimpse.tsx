import type { CSSProperties } from 'react';
import { ELEMENTS } from '@/features/landscape/elements';

/**
 * Windows into the painting (elements.ts `glimpses`, step 3b): an EMPTY box at one of a page's major breaks that the
 * painting fills below 1200 px with the page's own place, each one further along it and higher in one climb (engine
 * GLIMPSE: the windows of a page are one handscroll unrolled; the closing brings it back down). Art only, hidden from
 * assistive technology and from print; at 1200 px and up it is not laid out at all (layout.css), so wide screens keep
 * the approved page. `phone`: on phones only (a tablet's column is shorter and takes one window fewer). A phone held
 * sideways shows none (its 390 px screen keeps the strip and the closing only). `still`: the window's own still (public/scenes/glimpse/<still>@2x.webp, cut by
 * build:stills at its rest pose), shown until the engine paints it and wherever it cannot (no WebGL, a software
 * rasteriser, the governor's veto).
 */
export function Glimpse({ phone = false, still }: { phone?: boolean; still?: string }) {
  if (!ELEMENTS.glimpses) return null;
  const className = ['glimpse', phone ? 'glimpse--phone' : '', 'bleed'].filter(Boolean).join(' ');
  const style = still
    ? ({
        '--glimpse-still': `image-set(url('/scenes/glimpse/${still}@1x.webp') 1x, url('/scenes/glimpse/${still}@2x.webp') 2x)`,
      } as CSSProperties)
    : undefined;
  return <div className={className} data-landscape="glimpse" aria-hidden="true" style={style} />;
}
