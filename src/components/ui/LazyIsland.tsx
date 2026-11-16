'use client';

import { type ComponentType, type ReactNode, useEffect, useRef, useState } from 'react';

/**
 * A piece of the page that needs script only once the reader is near it (round 7: "Ask the painting" on Home, the
 * search on Work and on a project page). The server renders its still form (`children`: plain markup, no script);
 * this small wrapper waits until the piece is within a screen and a half of the viewport (or is focused), fetches
 * its code and puts the live piece in the still one's place (the reader's focus and anything typed in its line go
 * with it: `initialValue`). So the piece costs a page's first load nothing: on a
 * phone every kilobyte of script before the first screen has settled counts (Lighthouse's simulated LCP moved 0.15 s
 * with 5 KB).
 * The islands are named here, not passed in: a server component cannot hand a client one a function.
 */
const ISLANDS = {
  ask: () => import('@/features/ask/Ask').then((m) => m.Ask as ComponentType<Record<string, unknown>>),
  search: () =>
    import('@/features/craft/client/Search').then((m) => m.Search as unknown as ComponentType<Record<string, unknown>>),
} as const;

export function LazyIsland({
  island,
  props = {},
  children,
}: {
  island: keyof typeof ISLANDS;
  props?: Record<string, unknown>;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // the live piece, once it has come, with what the reader had typed in the still one's line; and whether their
  // focus was in it (both are handed on)
  const [live, setLive] = useState<{ C: ComponentType<Record<string, unknown>>; typed: string } | null>(null);
  const focused = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let asked = false;
    let dead = false;
    const load = () => {
      if (asked) return;
      asked = true;
      void ISLANDS[island]().then((C) => {
        if (dead) return;
        const typed = el.querySelector('input')?.value ?? '';
        focused.current = !!el.contains(document.activeElement) || typed !== '';
        setLive({ C, typed });
      });
    };
    el.addEventListener('focusin', load);
    el.addEventListener('pointerdown', load);
    const io =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && load(), { rootMargin: '150% 0px' })
        : null;
    if (io) io.observe(el.firstElementChild ?? el);
    else load();
    return () => {
      dead = true;
      io?.disconnect();
      el.removeEventListener('focusin', load);
      el.removeEventListener('pointerdown', load);
    };
  }, [island]);
  // the live piece has taken the still one's place: the focus the reader had put in its line goes to the live line
  useEffect(() => {
    if (live && focused.current) ref.current?.querySelector<HTMLElement>('input')?.focus();
  }, [live]);
  // (display: contents: the piece's own box stands in the page's flow, as if this wrapper were not there)
  return (
    <div ref={ref} style={{ display: 'contents' }}>
      {live ? <live.C {...props} initialValue={live.typed} /> : children}
    </div>
  );
}
