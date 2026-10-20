// sets/index.js — the registry of figure sets: one module per set, one set per stretch (figures.js, THE SET API).
// figures.js reads this list on first use. To add a set: write sets/<name>.js (export const meta, export function*
// draw) and add one line here; nothing else changes (index.js, the worker, the shaders and Canvas2D are generic).
// Stretch 2, the road between Work and Writing, has no page and no set.

import * as home from './home.js';
import * as market from './market.js';
import * as pavilion from './pavilion.js';
import * as terraces from './terraces.js';
import * as ferry from './ferry.js';
import * as path from './path.js';

export const SETS = [
  { stretch: 0, name: 'home', module: home },          // Home
  { stretch: 1, name: 'market', module: market },      // Work
  { stretch: 3, name: 'pavilion', module: pavilion },  // Writing and the Note
  { stretch: 4, name: 'terraces', module: terraces },  // Résumé
  { stretch: 5, name: 'ferry', module: ferry },        // Contact
  { stretch: 6, name: 'path', module: path },          // the 404
];
