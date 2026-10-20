// router.js — DEMO ONLY: a same-document router that previews the Next.js behaviour (SPEC-R3 §6, SPEC-R4A §13.3).
// One document; the landscape canvas, header, footer and filters persist; <main> swaps.
//
//   import { initRouter } from '/assets/js/router.js';
//   const router = initRouter(site);     // site: the chrome main.js shares (see main.js `site`)
//   router.destroy();
//
// What it takes over: a primary-button click (no modifier keys) on an a[href] that is same-origin http(s),
// has no target (or _self), no download, no type, no rel~=external, no data-router="off", and a path with no
// file extension (so the résumé file, /resume.json and /llms.txt load normally), and that is not a redirect stub
// (/about/ and the Note's old URL are standalone meta-refresh pages: they load normally, and any other page that
// turns out to be one falls back quietly). A different hash on the same path is left to the browser (it
// scrolls); the same path with no hash scrolls to the top. Everything else (mailto:, other sites, new tabs) is
// untouched.
//
// A forward navigation: the HTML (prefetched on hover, focus or press; cached 30 s) is parsed with
// DOMParser and validated (main#main and body[data-page] must exist). As soon as it is parsed, the painting is
// asked to prepare the destination's figure layers (landscape.prepare(stretch), when the engine has it), so
// the town or the traveller is ready before the pan and never pops in. The old text sinks into the mist
// while the painting pans to the new stretch (transition.js); at 160 ms, in one task: the page module's
// destroy(), <main> replaced, <body> data-* copied, the head swapped (title, description, robots, canonical,
// alternate, og:*, page JSON-LD; never the shared Person JSON-LD, which carries data-shared), the page
// stylesheet replaced by one adopted CSSStyleSheet (so two pages' styles are never active together), the
// history entry pushed, the scroll set (top, or the hash target), nav / story map / header updated. Then
// bootMain() on the new <main>, one landscape.rebind() with the new page's strip, closing, keep-outs, veils and
// wake regions (main.js site.targets), and the enter. Focus moves to the new h1 (tabindex=-1, preventScroll) or to
// the hash target, and #route-announcer reads the new title.
// Back/forward: the content swaps at once (no exit, no enter, no sweep), the scroll position is restored
// (and put back again after bootMain()'s margin notes fold, before its reveals look), and the painting pans
// back behind it in 400 ms. A jump of more than 2 stretches is spliced under the engine's own pale mist
// (behind the text), so five scenes never whip past; shorter ones pan the whole way with no mist.
// Anything unexpected (a fetch error, a non-OK status other than 404 (the designed 404 swaps in like any
// page), a page that is not built for swapping, an exception during the swap, no swap within 3 s) falls
// back to a normal navigation.
// QA: ?router=off switches it off for the session (sessionStorage 'ink:router'), ?router=on back on.
// Events on document: route:start { from, to, kind }, route:swap { from, to }, route:end { to, readyAt },
// route:fallback { to, reason }.

import { exit, enter, travel, cut, quiet, restore } from './transition.js';

const KEY = 'ink:router';
const CACHE_MS = 30000;
const WATCHDOG_MS = 3000;
const SAVE_MS = 200;               // scroll position is written to the history entry this long after scrolling stops

const supported = () => typeof fetch === 'function' && typeof DOMParser === 'function'
  && typeof history.pushState === 'function' && typeof CSSStyleSheet === 'function'
  && typeof CSSStyleSheet.prototype.replaceSync === 'function' && 'adoptedStyleSheets' in Document.prototype;

/** The router is off for this session after ?router=off (and on again after ?router=on). */
function switchedOff() {
  try {
    const q = new URLSearchParams(location.search).get('router');
    if (q === 'off') sessionStorage.setItem(KEY, 'off');
    if (q === 'on') sessionStorage.removeItem(KEY);
    return sessionStorage.getItem(KEY) === 'off';
  } catch { return false; }
}

const pathOf = (url) => {
  let p = url.pathname.replace(/index\.html$/, '');
  if (!p.endsWith('/') && !/\.[a-z0-9]+$/i.test(p)) p += '/';
  return p;
};
const keyOf = (url) => url.origin + pathOf(url) + url.search;   // the cache key: no hash
// Redirect stubs (standalone meta-refresh pages, no shared blocks): never intercepted (SPEC-R4A §13.3).
const STUBS = new Set(['/about/', '/writing/building-modular-ai-agents/']);
const num = (v, d) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? d : Number(v));
const newKey = () => Math.random().toString(36).slice(2, 10);
const emit = (type, detail) => document.dispatchEvent(new CustomEvent(type, { detail }));

