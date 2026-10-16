// main.js — boots the site from the config on <body> (SPEC-R4A §13.2).
//
//   <body data-page="home" data-stretch="0" data-distance="level" data-presence="1" data-horizon="0.6">
//
//   data-page      page id; its own CSS/JS live at assets/css/pages/<id>.css and assets/js/pages/<id>.js
//   data-stretch   where this page sits on the one continuous handscroll: Home 0, Work 1, (the road 2: no
//                  page), Writing and the Note 3, Résumé 4, Contact 5, 404 6
//   data-distance  landscape composition: 'level' | 'high' | 'deep'
//   data-presence  0..1, how strongly the page's scene shows in its strip and closing
//   data-horizon   0..1, the desktop ink horizon's presence while the reader is between them (default 0.6)
//   data-ground    'living' (4b: Home and Work): the page's own scene is the page's ground, painted full-bleed behind
//                  it in depth layers that sink as you scroll; absent = 4a's strip and closing windows
// and on <html>, set by the inline boot script before first paint (demo switches, SPEC-R4A §9.10):
//   data-palette   'ink' | 'misted' | 'rich' (default 'misted')
//
// Two halves:
//   chrome (once per document, below): the seal, nav, the returning header, the footer's story map, "Still the
//     landscape", the compare panel (demo, only under html.is-compare), the name's ink settle (+ the 2.5 s
//     safety net), the landscape, and (demo only) the same-document router (router.js; ?router=off).
//   bootMain(main, o?) (the current <main>, on load and after every route swap): brush links, ink buttons,
//     margin notes, compact-case disclosure, afterLayout(), diagram draw-ins, then the page module, then the
//     landscape is rebound to the new page's windows. Resolves to its destroy(). Nothing on a page fades in on
//     scroll any more: the round-3 mist-reveal.js is not loaded.
//
// The painting's windows (SPEC-R4A §7): the page's strip ([data-landscape="strip"]), its closing
// ([data-landscape="closing"]), the text blocks the painting must keep clear of ([data-landscape="keepout"]),
// the veils ([data-veil]) and the wake regions ([data-wake]). The round-3 option names (head, descend) are
// passed too, as aliases, so an engine that does not know the new names yet still follows the page.
//
// Page modules (assets/js/pages/<page>.js, declared with <script type="module" … data-page-module>) have no
// side effects at import and export default { init({ main, config, landscape, signal }), destroy() }.
// `landscape` is a Promise of the mountLandscape() handle (or null); `signal` aborts right after destroy().
// A module without a default export is a legacy self-running script: it is left alone (and the router
// falls back to full page loads around it).
//
// Exports: config (live: it reads <body> and <html> on every access, so it follows route swaps and the
// compare panel), ready (Promise of { config, landscape, entrance }), bootMain, site (what the router
// drives), destroy().

import { initArrival } from './arrival.js';
import { initSeal } from './seal.js';
import { initNav } from './nav.js';
import { initHeader } from './header.js';
import { initStoryMap } from './story-map.js';
import { initStill, isStill } from './still.js';
import { initCompare } from './compare.js';
import { initBrushLinks } from './brush-link.js';
import { initInkButtons } from './ink-button.js';
import { initDisclosure } from './disclosure.js';
import { initDiagrams } from './diagram.js';
import { initMarginNotes } from './margin-note.js';
import { initRouter } from './router.js';

const html = document.documentElement;
const body = document.body;
const num = (v, d) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? d : Number(v));
const PALETTES = ['ink', 'misted', 'rich'];

export const config = Object.freeze({
  get page() { return body.dataset.page || 'page'; },
  get stretch() { return num(body.dataset.stretch, 0); },
  get distance() { return body.dataset.distance || 'level'; },
  get presence() { return num(body.dataset.presence, 1); },
  get horizon() { return num(body.dataset.horizon, 0.6); },
  get ground() { return body.dataset.ground === 'living' && params.get('ground') !== '4a' ? 'living' : ''; },
  get palette() { return PALETTES.includes(html.dataset.palette) ? html.dataset.palette : 'misted'; },
});

// DEMO ONLY: screenshot helpers, loaded only when ?y= or ?t= is in the URL.
const params = new URLSearchParams(location.search);
// DEMO ONLY (4b): the living ground's tunables, for the art lead's comparisons (landscape/index.js STAGE documents
// them): ?sink=.05,.17,.26&reach=1&ease=2&split=2,3&seaK=1&soft=.06&billow=.035&haze=.56&hazeK=.75&anchor=-1
// &cluster=0&slide=-1 (from the anchor; px at 1440 otherwise)&slideAt=.38,.52&cloud=0&cloudAt=.1,.3,.62,.88&rise=1
// &body=.45,1&curtain=0&reveal=.9&revealAt=.45,1&descend=1&vmax=.5&lead=0&descAt=.02,.3,.55,.88&still=.25&core=40&feather=56&swell=72&clear=170&far=.5&sky=.45&drift=1.25&lag=.55,
// and ?ground=4a
// for 4a. (Work's own numbers, STAGE_AT, apply unless the URL sets them.)
const TUNE = ['sink', 'reach', 'ease', 'split', 'seaK', 'soft', 'billow', 'haze', 'hazeK', 'anchor', 'cluster', 'slide', 'slideAt', 'cloud', 'cloudAt', 'rise', 'body', 'curtain', 'reveal', 'revealAt',
  'descend', 'vmax', 'lead', 'descAt', 'still', 'core', 'feather', 'swell', 'clear', 'far', 'sky', 'drift', 'lag'];
