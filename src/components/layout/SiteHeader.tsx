'use client';

import Link from 'next/link';
import { site } from '@content/site';
import { AskDoor } from '@/features/ask/AskDoor';
import { useCurrent } from '@/features/chrome/current';

/**
 * The header: his name (a link home; its accessible name "Qijin Xu, home") and the four places downstream of Home,
 * in the painting's order (content/site.ts), set straight on the painting's sky and fixed there: the band stands
 * under it on every screen of every page, so the way to each place is always in reach. No menu button: one row at
 * 360 px.
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
        <span>{site.name}</span>
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
