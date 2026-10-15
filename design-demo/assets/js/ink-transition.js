// ink-transition.js — between pages an indigo-ink wash floods out from the click, then recedes in the
// direction the handscroll unrolls while the landscape pans from the old page's stretch to the new one.
//
//   import { initInkTransition, consumeArrival, cover, reveal } from '/assets/js/ink-transition.js';
//   const arrival = consumeArrival();          // { from, distance, presence, x, y, dir } if we came through the wash
//   const destroy = initInkTransition({ stretch, distance, presence, arrival, getLandscape, onReveal });
//   await cover({ x, y, source });             // flood the screen from a point (resolves fully covered)
//   await reveal({ dir });                     // recede (dir 1: towards the left, -1: right, 0: back to the point)
//   Both resolve with { cancelled } (true when destroy() or a newer phase cut them short).
//   Events (bubbling, on `document` unless said): 'ink:cover' when a flood starts, dispatched on `source`
//   (the pressed link) when given, so the control holds still under the flood (ink-button.js); 'ink:reveal'
//   when the wash recedes or is torn down, so held controls let go.
//
// How a navigation plays:
//   - A click on a same-origin page link (every browser): the wash floods from the click on this page at
//     once (instant feedback; speculation rules have usually prefetched the page on hover), then we
//     navigate. The next page paints already covered (the inline boot script adds .is-covered and the
//     stored last frame, --ink-frame, before first paint) and the wash recedes from it. Where
//     cross-document View Transitions exist they swap the two identical covered frames seamlessly (the
//     .ink-wash canvas is its own transition group).
//   - Back/forward and other navigations without a click, in browsers with cross-document View
//     Transitions: the old page records the centre (pageswap); the new page's CSS holds the old snapshot
//     (view-transition type 'ink', effects.css) while this module floods its live canvas over it, then
//     ends the transition and the wash recedes. A page restored from the bfcache still covered (it was
//     left by a click) simply recedes.
//   - Reduced motion: no wash; the view transition is a 200 ms cross-fade, other browsers just navigate.
//   - The Next.js port (same-document navigations) calls cover() on route start and reveal() on route end.
//
// The wash is drawn on a small 2D canvas (≈110k cells, upscaled smoothly so the edge stays soft). It is
// wet pigment, never a flat slab: ONE density field serves the flood, the full cover and the recession.
//   - the body: pigment pooled at a low frequency (fA) with fine granulation (fC), density ~0.55–0.85,
//     ~0.9 opaque while it moves, so it reads as a wet wash over the page;
//   - the moving front: a dark tide line in the pool colour where the water carries its pigment, a paler
//     band just behind it, and a second faint ring a little further in;
//   - the full cover (the swap frame) is the same field at full opacity. The noise is hash-deterministic
//     and depends only on the viewport size, so the old and the new page paint identical pixels, and the
//     last frame is also stored (sessionStorage 'ink:frame') for the new page's first paint before JS.

const KEY = 'ink:nav';
const FRAME_KEY = 'ink:frame';
const FRESH_MS = 5000;
const CELLS = 110_000;
const REACH = 0.5;     // the flood runs this far (vh) past the farthest corner, so its front leaves the screen
const TIDE = 1.32;     // pigment density at the tide line (1.25–1.4 with granulation: the pool colour)

// QA only: sessionStorage['ink:debug'] = '1' logs each phase with its timestamp (silent otherwise);
// a larger number also plays the wash that many times slower, to study single frames.
const DEBUG = (() => { try { return Number(sessionStorage.getItem('ink:debug')) || 0; } catch { return 0; } })();
const log = (...a) => { if (DEBUG) console.info(`[ink ${Math.round(performance.now())}ms]`, ...a); };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = () => document.documentElement;   // read lazily: nothing touches the document at import

/* ---------------------------------------------------------------- state */
let canvas = null;
let ctx = null;
let img = null;
let cols = 0;
let rows = 0;
let fA = null;   // broad warp of the front; pooling of the pigment
let fB = null;   // fibre-scale wicking
let fC = null;   // pigment granulation
let fD = null;   // the body's density: pooled pigment + granulation (the full cover is exactly this)
let raf = 0;
let phase = 'clear';   // 'clear' | 'covering' | 'covered' | 'revealing'
let current = null;    // { resolve } of the running phase
let colours = null;
let bound = false;     // initInkTransition() is idempotent: one set of listeners per page