const tune = Object.fromEntries(TUNE.filter((k) => params.has(k)).map((k) => [k, params.get(k)]));
// (the 4a comparison keeps 4a's "Draft art" placement too: layout.css reads this)
if (params.get('ground') === '4a') html.dataset.ground4a = '';
const demo = params.has('y') || params.has('t') ? await import('./demo.js') : null;
demo?.scrollFromParams(params);

let destroyed = false;
let landscape = null;
const chrome = [];          // the chrome's cleanups
let mainDestroy = null;     // the current <main>'s destroy()

/**
 * The page's elements the landscape reads (SPEC-R4A §13.2): its windows, keep-outs, veils and wake regions.
 * `head` and `descend` are the round-3 names of strip and closing, kept as aliases for one round.
 */
function landscapeTargets(main) {
  const strip = main.querySelector('[data-landscape="strip"]') || main.querySelector('[data-landscape="head"]');
  const closing = main.querySelector('[data-landscape="closing"]') || main.querySelector('[data-landscape-descend]');
  return {
    strip,
    closing,
    keepout: main.querySelectorAll('[data-landscape="keepout"]'),
    veil: main.querySelectorAll('[data-veil]'),
    wake: main.querySelectorAll('[data-wake]'),
    horizon: config.horizon,
    ground: config.ground,
    head: strip,
    descend: closing,
  };
}

// ---------------------------------------------------------------- the landscape (loaded on its own)
const canvas = document.querySelector('canvas.landscape');
let landscapeModule = null;
const loadLandscape = () => (landscapeModule ??= import('./landscape/index.js'));
/** Resolves just after the page's first frame has been painted: the text never waits for the painting (the
    engine's first mount compiles shaders and paints a whole scene in one task). A hidden tab resolves at once
    (the engine draws nothing visible until it is shown). */
const afterFirstPaint = () => new Promise((resolve) => {
  if (document.visibilityState === 'hidden') { resolve(); return; }
  requestAnimationFrame(() => setTimeout(resolve, 0));
});
async function mountLand() {
  if (!canvas) return null;
  try {
    const [{ mountLandscape }] = await Promise.all([loadLandscape(), afterFirstPaint()]);
    if (destroyed) return null;                 // torn down while the module loaded: never mount
    return mountLandscape(canvas, {
      stretch: config.stretch,
      distance: config.distance,
      presence: config.presence,
      palette: config.palette,
      ...landscapeTargets(document.getElementById('main') || document.body),
      still: isStill(),
      arrival: 'bloom',
      tune,
    });
  } catch (err) {
    console.warn('landscape unavailable', err);
    return null;
  }
}

// ---------------------------------------------------------------- per <main>
/**
 * Bind everything inside one <main>. The synchronous part comes first, so its destroy() exists at once,
 * even while the page module is still loading. The layout-changing inits go first (below 75rem margin notes
 * fold into toggles; below 40rem compact cases close), then `afterLayout()` runs (the router and a reload put
 * the restored scroll position back there, after the folds), and only then do the draw-ins look at what is
 * on screen.
 * @returns {{ destroy(): void, ready: Promise<void> }}
 */
function startMain(main, { module, rebind = false, afterLayout } = {}) {
  const cleanups = [
    initBrushLinks(main),
    initInkButtons(main),
    initMarginNotes(main),
    initDisclosure(main),
  ];
  try { afterLayout?.(); } catch { /* a scroll fix-up can never stop the page binding */ }
  cleanups.push(initDiagrams(main));
  const ctrl = new AbortController();
  let page = null;
  let dead = false;
  const destroy = () => {
    if (dead) return;
    dead = true;
    try { page?.destroy?.(); } catch (err) { console.error('page module destroy failed', err); }
    ctrl.abort();
    cleanups.splice(0).reverse().forEach((fn) => { try { fn(); } catch { /* keep going */ } });
  };

  const marker = document.querySelector('[data-page-module]');
  const src = module === undefined ? (marker?.getAttribute('src') || marker?.getAttribute('href')) : module;
  const ready = (async () => {
    if (src) {
      try {
        const mod = await import(new URL(src, location.href).href);
        const candidate = mod?.default;
        if (!dead && candidate && typeof candidate.init === 'function') {
          page = candidate;
          await page.init({ main, config, landscape: landReady, signal: ctrl.signal });
        }
      } catch (err) {
        console.error(`page module ${src} failed`, err);
      }
    }
    if (rebind && !dead) {
      const land = await landReady;
      if (land && !dead) {
        const targets = landscapeTargets(main);
        if (typeof land.rebind === 'function') land.rebind(targets);
        else land.setVeil?.(targets.veil);
      }
    }
  })();
  return { destroy, ready };
}

