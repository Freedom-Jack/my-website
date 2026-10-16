import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * The brush-swatch ink button: one loaded stroke of indigo wash at rest; on hover ink blooms from where the
 * pointer entered and the label turns paper where the ink has reached (effects.css; the bloom's origin and the
 * press rings: features/effects/ink-button). One per screen at most.
 *   arrow     a drawn arrow after the label ("See the work →")
 *   external  a file or another site: a plain <a> (the PDF opens in a new tab with `newTab`)
 */
export function InkButton({
  href,
  children,
  arrow = false,
  newTab = false,
  type,
}: {
  href: string;
  children: ReactNode;
  arrow?: boolean;
  newTab?: boolean;
  type?: string;
}) {
  const inner = (
    <>
      <span className="ink-btn__ink" aria-hidden="true" />
      <span className="ink-btn__label">
        {children}
        {newTab ? <span className="visually-hidden">, opens in a new tab</span> : null}
        {arrow ? <span className="ink-btn__arrow" aria-hidden="true" /> : null}
      </span>
    </>
  );
  const isPage = href.startsWith('/') && !/\.[a-z0-9]+$/i.test(href) && !newTab;
  if (isPage) {
    return (
      <Link className="ink-btn" href={href}>
        {inner}
      </Link>
    );
  }
  return (
    <a className="ink-btn" href={href} type={type} {...(newTab ? { target: '_blank', rel: 'noopener' } : {})}>
      {inner}
    </a>
  );
}
