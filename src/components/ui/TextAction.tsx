import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * The text action (effects.css .action): the one action on a screen is words in the UI weight with a 2 px ink
 * underline and, after them, a drawn arrow ("See the work →"); a 44 px target; no button, no brush, no fill.
 *   arrow     the drawn arrow after the label
 *   newTab    a file (the PDF): a plain <a> that opens in a new tab and says so
 */
export function TextAction({
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
      {children}
      {newTab ? <span className="visually-hidden">, opens in a new tab</span> : null}
      {arrow ? <span className="action__arrow" aria-hidden="true" /> : null}
    </>
  );
  const isPage = href.startsWith('/') && !/\.[a-z0-9]+$/i.test(href) && !newTab;
  if (isPage) {
    return (
      <Link className="action" href={href} prefetch={false}>
        {inner}
      </Link>
    );
  }
  return (
    <a className="action" href={href} type={type} {...(newTab ? { target: '_blank', rel: 'noopener' } : {})}>
      {inner}
    </a>
  );
}
