'use client';

import Link from 'next/link';
import { useCurrent } from '@/features/chrome/current';

/**
 * The whole scroll in miniature, at the tail of every page (round 7): its five places in the painting's order
 * (features/landscape/places STORY_MAP), each the place's own first frame (the hero still build:heroes cuts,
 * public/scenes/hero/<place>-wide@1x.webp, fetched only as the tail nears) with its name under it, a link to its
 * page; the current page (or its section) is sealed with aria-current. Nothing is current on the 404, which lies
 * off the map. The pictures are decorative: the names are the links' words.
 */
export function ScrollMap({
  label,
  places,
}: {
  label: string;
  places: ReadonlyArray<{ readonly href: string; readonly label: string; readonly still: string }>;
}) {
  const current = useCurrent();
  return (
    <nav className="scrollmap" aria-label={label}>
      <ol role="list">
        {places.map((p) => (
          <li key={p.href}>
            <Link href={p.href} aria-current={current(p.href)} prefetch={false}>
              <span className="scrollmap__art" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element -- a static WebP the heroes tool cut; lazy */}
                <img
                  src={`/scenes/hero/${p.still}-wide@1x.webp`}
                  alt=""
                  width={1440}
                  height={360}
                  loading="lazy"
                  decoding="async"
                />
              </span>
              <span className="scrollmap__name">{p.label}</span>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