// A page built for the router declares its behaviour with data-page-module and its stylesheet with
// data-page-style. A page whose script under /assets/js/pages/ lacks data-page-module runs itself at import
// and cannot be swapped in or out: such navigations fall back to a full load.
const PAGE_SCRIPT = 'script[type="module"][src*="/assets/js/pages/"]';
const legacy = (doc) => [...doc.querySelectorAll(PAGE_SCRIPT)].some((s) => !s.hasAttribute('data-page-module'));
const moduleSrc = (doc, base) => {
  const el = doc.querySelector('[data-page-module]');
  const src = el?.getAttribute('src') || el?.getAttribute('href');
  return src ? new URL(src, base).href : null;
};
const styleHref = (doc, base) => {
  const el = doc.querySelector('link[rel="stylesheet"][data-page-style]')
    || doc.querySelector('link[rel="stylesheet"][href*="/assets/css/pages/"]');
  return el ? new URL(el.getAttribute('href'), base).href : null;
};

// The head items a page owns (everything else in <head> is shared and never swapped).
const HEAD = [
  'title',
  'meta[name="description"]',
  'meta[name="robots"]',
  'link[rel="canonical"]',
  'link[rel="alternate"]',
  'meta[property^="og:"]',
  'script[type="application/ld+json"]:not([data-shared])',
];

