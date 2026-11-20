import type { CSSProperties, ReactNode } from 'react';
import { bandGeometry } from '@/features/landscape/band-geometry';
import { PLACES, type PageId } from '@/features/landscape/places';
import { site } from '@content/site';
import { JsonLd } from '@/lib/jsonld';
import { NextPlace } from './NextPlace';

/**
 * A page's <main>: it declares the page's place in the painting (data-stretch, data-distance, data-presence,
 * data-horizon, data-ground, data-inside; the landscape and the navigation read them), holds the engine's anchor
 * (the strip's box at the page's top, out of the flow: styles/shell.css .band-anchor), sets the page's band
 * geometry for its styles (how close it stands, how far it travels: features/landscape/band-geometry) and ends on
 * the way on (NextPlace: every page but Contact and the 404). The print-only name line opens it (every page but the Résumé,
 * which has its own letterhead). The page's own structured data (`ld`) goes first.
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
  const g = bandGeometry(page);
  return (
    <main
      id="main"
      tabIndex={-1}
      className={className}
      style={{ '--band-inside': g.inside, '--travel': g.travel } as CSSProperties}
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
      <div className="band-anchor" data-landscape="strip" aria-hidden="true" />
      {printName ? (
        <p className="print-name">
          {site.name} · {new URL(site.url).host}
        </p>
      ) : null}
      {children}
      <NextPlace page={page} />
    </main>
  );
}
