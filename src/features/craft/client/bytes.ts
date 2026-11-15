'use client';

/**
 * "downloaded N KB from this site" (the attack's A5): the compressed bytes the craft fetched, measured, never typed.
 * A PerformanceObserver reads every resource entry; an entry counts when it is one of the craft's JSON files
 * (/craft/…) or a script fetched while a craft module was loading (the import's own chunk). Its encoded body size is
 * what came over the wire, compressed. Subscribers hear every change.
 */
let total = 0;
let observer: PerformanceObserver | null = null;
const seen = new Set<string>();
const windows: Array<[number, number]> = [];
const subs = new Set<(bytes: number) => void>();

function take(entries: PerformanceEntryList) {
  let changed = false;
  for (const e of entries as PerformanceResourceTiming[]) {
    if (seen.has(e.name)) continue;
    let same = false;
    let craft = false;
    try {
      const u = new URL(e.name, location.href);
      same = u.origin === location.origin;
      craft = u.pathname.startsWith('/craft/');
    } catch {
      continue;
    }
    const during = e.initiatorType === 'script' && windows.some(([a, b]) => e.startTime >= a && e.startTime <= b);
    if (!same || !(craft || during)) continue;
    seen.add(e.name);
    total += e.encodedBodySize || e.transferSize || 0;
    changed = true;
  }
  if (changed) for (const s of subs) s(total);
}

function start() {
  if (observer || typeof PerformanceObserver === 'undefined') return;
  observer = new PerformanceObserver((list) => take(list.getEntries()));
  try {
    observer.observe({ type: 'resource', buffered: true });
  } catch {
    observer = null;
  }
}

/** Run a craft load inside a measured window (its chunk and its JSON count), then settle the count. */
export async function measured<T>(load: () => Promise<T>): Promise<T> {
  start();
  const w: [number, number] = [performance.now(), Infinity];
  windows.push(w);
  try {
    return await load();
  } finally {
    w[1] = performance.now();
    take(performance.getEntriesByType('resource'));
  }
}

export function onBytes(fn: (bytes: number) => void): () => void {
  subs.add(fn);
  fn(total);
  return () => subs.delete(fn);
}

/** "14" (KB, rounded, at least 1 once anything came) */
export const kb = (bytes: number) => (bytes ? Math.max(1, Math.round(bytes / 1024)) : 0);