/* ---------------------------------------------------------------- noise */
function hash(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y) {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(i, j);
  const b = hash(i + 1, j);
  const c = hash(i, j + 1);
  const d = hash(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, octaves) {
  let s = 0;
  let amp = 0.5;
  let norm = 0;
  for (let k = 0; k < octaves; k++) {
    s += amp * vnoise(x, y);
    norm += amp;
    x = x * 2.03 + 17.1;
    y = y * 2.03 + 9.7;
    amp *= 0.5;
  }
  return s / norm;
}

/* ---------------------------------------------------------------- canvas */
function hexToRgb(hex, fallback) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function readColours() {
  const cs = getComputedStyle(root());
  const deep = hexToRgb(cs.getPropertyValue('--wash-deep'), [34, 48, 58]);
  return {
    deep,                                                       // a fully loaded wash (density 1)
    light: hexToRgb(cs.getPropertyValue('--wash'), [62, 86, 100]).map((c) => Math.round(c * 0.72 + 239 * 0.28)),
    pool: deep.map((c) => Math.round(c * 0.52)),                // pigment pooled at the tide line (density 1.4)
  };
}
function ms(name, fallback) {
  return (parseFloat(getComputedStyle(root()).getPropertyValue(name)) || fallback) * Math.max(1, DEBUG);
}

function getCanvas() {
  if (canvas?.isConnected) return canvas;
  canvas = document.querySelector('canvas.ink-wash');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'ink-wash';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.append(canvas);
  }
  ctx = null;
  cols = rows = 0;
  return canvas;
}

const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };

function ensure() {
  getCanvas();
  const vw = innerWidth;
  const vh = canvas.clientHeight || innerHeight;
  const s = Math.min(0.5, Math.sqrt(CELLS / (vw * vh)));
  const c = Math.max(16, Math.round(vw * s));
  const r = Math.max(16, Math.round(vh * s));
  if (c === cols && r === rows && fA && ctx) return;
  cols = c;
  rows = r;
  canvas.width = c;
  canvas.height = r;
  ctx = canvas.getContext('2d');
  img = ctx.createImageData(c, r);
  colours = readColours();
  const n = c * r;
  fA = new Float32Array(n);
  fB = new Float32Array(n);
  fC = new Float32Array(n);
  fD = new Float32Array(n);
  const ca = Math.cos(0.52);
  const sa = Math.sin(0.52);
  for (let y = 0; y < r; y++) {
    const v = y / r;
    for (let x = 0; x < c; x++) {
      const u = x / r;            // units of viewport height, so features stay round on any aspect
      const k = y * c + x;
      fA[k] = fbm(u * 2.6, v * 2.6, 4);
      fB[k] = fbm(u * 15 + 3.3, v * 5.5 + 1.7, 3);
      fC[k] = fbm((u * ca - v * sa) * 38 + 11.3, (u * sa + v * ca) * 38 + 5.1, 3);   // rotated: no lattice
      // The body: pigment pools where fA runs high (0.55–0.85) with a soft, slightly darker pool edge;
      // granulation (fC, the paper's tooth per cell, fibre streaks) adds about ±0.08 on top.
      const A = fA[k];
      const edge = (A - 0.5) / 0.035;
      fD[k] = 0.55 + 0.3 * smooth((A - 0.42) / 0.16) + 0.07 * Math.exp(-edge * edge)
        + (fC[k] - 0.5) * 0.24 + (hash(x * 7 + 3, y * 11 + 5) - 0.5) * 0.08 + (fB[k] - 0.5) * 0.06;
    }
  }
}

/**
 * The one density field. w: distance (vh) from the tide line into the wet side (negative: out in the
 * fringe). tide: 0..1, how strongly the tide line pools here. s: 0..1, how developed the front is.
 * Water carries pigment to the front: a dark tide line, a paler band behind it that fades back into
 * the body over 0.25 vh, and a second faint ring ~0.09 vh from the edge.
 */
