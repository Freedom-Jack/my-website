'use client';

import Link from 'next/link';
import { useCurrent } from '@/features/chrome/current';

/**
 * The tail's five names: Home · Work · Writing · Résumé · Contact, the painting's order (features/landscape/places
 * STORY_MAP), each a link, the current page (or its section) marked with aria-current. Nothing is current on the
 * 404, which lies off the map.
 */
export function TailNames({
  label,
  places,
}: {
  label: string;
  places: ReadonlyArray<{ readonly href: string; readonly label: string }>;
}) {
  const current = useCurrent();
  return (
    <nav className="tail__names" aria-label={label}>
      <ul role="list">
        {places.map((p) => (
          <li key={p.href}>
            <Link href={p.href} aria-current={current(p.href)} prefetch={false}>
              {p.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
