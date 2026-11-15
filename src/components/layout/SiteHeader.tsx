'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef } from 'react';
import { site } from '@content/site';
import { useCurrent } from '@/features/chrome/current';
import { useReturningHeader } from '@/features/chrome/returning-header';
import { useStackedHeader } from '@/features/chrome/stacked-header';
import { RiverLine } from './RiverLine';

/**
 * The header: the name as text, a link home (its accessible name "Qijin Xu, home"; the seal signs once, at the tail),
 * then Work · Writing · Résumé · Contact (content/site.ts, the painting's order), and under the row the river line
 * (RiverLine: a hairline with a tick per stop and the mark that stands under the current page and travels as the
 * page scrolls). In normal flow, on paper, above the strip; once the strip has scrolled away it returns, solid, on
 * scroll-up (features/chrome/returning-header), its river line staying on the screen's edge meanwhile. Never a
 * menu button: one row at 360 px, the nav on a row of its own below 357.
 */
export function SiteHeader() {
  const ref = useRef<HTMLElement>(null);
  const current = useCurrent();
  const pathname = usePathname();
  useReturningHeader(ref, pathname);
  useStackedHeader(ref);
  return (
    <header className="site-header" ref={ref}>
      <div className="site-header__inner frame">
        <Link
          className="home-link"
          href="/"
          aria-current={current('/') === 'page' ? 'page' : undefined}
          prefetch={false}
        >
          <span className="home-link__name">{site.name}</span>
          <span className="visually-hidden">, home</span>
        </Link>
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
        <RiverLine />
      </div>
    </header>
  );
}
