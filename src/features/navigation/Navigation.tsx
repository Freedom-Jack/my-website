'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { normPath, type Place, placeForPath } from '@/features/landscape/places';
import { landscape } from '@/features/landscape/store';
import { currentMain, placeOf, targetsOf } from '@/features/landscape/targets';
import { quiet } from '@/features/chrome/still';
import { liftBand } from './band';
import { fly, warmFlight } from './flight';
import { cut, enter, exit, restore, travel } from './transition';

/**
 * Moving between pages inside the one painting: one grammar, the river's. The painting pans to the next place and
 * the words cross-fade under it (transition.ts), on Next.js's own client navigation.
 *
 * Every in-site link is caught here, at the document (so links in MDX content and the chrome behave alike):
 * the old words fade while the painting starts its pan toward the destination's place (known from the places
 * table before the page arrives, and its figures prepared off the main thread on hover), then the router swaps the
 * page. When the new <main> is in, the page is scrolled (to the top, or its #fragment), the painting is rebound to
 * its band, focus goes to its h1, the route announcer reads its title, and the new words fade in.
 * Back/forward: the content is there at once, at the place the reader left it (the position is kept per path for
 * the session), and the painting pans back behind it.
 * Not caught: modified clicks, new tabs, downloads, files (/resume.pdf, /resume.json), other origins.
 */

const WATCHDOG_MS = 3000;

// Where the reader was on each page (session only): Back and Forward return there (the content arrives at once, so
// the browser's own restoration never sees the swap). Keyed by path: Next's history entries carry no key of their own.
const posKey = (path: string) => `ink:y:${normPath(path)}`;
const savePos = (path: string) => {
  try {
    sessionStorage.setItem(posKey(path), String(Math.round(scrollY)));
  } catch {
    /* private mode: nothing remembered */
  }
};
const savedPos = (path: string) => {
  try {
    const v = sessionStorage.getItem(posKey(path));
    return v === null ? null : Number(v) || 0;
  } catch {
    return null;
  }
};

interface Pending {
  url: URL;
  dest: Place;
  watchdog: number;
  pushed: boolean;
  ctrl: AbortController;
  /** the band, off the scroll's clock for the change (band.ts liftBand) */
  band: { release(): void; cancel(): void };
}

