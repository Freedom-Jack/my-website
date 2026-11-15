import type { ReactNode } from 'react';
import { PLACES, type PageId } from '@/features/landscape/places';
import { site } from '@content/site';
import { JsonLd } from '@/lib/jsonld';
import { Closing } from './Closing';
import { NextPlace } from './NextPlace';

/**
 * A page's <main>: it declares the page's place in the painting (data-stretch, data-distance, data-presence,
 * data-horizon, data-ground, data-inside: a deep page opens inside its place, and may name its own stretch-local u
 * there; the landscape and the navigation read them), ends on the way on (NextPlace: one line
 * pointing downstream, every page but Contact and the 404) and then on the page's own closing scene (every page but
 * the 404, which lies off the map). The print-only name line opens it (every page but the Résumé, which has its own
 * letterhead): printed pages hide the header (DESIGN §11.E answer 12). The page's own structured data (`ld`) goes
 * first, so the closing stays <main>'s last child and the tail its next sibling (layout.css).
 */
export function PageMain({
  page,
  children,
  className,
  ld = [],
  printName = true,
  glimpseEnd = false,
}: {
  page: PageId;
  children: ReactNode;
  /** the page's CSS Module root class (its layout rules are scoped under it) */
  className?: string;
  /** the page's JSON-LD blocks (Person is in the root layout) */
  ld?: unknown[];
  printName?: boolean;
  /** elements.ts glimpses: a short page ends on the place settled, near and large (Closing `end`) */
  glimpseEnd?: boolean;
}) {
  const place = PLACES[page];
  return (
    <main
      id="main"
      tabIndex={-1}
      className={className ? `frame ${className}` : 'frame'}
      data-page={place.page}
      data-stretch={place.stretch}
      data-distance={place.distance}
      data-presence={place.presence}
      data-horizon={place.horizon}
      data-ground={place.ground || undefined}
      data-inside={place.inside === true ? '' : typeof place.inside === 'number' ? place.inside : undefined}
    >
      {ld.map((data, i) => (
        <JsonLd key={i} data={data} />
      ))}
      {printName ? (
        <p className="print-name">
          {site.name} · {new URL(site.url).host}
        </p>
      ) : null}
      {children}
      <NextPlace page={page} />
      {place.closing ? <Closing end={glimpseEnd} /> : null}
    </main>
  );
}
