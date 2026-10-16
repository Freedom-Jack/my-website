import type { ReactNode } from 'react';
import { PLACES, type PageId } from '@/features/landscape/places';
import { site } from '@content/site';
import { JsonLd } from '@/lib/jsonld';
import { Closing } from './Closing';

/**
 * A page's <main>: it declares the page's place in the painting (data-stretch, data-distance, data-presence,
 * data-horizon, data-ground; the landscape and the navigation read them), and ends on the page's own closing
 * scene when the page is a long one. The print-only name line opens it (every page but the Résumé, which has
 * its own letterhead): printed pages hide the header (DESIGN §11.E answer 12). The page's own structured data
 * (`ld`) goes first, so the closing stays <main>'s last child and the footer its next sibling (layout.css).
 */
export function PageMain({
  page,
  children,
  className,
  ld = [],
  printName = true,
}: {
  page: PageId;
  children: ReactNode;
  /** the page's CSS Module root class (its layout rules are scoped under it) */
  className?: string;
  /** the page's JSON-LD blocks (Person is in the root layout) */
  ld?: unknown[];
  printName?: boolean;
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
      {place.closing ? <Closing /> : null}
    </main>
  );
}