function eligible(a: HTMLAnchorElement | null, e: MouseEvent | null): URL | null {
  if (!a || !a.hasAttribute('href')) return null;
  if (e && (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.defaultPrevented)) return null;
  const target = a.getAttribute('target');
  if (target && target !== '_self') return null;
  if (a.hasAttribute('download') || a.hasAttribute('type')) return null;
  if ((a.getAttribute('rel') || '').split(/\s+/).includes('external')) return null;
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

/**
 * The new page takes the focus at its title (or at the place a fragment names). Nothing is announced here: Next's
 * own route announcer says the page's title once, and a second voice would say it twice.
 */
function focusTitle(main: HTMLElement, target: Element | null) {
  const el = (target as HTMLElement | null) || main.querySelector<HTMLElement>('h1');
  if (!el) return;
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
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
  const leftAt = useRef(0); // how far the page being left by Back/Forward had been read (0..1), for the flight

  // ------------------------------------------------------------------ leaving: catch the click
  useEffect(() => {
    const callOff = () => {
      const p = pending.current;
      if (!p || p.pushed) return;
      p.ctrl.abort();
      clearTimeout(p.watchdog);
      p.band.cancel();
      pending.current = null;
      restore(currentMain());
      const main = currentMain();
      if (main) travel(landscape.get(), placeOf(main), { back: true });
    };

    const navigate = (url: URL) => {
      const old = pending.current;
      if (old) {
        old.ctrl.abort();
        clearTimeout(old.watchdog);
        old.band.cancel();
      }
      const main = currentMain();
      const dest = placeForPath(url.pathname);
      const ctrl = new AbortController();
      const href = url.pathname + url.search + url.hash;
      // (the band leaves the scroll's clock for the change: it eases to full size, where the new page's top has it)
      const p: Pending = { url, dest, watchdog: 0, pushed: false, ctrl, band: liftBand() };
      pending.current = p;
      savePos(location.pathname);
      router.prefetch(url.pathname + url.search);
      prepare(dest);
      if (!quiet()) {
        const land = landscape.get();
        if (land) travel(land, dest);
        else {
          // (no engine here: the whole scroll flies past as one strip, from where this page's band has travelled to)
          const max = document.documentElement.scrollHeight - innerHeight;
          const far = Math.max(0, Math.abs(dest.stretch - (main ? placeOf(main).stretch : 0)) - 1);
          fly((main?.dataset.page as Place['page']) ?? 'home', dest.page, {
            progress: max > 0 ? scrollY / max : 0,
            duration: 600 + 120 * far,
          });
        }
      }
      void exit(main, { signal: ctrl.signal }).then(() => {
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
        if (scrollY > 0) scrollTo({ top: 0, behavior: quiet() ? 'instant' : 'smooth' });
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
      if (!landscape.get()) warmFlight();
    };

    // Back/Forward: popstate fires before the page swaps, so the page being left is still the shown one
    const onPop = () => {
      if (shown.current) savePos(shown.current);
      const max = document.documentElement.scrollHeight - innerHeight;
      leftAt.current = max > 0 ? scrollY / max : 0;
    };
    // A touch gives no warning before its tap. Where the engine does not run (a narrow window, or a wide one the
    // probe has left on the still), the flight's strip is fetched once the page has loaded and the browser is idle,
    // so the first page change flies too. Never under
    // reduced motion, Still or Save-Data.
    let idle = 0;
    const warm = () => {
      idle = 0;
      const saving = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
      const still = !matchMedia('(min-width: 1200px)').matches || document.documentElement.dataset.live === 'still';
      if (still && !landscape.get() && !quiet() && !saving) warmFlight();
    };
    const whenIdle = () => {
      idle =
        typeof requestIdleCallback === 'function'
          ? requestIdleCallback(warm, { timeout: 4000 })
          : window.setTimeout(warm, 2500);
    };
    if (document.readyState === 'complete') whenIdle();
    else addEventListener('load', whenIdle, { once: true });

    addEventListener('popstate', onPop);
    document.addEventListener('click', onClick, true);
    document.addEventListener('pointerover', onIntent, { passive: true });
    document.addEventListener('focusin', onIntent);
    document.addEventListener('pointerdown', onIntent, { passive: true });
    return () => {
      removeEventListener('load', whenIdle);
      if (idle) (typeof cancelIdleCallback === 'function' ? cancelIdleCallback : clearTimeout)(idle);
      removeEventListener('popstate', onPop);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('pointerover', onIntent);
      document.removeEventListener('focusin', onIntent);
      document.removeEventListener('pointerdown', onIntent);
    };
  }, [router]);

  // ------------------------------------------------------------------ arriving: the new <main> is in
  useEffect(() => {
    const here = normPath(pathname);
    const before = shown.current;
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
      clearTimeout(p.watchdog);
      pending.current = null;
    }
    const target = kind === 'push' ? hashTarget(p?.url.hash ?? '') : hashTarget(location.hash);
    {
      const html = document.documentElement;
      const prev = html.style.scrollBehavior;
      html.style.scrollBehavior = 'auto';
      if (target) target.scrollIntoView({ block: 'start', behavior: 'instant' });
      else if (kind === 'push') scrollTo({ top: 0, behavior: 'instant' });
      else scrollTo({ top: savedPos(pathname) ?? 0, behavior: 'instant' }); // (pop: where the reader left this page)
      html.style.scrollBehavior = prev;
    }
    // (the new page is in, at its top: the band goes back on the scroll's clock once it has reached full size)
    p?.band.release();

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

    // (no engine here: Back and Forward fly the whole scroll past too, behind the page that is already in)
    if (!land && kind === 'pop' && !quiet() && before)
      fly(placeForPath(before).page, (main.dataset.page as Place['page']) ?? 'home', {
        progress: leftAt.current,
        duration: 400,
      });

    // (Back and Forward return the reader to where they were: the focus is not taken to the title, or the next
    // Tab would throw that place away)
    if (kind !== 'pop' || target) focusTitle(main, target);
    if (kind === 'push') void enter(main);
  }, [pathname]);

  return null;
}
