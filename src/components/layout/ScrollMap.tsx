'use client';

import Link from 'next/link';
import { useCurrent } from '@/features/chrome/current';

/**
 * The whole scroll in miniature, at the tail of every page (round 7): its five places in the painting's order
 * (features/landscape/places STORY_MAP), each the place's own first frame (the hero still build:heroes cuts,
 * public/scenes/hero/<place>-phone@1x.webp on phones, -wide@1x.webp from 640 px, fetched only as the tail nears)
 * with its name under it, a link to its
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
                {/* a plain <img> whose source comes as the tail nears (features/landscape/glimpse-stills: never in a
                    page's first load): the place's phone still on phones, its wide one from 640 px */}
                {/* eslint-disable-next-line @next/next/no-img-element -- a static WebP the heroes tool cut */}
                <img
                  data-near=""
                  data-src={`/scenes/hero/${p.still}-phone@1x.webp`}
                  data-src-wide={`/scenes/hero/${p.still}-wide@1x.webp`}
                  alt=""
                  width={1440}
                  height={360}
                  decoding="async"
                />
                <noscript>
                  {/* eslint-disable-next-line @next/next/no-img-element -- the no-JS picture */}
                  <img src={`/scenes/hero/${p.still}-wide@1x.webp`} alt="" width={1440} height={360} decoding="async" />
                </noscript>
              </span>
              <span className="scrollmap__name">{p.label}</span>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
