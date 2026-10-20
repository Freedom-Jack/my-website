'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';
import { normPath } from '@/features/landscape/places';

/**
 * "You are here" for every link to a page: aria-current="page" on the link to this page, "true" on the link to its
 * section (Work while reading a case, Writing while reading a note), none anywhere on the 404, whatever its URL (it
 * is not part of any section). The brush mark under a current link is CSS (effects.css).
 */

// The 404 says it is showing (<LostMark/>), so the chrome marks nothing while it is.
let lost = 0;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const notify = () => listeners.forEach((fn) => fn());

/** Rendered by the 404 page: while it is mounted, no link is "current". */
export function LostMark() {
  useEffect(() => {
    lost += 1;
    notify();
    return () => {
      lost -= 1;
      notify();
    };
  }, []);
  return null;
}

export function useCurrent(): (href: string) => 'page' | 'true' | undefined {
  const here = normPath(usePathname() || '/');
  const isLost = useSyncExternalStore(
    subscribe,
    () => lost > 0,
    () => false,
  );
  return (href: string) => {
    if (isLost) return undefined;
    const p = normPath(href);
    if (p === here) return 'page';
    if (p !== '/' && here.startsWith(p)) return 'true';
    return undefined;
  };
}
