// sets/index.ts — the registry of figure sets: one module per set, one set per stretch (figures.ts, THE SET API).
// The figure worker (figures.worker.ts) and the main-thread fallback (figure-source.ts) register this list with
// figures.ts. To add a set: write sets/<name>.ts (export const meta, export function* draw), add one line here and
// its meta to figure-meta.ts METAS (tests/unit/figure-meta.test.ts keeps the two equal); index.ts, the worker, the
// shaders and Canvas2D are generic.
// One set per place, in the handscroll's order: every stretch is a page's place. Each set places itself by its own
// stretch constant K.

import type { SetEntry } from '../figures';
import * as home from './home';
import * as market from './market';
import * as pavilion from './pavilion';
import * as terraces from './terraces';
import * as ferry from './ferry';
import * as path from './path';

export const SETS: SetEntry[] = [
  { stretch: 0, name: 'home', module: home },          // Home
  { stretch: 1, name: 'market', module: market },      // Work
  { stretch: 2, name: 'pavilion', module: pavilion },  // Writing and the Note
  { stretch: 3, name: 'terraces', module: terraces },  // Résumé
  { stretch: 4, name: 'ferry', module: ferry },        // Contact
  { stretch: 5, name: 'path', module: path },          // the 404
];