function pigment(k, w, tide, s) {
  if (s <= 0) return fD[k];
  const d = fD[k] - 0.2 * s * (w > 0 ? 1 - smooth(w / 0.25) : 1);
  const z = (w - 0.072) * 80;
  const ring = z > -3 && z < 3 ? Math.exp(-z * z) * 0.3 : 0;
  const pool = (tide > ring ? tide : ring) * s;
  return d + (TIDE + (fC[k] - 0.5) * 0.3 - d) * pool;
}

/** Paint one frame. alphaOf(k, u, v) returns alpha 0..1 and sets `dens` (pigment density, ~0..1.4). */
let dens = 1;
function paint(alphaOf) {
  const d = img.data;
  const { deep, light, pool } = colours;
  let i = 0;
  for (let y = 0; y < rows; y++) {
    const v = y / rows;
    for (let x = 0; x < cols; x++, i += 4) {
      const k = y * cols + x;
      const a = alphaOf(k, x / rows, v);
      if (a <= 0.002) { d[i + 3] = 0; continue; }
      let r, g, b;
      if (dens <= 1) {
        const t = dens < 0 ? 0 : dens;
        r = light[0] + (deep[0] - light[0]) * t;
        g = light[1] + (deep[1] - light[1]) * t;
        b = light[2] + (deep[2] - light[2]) * t;
      } else {
        const t = dens - 1 > 0.4 ? 1 : (dens - 1) / 0.4;
        r = deep[0] + (pool[0] - deep[0]) * t;
        g = deep[1] + (pool[1] - deep[1]) * t;
        b = deep[2] + (pool[2] - deep[2]) * t;
      }
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
      d[i + 3] = a >= 1 ? 255 : a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** The flood. p: eased progress, t: time fraction (the body turns opaque over the last 12%). */
function frameCover(p, t, ox, oy, maxD) {
  const R = p * (maxD + REACH);
  const fe = 0.03;                              // the wet edge: a narrow fringe, the tide line sits in it
  const fill = smooth((p - 0.9) / 0.1);         // safety: any last dry corner fills as the flood settles
  const bodyA = 0.9 + 0.1 * smooth((t - 0.88) / 0.12);
  paint((k, u, v) => {
    const dx = u - ox;
    const dy = v - oy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const warp = (fA[k] - 0.5) * 0.46 * Math.min(1, dist * 2.5) + (fB[k] - 0.5) * 0.08;
    const e = R - dist - warp;                  // > 0: wet
    if (e <= 0 && fill <= 0) return 0;
    const w = e - 0.018;
    const z = w / 0.011;
    const tide = z > -3 && z < 3 ? Math.exp(-z * z) : 0;
    dens = pigment(k, w, tide, 1);
    const edge = e <= 0 ? 0 : e >= fe ? 1 : smooth(e / fe);
    const a = edge * (bodyA + (1 - bodyA) * tide);
    return a > fill * bodyA ? a : fill * bodyA;
  });
}

/** The recession. q: eased progress, t: time fraction. Keeps the warp, the pools, the rim and the ragged edge. */
function frameReveal(q, t, dir, ox, oy, maxD) {
  const fe = 0.12;                              // a receding wet edge is broad and soft
  const width = cols / rows;
  const span = (dir === 0 ? maxD : width) + 0.5;
  const F = q * span - 0.02;                    // the edge enters at once: no still slab
  const fade = 1 - smooth((q - 0.86) / 0.14);
  const bodyA = 1 - 0.1 * smooth(t / 0.15);     // opaque at the swap, back to wet pigment within 15%
  const grow = smooth(t / 0.1);                 // the tide and the pale band develop over the first frames
  const dry = q * 0.2;                          // ink dries lighter as it recedes
  paint((k, u, v) => {
    let s;
    if (dir > 0) s = width - u;                  // dry from the right edge: the ink is pulled to the left
    else if (dir < 0) s = u;
    else { const dx = u - ox; const dy = v - oy; s = maxD - Math.sqrt(dx * dx + dy * dy); }
    const pools = Math.max(0, fA[k] - 0.66) * 1.1;    // a few pools stay wet a little longer
    const e = F - s - (fA[k] - 0.5) * 0.5 - (fB[k] - 0.5) * 0.09 + pools * 0.25 - pools;
    if (e >= fe) return 0;
    const z = (e + 0.02) * 48;
    const rim = z > -3 && z < 3 ? Math.exp(-z * z) : 0;
    dens = pigment(k, -0.02 - e, rim, grow) - dry - (e > 0 ? (e / fe) * 0.35 : 0);
    const edge = e <= 0 ? 1 : 1 - smooth(e / fe);
    return edge * (bodyA + (1 - bodyA) * rim * grow) * fade;
  });
}

/** The full cover: the same field at full opacity, identical on both pages of a navigation. */
function frameFull() {
  ensure();
  paint((k) => { dens = fD[k]; return 1; });
}

/** Keep the last covered frame for the next page's first paint (the boot script sets --ink-frame). */
function storeFrame() {
  try {
    sessionStorage.removeItem(FRAME_KEY);       // never leave an older frame behind if this one fails
    // ~25 KB: below q .9 WebP smooths the granulation away and the swap would show a texture change
    let url = canvas.toDataURL('image/webp', 0.95);
    if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', 0.92);
    sessionStorage.setItem(FRAME_KEY, url);
  } catch { /* storage full or blocked: the next page falls back to --wash-deep */ }
}

function run(duration, ease, draw) {
  cancelAnimationFrame(raf);
  current?.resolve({ cancelled: true });         // a newer phase takes over
  return new Promise((resolve) => {
    const t0 = performance.now();
    const me = { resolve };
    current = me;
    let frames = 0;
    let gap = 0;
    let last = t0;
    let interval = 1000 / 60;
    const step = (now) => {
      if (frames) interval = now - last;
      // finish on time: when less than half a frame is left, this frame is the last one
      const t = now - t0 + interval / 2 >= duration ? 1 : clamp01((now - t0) / duration);
      draw(ease(t), t);
      frames++;
      gap = Math.max(gap, now - last);
      last = now;
      if (t < 1) raf = requestAnimationFrame(step);
      else {
        if (current === me) current = null;
        log(`  ${frames} frames, longest gap ${Math.round(gap)} ms, last paint ${Math.round(performance.now() - now)} ms`);
        resolve({ cancelled: false });
      }
    };
    raf = requestAnimationFrame(step);
  });
}

function originFor(x, y) {
  const vw = innerWidth;
  const vh = canvas.clientHeight || innerHeight;
  const ox = (Number.isFinite(x) ? x : vw / 2) / vh;
  const oy = (Number.isFinite(y) ? y : vh / 2) / vh;
  const w = vw / vh;
  const maxD = Math.max(Math.hypot(ox, oy), Math.hypot(w - ox, oy), Math.hypot(ox, 1 - oy), Math.hypot(w - ox, 1 - oy));
  return { ox, oy, maxD };
}

let lastOrigin = { x: undefined, y: undefined };

/** Announce a phase: 'ink:cover' on the pressed control (bubbling) or the document; 'ink:reveal' on the document. */
function announce(type, target) {
  try { (target?.isConnected ? target : document).dispatchEvent(new CustomEvent(type, { bubbles: true })); } catch { /* no DOM */ }
}

/* ---------------------------------------------------------------- public API */

/**
 * Flood the screen with ink from (x, y) in CSS px (default: the centre). Resolves when fully covered.
 * source: the pressed element (a link), if any. It receives 'ink:cover', so a control with its own ink
 * (an .ink-btn or .ink-row) holds still under the flood instead of repainting its filtered ink every frame.
 */
export function cover({ x, y, duration, source } = {}) {
  if (reduced()) return Promise.resolve({ cancelled: false });
  ensure();
  lastOrigin = { x, y };
  phase = 'covering';
  log('cover start', Math.round(x ?? -1), Math.round(y ?? -1));
  announce('ink:cover', source);
  canvas.classList.add('is-blocking');
  const { ox, oy, maxD } = originFor(x, y);
  const easeCover = (t) => 1 - Math.pow(1 - t, 3);
  return run(duration ?? ms('--dur-wash-cover', 260), easeCover, (p, t) => frameCover(p, t, ox, oy, maxD))
    .then((r) => {
      if (r.cancelled) return r;
      frameFull();
      storeFrame();
      phase = 'covered';
      log('covered');
      return r;
    });
}

/** Recede the wash. dir 1: pulled to the left (moving forward along the scroll), -1: to the right, 0: back to its origin. */
export function reveal({ dir = 0, duration } = {}) {
  ensure();
  announce('ink:reveal');
  const html = root();
  html.classList.remove('is-covered');
  html.style.removeProperty('--ink-frame');
  if (reduced()) {
    current?.resolve({ cancelled: true });
    cancelAnimationFrame(raf);
    ctx.clearRect(0, 0, cols, rows); phase = 'clear'; canvas.classList.remove('is-blocking');
    return Promise.resolve({ cancelled: false });
  }
  phase = 'revealing';
  log('reveal start, dir', dir);
  const { ox, oy, maxD } = originFor(lastOrigin.x, lastOrigin.y);
  const easeReveal = (t) => 1 - Math.pow(1 - t, 3);   // a fast attack: the edge is moving from the first frame
  canvas.classList.remove('is-blocking');
  return run(duration ?? ms('--dur-wash-reveal', 420), easeReveal, (q, t) => frameReveal(q, t, Math.sign(dir), ox, oy, maxD))
    .then((r) => {
      if (r.cancelled) return r;
      ctx.clearRect(0, 0, cols, rows);
      phase = 'clear';
      log('clear');
      return r;
    });
}

/**
 * Read and clear the record left by the previous page.
 * Returns { from, distance, presence, x, y, dir, covered } or null. `from` is where the previous page's
 * landscape actually stood when it was left (a page may pan along its own stretch, e.g. About's
 * handscroll); `distance` and `presence` are its composition, so the next mount can start from exactly
 * what was on screen (mountLandscape's fromStretch / fromDistance / fromPresence).
 */
export function consumeArrival(stretch = Number(document.body?.dataset.stretch) || 0) {
  let rec = null;
  try {
    rec = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    sessionStorage.removeItem(KEY);
  } catch { /* storage blocked: arrive without a wash */ }
  if (!rec || Date.now() - rec.t > FRESH_MS || reduced()) return null;
  const from = Number.isFinite(rec.from) ? rec.from : stretch;
  return {
    from,
    distance: typeof rec.distance === 'string' ? rec.distance : undefined,
    presence: Number.isFinite(rec.presence) ? rec.presence : undefined,
    x: rec.x,
    y: rec.y,
    dir: Math.sign(stretch - from),
    covered: !!rec.covered,
  };
}

/** covered: true when this page has already flooded itself (the next page then arrives covered). */
function record(where, x, y, covered = false) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ ...where, x, y, covered, t: Date.now() })); } catch { /* ignore */ }
}

