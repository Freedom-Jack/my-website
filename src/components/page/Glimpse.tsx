import { ELEMENTS } from '@/features/landscape/elements';

/**
 * Windows into the painting (elements.ts `glimpses`): an empty box at one of a page's major breaks that the painting
 * fills below 1200 px with the page's own place, each one further along it (engine GLIMPSE: the windows of a page are
 * one handscroll unrolled, east-going and level). Art only, hidden from assistive technology and
 * from print; at 1200 px and up it is not laid out at all (layout.css).
 * `phone`: on phones only (a tablet's column is shorter and takes one window fewer). A phone held sideways shows none
 * (its 390 px screen keeps the strip and the closing only). `still`: the window's own still
 * (public/scenes/glimpse/<still>@1x|2x.webp, cut by build:stills at its rest pose), shown until the engine paints it
 * and wherever it cannot (no WebGL, a software rasteriser, the live probe's still, the governor's veto). It is an
 * <img> inside the box whose sources are data attributes until the window comes within 60 % of a viewport's height
 * (features/landscape/glimpse-stills.ts, run by the landscape and the navigation), so it never joins the first load;
 * without JavaScript the <noscript> twin shows it from the first paint.
 */
export function Glimpse({ phone = false, still }: { phone?: boolean; still: string }) {
  if (!ELEMENTS.glimpses) return null;
  const className = ['glimpse', phone ? 'glimpse--phone' : '', 'bleed'].filter(Boolean).join(' ');
  const src = (d: 1 | 2) => `/scenes/glimpse/${still}@${d}x.webp`;
  return (
    <div className={className} data-landscape="glimpse" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- a static WebP the tool cut, fetched only near the viewport; next/image's chunk stays out of the first load */}
      <img
        className="glimpse__still"
        data-src={src(1)}
        data-srcset={`${src(1)} 1x, ${src(2)} 2x`}
        alt=""
        loading="lazy"
        decoding="async"
        fetchPriority="low"
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element -- the no-JS still */}
        <img className="glimpse__still" src={src(1)} srcSet={`${src(1)} 1x, ${src(2)} 2x`} alt="" decoding="async" />
      </noscript>
    </div>
  );
}
