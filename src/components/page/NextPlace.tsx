import type { CSSProperties } from 'react';
import { site } from '@content/site';
import { Arrow } from '@/components/ui/Arrow';
import { bandGeometry } from '@/features/landscape/band-geometry';
import { NEXT_PLACE, type PageId } from '@/features/landscape/places';
import { InlineLink } from '@/lib/inline';

/**
 * The way on: every page but Contact and the 404 ends on the next place downstream (Home → Work → Writing → Résumé
 * → Contact; a case and a note point past their own place). Its name is inscribed in the painting exactly where it
 * will stand as that page's own title (styles/band.css .inscription--next: the way to that place's hero, east of
 * this one's), so as the page is read and the scroll unrolls, the name comes into the band with its place. A real
 * anchor: the page change is the painting's own travel (features/navigation).
 */
export function NextPlace({ page }: { page: PageId }) {
  const next = NEXT_PLACE[page];
  if (!next) return null;
  const g = bandGeometry(page);
  return (
    <aside
      className="inscription inscription--next"
      aria-label={`${site.ending.label}: ${next.label}`}
      style={{ '--next-dl': g.next } as CSSProperties}
    >
      <div className="inscription__run">
        <InlineLink href={next.href} className="inscription__next title">
          {next.label}
          <Arrow />
        </InlineLink>
      </div>
    </aside>
  );
}
