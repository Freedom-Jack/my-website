'use client';

import { usePathname } from 'next/navigation';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import manifest from '../../../public/scenes/band/manifest.json';
import { type PageId, placeForPath } from '@/features/landscape/places';

/**
 * The band's still: the page's own stage, cut ahead by tools/build-band.ts (public/scenes/band). It is the painting
 * from the first paint on every device, the whole painting wherever the engine does not run (phones, tablets,
 * reduced motion, no GPU), and it lies under the live stage where it does.
 * One picture per page kind, fetched in two parts: what the window shows at the page's top (asked for at once, at
 * high priority: it is the first screen's painting), and the rest to the east, which the band comes to as it settles
 * and unrolls (asked for at low priority). A phone has its own two parts, cut further east and at its own scale.
 * Every length here is in window widths of the cut; styles/band.css turns them into lengths by the band's own scale,
 * so the still sits exactly where the engine frames the live stage.
 * On a page change the page left keeps its still until the new page's first part has arrived, so the band is never
 * blank between two places (the travel between them is features/navigation's).
 */
interface Part {
  files: string[];
  x: number;
  w: number;
  size: [number, number];
}
interface Still {
  water: number;
  h: number;
  travel: number;
  inside: number;
  wide: { a: Part; b: Part };
  phone: { a: Part; b: Part };
  tabletX: number;
}
const STILLS = (manifest as unknown as { stills: Partial<Record<PageId, Still>> }).stills;
const PHONE = '(max-width: 39.99rem)';
const src = (f: string) => `/scenes/band/${f}`;
const set = (p: Part) => (p.files.length > 1 ? `${src(p.files[0]!)} 1x, ${src(p.files[1]!)} 2x` : src(p.files[0]!));

function PartImg({ wide, phone, first, onLoad }: { wide: Part; phone: Part; first: boolean; onLoad?: () => void }) {
  return (
    <picture
      className="band__part"
      style={{ '--px': wide.x, '--pw': wide.w, '--px-phone': phone.x, '--pw-phone': phone.w } as CSSProperties}
    >
      <source media={PHONE} srcSet={set(phone)} width={phone.size[0]} height={phone.size[1]} />
      {/* (a plain <img>: a static WebP the band tool cut, in its own <picture>) */}
      <img
        src={src(wide.files[0]!)}
        srcSet={set(wide)}
        width={wide.size[0]}
        height={wide.size[1]}
        alt=""
        decoding="async"
        fetchPriority={first ? 'high' : 'low'}
        onLoad={onLoad}
        onError={(e) => {
          e.currentTarget.style.visibility = 'hidden';
          onLoad?.();
        }}
      />
    </picture>
  );
}

function StillOf({ page, waiting, onReady }: { page: PageId; waiting?: boolean; onReady?: () => void }) {
  const s = STILLS[page];
  const ref = useRef<HTMLDivElement>(null);
  // (an image already in the cache has loaded before React could listen)
  useEffect(() => {
    const img = ref.current?.querySelector('img');
    if (img?.complete) onReady?.();
  }, [onReady]);
  if (!s) return null;
  return (
    <div
      ref={ref}
      className={waiting ? 'band__still is-waiting' : 'band__still'}
      data-page={page}
      style={
        {
          '--still-water': s.water,
          '--still-travel': s.travel,
          '--still-tablet-x': s.tabletX,
          '--still-phone-x': s.phone.a.x,
        } as CSSProperties
      }
    >
      <PartImg wide={s.wide.a} phone={s.phone.a} first onLoad={onReady} />
      <PartImg wide={s.wide.b} phone={s.phone.b} first={false} />
    </div>
  );
}

export function BandStill() {
  const page = placeForPath(usePathname() || '/').page;
  // the still on show, and (during a page change) the one arriving over it
  const [shown, setShown] = useState<PageId>(page);
  const arriving = page !== shown;
  if (!arriving) return <StillOf key={page} page={page} />;
  if (!STILLS[page]) return <StillOf key={shown} page={shown} />;
  return (
    <>
      <StillOf key={shown} page={shown} />
      <StillOf key={page} page={page} waiting onReady={() => setShown(page)} />
    </>
  );
}
