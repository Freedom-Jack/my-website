'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import scroll from '../../../public/scenes/scroll/scroll.json';
import { useCurrent } from '@/features/chrome/current';

/**
 * The whole scroll in miniature, at the tail of every page: ONE strip of the painting from Home's peaks to the
 * crossing, the stretches between the places included (public/scenes/scroll/scroll.webp, cut from the engine by
 * tools/build-scroll.ts; fetched only as the tail nears). Jack, of the five separate stills that stood here: "it is
 * not a coherent scroll … also include the transitions".
 * Each page's name stands under its own place (scroll.json `places`: where along the strip each one's focus lies),
 * and the stretch of the strip round a place is that page's link, so the map is read and used as one painting. The
 * current page (or its section) is sealed with aria-current; nothing is current on the 404, which lies off the map.
 * On a wide screen the strip runs the screen's width. Below 1200 px it keeps a height it can be read at and is
 * wider than the screen: it runs sideways under the finger and opens on the current place. The picture is
 * decorative: the names are the links' words.
 */
const [W, H] = scroll.size as [number, number];
const AT = scroll.places as Record<string, number>;

export function ScrollMap({
  label,
  places,
}: {
  label: string;
  places: ReadonlyArray<{ readonly href: string; readonly label: string; readonly still: string }>;
}) {
  const current = useCurrent();
  const path = usePathname();
  const pan = useRef<HTMLDivElement>(null);
  const at = places.map((p) => AT[p.still] ?? 0);
  // a place's stretch of the strip: from halfway to the place before it to halfway to the next
  const edge = (i: number) => (i <= 0 ? 0 : i >= at.length ? 1 : (at[i - 1]! + at[i]!) / 2);
  const here = places.findIndex((p) => current(p.href));
  const hereAt = here < 0 ? 0 : at[here]!;

  // (where the strip is wider than the screen) it opens on the current place
  useEffect(() => {
    const el = pan.current;
    if (!el || el.scrollWidth <= el.clientWidth + 1) return;
    el.scrollLeft = Math.max(0, hereAt * el.scrollWidth - el.clientWidth / 2);
  }, [path, hereAt]);

  const pc = (v: number) => `${(v * 100).toFixed(2)}%`;
  return (
    <nav className="scrollmap" aria-label={label}>
      <div className="scrollmap__pan" ref={pan}>
        <div className="scrollmap__strip" style={{ '--strip-ratio': `${W} / ${H}` } as React.CSSProperties}>
          {/* a plain <img> whose source comes as the tail nears (features/landscape/glimpse-stills: never in a
              page's first load) */}
          {/* eslint-disable-next-line @next/next/no-img-element -- a static WebP the scroll tool cut */}
          <img
            className="scrollmap__art"
            data-near=""
            data-src={`/scenes/scroll/${scroll.file}`}
            alt=""
            width={W}
            height={H}
            decoding="async"
          />
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element -- the no-JS picture */}
            <img
              className="scrollmap__art"
              src={`/scenes/scroll/${scroll.file}`}
              alt=""
              width={W}
              height={H}
              decoding="async"
            />
          </noscript>
          <span className="scrollmap__foot" aria-hidden="true" />
          <ol role="list">
            {places.map((p, i) => {
              const a = edge(i);
              const b = edge(i + 1);
              return (
                <li key={p.href} style={{ insetInlineStart: pc(a), inlineSize: pc(b - a) }}>
                  <Link href={p.href} aria-current={current(p.href)} prefetch={false}>
                    <span className="scrollmap__name" style={{ insetInlineStart: pc((at[i]! - a) / (b - a)) }}>
                      {p.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </nav>
  );
}
