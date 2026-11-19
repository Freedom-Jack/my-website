'use client';

import type { LandscapeHandle } from './types';

/**
 * The one live painting, for the parts of the site that steer it (the navigation, Still). The canvas and its
 * mount live in the root layout (Landscape.tsx); the handle arrives after the page's first paint, or never
 * (no canvas support, an engine error: the page reads the same either way).
 */
let handle: LandscapeHandle | null = null;

export const landscape = {
  get(): LandscapeHandle | null {
    return handle;
  },
  set(h: LandscapeHandle | null) {
    handle = h;
  },
  reset() {
    handle = null;
  },
};
