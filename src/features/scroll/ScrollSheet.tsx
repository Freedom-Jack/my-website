'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { site } from '@content/site';
import { StoryMapArt } from '@/components/layout/StoryMap';
import { quiet } from '@/features/chrome/still';
import { STORY_MAP, normPath } from '@/features/landscape/places';
import { landscape } from '@/features/landscape/store';
import { currentMain, placeOf, targetsOf } from '@/features/landscape/targets';
import type { LandscapeHandle } from '@/features/landscape/types';
import { exit, restore } from '@/features/navigation/transition';
import { scrollMode } from './store';
import type { ScrollStop } from './types';
import { LAST, clampX, detent, durationFor, dxToStretch, nearest, stepFrom } from './walk';

/**
 * The scroll, held (elements.ts `scroll`; DESIGN: the "beyond" round). After the words, the footer's opener folds the
 * page into the paper (the route exit's own way, <main> inert) and this sheet stands over it: the painting in the
 * hero's own band, bound to the one persistent canvas (rebind: the band is the strip window; no closing, no veils, no
 * keep-out, no stage), the place's name and what its page holds under it (the server-built index: existing strings,
 * real links), and the story map lifted off the footer as the stops.
 *
 * The hand moves the painting. Drag and wheel set the camera through the engine's hold(x) once per animation frame
 * (one governed scene per frame, nothing on a clock); a release within the detent of a place settles there (300 ms);
 * the arrow keys, Home, End and the stops walk with the engine's own pan at a walking pace; at rest a place may be
 * seen level, high or deep (Up, Down, or the two words), and every walk returns to level. Any link in the inscription
 * is the way in: the site's own navigation catches it (features/navigation) and the page arrives with the camera
 * already there; the sheet closes itself on the route change. Esc or the close returns the words where they were, the
 * camera to the page's own place, focus to the opener. Reduced motion and Still: every walk is a cut (the engine's
 * rule), a drag ends in a step to the next place, nothing moves but by the hand. The last position is kept for this
 * tab (sessionStorage 'ink:at'), so the scroll opens where the hand left it.
 */
type Distance = 'level' | 'high' | 'deep';
const DISTANCES: Distance[] = ['level', 'high', 'deep'];
const AT_KEY = 'ink:at';
const REST_MS = 600; // the hand has rested: the distances appear, the neighbours are prepared, the place is announced
const WHEEL_MS = 160; // a wheel gesture has ended
const SETTLE_MS = 300; // the detent's settle
const STEP_PX = 24; // under reduced motion or Still: a drag this long (and more across than down) steps a place; less is a tap
const HELD_CLASS = 'is-scroll-held'; // on <html> while the sheet is open: the document locked, the chrome hidden
const CHROME = '.site-header, .site-footer, .skip-link'; // the body-level chrome made inert while the sheet is open
const CARRY = 0.3; // stretches: on a phone a drag this far carries to the next place even when it rests before the release
const FLICK = 0.5; // CSS px per ms at release: let go while still moving and the scroll goes on to the next place (a phone's band is narrower than half a stretch, so a swipe must carry)

interface Drag {
  x0: number;
  y0: number;
  start: number;
  scale: number;
  last: number;
  lastY: number;
  moved: boolean;
  /** The last few samples (ms, px), for the release's velocity. */
  samples: [number, number][];
}
/** The hand's speed at release, CSS px per ms over its last ~80 ms (0 when it rested before letting go). */
const velocityOf = (d: Drag): number => {
  const now = d.samples[d.samples.length - 1];
  if (!now) return 0;
  const past = [...d.samples].reverse().find(([t]) => now[0] - t >= 40) ?? d.samples[0]!;
  const dt = now[0] - past[0];
  return dt > 0 && now[0] - past[0] <= 160 ? (now[1] - past[1]) / dt : 0;
};

const land = (): LandscapeHandle | null => landscape.get();
const phone = () => matchMedia('(max-width: 39.99rem)').matches;
/** The detent's reach: a phone's band shows half a stretch, so a release there always settles on a place. */
const radius = () => (phone() ? 0.5 : 0.3);
/** Where the camera stands now (the engine's own position), else where the hand wants it. */
const cameraX = (fallback: number): number => {
  const v = Number(land()?.stats().stretch);
  return Number.isFinite(v) ? v : fallback;
};
/** CSS px per stretch in the band (the engine's framing of it), else the band's width. */
const scaleNow = (el: HTMLElement | null): number => {
  const fr = land()?.stats().framing as { strip?: { scale?: number } } | undefined;
  return Number(fr?.strip?.scale) || el?.clientWidth || 1440;
};
const save = (x: number) => {
  try {
    sessionStorage.setItem(AT_KEY, String(Math.round(x * 1000) / 1000));
  } catch {
    /* not remembered: private mode */
  }
};
/** While the sheet is open: the document locked and the chrome hidden (scroll.css), the chrome inert (the sheet is modal). */
const held = (on: boolean) => {
  document.documentElement.classList.toggle(HELD_CLASS, on);
  for (const el of document.querySelectorAll<HTMLElement>(CHROME)) el.inert = on;
};
/** The neighbours' figure layers, drawn ahead so a walk never pops them in. */
const warm = (x: number) => {
  const L = land();
  if (!L) return;
  const c = nearest(x);
  for (const j of [c - 1, c + 1])
    if (j >= 0 && j <= LAST) void L.prepare(j, { distance: 'level', presence: 1 }).catch(() => {});
};

