'use client';

import Link from 'next/link';
import { useEffect, useSyncExternalStore, type CSSProperties } from 'react';
import { usePathname } from 'next/navigation';
import manifest from '../../../public/scenes/manifest.json';
import { STORY_MAP, placeForPath } from '@/features/landscape/places';
import { ELEMENTS } from '@/features/landscape/elements';
import { useCurrent } from '@/features/chrome/current';

type Tiles = Record<string, number[]>;

/** sun: where each place's light sits across / down its still (0..1). From the one light table (engine/lights.ts),
 *  written into the manifest by tools/build-stills.ts with the stills themselves, so they always agree. */
const SUNS = (manifest as unknown as { suns?: Record<string, [number, number]> }).suns ?? {};

/**
 * The footer's story map: the whole painting as one small handscroll. Each place's own opening scene in
 * miniature (build-time stills cut from the engine: tools/build-stills.ts → public/scenes/), each in a soft
 * window that meets its neighbours in mist (layout.css), one label per place in the painting's order, a plain tick
 * over each. "You are here" is the label's aria-current; with the `sun` element its place holds the sun (finish.css,
 * through :has(); .is-here on the scene and the sun is the hook for the current place). Decorative art: alt=""
 * inside an aria-hidden box. Works without JS.
 */
const BEEN_KEY = 'ink:been';
/** elements.ts `visited`: the places visited this session (their stretches), remembered in this tab only; the map
 *  shows them still holding a little of their light, where you have travelled. A convenience: with no storage it
 *  simply marks nothing, and the server renders none (no hydration mismatch). */
const beenFns = new Set<() => void>();
const beenRead = (): string => {
  try {
    return sessionStorage.getItem(BEEN_KEY) || '[]';
  } catch {
    return '[]';
  }
};
const beenParse = (raw: string): number[] => {
  try {
    return (JSON.parse(raw) as unknown[]).map(Number).filter(Number.isFinite);
  } catch {
    return [];
  }
};
function useBeen(): number[] {
  const path = usePathname() || '/';
  const raw = useSyncExternalStore(
    (fn) => {
      beenFns.add(fn);
      return () => beenFns.delete(fn);
    },
    beenRead,
    () => '[]',
  );
  useEffect(() => {
    if (!ELEMENTS.visited) return;
    const k = placeForPath(path).stretch;
    const list = beenParse(beenRead());
    if (k > 4 || list.includes(k)) return;
    try {
      sessionStorage.setItem(BEEN_KEY, JSON.stringify([...list, k]));
    } catch {
      /* no storage: nothing is marked */
    }
    beenFns.forEach((fn) => fn());
  }, [path]);
  return ELEMENTS.visited ? beenParse(raw) : [];
}

export function StoryMap() {
  const current = useCurrent();
  const been = useBeen();
  const tiles = manifest.tiles as Tiles;
  return (
    <nav className="story-map" aria-label="All pages">
      <div className="story-map__art" aria-hidden="true">
        {STORY_MAP.map((p) => {
          const [w = 300, h = 70] = tiles[p.still] ?? [];
          return (
            <span
              key={p.still}
              className={`story-map__scene${current(p.href) ? ' is-here' : ''}${been.includes(p.stretch) ? ' is-been' : ''}`}
              data-stretch={p.stretch}
            >
              {/* A decorative still at its own pixel sizes (1x, 2x): next/image would re-encode it. Two (sun): the dim
                  still (no sun) under the lit one (its own sun); CSS shows the lit one for the current place and
                  raises it for a hovered or focused label (layout.css / finish.css). */}
              {(['', '-lit'] as const).map((v) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={v}
                  className={v ? 'story-map__lit' : 'story-map__dim'}
                  src={`/scenes/${p.still}${v}@1x.webp`}
                  srcSet={`/scenes/${p.still}${v}@1x.webp 1x, /scenes/${p.still}${v}@2x.webp 2x`}
                  width={w}
                  height={h}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              ))}
            </span>
          );
        })}
        {STORY_MAP.map((p) => (
          <span
            key={`sun-${p.still}`}
            className={current(p.href) ? 'story-map__sun is-here' : 'story-map__sun'}
            data-stretch={p.stretch}
            style={
              { '--fx': (SUNS[p.still] ?? [0.5, 0.3])[0], '--fy': (SUNS[p.still] ?? [0.5, 0.3])[1] } as CSSProperties
            }
          />
        ))}
        {STORY_MAP.map((p) => (
          <span key={p.still} className="story-map__tick" data-stretch={p.stretch} />
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