/** A file (an SVG, a PDF, JSON…), not a page: its path ends in an extension other than .html. */
function isFile(url) {
  const last = url.pathname.slice(url.pathname.lastIndexOf('/') + 1);
  return /\.[a-z0-9]+$/i.test(last) && !/\.html?$/i.test(last);
}

/** Only real page links get the wash: same origin, same tab, no download/type, and a path without a file extension. */
function linkFrom(e) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
  if (!a || a.hasAttribute('download') || a.hasAttribute('type') || a.dataset.noWash !== undefined) return null;
  if (a.target && a.target !== '_self') return null;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return null;
  if (url.pathname === location.pathname && url.search === location.search) return null; // same page / #hash
  if (isFile(url)) return null;                                                             // files, not pages
  return { a, url };
}

/**
 * Wire the site's navigations to the wash. Call once per page (a second call is a no-op until destroy()).
 * @param {{ stretch?: number, distance?: string, presence?: number,
 *           arrival?: ReturnType<typeof consumeArrival>,
 *           getLandscape?: () => (null | { panTo(s: number, o?: { duration?: number }): Promise<void>, stats?(): { stretch?: number } }),
 *           onReveal?: () => void }} o
 */
export function initInkTransition({ stretch = 0, distance, presence, arrival = null, getLandscape = () => null, onReveal = () => {} } = {}) {
  if (bound) return () => {};
  bound = true;
  const html = root();
  getCanvas();
  const offs = [];
  const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); offs.push(() => target.removeEventListener(type, fn, opts)); };
  let leaving = 0;
  let alive = true;
  // where the landscape stands right now (a page may have panned it along its own stretch)
  const here = () => {
    let live = NaN;
    try { live = Number(getLandscape()?.stats?.().stretch); } catch { /* no landscape */ }
    return { from: Number.isFinite(live) ? live : stretch, distance, presence };
  };

  // the landscape rests while this page floods on its way out (it is hidden anyway, and every frame
  // goes to the wash); it wakes as soon as the page is uncovered again
  const rest = () => { try { getLandscape()?.pause?.(); } catch { /* no landscape */ } };
  const wake = () => { try { getLandscape()?.resume?.(); } catch { /* no landscape */ } };
  const startReveal = (dir) => {
    if (!alive) return Promise.resolve({ cancelled: true });
    wake();
    onReveal();
    return reveal({ dir });
  };
  const endVT = (vt) => {
    if (!vt) return;
    vt.ready.catch(() => {});        // skipping before 'ready' rejects it; that is expected here
    vt.finished.catch(() => {});
    try { vt.skipTransition(); } catch { /* already done */ }
  };

  /* ---- arriving on this page */
  const arriveWith = (vt, rec) => {
    if (DEBUG) {
      let typed = null;
      try { typed = html.matches(':active-view-transition-type(ink)'); } catch { /* unsupported */ }
      log('arrive', JSON.stringify({ vt: !!vt, types: vt ? [...(vt.types || [])] : null, typed, rec, phase, covered: html.classList.contains('is-covered') }));
    }
    if (!rec) { html.classList.remove('is-covered'); onReveal(); return; }
    if (phase === 'covered') {
      // restored from the bfcache still covered (this page was left by a click): just recede
      endVT(vt);
      lastOrigin = { x: rec.x, y: rec.y };
      startReveal(rec.dir);
    } else if (vt && !rec.covered) {
      // the old page is held by CSS; flood over it on our live canvas, then end the view transition
      html.classList.remove('is-covered');
      vt.ready
        .then(() => (alive ? cover({ x: rec.x, y: rec.y }) : { cancelled: true }))
        .then((r) => { if (r.cancelled) return; vt.skipTransition(); return startReveal(rec.dir); })
        .catch(() => { ctx?.clearRect(0, 0, cols, rows); phase = 'clear'; canvas?.classList.remove('is-blocking'); onReveal(); });
    } else {
      // the page painted covered (.is-covered, with the stored frame); take over with the identical
      // frame, then recede. Two covered frames: end any view transition now so its old snapshot never
      // sits on top.
      endVT(vt);
      lastOrigin = { x: rec.x, y: rec.y };
      frameFull();
      phase = 'covered';
      afterFirstFrames(() => startReveal(rec.dir));
    }
  };

  // The arriving page's heaviest frames are its first: the landscape mounts and draws its first
  // scene. Let them land under the cover (two frames once the landscape exists, at most ~400 ms),
  // so the recession that follows runs on settled frames instead of stalling halfway.
  const afterFirstFrames = (fn) => {
    const t0 = performance.now();
    let ready = 0;
    const tick = () => {
      if (!alive) return;
      if ((getLandscape() || performance.now() - t0 > 400) && ++ready >= 2) { fn(); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  if (reduced()) {
    html.classList.remove('is-covered');
    onReveal();
  } else if ('onpagereveal' in window && !window.__inkRevealed) {
    on(window, 'pagereveal', (e) => arriveWith(e.viewTransition, arrival), { once: true });
  } else {
    arriveWith(window.__inkVT || null, arrival);
  }

  // Back/forward into a page kept in the bfcache (pageshow fires first, then pagereveal where it exists).
  let restoring = false;
  on(window, 'pageshow', (e) => {
    clearTimeout(leaving);
    if (!e.persisted) return;
    if ('onpagereveal' in window) { restoring = true; return; }
    if (phase !== 'clear') { wake(); reveal({ dir: 0 }); }     // e.g. Firefox: we left this page covered
  });
  on(window, 'pagereveal', (e) => {
    if (!restoring) return;
    restoring = false;
    wake();
    const rec = consumeArrival(stretch);
    if (!rec) {
      if (phase !== 'clear') { endVT(e.viewTransition); reveal({ dir: 0 }); }   // left covered: recede at once
      return;
    }
    if (phase !== 'covered' && !reduced()) {
      try { e.viewTransition?.types?.add('ink'); } catch { /* types unsupported: a plain cross-fade */ }
    }
    const land = getLandscape();
    land?.panTo?.(rec.from, { duration: 0, distance: rec.distance, presence: rec.presence });
    land?.panTo?.(stretch, { distance, presence });
    arriveWith(e.viewTransition, rec);
  });

  /* ---- leaving this page */
  if (!reduced()) {
    on(document, 'click', (e) => {
      const hit = linkFrom(e);
      if (!hit) return;
      e.preventDefault();
      if (phase === 'covering' || phase === 'covered') return;   // already on our way out
      const keyboard = e.detail === 0;
      const r = hit.a.getBoundingClientRect();
      const x = keyboard ? r.left + r.width / 2 : e.clientX;
      const y = keyboard ? r.top + r.height / 2 : e.clientY;
      const where = here();
      rest();
      cover({ x, y, source: hit.a }).then((res) => {
        if (!alive) return;
        if (res.cancelled) { wake(); return; }
        record(where, x, y, true);
        location.assign(hit.url.href);
        leaving = setTimeout(() => { wake(); reveal({ dir: 0 }); }, 6000);   // navigation did not happen: uncover
      });
    });

    // back/forward (no click) in browsers with view transitions: record the centre; the next page floods
    on(window, 'pageswap', (e) => {
      if (!e.viewTransition) return;
      let rec = null;
      try { rec = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { /* ignore */ }
      if (!rec || Date.now() - rec.t > 1500) record(here(), innerWidth / 2, innerHeight / 2);
    });
  }

  // Every navigation (reduced motion too): a file (an SVG, a PDF) cannot take part in a view transition.
  // Skip it here on the old page, so the browser never hands the file a transition it must then abort
  // (an uncaught rejection in the file's own context). Skipped or aborted transitions are expected.
  on(window, 'pageswap', (e) => {
    const vt = e.viewTransition;
    if (!vt) return;
    const no = () => {};
    vt.ready.catch(no);
    vt.finished.catch(no);
    vt.updateCallbackDone?.catch(no);
    let to = null;
    try { to = new URL(e.activation?.entry?.url || ''); } catch { /* unknown destination */ }
    if (to && isFile(to)) { try { vt.skipTransition(); } catch { /* already done */ } }
  });

  // compute the noise fields ahead of the first click, off the critical path (not needed without motion)
  let idle = 0;
  let idleTimer = 0;
  if (!reduced()) {
    const warm = () => { idle = idleTimer = 0; if (alive && !fA) ensure(); };
    if ('requestIdleCallback' in window) idle = requestIdleCallback(warm, { timeout: 3000 }); else idleTimer = setTimeout(warm, 1200);
  }

  return () => {
    alive = false;
    bound = false;
    offs.forEach((off) => off());
    clearTimeout(leaving);
    clearTimeout(idleTimer);
    if (idle && 'cancelIdleCallback' in window) cancelIdleCallback(idle);
    cancelAnimationFrame(raf);
    const running = current;
    current = null;
    running?.resolve({ cancelled: true });
    if (ctx) ctx.clearRect(0, 0, cols, rows);
    canvas?.classList.remove('is-blocking');
    html.classList.remove('is-covered');
    html.style.removeProperty('--ink-frame');
    phase = 'clear';
    announce('ink:reveal');
  };
}