export function initRouter(site) {
  const off = () => ({ destroy() {}, navigate: null });
  if (!supported() || switchedOff()) return off();
  if (legacy(document)) {
    // this page runs a self-starting script: its links load normally (nothing could tear it down)
    return off();
  }

  history.scrollRestoration = 'manual';
  const cache = new Map();         // keyOf(url) -> { t, ready: Promise<page> }
  const ys = new Map();            // history key -> scrollY (memory; the entries' state has it too)
  let state = { key: newKey(), y: scrollY };
  history.replaceState({ ...(history.state || {}), ink: true, ...state }, '', location.href);
  let current = new URL(location.href);
  let nav = null;                  // the navigation in flight: { ctrl, url, timer }
  let pageSheet = null;            // the adopted sheet of the current page (after the first swap)
  let saveTimer = 0;

  const saveY = (y = scrollY) => {
    ys.set(state.key, y);
    try { history.replaceState({ ...(history.state || {}), ink: true, key: state.key, y }, '', location.href); } catch { /* rate-limited */ }
  };
  const onScroll = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => saveY(), SAVE_MS); };
  // a reload or a cross-document return to this entry: let the browser restore it (main.js covers older entries)
  const onPageHide = () => { saveY(); history.scrollRestoration = 'auto'; };
  const onPageShow = (e) => { if (e.persisted) history.scrollRestoration = 'manual'; };

  // ---------------------------------------------------------------- fetch and parse
  /** Ask the painting to draw the destination's figure layers now, off the main thread (idempotent). */
  function prepare(doc) {
    const land = site.landscape;
    if (!land || typeof land.prepare !== 'function') return;
    const stretch = num(doc.body?.dataset.stretch, NaN);
    if (!Number.isFinite(stretch)) return;
    // (the destination's own composition, as the pan will ask for it: the layer drawn now is the one it shows)
    const o = { distance: doc.body.dataset.distance || 'level', presence: num(doc.body.dataset.presence, 1) };
    try { Promise.resolve(land.prepare(stretch, o)).catch(() => { /* the pan fades it in when it is ready */ }); }
    catch { /* never let the painting stop a navigation */ }
  }

  function load(url) {
    const k = keyOf(url);
    const hit = cache.get(k);
    if (hit && performance.now() - hit.t < CACHE_MS) return hit.ready;
    const ready = (async () => {
      const res = await fetch(url.href, { credentials: 'same-origin', headers: { Accept: 'text/html' } });
      if (!res.ok && res.status !== 404) throw Object.assign(new Error(`HTTP ${res.status}`), { reason: `status ${res.status}` });
      if (!(res.headers.get('content-type') || '').includes('text/html')) throw Object.assign(new Error('not HTML'), { reason: 'not html' });
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const base = res.url || url.href;
      if (doc.querySelector('meta[http-equiv="refresh" i]')) throw Object.assign(new Error('redirect stub'), { reason: 'redirect stub', quiet: true });
      const main = doc.querySelector('main#main');
      if (!main || !doc.body?.dataset.page) throw Object.assign(new Error('not a site page'), { reason: 'no main#main or body[data-page]' });
      if (legacy(doc)) throw Object.assign(new Error('legacy page script'), { reason: 'page script without data-page-module' });
      const css = styleHref(doc, base);
      const cssText = css ? await fetch(css, { credentials: 'same-origin' }).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`CSS ${r.status}`)))) : null;
      prepare(doc);
      return { url: base, status: res.status, doc, main, css, cssText, module: moduleSrc(doc, base) };
    })();
    cache.set(k, { t: performance.now(), ready });
    ready.catch(() => cache.delete(k));
    return ready;
  }

  // ---------------------------------------------------------------- which links
  function eligible(a, e) {
    if (!a || !a.hasAttribute('href')) return null;
    if (e && (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.defaultPrevented)) return null;
    const target = a.getAttribute('target');
    if (target && target !== '_self') return null;
    if (a.hasAttribute('download') || a.hasAttribute('type')) return null;
    if ((a.getAttribute('rel') || '').split(/\s+/).includes('external')) return null;
    if (a.dataset.router === 'off') return null;
    let url;
    try { url = new URL(a.href, location.href); } catch { return null; }
    if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return null;
    if (/\.[a-z0-9]+$/i.test(url.pathname) && !/index\.html$/i.test(url.pathname)) return null;
    if (STUBS.has(pathOf(url))) return null;
    return url;
  }
  const samePage = (url) => pathOf(url) === pathOf(current) && url.search === current.search;

  function prefetch(e) {
    const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
    const url = eligible(a, null);
    if (url && !samePage(url)) load(url).catch(() => { /* the click will fall back */ });
  }

  /** Call off the navigation in flight (before its swap): the page that was leaving stays. */
  function callOff() {
    if (!nav) return;
    nav.ctrl.abort();
    clearTimeout(nav.timer);
    nav = null;
    restore(document.getElementById('main'));
    const land = site.landscape;
    if (land && !quiet()) travel(land, { to: num(document.body.dataset.stretch, 0), distance: document.body.dataset.distance || 'level', presence: num(document.body.dataset.presence, 1), back: true });
  }

  function onClick(e) {
    const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
    const url = eligible(a, e);
    if (!url) return;
    if (samePage(url)) {
      if (nav && !nav.swapped) { e.preventDefault(); callOff(); return; }   // changed their mind: stay
      if (url.hash) return;                       // the browser scrolls to the fragment
      e.preventDefault();
      scrollTo({ top: 0, behavior: 'instant' });
      return;
    }
    e.preventDefault();
    navigate(url, { kind: 'push' });
  }

  function onPop(e) {
    const url = new URL(location.href);
    if (nav && !nav.swapped) callOff();                // Back during a forward navigation: stay put first
    if (samePage(url)) { current = url; return; }      // a hash change within the page: the browser's
    ys.set(state.key, scrollY);                        // the entry we leave
    const st = e.state || {};
    navigate(url, { kind: 'pop', state: st });
  }

  // ---------------------------------------------------------------- where the painting goes
  const stretchOf = (body) => num(body.dataset.stretch, 0);
  /** Before the HTML is here: the stretch the footer's story map gives the link (Home 0 … Contact 5). */
  function guessStretch(url) {
    const items = [...document.querySelectorAll('.story-map__list li[data-stretch]')];
    const p = pathOf(url);
    let best = null, len = -1;
    for (const li of items) {
      const a = li.querySelector('a[href]');
      if (!a) continue;
      const q = pathOf(new URL(a.href, location.href));
      if ((p === q || (q !== '/' && p.startsWith(q))) && q.length > len) { best = num(li.dataset.stretch, null); len = q.length; }
    }
    return best;
  }

  // ---------------------------------------------------------------- the swap (one task)
  function swapHead(page) {
    const { doc } = page;
    const anchor = document.head.querySelector('meta[name="color-scheme"]') || document.head.firstChild;
    for (const sel of HEAD) {
      document.head.querySelectorAll(sel).forEach((el) => el.remove());
      for (const el of doc.head.querySelectorAll(sel)) document.head.insertBefore(document.importNode(el, true), anchor);
    }
    // the page module's marker: an inert modulepreload (the router imports the module itself; a new
    // <script> would be executed again by the browser)
    document.head.querySelectorAll('[data-page-module]').forEach((el) => el.remove());
    if (page.module) {
      const marker = document.createElement('link');
      marker.rel = 'modulepreload';
      marker.href = page.module;
      marker.setAttribute('data-page-module', '');
      document.head.append(marker);
    }
  }

  function swapStyle(page) {
    document.querySelectorAll('link[rel="stylesheet"][data-page-style], link[rel="stylesheet"][href*="/assets/css/pages/"]').forEach((l) => l.remove());
    const sheets = document.adoptedStyleSheets.filter((s) => s !== pageSheet);
    pageSheet = null;
    if (page.cssText != null) {
      pageSheet = page.sheet || new CSSStyleSheet({ baseURL: page.css });
      if (!page.sheet) pageSheet.replaceSync(page.cssText);
      sheets.push(pageSheet);
    }
    document.adoptedStyleSheets = sheets;
  }

  function swapBody(doc) {
    const body = document.body;
    for (const k of Object.keys(body.dataset)) if (!(k in doc.body.dataset)) delete body.dataset[k];
    for (const [k, v] of Object.entries(doc.body.dataset)) body.dataset[k] = v;
  }

  function swap(page, url, { kind, state: popState }) {
    const from = current.href;
    const leavingY = scrollY;                                       // before the new page can clamp it
    clearTimeout(saveTimer);
    site.destroyMain();                                             // 1. the page module's destroy, the old bindings
    const oldMain = document.getElementById('main');
    const main = document.importNode(page.main, true);              // 2. the new <main>
    oldMain.replaceWith(main);
    swapBody(page.doc);                                             // 3. <body> data-*
    swapHead(page);                                                 // 4. head
    swapStyle(page);                                                // 5. page stylesheet
    if (kind === 'push') {                                          // 6. history
      saveY(leavingY);
      state = { key: newKey(), y: 0 };
      history.pushState({ ink: true, ...state }, '', url.href);
    } else {
      state = { key: popState.key || newKey(), y: num(ys.get(popState.key), num(popState.y, 0)) };
      if (!popState.key) history.replaceState({ ...(history.state || {}), ink: true, ...state }, '', location.href);
    }
    current = new URL(location.href);
    document.documentElement.classList.add('is-routed');
    // 7. scroll: never smooth
    const target = url.hash ? document.getElementById(decodeURIComponent(url.hash.slice(1))) : null;
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    if (kind === 'pop') scrollTo({ top: state.y, behavior: 'instant' });
    else if (target) target.scrollIntoView({ block: 'start', behavior: 'instant' });
    else scrollTo({ top: 0, behavior: 'instant' });
    html.style.scrollBehavior = prev;
    // 8. chrome
    site.nav?.update?.();
    site.storyMap?.update?.();
    site.header?.reset?.();
    emit('route:swap', { from, to: url.href });
    return { main, target };
  }

  function focusAndAnnounce(main, target) {
    const el = target || main.querySelector('h1');
    if (el) {
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    }
    const live = document.getElementById('route-announcer');
    if (live) {
      setTimeout(() => {
        live.textContent = '';
        requestAnimationFrame(() => { live.textContent = document.title; });
      }, 50);
    }
  }

  // ---------------------------------------------------------------- one navigation
  function fallback(url, kind, reason) {
    emit('route:fallback', { to: url.href, reason });
    if (kind === 'pop') location.reload();
    else location.assign(url.href);
  }

  async function navigate(url, { kind, state: popState = {} }) {
    nav?.ctrl.abort();
    clearTimeout(nav?.timer);
    const ctrl = new AbortController();
    const me = { ctrl, url, timer: 0 };
    nav = me;
    const { signal } = ctrl;
    const start = performance.now();
    const fromStretch = num(site.landscape?.stats?.().stretch, stretchOf(document.body));
    emit('route:start', { from: current.href, to: url.href, kind });
    me.timer = setTimeout(() => { if (nav === me) { ctrl.abort(); nav = null; fallback(url, kind, 'timeout'); } }, WATCHDOG_MS);

    try {
      await site.firstMain;                       // never swap before the first page has finished booting
      const oldMain = document.getElementById('main');
      let dir = 0;
      let exiting = Promise.resolve();
      if (kind === 'push') {
        const guess = guessStretch(url);
        dir = guess === null ? 0 : Math.sign(guess - fromStretch);
        exiting = exit(oldMain, { dir, signal });
      }
      const page = await load(url);
      if (signal.aborted) return;
      const to = stretchOf(page.doc.body);
      prepare(page.doc);                          // idempotent: a no-op when the prefetch already asked
      const where = { to, distance: page.doc.body.dataset.distance || 'level', presence: num(page.doc.body.dataset.presence, 1) };
      dir = Math.sign(to - fromStretch) || dir;
      const land = site.landscape;
      if (!quiet()) travel(land, { ...where, dir, back: kind === 'pop' });
      if (page.cssText != null && !page.sheet) {
        page.sheet = new CSSStyleSheet({ baseURL: page.css });
        page.sheet.replaceSync(page.cssText);
      }
      const modReady = page.module ? import(page.module) : null;   // warm the module while the text sinks
      modReady?.catch(() => { /* bootMain reports it */ });
      await exiting;
      if (signal.aborted) return;

      const { main, target } = swap(page, url, { kind, state: popState });
      me.swapped = true;
      clearTimeout(me.timer);
      if (quiet()) cut(land, where);
      // bootMain's synchronous part runs in this same task: links, buttons, margin notes (on phones they fold
      // into toggles, above the restored position too), then afterLayout puts the scroll back exactly where
      // it belongs (state.y, or the hash target under the header), and only then do the reveals look at what
      // is on screen (so they settle everything above it). The restore is never smooth.
      const afterLayout = () => {
        if (kind === 'pop') { if (Math.abs(scrollY - state.y) > 1) scrollTo({ top: state.y, behavior: 'instant' }); }
        else if (target?.isConnected) target.scrollIntoView({ block: 'start', behavior: 'instant' });
      };
      site.bootMain(main, { module: page.module, rebind: false, afterLayout });
      // the landscape follows the new page's strip, closing, keep-outs, veils and wake regions at once (one
      // rebind per swap, on the final layout); the engine recomputes the horizon handover before its first present
      try { land?.rebind?.(site.targets(main)); } catch (err) { console.warn('router: landscape rebind failed', err); }
      focusAndAnnounce(main, target);

      if (kind === 'pop') {
        if (nav === me) nav = null;
        emit('route:end', { to: url.href, readyAt: performance.now() - start });
        return;
      }
      await enter(main, { dir, signal });
      if (nav === me) nav = null;
      if (!signal.aborted) emit('route:end', { to: url.href, readyAt: performance.now() - start });
    } catch (err) {
      clearTimeout(me.timer);
      if (signal.aborted && nav !== me) return;   // superseded by a newer navigation
      if (nav === me) nav = null;
      if (!err?.quiet) console.warn('router: falling back to a full navigation', err);
      fallback(url, kind, err?.reason || String(err?.message || err));
    }
  }

  document.addEventListener('click', onClick);
  document.addEventListener('pointerover', prefetch, { passive: true });
  document.addEventListener('focusin', prefetch);
  document.addEventListener('pointerdown', prefetch, { passive: true });
  addEventListener('popstate', onPop);
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('pagehide', onPageHide);
  addEventListener('pageshow', onPageShow);

  return {
    navigate: (href) => navigate(new URL(href, location.href), { kind: 'push' }),
    destroy() {
      nav?.ctrl.abort();
      clearTimeout(nav?.timer);
      clearTimeout(saveTimer);
      document.removeEventListener('click', onClick);
      document.removeEventListener('pointerover', prefetch);
      document.removeEventListener('focusin', prefetch);
      document.removeEventListener('pointerdown', prefetch);
      removeEventListener('popstate', onPop);
      removeEventListener('scroll', onScroll);
      removeEventListener('pagehide', onPageHide);
      removeEventListener('pageshow', onPageShow);
      history.scrollRestoration = 'auto';
    },
  };
}
