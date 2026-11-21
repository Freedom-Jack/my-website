'use client';

import Link from 'next/link';
import { site } from '@content/site';
import { Seal } from '@/components/ui/Seal';
import { AskDoor } from '@/features/ask/AskDoor';
import { useCurrent } from '@/features/chrome/current';

/**
 * The header: one bar on every page. His seal and name (the way home: a button, its accessible name "Qijin Xu,
 * home"), the places along the scroll in the painting's order (content/site.ts), and the Ask's field. At a page's
 * top it stands on the painting's sky; as the page is read it takes its paper, with a ribbon of the painting under
 * it (styles/shell.css, styles/band.css).
 */
export function SiteHeader() {
  const current = useCurrent();
  return (
    <header className="site-header">
      <Link
        className="site-header__home"
        href="/"
        aria-current={current('/') === 'page' ? 'page' : undefined}
        prefetch={false}
      >
        <Seal id="seal-carve-home" />
        <span className="site-header__name">{site.name}</span>
        <span className="visually-hidden">, home</span>
      </Link>
      <div className="site-header__side">
        <nav className="site-nav" aria-label="Main">
          <ul className="site-nav__list" role="list">
            {site.nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} aria-current={current(item.href)} prefetch={false}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <AskDoor />
      </div>
    </header>
  );
}
