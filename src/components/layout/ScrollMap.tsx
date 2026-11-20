'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type CSSProperties, useEffect, useRef } from 'react';
import manifest from '../../../public/scenes/band/manifest.json';
import { useCurrent } from '@/features/chrome/current';

/**
 * The whole scroll in miniature, at the tail of every page: one strip of the painting from Home's peaks to the
 * crossing, the stretches between the places included (public/scenes/band/transit.webp, cut from the engine by
 * tools/build-band.ts: the same strip that flies past when a page changes where the engine does not run; fetched only
 * as the tail nears).
 * Each page's name stands under its own place (the manifest's `places`: where along the strip each one's focus
 * lies), and the reach of the strip round a place is that page's link, so the map is read and used as one painting.
 * The current page (or its section) is marked with aria-current; nothing is current on the 404, which lies off the
 * map. On a wide screen the strip runs the screen's width. On a narrow one it keeps a height it can be read at and
 * is wider than the screen: it runs sideways under the finger and opens on the current place. The picture is
 * decorative: the names are the links' words.
 */
interface Transit {
  file: string;
  size: [number, number];
  from: number;
  to: number;
  water: number;
  h: number;
  places: Record<string, number>;
}
const T = (manifest as unknown as { transit?: Transit }).transit;
/** What the map shows of the strip: this many stretches from its left edge, and these rows about the waterline
 *  (window widths of the cut: the sky over the peaks, the near shore). */
const SHOW = 5.3;
const ROWS = { above: 0.29, below: 0.12 };

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
  const span = T ? T.to - T.from : SHOW;
  const at = places.map((p) => ((T?.places[p.still] ?? 0) * span) / SHOW);
  // a place's reach of the strip: from halfway to the place before it to halfway to the next
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
  const rows = ROWS.above + ROWS.below;
  return (
    <nav className="scrollmap" aria-label={label}>
      <div className="scrollmap__pan" ref={pan}>
        <div className="scrollmap__strip" style={{ '--strip-ratio': `${SHOW} / ${rows}` } as CSSProperties}>
          {T ? (
            <span className="scrollmap__window" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element -- a static WebP the band tool cut */}
              <img
                className="scrollmap__art"
                src={`/scenes/band/${T.file}`}
                alt=""
                width={T.size[0]}
                height={T.size[1]}
                loading="lazy"
                decoding="async"
                style={{
                  width: pc(span / SHOW),
                  height: pc(T.h / rows),
                  top: pc(-(T.water - ROWS.above) / rows),
                }}
              />
            </span>
          ) : null}
          <ol role="list">
            {places.map((p, i) => {
              const a = edge(i);
              const b = edge(i + 1);
              return (
                <li key={p.href} style={{ insetInlineStart: pc(a), inlineSize: pc(b - a) }}>
                  <Link
                    href={p.href}
                    aria-current={current(p.href)}
                    prefetch={false}
                    onFocus={(e) =>
                      // (the link is its whole reach of the strip: the keyboard brings its name into the window)
                      e.currentTarget.firstElementChild?.scrollIntoView({ inline: 'center', block: 'nearest' })
                    }
                  >
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
