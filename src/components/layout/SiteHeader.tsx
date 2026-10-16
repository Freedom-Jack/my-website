'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef } from 'react';
import { site } from '@content/site';
import { Seal } from '@/components/ui/Seal';
import { useCurrent } from '@/features/chrome/current';
import { useReturningHeader } from '@/features/chrome/returning-header';
import { useStackedHeader } from '@/features/chrome/stacked-header';

/**
 * The header: one home link (the seal and the words "Qijin Xu"; its accessible name "Qijin Xu, home"), then
 * Work · Résumé · Contact (content/site.ts). In normal flow, on paper, above the strip; once the strip has
 * scrolled away it returns, solid, on scroll-up (features/chrome/returning-header). Never a menu button:
 * one row at 360 px, the nav on a row of its own below 340.
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
        <Link className="home-link" href="/" aria-current={current('/') === 'page' ? 'page' : undefined}>
          <Seal id="seal-carve" />
          <span className="home-link__name">{site.name}</span>
          <span className="visually-hidden">, home</span>
        </Link>
        <nav className="site-nav" aria-label="Main">
          <ul className="site-nav__list" role="list">
            {site.nav.map((item) => (
              <li key={item.href}>
                <Link className="brush" href={item.href} aria-current={current(item.href)}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
