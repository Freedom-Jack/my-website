import type { ReactNode } from 'react';

/**
 * The painted strip every page opens on: an EMPTY art box the painting fills (the text never depends on it:
 * the layout is the same with JS off, WebGL off, or the engine still loading), then the page's title block.
 *   home, sub: on wide screens (≥ 1200) the title sits in the art's mist (the keep-out: no colour or figures
 *              under it); below, on paper under the art.
 *   doc:       a low band over a document (the Résumé, a note): art only; the h1 follows it, outside.
 * Without JS or a landscape, the box shows a faint static ridge hint (layout.css).
 */
export function Strip({
  variant,
  labelledBy,
  children,
  veil = 0.85,
}: {
  variant: 'home' | 'sub' | 'doc';
  labelledBy?: string;
  children?: ReactNode;
  veil?: number;
}) {
  return (
    <header className={`strip strip--${variant}`} aria-labelledby={labelledBy}>
      <div className="strip__art bleed" data-landscape="strip" data-wake="" aria-hidden="true" />
      {children ? (
        <div className="strip__text" data-landscape="keepout" data-veil={veil}>
          {children}
        </div>
      ) : null}
    </header>
  );
}
