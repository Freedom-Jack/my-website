'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { normPath, type Place, placeForPath } from '@/features/landscape/places';
import { landscape } from '@/features/landscape/store';
import { currentMain, placeOf, targetsOf } from '@/features/landscape/targets';
import { quiet } from '@/features/chrome/still';
import { cut, enter, exit, restore, travel } from './transition';
import { liftNavMark } from '@/features/effects/nav-mark';

/**
 * Moving between pages inside the one painting (design-demo/README "Route changes"; the demo router's
 * choreography on Next.js's own client navigation).
 *
 * Every in-site link is caught here, at the document (so links in MDX content and the chrome behave alike):
 * the old text sinks into the mist while the painting starts its pan toward the destination's place (known
 * from the places table before the page arrives, and its figures prepared off the main thread on hover), then
 * the router swaps the page. When the new <main> is in, the page is scrolled (to the top, or its #fragment),
 * the painting is rebound to its windows and veils, focus goes to its h1, the route announcer reads its title,
 * and its text condenses in. Back/forward: the content is there at once and the painting pans back behind it.
 * Not caught: modified clicks, new tabs, downloads, files (/resume.pdf, /resume.json), other origins.
 */

const WATCHDOG_MS = 3000;

interface Pending {
  url: URL;
  dest: Place;
  dir: number;
  timer: number;
  watchdog: number;
  pushed: boolean;
  ctrl: AbortController;
}

function eligible(a: HTMLAnchorElement | null, e: MouseEvent | null): URL | null {
  if (!a || !a.hasAttribute('href')) return null;
  if (e && (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.defaultPrevented)) return null;
  const target = a.getAttribute('target');
  if (target && target !== '_self') return null;
  if (a.hasAttribute('download') || a.hasAttribute('type')) return null;
  if ((a.getAttribute('rel') || '').split(/\s+/).includes('external')) return null;
  if (a.dataset.router === 'off') return null;
  let url: URL;
  try {
    url = new URL(a.href, location.href);
  } catch {
    return null;
  }
  if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return null;
  if (/\.[a-z0-9]+$/i.test(url.pathname)) return null;
  return url;
}

const anchorOf = (e: Event) => (e.target instanceof Element ? e.target.closest<HTMLAnchorElement>('a[href]') : null);
const samePage = (url: URL) => normPath(url.pathname) === normPath(location.pathname) && url.search === location.search;
const prepared = new Set<string>();

function prepare(dest: Place) {
  const key = `${dest.stretch}|${dest.distance}|${dest.presence}`;
  const land = landscape.get();
  if (!land || prepared.has(key)) return;
  prepared.add(key);
  setTimeout(() => prepared.delete(key), 30000);
  try {
    void land.prepare(dest.stretch, { distance: dest.distance, presence: dest.presence }).catch(() => {});
  } catch {
    /* never let the painting stop a navigation */
  }
}

function focusAndAnnounce(main: HTMLElement, target: Element | null) {
  const el = (target as HTMLElement | null) || main.querySelector<HTMLElement>('h1');
  if (el) {
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  }
  const live = document.getElementById('route-announcer');
  if (live) {
    setTimeout(() => {
      live.textContent = '';
      requestAnimationFrame(() => {
        live.textContent = document.title;
      });
    }, 50);
  }
}

function hashTarget(hash: string): Element | null {
  if (!hash || hash.length < 2) return null;
  try {
    return document.getElementById(decodeURIComponent(hash.slice(1)));
  } catch {
    return null;
  }
}