/**
 * Bind everything inside one <main>: on load, and after a route swap.
 * @param {HTMLElement} main
 * @param {{ module?: string|null, rebind?: boolean, afterLayout?: () => void }} [o]  module: the page
 *   module's URL (default: the document's [data-page-module]); rebind: hand the landscape the new page's
 *   elements once the page module has run (the demo router rebinds itself, at the swap); afterLayout: runs
 *   once the layout-changing inits are done, before the draw-ins (restore a scroll position there).
 * @returns {Promise<() => void>} destroy
 */
export function bootMain(main, o) {
  const h = startMain(main, o);
  return h.ready.then(() => h.destroy);
}

// ---------------------------------------------------------------- the chrome, once per document
// Retired session keys (the round-2 page wash, round 3's edge variant and scroll-map cache): drop them once.
try { ['ink:nav', 'ink:frame', 'ink:transition', 'ink:strip'].forEach((k) => sessionStorage.removeItem(k)); } catch { /* ignore */ }

// 1. The name's ink settle (Home); nothing else on the first screen has an entrance.
const entrance = initArrival();
chrome.push(entrance.destroy);

// 2. Header and footer. Each init is idempotent and returns its destroy (or an object with destroy()).
const header = document.querySelector('.site-header');
const footer = document.querySelector('.site-footer');
const nav = initNav();
const returning = initHeader();
const still = initStill({ getLandscape: () => landscape });
const storyMap = initStoryMap({ strip: async () => (await loadLandscape()).stripSVG ?? null });
const compare = initCompare({ getLandscape: () => landscape });
chrome.push(
  initSeal(),
  () => nav.destroy(),
  () => returning.destroy(),
  () => still.destroy(),
  () => storyMap.destroy(),
  () => compare.destroy(),
  header ? initBrushLinks(header) : () => {},
  footer ? initBrushLinks(footer) : () => {},
);

// 3. The landscape. A problem there can never take the page's effects down.
const landReady = mountLand().then((handle) => {
  if (destroyed) { try { handle?.destroy(); } catch { /* ignore */ } return null; }
  landscape = handle;
  html.classList.toggle('no-landscape', !handle || handle.mode === 'static');
  if (handle) {
    still.apply(handle);
    // the palette may have changed (compare panel) while the engine loaded
    if (typeof handle.setPalette === 'function' && handle.stats?.().palette && handle.stats().palette !== config.palette) {
      try { handle.setPalette(config.palette); } catch { /* the engine keeps its own */ }
    }
    chrome.push(() => handle.destroy());
  }
  return handle;
});

// 4. The page's own <main>. A reload, or a return to an entry the router made, restores where the reader
//    was before the page binds (the router keeps scroll restoration manual).
let restoreY = null;
try {
  const type = performance.getEntriesByType('navigation')[0]?.type;
  const st = history.state;
  if ((type === 'reload' || type === 'back_forward') && st?.ink && st.y > 0 && scrollY === 0 && !location.hash && !demo) {
    restoreY = st.y;
    scrollTo({ top: restoreY, behavior: 'instant' });
  }
} catch { /* nothing to restore */ }
const mainEl = document.getElementById('main');
let firstMain = Promise.resolve();
if (mainEl) {
  // margin notes and compact cases fold on phones (above the restored position, too): put it back after
  const afterLayout = restoreY === null ? undefined
    : () => { if (Math.abs(scrollY - restoreY) > 1) scrollTo({ top: restoreY, behavior: 'instant' }); };
  const first = startMain(mainEl, { afterLayout });
  mainDestroy = first.destroy;
  firstMain = first.ready;
}

// 5. Safety net: whatever happens, the name's ink edge is gone after ~2.5 s.
const safety = demo?.frozenAt(params) == null ? setTimeout(() => entrance.finish(), 2500) : 0;
demo?.freeze(params, entrance);

export const ready = landReady.then(() => ({ config, landscape, entrance }));

/** What the demo router drives (and what the Next.js port's layout would own). */
export const site = {
  get landscape() { return landscape; },
  landReady,
  nav,
  header: returning,
  storyMap,
  still,
  compare,
  entrance,
  firstMain,
  /** The landscape's elements for a <main> (for rebind after a swap). */
  targets: landscapeTargets,
  /** Destroy the current main's bindings (the router does this inside its swap task). */
  destroyMain() {
    const old = mainDestroy;
    mainDestroy = null;
    try { old?.(); } catch { /* keep going */ }
  },
  /** Bind a freshly swapped-in main; its destroy is registered at once. Resolves when its page module ran. */
  bootMain(main, o) {
    site.destroyMain();
    const h = startMain(main, { rebind: true, ...o });
    mainDestroy = h.destroy;
    return h.ready;
  },
};

// 6. DEMO ONLY: the same-document router (it previews the Next.js client navigation).
const router = initRouter(site);
chrome.push(() => router.destroy());

/** Tear everything down (tests; the Next.js port's layout unmount). */
export function destroy() {
  destroyed = true;
  clearTimeout(safety);
  site.destroyMain();
  chrome.splice(0).reverse().forEach((fn) => { try { fn(); } catch { /* keep going */ } });
  landscape = null;
}
