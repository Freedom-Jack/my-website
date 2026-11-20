import type { CSSProperties, ReactNode } from 'react';

/**
 * A page's title, inscribed in the painting's sky (styles/band.css .inscription): it belongs to the painting, so it
 * stands back with the band and travels west with it as the page is read. `y`: how far under the header it starts
 * (a CSS length; each place leaves its sky open at a different height).
 */
export function Inscription({ children, y }: { children: ReactNode; y?: string }) {
  return (
    <header className="inscription">
      <div className="inscription__run">
        <div className="inscription__at" style={y ? ({ '--title-y': y } as CSSProperties) : undefined}>
          {children}
        </div>
      </div>
    </header>
  );
}