export function Navigation() {
  const router = useRouter();
  const pathname = usePathname();
  const pending = useRef<Pending | null>(null);
  const shown = useRef<string | null>(null); // the path whose <main> has been bound (Strict Mode re-runs effects)

  // ------------------------------------------------------------------ leaving: catch the click
  useEffect(() => {
    const callOff = () => {
      const p = pending.current;
      if (!p || p.pushed) return;
      p.ctrl.abort();
      clearTimeout(p.timer);
      clearTimeout(p.watchdog);
      pending.current = null;
      restore(currentMain());
      const main = currentMain();
      if (main) travel(landscape.get(), placeOf(main), { back: true });
    };

    const navigate = (url: URL) => {
      const old = pending.current;
      if (old) {
        old.ctrl.abort();
        clearTimeout(old.timer);
        clearTimeout(old.watchdog);
      }
      const main = currentMain();
      const fromStretch = Number(landscape.get()?.stats().stretch ?? (main ? placeOf(main).stretch : 0));
      const dest = placeForPath(url.pathname);
      const dir = Math.sign(dest.stretch - fromStretch);
      const ctrl = new AbortController();
      const href = url.pathname + url.search + url.hash;
      const p: Pending = { url, dest, dir, timer: 0, watchdog: 0, pushed: false, ctrl };
      pending.current = p;
      router.prefetch(url.pathname + url.search);
      prepare(dest);
      if (!quiet()) travel(landscape.get(), dest, { dir });
      liftNavMark(url.pathname, dir); // (navMark: the nav's mark lifts at the click, inside the pan)
      void exit(main, { dir, signal: ctrl.signal }).then(() => {
        if (pending.current !== p || ctrl.signal.aborted) return;
        p.pushed = true;
        router.push(href, { scroll: false });
      });
      // a page that never arrives: load it the ordinary way
      p.watchdog = window.setTimeout(() => {
        if (pending.current === p) location.assign(href);
      }, WATCHDOG_MS);
    };

    const onClick = (e: MouseEvent) => {
      const url = eligible(anchorOf(e), e);
      if (!url) return;
      if (samePage(url)) {
        if (pending.current && !pending.current.pushed) {
          e.preventDefault();
          callOff();
          return;
        }
        if (url.hash) return; // the fragment: the browser's (and Next's) own scroll
        e.preventDefault();
        scrollTo({ top: 0, behavior: 'instant' });
        return;
      }
      e.preventDefault();
      navigate(url);
    };

    const onIntent = (e: Event) => {
      const url = eligible(anchorOf(e), null);
      if (!url || samePage(url)) return;
      router.prefetch(url.pathname + url.search);
      prepare(placeForPath(url.pathname));
    };

    document.addEventListener('click', onClick, true);
    document.addEventListener('pointerover', onIntent, { passive: true });
    document.addEventListener('focusin', onIntent);
    document.addEventListener('pointerdown', onIntent, { passive: true });
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('pointerover', onIntent);
      document.removeEventListener('focusin', onIntent);
      document.removeEventListener('pointerdown', onIntent);
    };
  }, [router]);

  // ------------------------------------------------------------------ arriving: the new <main> is in
  useEffect(() => {
    const here = normPath(pathname);
    if (shown.current === null || shown.current === here) {
      shown.current = here; // the first page (the landscape mounts on it), or the same page again
      return;
    }
    shown.current = here;
    const main = currentMain();
    if (!main) return;
    const p = pending.current;
    const kind = p && normPath(p.url.pathname) === normPath(pathname) ? 'push' : 'pop';
    if (p) {
      clearTimeout(p.timer);
      clearTimeout(p.watchdog);
      pending.current = null;
    }
    document.documentElement.classList.add('is-routed');
    const target = kind === 'push' ? hashTarget(p?.url.hash ?? '') : hashTarget(location.hash);
    if (kind === 'push') {
      const html = document.documentElement;
      const prev = html.style.scrollBehavior;
      html.style.scrollBehavior = 'auto';
      if (target) target.scrollIntoView({ block: 'start', behavior: 'instant' });
      else scrollTo({ top: 0, behavior: 'instant' });
      html.style.scrollBehavior = prev;
    }

    // the painting: the page's own place (the places table may have guessed wrong, e.g. a 404 under /work/)
    const land = landscape.get();
    const place = placeOf(main);
    if (land) {
      if (kind === 'pop') {
        if (quiet()) cut(land, place);
        else travel(land, place, { back: true });
      } else if (quiet()) cut(land, place);
      else if (
        p &&
        (place.stretch !== p.dest.stretch || place.distance !== p.dest.distance || place.presence !== p.dest.presence)
      ) {
        void land.panTo(place.stretch, {
          duration: 400,
          ease: 'cubic-out',
          distance: place.distance,
          presence: place.presence,
        });
      }
      try {
        land.rebind(targetsOf(main));
      } catch (err) {
        console.warn('landscape rebind failed', err);
      }
    }

    focusAndAnnounce(main, target);
    if (kind === 'push') void enter(main, { dir: p?.dir ?? 0 });
  }, [pathname]);

  return null;
}
