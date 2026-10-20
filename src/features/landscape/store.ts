'use client';

import type { LandscapeHandle } from './types';

/**
 * The one live painting, for the parts of the site that steer it (the navigation, Still). The canvas and its
 * mount live in the root layout (Landscape.tsx); the handle arrives after the page's first paint, or never
 * (no canvas support, an engine error: the page reads the same either way).
 */
let handle: LandscapeHandle | null = null;
let settled = false;
const waiting = new Set<(h: LandscapeHandle | null) => void>();

export const landscape = {
  get(): LandscapeHandle | null {
    return handle;
  },
  /** Resolves with the handle once the mount has finished (or failed: null). */
  ready(): Promise<LandscapeHandle | null> {
    if (settled) return Promise.resolve(handle);
    return new Promise((resolve) => waiting.add(resolve));
  },
  set(h: LandscapeHandle | null) {
    handle = h;
    settled = true;
    for (const resolve of waiting) resolve(h);
    waiting.clear();
  },
  reset() {
    handle = null;
    settled = false;
  },
};
