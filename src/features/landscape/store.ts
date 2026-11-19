'use client';

import type { LandscapeHandle } from './types';

/**
 * The one live painting, for the parts of the site that steer it (the navigation, Still, Ask, the craft search, the
 * scroll). The canvas and its mount live in the root layout (Landscape.tsx); the handle arrives after the probe, or
 * never (the page keeps its still, or the engine fails): the page reads the same either way.
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
