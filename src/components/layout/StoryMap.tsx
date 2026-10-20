'use client';

import Link from 'next/link';
import manifest from '../../../public/scenes/manifest.json';
import { STORY_MAP } from '@/features/landscape/places';
import { useCurrent } from '@/features/chrome/current';

type Tiles = Record<string, number[]>;

/**
 * The footer's story map: the whole painting as one small handscroll. Each place's own opening scene in
 * miniature (build-time stills cut from the engine: tools/build-stills.ts → public/scenes/), each in a soft
 * window that meets its neighbours in mist (layout.css), one label per place in the painting's order, a tick
 * over each. "You are here" is the label's aria-current (CSS lifts its tick through :has(), and .is-here mirrors
 * it for browsers without :has()). Decorative art: alt="" inside an aria-hidden box. Works without JS.
 */
export function StoryMap() {
  const current = useCurrent();
  const tiles = manifest.tiles as Tiles;
  return (
    <nav className="story-map" aria-label="All pages">
      <div className="story-map__art" aria-hidden="true">
        {STORY_MAP.map((p) => {
          const [w = 300, h = 70] = tiles[p.still] ?? [];
          return (
            <span key={p.still} className="story-map__scene" data-stretch={p.stretch}>
              {/* A decorative still at its own pixel sizes (1x, 2x): next/image would re-encode it. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/scenes/${p.still}@1x.webp`}
                srcSet={`/scenes/${p.still}@1x.webp 1x, /scenes/${p.still}@2x.webp 2x`}
                width={w}
                height={h}
                alt=""
                loading="lazy"
                decoding="async"
              />
            </span>
          );
        })}
        {STORY_MAP.map((p) => (
          <span
            key={p.still}
            className={current(p.href) ? 'story-map__tick is-here' : 'story-map__tick'}
            data-stretch={p.stretch}
          />
        ))}
      </div>
      <ol className="story-map__list" role="list">
        {STORY_MAP.map((p) => (
          <li key={p.still} data-stretch={p.stretch}>
            <Link className="brush" href={p.href} aria-current={current(p.href)}>
              {p.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
