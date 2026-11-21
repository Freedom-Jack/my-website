import type { CSSProperties, ReactNode } from 'react';
import { inscriptions, type InscriptionId } from '@content/inscriptions';

/**
 * A page's opening: its own title on the paper under the painting and, on Home, what is inscribed in the painting's
 * sky.
 *
 * `place`: the inscription that stands in this page's sky (content/inscriptions.ts: Home's only), as a painting
 * carries one: a few small columns of brush script with the seal, drawn as artwork (public/inscriptions/), and the
 * line in English beside it. It stands in the sky at the page's top and leaves with it as the page is read
 * (styles/band.css .inscription).
 * `children`: the page's <h1> and the line under it, set on the paper.
 */
export function Inscription({ place, children }: { place?: InscriptionId; children?: ReactNode }) {
  const v = place ? inscriptions.lines[place] : null;
  return (
    <>
      {v ? (
        <div className="inscription">
          <div className="inscription__at">
            {/* eslint-disable-next-line @next/next/no-img-element -- a small static SVG drawing */}
            <img
              className="inscription__art"
              src={v.src}
              width={v.width}
              height={v.height}
              alt={`${inscriptions.alt}: ${v.pinyin}`}
              style={{ '--h': v.height / 32 } as CSSProperties}
              decoding="async"
            />
            <p className="inscription__en">
              {v.en.map((line) => (
                <span key={line}>{line}</span>
              ))}
              <cite>{inscriptions.from}</cite>
            </p>
          </div>
        </div>
      ) : null}
      {children ? <header className="row page-head">{children}</header> : null}
    </>
  );
}