export function ScrollSheet({ stops }: { stops: ScrollStop[] }) {
  const open = useSyncExternalStore(scrollMode.subscribe, scrollMode.isOpen, () => false);
  const generation = useSyncExternalStore(scrollMode.subscribe, scrollMode.generation, () => 0);
  const pathname = usePathname();
  const [k, setK] = useState(0); // the place the camera is nearest to (the inscription, the light, aria)
  const [distance, setDistance] = useState<Distance>('level');
  const [atRest, setAtRest] = useState(false);
  // a new opening: the sheet's first frame already names the opening place (state that follows the store's count)
  const [seen, setSeen] = useState(generation);
  if (generation !== seen) {
    setSeen(generation);
    setK(nearest(scrollMode.startX()));
    setDistance('level');
    setAtRest(false);
  }
  const band = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const target = useRef(0); // where the hand wants the camera (world x, stretches)
  const drag = useRef<Drag | null>(null);
  const raf = useRef(0);
  const restTimer = useRef(0);
  const wheelTimer = useRef(0);
  const follow = useRef(0); // while a walk runs: the inscription follows the camera at the ambient pace
  const openedAt = useRef<string | null>(null);
  const leaving = useRef(false); // a link in the sheet was followed: the hand is off the band until the page arrives

  const clearTimers = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = 0;
    clearTimeout(restTimer.current);
    clearTimeout(wheelTimer.current);
    clearInterval(follow.current);
    restTimer.current = wheelTimer.current = follow.current = 0;
  }, []);

  /** The place nearest the camera, as the sheet shows it. */
  const syncPlace = (x: number) => setK((prev) => (nearest(x) === prev ? prev : nearest(x)));
  /** The hand has stopped: after REST_MS the distances appear and the place is announced. */
  const rest = useCallback(() => {
    clearTimeout(restTimer.current);
    restTimer.current = window.setTimeout(() => {
      setAtRest(true);
      syncPlace(target.current);
      warm(target.current);
      save(target.current);
    }, REST_MS);
  }, []);

  /** A walk by the engine's own pan (keys, the stops, the detent's settle): a walking pace, a cut when quiet. */
  const walkTo = useCallback(
    (x: number, dur?: number, dist: Distance = 'level') => {
      const L = land();
      target.current = clampX(x);
      setAtRest(false);
      setDistance(dist);
      clearTimeout(restTimer.current);
      clearInterval(follow.current);
      if (!L) return;
      const from = cameraX(target.current);
      const ms = quiet() ? 0 : (dur ?? durationFor(target.current - from));
      const mine = target.current;
      follow.current = window.setInterval(() => syncPlace(cameraX(target.current)), 100);
      void L.panTo(mine, { duration: ms, ease: 'cubic-out', cloud: false, distance: dist }).then(() => {
        clearInterval(follow.current);
        follow.current = 0;
        if (target.current === mine) {
          syncPlace(mine);
          rest();
        }
      });
      syncPlace(from);
    },
    [rest],
  );

  /** The hand: one hold per animation frame. */
  const schedule = useCallback(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      land()?.hold(target.current);
      syncPlace(target.current);
    });
  }, []);

  /** The hand has let go: a flick steps to the next place in its direction; otherwise the detent settles on a place
   *  within reach, else the scroll rests where it is. */
  const release = useCallback(
    (dir: 1 | -1 | 0, moved: boolean, flick = false) => {
      if (quiet()) {
        // reduced motion or Still: a drag or a wheel is a step to the next place in its direction (a cut)
        if (moved && dir) walkTo(stepFrom(target.current, dir));
        return;
      }
      if (flick && dir) {
        walkTo(stepFrom(target.current, dir));
        return;
      }
      const at = detent(target.current, radius());
      if (at !== null && Math.abs(at - target.current) > 1e-3) walkTo(at, SETTLE_MS);
      else {
        syncPlace(target.current);
        rest();
      }
    },
    [rest, walkTo],
  );

  // ------------------------------------------------------------------ open: the page folds, the band is bound
  useEffect(() => {
    if (!open) return;
    const L = land();
    const main = currentMain();
    if (!L || !main || L.mode === 'static') {
      scrollMode.close();
      return;
    }
    openedAt.current = pathname;
    leaving.current = false;
    const start = clampX(scrollMode.startX());
    target.current = start;
    held(true);
    void exit(main, { dir: 0 });
    const id = requestAnimationFrame(() => {
      const el = band.current;
      if (!el) return;
      L.rebind({ strip: el, closing: null, keepout: [], veil: [], wake: [el], glimpse: [], horizon: 0, ground: '' });
      const cur = cameraX(start);
      if (Math.abs(start - cur) > 1e-3) void L.panTo(start, { duration: 0, distance: 'level' });
      void L.sweep({ dir: start >= cur ? 1 : -1, duration: 340 });
      warm(start);
      el.focus({ preventScroll: true });
      rest();
    });
    return () => cancelAnimationFrame(id);
    // (pathname is read at the open only: a later route change closes the sheet below)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ------------------------------------------------------------------ close: Esc, the close link (the page returns)
  const leave = useCallback(() => {
    clearTimers();
    held(false);
    const L = land();
    const main = currentMain();
    if (L && main) {
      const place = placeOf(main);
      L.rebind(targetsOf(main));
      void L.panTo(place.stretch, {
        duration: quiet() ? 0 : 400,
        ease: 'cubic-out',
        cloud: false,
        distance: place.distance,
        presence: place.presence,
      });
      restore(main);
    }
    const opener = scrollMode.opener();
    scrollMode.close();
    opener?.focus({ preventScroll: true });
  }, [clearTimers]);

  // a link in the inscription was followed: the page arrives with the camera already there (features/navigation
  // rebinds the painting to the new page); the sheet simply goes
  useEffect(() => {
    if (open && openedAt.current !== null && pathname !== openedAt.current) {
      clearTimers();
      held(false);
      openedAt.current = null;
      scrollMode.close();
    }
  }, [pathname, open, clearTimers]);

  // Escape closes the sheet from anywhere (the chrome is inert, but focus may still be on the body)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      leave();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, leave]);
  useEffect(() => () => held(false), []);

  // the wheel (non-passive: the band owns it), and the timers, while open
  useEffect(() => {
    if (!open) return;
    const el = band.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (leaving.current) return;
      const delta = Math.abs(e.deltaX) >= Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!delta) return;
      setAtRest(false);
      clearTimeout(restTimer.current);
      clearTimeout(wheelTimer.current);
      if (quiet()) {
        wheelTimer.current = window.setTimeout(() => release(delta > 0 ? 1 : -1, true), WHEEL_MS);
        return;
      }
      // the hand takes over from wherever the camera is (a walk may be running), at the one composition
      target.current = clampX(cameraX(target.current) + delta / scaleNow(el));
      setDistance('level');
      schedule();
      wheelTimer.current = window.setTimeout(() => release(0, true), WHEEL_MS);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      clearTimers();
    };
  }, [open, release, schedule, clearTimers]);

  // ------------------------------------------------------------------ the hand on the band
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (leaving.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const el = e.currentTarget;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* a pointer the browser no longer tracks: the drag still runs on the band's own events */
    }
    // the hand takes over from wherever the camera is (a walk may be running), at the one composition
    target.current = cameraX(target.current);
    drag.current = {
      x0: e.clientX,
      y0: e.clientY,
      start: target.current,
      scale: scaleNow(el),
      last: e.clientX,
      lastY: e.clientY,
      moved: false,
      samples: [[performance.now(), e.clientX]],
    };
    setAtRest(false);
    setDistance('level');
    clearTimeout(restTimer.current);
    clearInterval(follow.current);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x0;
    if (Math.abs(dx) > 3) d.moved = true;
    d.last = e.clientX;
    d.lastY = e.clientY;
    d.samples.push([performance.now(), e.clientX]);
    if (d.samples.length > 12) d.samples.shift();
    if (quiet()) return;
    target.current = clampX(d.start + dxToStretch(dx, d.scale));
    schedule();
  };
  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    d.samples.push([performance.now(), e.clientX]); // (the release's own time: a rest before letting go is no flick)
    const v = velocityOf(d); // px per ms; the painting follows the hand, so a leftward hand walks east
    const flick = Math.abs(v) >= FLICK;
    const dx = d.last - d.x0,
      dy = d.lastY - d.y0;
    const dir: 1 | -1 | 0 = flick ? (v < 0 ? 1 : -1) : dx < 0 ? 1 : dx > 0 ? -1 : 0;
    // under reduced motion or Still a release steps a place only for a real sideways drag, never for a wobble
    const stepped = Math.abs(dx) >= STEP_PX && Math.abs(dx) > Math.abs(dy);
    // a phone's band shows half a stretch, so a deliberate drag past a third of one carries to the next place
    const carried = phone() && dir !== 0 && Math.abs(target.current - d.start) >= CARRY;
    release(dir, quiet() ? stepped : d.moved, flick || carried);
  };

  const setDist = (d: Distance) => {
    const L = land();
    if (!L) return;
    setDistance(d);
    void L.panTo(target.current, { duration: quiet() ? 0 : SETTLE_MS, ease: 'cubic-out', cloud: false, distance: d });
  };

  const onBandKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const L = land();
    if (!L || leaving.current) return;
    const x = target.current;
    switch (e.key) {
      case ' ':
      case 'PageUp':
      case 'PageDown':
        break; // (the document is locked; these never scroll the page behind the sheet)
      case 'ArrowRight':
        walkTo(stepFrom(x, 1));
        break;
      case 'ArrowLeft':
        walkTo(stepFrom(x, -1));
        break;
      case 'Home':
        walkTo(0);
        break;
      case 'End':
        walkTo(LAST);
        break;
      case 'ArrowUp':
      case 'ArrowDown': {
        if (!atRest) break;
        const i = DISTANCES.indexOf(distance);
        const n = (i + (e.key === 'ArrowUp' ? 1 : DISTANCES.length - 1)) % DISTANCES.length;
        setDist(DISTANCES[n]!);
        break;
      }
      case 'Enter':
        sheet.current?.querySelector<HTMLAnchorElement>('.scroll-place a')?.click();
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const onSheetKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !sheet.current) return;
    // a manual focus trap: the header above is never inert, but the scroll's own controls are the sheet's
    const items = [...sheet.current.querySelectorAll<HTMLElement>('a[href], button, [tabindex="0"]')].filter(
      (el) => !el.hidden && !el.closest('[hidden]'),
    );
    if (!items.length) return;
    const first = items[0]!,
      last = items[items.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  /** A link in the sheet: the hand comes off the band until the page arrives; a link to the page the sheet was opened
   *  from never changes the pathname (a fragment jump, or a scroll to the top), so the sheet closes first and the
   *  page is back for the jump. */
  const onSheetClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('a[href]');
    if (!a || e.defaultPrevented) return;
    let url: URL;
    try {
      url = new URL(a.href, location.href);
    } catch {
      return;
    }
    if (url.origin !== location.origin) return;
    leaving.current = true;
    clearTimers();
    if (normPath(url.pathname) === normPath(location.pathname) && url.search === location.search) leave();
  };

  if (!open) return null;
  const stop = stops.find((s) => s.stretch === k) ?? stops[0]!;
  return (
    <div
      ref={sheet}
      className="scroll-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scroll-name"
      onKeyDown={onSheetKey}
      onClickCapture={onSheetClick}
    >
      <h2 id="scroll-name" className="visually-hidden">
        {site.scroll.name}
      </h2>
      <div
        ref={band}
        className="scroll-band"
        data-landscape="strip"
        data-wake=""
        role="slider"
        tabIndex={0}
        aria-label={site.scroll.name}
        aria-valuemin={0}
        aria-valuemax={LAST}
        aria-valuenow={k}
        aria-valuetext={stop.label}
        aria-orientation="horizontal"
        aria-describedby="scroll-sheet-hint"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onBandKey}
      />
      <div className="scroll-body">
        <div className="frame scroll-inscription">
          <p className="scroll-place">
            <a className="brush brush--display" href={stop.href}>
              {stop.label}
            </a>
          </p>
          <ul className="scroll-lines" role="list">
            {stop.lines.map((l) => (
              <li key={`${l.href}|${l.label}`}>
                <a className="brush" href={l.href}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <p className="scroll-distances" hidden={!atRest}>
            {DISTANCES.map((d) => (
              <button key={d} type="button" className="brush" aria-pressed={distance === d} onClick={() => setDist(d)}>
                {site.scroll[d]}
              </button>
            ))}
          </p>
        </div>
        <div className="frame scroll-stops">
          <div className="story-map story-map--scroll" role="group" aria-label="All pages">
            <StoryMapArt here={k} />
            <ol className="story-map__list" role="list">
              {STORY_MAP.map((p) => (
                <li key={p.still} data-stretch={p.stretch}>
                  <button
                    type="button"
                    className="brush"
                    aria-current={k === p.stretch ? 'location' : undefined}
                    onClick={() => walkTo(p.stretch)}
                  >
                    {p.label}
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <p className="scroll-close">
            <button type="button" className="brush" onClick={leave}>
              {site.scroll.close}
            </button>
          </p>
        </div>
      </div>
      <p className="visually-hidden" role="status" aria-live="polite">
        {atRest ? stop.label : ''}
      </p>
      <span className="visually-hidden" id="scroll-sheet-hint">
        {site.scroll.hint}
      </span>
    </div>
  );
}
