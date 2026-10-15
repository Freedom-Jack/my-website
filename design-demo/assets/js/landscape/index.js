// landscape/index.js — public API of the generative ink-landscape background.
// Everything else in the site talks to the landscape ONLY through mountLandscape() and the handle
// it returns (plus the DOM-free exports stripSVG(), sceneAt(), framingAt(), PALETTES and PIGMENTS). Internals:
// compose.js (where the mountains and the water stand, how each window frames them), ridges.js (profiles),
// palette.js (pigments), figures.js + figures.worker.js (the figure layers), gl.js + shaders.js (WebGL2 painter),
// canvas2d.js (fallback), strip.js (the footer's story map).
//
// Round 4a (SPEC-R4A §7, §12): one fixed canvas paints into *windows*, boxes on the page: the page's strip
// ([data-landscape="strip"]) and its closing ([data-landscape="closing"]). Each window is its own painting of the
// one handscroll at its own framing (framingAt), rendered once into its own buffer and presented at the box's live
// position, so it moves 1:1 with the page and never re-renders while you scroll. Between them, on desktops, the
// low ink horizon of round 3 fades in (hzK); outside them the canvas is paper. The mist drifts and parts around a
// fine pointer only inside the windows. Figure layers (Home's traveller and hut, Work's river market) are drawn
// once per (stretch, width class, palette) off the main thread and painted *into* the scene, under the same mist.
//
// Frame loop: nothing spins. A frame is requested only when something is dirty (resize, pan, scroll, veil,
// arrival, a figure's fade, a sweep), the pointer's wake is open (<= 30 fps) or the ambient mist is due (<= 15 fps)
// while a window is on screen. After ~45 s with no input the drift eases to a stop and the loop sleeps. With no
// window on screen and no horizon (a phone reading on paper) the engine requests no frames at all. Frames in motion
// (pans, the bloom) are governed: when they run slow they are painted as drafts at a lower internal scale, and one
// full-quality scene follows ~150 ms after they stop.

import { createGL } from './gl.js';
import { createCanvas2D } from './canvas2d.js';
import { buildRidges, layerFeet, crestMax, LAYERS } from './ridges.js';
import { spec, blendSpec, resolve, framing, cameraLeft, sceneName, framingBlend, widthClass, HS, SCENES, STRETCH_COUNT, featherOf } from './compose.js';
import { VEILS, TRAIL } from './shaders.js';
import { paletteName } from './palette.js';
import { figureMeta, createFigureSource } from './figures.js';

export { stripSVG } from './strip.js';
export { PALETTES, PIGMENTS } from './palette.js';
export { framingAt } from './compose.js';

/** The scene painted at a stretch (DOM-free): 'peak' | 'river' | 'path' | 'lake' | 'shore' | 'crossing' | 'lone-peak'. */
export function sceneAt(stretch) { return sceneName(stretch); }

const S_SCENE = 2, S_PRESENT = 4, S_MEASURE = 8, S_SCROLL = 16, S_ALL = 31;   // dirty flags
const ARRIVE_END = 1.7;   // s, the bloom is over (matches the shader's "settled")
const LONG_CAP = 1920;    // internal buffer: long side cap
const AMBIENT_MS = 70;    // drifting mist: < 15 fps on every GPU
const POINTER_MS = 33;    // the wake: <= 30 fps
const IDLE_MS = 45000;    // no pointer / scroll / key / visibility input for this long: the drift...
const EASE_OUT_MS = 2000; // ...eases to a stop over ~2 s (the loop then sleeps)
const EASE_IN_MS = 800;   // and eases back in on the next input
const FULL_MS = 150;      // motion stopped: one full-quality scene follows the draft frames
const GPU_WAIT_MAX = 400; // a frame waits at most this long for the GPU to finish the previous one
const GOV_N = 12;         // governor window: heavy frames sampled...
const SLOW_MS = 45;       // ...and their mean interval that counts as slow
const RESERVE = 0.9;      // a veil this strong is a paper reserve for small print (see measureVeil)...
const RESERVE_FEATHER = 0.5;  // ...with half the feather...
const RESERVE_IN = 24;    // ...reaching its strength once this many CSS px of its lines are on screen
// The horizon (round 3's 'horizon' state, now a band of its own): every plane is flattened (HZ_SQUASH) and sinks
// until its highest crest stands at HZ_TOP (viewport heights from the bottom), never less than the plane behind it,
// its peaks rising from a low mist HZ_BAND below that line, its ink times HZ_INK (and the presence ratio).
const HZ_TOP = [0.25, 0.23, 0.205, 0.1, 0.05];
const HZ_INK = [1, 0.97, 0.9, 0.6, 0.4];
const HZ_BAND = 0.17;
const HZ_SQUASH = 0.55;
const HZ_STEP = 0.12;     // hzK eases at most this much per frame (a fast scroll never pops the band in)
const HZ_MEDIA = '(min-width: 64rem) and (min-aspect-ratio: 1/1)';
// The wake (SPEC-R3 §8.5, made local in 4a): its radius is a share of the viewport's height in CSS px, clamped
// (WAKE_VH, WAKE_PX: ~115 px at 900 tall, half strength ~95 px from the path), so it opens the mist around the
// pointer inside a strip instead of reaching across the whole band (round 3's 0.29 vh filled a 520 px strip);
// position lag, strength attack and release (time constants, ms: ~120 ms and ~700 ms to settle), trail points'
// closing time constant.
const WAKE_VH = 0.128;
const WAKE_PX = [84, 136];
const WAKE_LAG = 50;
const WAKE_ATTACK = 40;
const WAKE_RELEASE = 233;
const TRAIL_TAU = 230;
const TRAIL_AGE = 1000;
// Pans of more than 2 stretches travel CUT_SPAN stretches on screen; the rest is spliced out at CUT_AT
// of the duration, while the (thickened) mist sweep covers the whole view. Five scenes never whip past.
const CUT_SPAN = 1.6;
const CUT_AT = 0.33;
const SWEEP_W = 0.34;     // the sweep bank's half-width, viewport heights
// Figure layers: the old layer fades out over the first 30% of a pan, the new one in over the last 40%; a layer
// that becomes ready later fades in over FIG_IN ms (FIG_IN_RM under reduced motion and still). Never a pop.
const FIG_IN = 300;
const FIG_IN_RM = 150;
const FIG_KEEP = 6;       // figure layers cached (per stretch x width class x palette)
// Window feathers, CSS px (painted by the engine): top out of paper, bottom into paper; a document's strip half.
// (compose.js owns them: the band framings keep summits and ground clear of them.)
// The deferred first frame under the old page wash (retired in round 3; kept so an old boot script
// that still covers the page cannot catch the first GPU frame mid-reveal).
const REVEAL_EVENT = 'ink:reveal';
const FLOOD_TYPE = ':active-view-transition-type(ink)';
const COVERED = 'is-covered';
const DEFER_MAX = 1500;
const FORCED = new Set(['hero', 'horizon', 'closing']);

const live = new WeakMap(); // canvas -> controller: one live landscape per canvas

/**
 * Mount the landscape on a fixed, full-viewport <canvas>.
 * Safe to call again on the same canvas (the previous mount is destroyed first), so it survives
 * React Strict Mode's mount → unmount → mount.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object}  [opts]
 * @param {number}  [opts.stretch=0]       Position along the one continuous handscroll. Each page has its own
 *                                         stretch (home 0, work 1, the road 2, writing 3, résumé 4, contact 5, 404 6).
 *                                         Each stretch is a scene (sceneAt): peak, river, path, lake, shore,
 *                                         crossing, lone-peak. Seams pass through mist or water.
 * @param {'level'|'high'|'deep'} [opts.distance='level']  Composition preset ("three distances").
 * @param {number}  [opts.presence=1]      0..1. How strongly the landscape shows.
 * @param {Element|null} [opts.strip]      [data-landscape="strip"]: window 1, the page's own scene at its strip framing,
 *                                         palette and figures, the drifting mist and the cursor's wake. Alias: `head`.
 * @param {Element|null} [opts.closing]    [data-landscape="closing"]: window 2, the scene framed on the road toward the
 *                                         next place. Alias: `descend`. With neither window, the first viewport acts
 *                                         as one full-screen window (round 3's hero; the lab).
 * @param {Iterable<Element>} [opts.keepout] [data-landscape="keepout"] text blocks: where one overlaps a window, no
 *                                         pigment lies under it, the mist ramps from opaque 140 px left of its right
 *                                         edge to clear 140 px right of it, nothing figurative comes within 40 px,
 *                                         the scene's focus stands >= 180 px right of it and the wake keeps off it.
 * @param {'ink'|'misted'|'rich'} [opts.palette='misted']  Pigment strength (PALETTES). 'ink' is round 3's painting.
 * @param {boolean} [opts.figures=true]    false hides the figure layers (lab, QA).
 * @param {string}  [opts.horizonMedia]    When the horizon band may show (default '(min-width: 64rem) and
 *                                         (min-aspect-ratio: 1/1)': desktops and landscape tablets).
 * @param {number}  [opts.horizon=0.6]     The horizon band's presence (body data-horizon).
 * @param {Element|Iterable<Element>} [opts.veil]  Text blocks that mist should thicken behind (the 8 largest
 *                                         visible at a time). An element's own `data-veil` value, when it is a
 *                                         number 0..1 (e.g. data-veil="0.95"), is its veil strength instead of
 *                                         `veilStrength`; an empty value keeps the default. A veil of 0.9 or more
 *                                         is a paper reserve for small print: solid paper behind the element's own
 *                                         text lines (the union of their boxes), with half the feather.
 * @param {Iterable<Element>} [opts.wake]  [data-wake] regions: the pointer's wake is allowed only while the pointer
 *                                         is inside one (and inside a window), times (1 - keep-out) and (1 - veil).
 * @param {'bloom'|'none'} [opts.arrival='bloom']  'bloom' paints the strip in on load (the wet front, ~1.2 s).
 * @param {number}  [opts.fromStretch]     If set, start at this stretch and pan to `stretch`.
 * @param {'level'|'high'|'deep'} [opts.fromDistance]  Distance to start from when `fromStretch` is set.
 * @param {number}  [opts.fromPresence]    Presence to start from when `fromStretch` is set.
 * @param {number}  [opts.panDuration=900] Duration of the mount pan from `fromStretch`, ms.
 * @param {number}  [opts.arrivalMs=1250]  Length of the ink bloom, ms (the lab slows it down to study it).
 * @param {number}  [opts.veilStrength=0.72] 0..1, how much paper-coloured mist gathers behind veiled text.
 * @param {number}  [opts.grain=1]         Paper grain strength multiplier (0 = none).
 * @param {number}  [opts.tide=1]          Strength of the faint dried-wash edges ("tide lines") at rest, 0..1.
 * @param {boolean} [opts.ambient=true]    Drifting mist. false = the landscape only redraws on change.
 * @param {boolean} [opts.pointer=true]    Allow the pointer's wake (fine pointers, inside `wake` regions).
 * @param {'auto'|number} [opts.quality='auto']  Internal resolution multiplier (QA/lab; 'auto' adapts).
 * @param {boolean} [opts.reducedMotion]   Override prefers-reduced-motion (lab only).
 * @param {boolean} [opts.still=false]     Start stilled (see setStill).
 * @param {'wide'|'tablet'|'phone'|'short'} [opts.widthClass]  Lab / QA only: frame as this width class whatever the
 *                                         viewport (the strips lab renders every class on one screen).
 *   `vistas` (round 3) and `banks` (round 2) are ignored.
 *
 * @returns {{ mode: 'webgl'|'canvas2d'|'static',
 *            panTo(stretch:number, o?:{duration?:number, distance?:string, presence?:number, ease?:'whip'|'cubic-out', cloud?:boolean}):Promise<void>,
 *            sweep(o?:{dir?:1|-1, duration?:number}):Promise<void>,
 *            setPalette(p:'ink'|'misted'|'rich'):void,
 *            prepare(stretch:number):Promise<void>,
 *            rebind(o:{strip?, closing?, keepout?, veil?, wake?, horizon?}):void,
 *            setVeil(els):void, setStill(on:boolean):void,
 *            setState(s:'hero'|'horizon'|'closing'|null):void,
 *            refresh():void, pause():void, resume():void, destroy():void, stats():object }}
 *   `panTo`: ease 'whip' (default) or 'cubic-out'. The camera moves along world x; every window's framing moves
 *     from the old page's to the new page's with it (the pan plays in whatever window is on screen). A pan of more
 *     than 2 stretches travels 1.6 on screen and splices out the middle under a thick mist; `cloud: false`
 *     (back/forward) travels the whole way. Reduced motion and still: it cuts. The old figure layer fades out over
 *     the first 30% of the pan, the new one in over the last 40% (or within 300 ms of becoming ready).
 *   `sweep`: a pale mist bank (never darker than #D5DCD9) that travels with the scenery across the view.
 *     WebGL only; none under reduced motion, still, or Canvas2D (resolves at once).
 *   `setPalette`: one governed redraw per window; figure layers redrawn for it (cached per palette). Dispatches a
 *     bubbling 'landscape:palette' event on the canvas ({ detail: { palette } }).
 *   `prepare`: draws that stretch's figure layer (current width class and palette) off the main thread; resolves
 *     when it is ready, at once if it has none or it is cached. Idempotent. The router calls it on prefetch.
 *   `rebind`: after a route swap (aliases head/descend; vistas ignored). Re-reads the boxes and framings and
 *     recomputes hzK before the first present (a page entered mid-scroll shows the right state at once).
 *   `setState`: QA override: 'hero' forces hzK 0, 'horizon' 1, 'closing' puts the closing framing in the strip;
 *     null (or 'vista') = scroll-driven.
 *   `setStill(true)`: drift, wake, sweeps, the bloom and pans stop (pans snap). `pause()` is a hard freeze.
 *   `mode` is live: it changes to 'canvas2d' if the WebGL context is lost for good (a bubbling `landscape:mode`
 *     event on the canvas).
 *   `stats()` (QA): counters (frames, scenes, presents, drafts), `palette`, `widthClass`, `windows` ({ strip,
 *     closing }: top, height, visible), `hzK`, `figures` ({ [stretch]: 'none'|'pending'|'ready' }), `figureMs`,
 *     `framing` ({ strip, closing }: worldLeft, worldTop, scale, focus), `stretch`, `scene`, `state`, `wake`, `still`,
 *     `sweeping`, `ambient`, `drift`, `draft`, `pending`, `running`.
 */
export function mountLandscape(canvas, opts = {}) {
  const prev = canvas && live.get(canvas);
  if (prev) prev.destroy();
  if (!canvas || typeof canvas.getContext !== 'function') return inert();
  const handle = controller(canvas, opts);
  live.set(canvas, handle);
  return handle;
}

function inert() {
  return {
    mode: 'static',
    panTo: () => Promise.resolve(),
    sweep: () => Promise.resolve(),
    setPalette() {},
    prepare: () => Promise.resolve(),
    rebind() {},
    setVeil() {},
    setStill() {},
    setState() {},
    refresh() {},
    pause() {},
    resume() {},
    destroy() {},
    stats: () => ({ mode: 'static', state: null, hzK: 0, scene: '', wake: 0, still: false, figures: {}, windows: {} }),
  };
}

const num = (v, d) => (Number.isFinite(+v) && v !== null && v !== '' ? +v : d);
const toList = (els) => (!els ? [] : els instanceof Element ? [els] : [...els].filter((e) => e instanceof Element));
const elOr = (a, b) => (a instanceof Element ? a : b instanceof Element ? b : null);
const easeWhip = (t) => (t >= 1 ? 1 : (1 - Math.pow(2, -9 * t)) / (1 - Math.pow(2, -9))); // fast attack, long decay
const easeCubic = (t) => (t >= 1 ? 1 : 1 - Math.pow(1 - t, 3));
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const r3 = (v) => Math.round(v * 1000) / 1000;

function controller(canvas, opts) {
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const mqFine = matchMedia('(pointer: fine)');
  const mqHz = matchMedia(typeof opts.horizonMedia === 'string' && opts.horizonMedia ? opts.horizonMedia : HZ_MEDIA);
  let reduced = typeof opts.reducedMotion === 'boolean' ? opts.reducedMotion : mqReduce.matches;
  let still = !!opts.still;
  const quantized = () => reduced || still;

  // ---------------------------------------------------------------- renderer + fallbacks
  let surface = canvas;      // the element we draw on (a sibling clone if WebGL died on `canvas`)
  let renderer = null;
  let mode = 'static';
  let lostTimer = 0, readyTimer = 0;
  let hiddenDisplay = null;
  const hooks = {
    lost() { stop(); clearTimeout(lostTimer); lostTimer = setTimeout(() => toCanvas2D(), 3000); },
    restored() { clearTimeout(lostTimer); W = H = 0; dropLayers(); resize(true); request(S_ALL); },
    failed() { clearTimeout(lostTimer); toCanvas2D(); },
  };
  try {
    renderer = createGL(canvas, hooks);
  } catch (err) {
    renderer = null;
    if (err && err.tainted) cloneSurface();
  }
  if (renderer) mode = 'webgl';
  else {
    renderer = createCanvas2D(surface);
    mode = renderer ? 'canvas2d' : 'static';
  }

  function cloneSurface() {
    // A canvas that ever held a WebGL context cannot give a 2D one: paint on a sibling copy.
    // (Insert next to it instead of replacing it, so a framework that owns `canvas` is undisturbed.)
    const fresh = canvas.cloneNode(false);
    fresh.removeAttribute('id');
    canvas.after(fresh);
    hiddenDisplay = canvas.style.display;
    canvas.style.display = 'none';
    surface = fresh;
  }
  function toCanvas2D() {
    if (destroyed || mode === 'canvas2d') return;
    stop();
    try { renderer?.destroy(); } catch { /* ignore */ }
    observeSurface(false);
    cloneSurface();
    renderer = createCanvas2D(surface);
    mode = renderer ? 'canvas2d' : 'static';
    observeSurface(true);
    endSweep();
    resetWake();
    dropLayers();
    W = H = 0;
    resize(true);
    request(S_ALL);
    surface.dispatchEvent(new CustomEvent('landscape:mode', { bubbles: true, detail: { mode } }));
  }

  // ---------------------------------------------------------------- state
  const software = !!renderer?.software;
  const fixedQ = opts.quality !== undefined && opts.quality !== 'auto' ? Math.min(1.5, Math.max(0.3, num(opts.quality, 1))) : 0;
  let quality = fixedQ || (software ? 0.6 : 1);
  // frames in motion (pans, the bloom) are painted at this internal scale; the governor lowers it
  let draftScale = fixedQ ? 1 : software ? 0.5 : 1;
  const grainK = Math.max(0, num(opts.grain, 1)) * 0.4;
  const tide = Math.min(1, Math.max(0, num(opts.tide, 1)));
  const veilK = Math.min(1, Math.max(0, num(opts.veilStrength, 0.72)));
  const ambientWanted = opts.ambient !== false;
  let palette = paletteName(opts.palette);
  const figuresOn = opts.figures !== false;

  const target0 = num(opts.stretch, 0);
  const hasFrom = !quantized() && Number.isFinite(+opts.fromStretch) && opts.fromStretch !== null;
  let stretch = hasFrom ? +opts.fromStretch : target0;
  let curSpec = hasFrom
    ? spec(opts.fromDistance ?? opts.distance, opts.fromPresence ?? opts.presence)
    : spec(opts.distance, opts.presence);
  let tween = null;          // {from, to, fromSpec, toSpec, t, dur, ease, cut, resolve}

  let arriving = !quantized() && opts.arrival !== 'none';
  let arrive = arriving ? 0 : 9;      // shader seconds: the bloom is authored as 1.25 s
  let arriveSeen = false;             // has any of the bloom been painted while the page was visible?
  const arriveRate = 1250 / Math.min(20000, Math.max(300, num(opts.arrivalMs, 1250)));

  let cssW = 0, cssH = 0, W = 0, H = 0, aspect = 1.6, bufS = 1;
  let rect = { left: 0, top: 0, width: 1, height: 1 };
  const clsForced = ['wide', 'tablet', 'phone', 'short'].includes(opts.widthClass) ? opts.widthClass : null;   // lab / QA only
  const classNow = () => clsForced || widthClass(innerWidth, innerHeight);
  let cls = classNow();
  let time = 40;             // ambient clock, seconds (never jumps after a pause)
  let driftT = 1;            // 0..1: the drift eases out after IDLE_MS without input, and back in
  let lastInput = performance.now();
  const veil = new Float32Array(VEILS * 4).fill(-1);
  const veilS = new Float32Array(VEILS);
  const veilF = new Float32Array(VEILS).fill(1);   // each veil's feather, x the shared one (a reserve's is tighter)
  let veilEls = toList(opts.veil);
  // a reserve's text box, as offsets inside its element's box: re-read when the box or the fonts change
  const textBoxes = new WeakMap();
  let fontGen = 0;
  const onFonts = () => { fontGen++; request(S_MEASURE | S_SCROLL); };

  // ---------------------------------------------------------------- windows and views
  // A window: a box on the page, painted at its own framing. A view: its painting (and the horizon's).
  const mkWin = (kind, el) => ({
    kind, id: kind, el, box: null, vis: false, near: !!el, keepR: null, keepU: null, viewU: null, wakeOK: false, doc: false, note: null, noteEl: null,
    fr: null, key: '', buf: null, samples: 0, draft: false, pending: false, painted: false, want: false,
  });
  const wins = [mkWin('strip', elOr(opts.strip, opts.head)), mkWin('closing', elOr(opts.closing, opts.descend))];
  const hzv = { id: 'horizon', key: '', buf: null, samples: 0, draft: false, painted: false, pending: false, want: false, view: new Float32Array(4) };
  let keepEls = toList(opts.keepout);
  let wakeEls = toList(opts.wake);
  let horizonP = clamp01(num(opts.horizon, 0.6));
  let hzOn = mqHz.matches;
  let hzK = 0, hzTarget = 0;
  let forced = null;
  let fullMode = !wins[0].el && !wins[1].el;   // no windows: the first viewport is one (round 3's hero; the lab)
  // the horizon's per-plane sinks and its uniform (sink, foot, ink, squash) x LAYERS
  const crest = new Float32Array(LAYERS);
  const hzU = new Float32Array(LAYERS * 4);
  const hzZero = new Float32Array(LAYERS * 4);

  // the wake (viewport CSS px), its trail, and the uniforms
  const wake = { x: 0, y: 0, tx: 0, ty: 0, s: 0, target: 0, has: false, inWin: false, dirty: false, pushedAt: 0, moving: false };
  const trail = [];          // [{ x, y, s0, t }], newest first
  const trailU = new Float32Array(TRAIL * 4);
  const wakeBox = new Float32Array([2, 2, -1, -1]);
  let wakeRects = null;
  // the sweep
  let sw = null;             // { t, dur, dir, seed, resolve }
  let sweepN = 0;
  const sweepU = new Float32Array(4);
  let sweepSeed = 0;

  let raf = 0, timer = 0, timerAt = 0, need = 0, clockLast = 0, lastPresent = 0;
  let userPaused = false, hidden = document.visibilityState === 'hidden', onscreen = true, destroyed = false;
  let anyVisible = false, wasVisible = true;   // a window on screen now / at the last present
  // hidden under the old page wash: the first frame waits for the full cover (see DEFER_MAX)
  const heldByWash = () => {
    const h = document.documentElement;
    if (h.classList.contains(COVERED)) return true;
    try { return h.matches(FLOOD_TYPE); } catch { return false; }
  };
  let deferred = mode === 'webgl' && !reduced && heldByWash();
  let deferTimer = 0, deferRaf = 0;
  let drawnOnce = false;
  let lastScroll = 0;        // performance.now() of the last scroll event
  let gov = [], heavyLast = 0;
  let idleId = 0;
  let lastSlots = [];
  const counts = {
    frames: 0, scenes: 0, presents: 0, drafts: 0, ridges: 0,
    ridgeMs: 0, sceneMs: 0, presentMs: 0,             // CPU time of the last call
    draftAt: 0, fullAt: 0,                            // performance.now() of the last draft / full-quality scene
    figureMs: 0,                                      // the last figure layer's drawing time (worker or idle chunks)
  };

  // ---------------------------------------------------------------- figure layers
  // One layer per (stretch, scale, palette, resolution): drawn off the main thread (figures.worker.js), uploaded
  // once (never while scrolling), cached. It is shown with an alpha (fades; see figSlots).
  const layers = new Map();  // key -> { key, stretch, meta, status, img, readyAt, uploaded, waiters, used, shownSince }
  let figSrc = null;
  let drawnFigs = false;     // the first full scene is up (a layer ready before it follows the bloom instead of fading)
  const figSource = () => (figSrc ??= createFigureSource());
  const layerScale = (k) => {
    if (cls === 'wide') return Math.round(Math.min(cssW || innerWidth, 1700) / 40) * 40;
    const T = SCENES[Math.min(STRETCH_COUNT - 1, Math.max(0, k))].frame;
    return ((cls === 'short' ? T.short || T.phone : T[cls]) || T.tablet).scale;
  };
  const layerDpr = () => Math.min(2, Math.max(1, Math.round(bufS * 1.34 * 4) / 4));
  const layerKey = (k) => `${k}|${layerScale(k)}|${palette}|${layerDpr()}|${mode}`;
  const ready = (L) => !!L && L.status === 'ready' && L.uploaded;
  function layerFor(k, create = true) {
    k = Math.round(k);
    if (!figuresOn || mode === 'static' || !renderer || k < 0 || k >= STRETCH_COUNT) return null;
    const meta = figureMeta(k);
    if (!meta) return null;
    const key = layerKey(k);
    let L = layers.get(key);
    if (L || !create) { if (L) L.used = performance.now(); return L || null; }
    L = { key, stretch: k, meta, status: 'pending', img: null, readyAt: 0, uploaded: false, waiters: [], used: performance.now(), shownSince: 0 };
    layers.set(key, L);
    const [distance, presence] = SCENES[k].page;
    figSource().request({
      stretch: k, scale: layerScale(k), dpr: layerDpr(), palette, distance, presence,
      out: mode === 'webgl' ? 'bytes' : 'bitmap',
    }).then((res) => {
      if (destroyed || layers.get(key) !== L) return;
      L.img = res;
      counts.figureMs = Math.round(res.ms * 10) / 10;
      uploadSoon(L);
    }, (err) => {
      if (layers.get(key) !== L) return;
      console.warn('landscape: figure layer failed', err);
      L.status = 'failed';
      L.waiters.splice(0).forEach((f) => f());
    });
    trimLayers();
    return L;
  }
  // a stand-in while a layer is drawn: the same stretch's layer at another palette or width (never a gap)
  function standIn(k) {
    let best = null;
    for (const L of layers.values()) if (L.stretch === k && ready(L) && (!best || L.readyAt > best.readyAt)) best = L;
    return best;
  }
  // upload a finished layer, but never while the page is scrolling (it waits for a quiet moment)
  function uploadSoon(L) {
    if (destroyed || !L.img || L.uploaded) return;
    const since = performance.now() - lastScroll;
    if (since < 120) { setTimeout(() => uploadSoon(L), 140 - since); return; }
    if (!renderer || !renderer.figure(L.key, L.img)) { L.status = 'failed'; L.waiters.splice(0).forEach((f) => f()); return; }
    if (mode === 'webgl') L.img = { width: L.img.width, height: L.img.height };   // the bytes live on the GPU now
    L.uploaded = true;
    L.status = 'ready';
    L.readyAt = performance.now();
    // replacing a stand-in (another palette or width of the same layer): no fade, the swap is in place
    const prev = lastSlots.find((s) => s.L.stretch === L.stretch && s.L !== L);
    if (prev) L.shownSince = performance.now() - 1e4;
    L.waiters.splice(0).forEach((f) => f());
    request(S_PRESENT);
  }
  function trimLayers() {
    if (layers.size <= FIG_KEEP) return;
    const keep = new Set([Math.round(stretch), Math.round(stretch) + 1, Math.round(stretch) - 1]);
    if (tween) { keep.add(Math.round(tween.from)); keep.add(Math.round(tween.to)); }
    const old = [...layers.values()].filter((L) => !(keep.has(L.stretch) && L.key === layerKey(L.stretch))).sort((a, b) => a.used - b.used);
    while (layers.size > FIG_KEEP && old.length) {
      const L = old.shift();
      layers.delete(L.key);
      try { renderer?.figure(L.key, null); } catch { /* ignore */ }
      L.waiters.splice(0).forEach((f) => f());
    }
  }
  function dropLayers() {
    for (const L of layers.values()) { try { renderer?.figure(L.key, null); } catch { /* ignore */ } L.waiters.splice(0).forEach((f) => f()); }
    layers.clear();
    lastSlots = [];
  }
  const fadeIn = () => (quantized() ? FIG_IN_RM : FIG_IN);
  /** The figure layers on show now, each with its alpha: the current stretch's, the pan's destination, a neighbour
   *  whose layer a window can see (Home's closing looks down the road to the river town). At most two. */
  function figSlots() {
    if (!figuresOn || mode === 'static') return [];
    const now = performance.now();
    const out = [];
    const show = (k) => { const L = layerFor(k); return ready(L) ? L : standIn(Math.round(k)); };
    const late = (L) => {
      if (!L.shownSince) L.shownSince = drawnFigs ? now : now - 1e4;
      return clamp01((now - L.shownSince) / fadeIn());
    };
    if (tween) {
      const a = show(tween.from), b = show(tween.to);
      const t = tween.t;
      if (a) out.push({ L: a, k: (1 - sstep(0, 0.3, t)) * late(a) });
      if (b && b !== a) out.push({ L: b, k: sstep(0.6, 1, t) * late(b) });
    } else {
      const k = Math.round(stretch);
      for (const j of [k, k + 1, k - 1]) {
        if (out.length >= 2) break;
        const L = j === k ? show(j) : layerFor(j, false);
        if (!ready(L)) continue;
        if (j !== k && !windowsSee(L.meta.rect)) continue;
        out.push({ L, k: late(L) });
      }
    }
    return out;   // (alpha 0 included: a layer about to fade in still asks for its frames)
  }
  // does any window, at its framing now, see that world rect? (an unpainted or off-screen window counts only when it
  // is about to be painted: its stale framing from another stretch must not hold a layer)
  function windowsSee(r) {
    for (const w of wins) {
      if (!w.box || !(w.vis || w.want)) continue;
      const fr = framingOf(w);
      if (!fr || fr.full) continue;
      const u0 = fr.worldLeft, u1 = u0 + w.box.width / fr.scale;
      if (u1 > r[0] && u0 < r[1]) return true;
    }
    return false;
  }
  const figU = (s) => (s ? {
    id: s.L.key, k: s.k, plane: s.L.meta.plane, phase: s.L.meta.phase,
    rect: new Float32Array([s.L.meta.rect[0], s.L.meta.rect[2], 1 / (s.L.meta.rect[1] - s.L.meta.rect[0]), 1 / (s.L.meta.rect[3] - s.L.meta.rect[2])]),
    raw: s.L.meta.rect,
  } : null);

  // ---------------------------------------------------------------- sizing
  function resize(force = false) {
    if (!renderer) return false;
    const r = surface.getBoundingClientRect();
    const w = Math.round(r.width) || innerWidth;
    const h = Math.round(r.height) || innerHeight;
    rect = { left: r.left, top: r.top, width: w, height: h };
    const c = classNow();
    const clsChanged = c !== cls;
    cls = c;
    // Mobile URL bars nudge the height: let CSS stretch the buffer instead of rebuilding.
    if (!force && W && w === cssW && Math.abs(h - cssH) < cssH * 0.12 && !clsChanged) return false;
    cssW = w; cssH = h; aspect = w / h;
    const dpr = Math.max(1, devicePixelRatio || 1);
    let s = 0.75 * Math.min(dpr, 2) * (mode === 'webgl' ? quality : 1);
    s = Math.min(s, LONG_CAP / Math.max(w, h));
    bufS = s;
    const bw = Math.max(2, Math.round(w * s));
    const bh = Math.max(2, Math.round(h * s));
    renderer.resize(bw, bh);
    W = bw; H = bh;
    for (const v of [...wins, hzv]) v.key = '';
    need |= S_SCENE | S_PRESENT | S_MEASURE | S_SCROLL;
    wakeRects = null;
    return true;
  }

  // ---------------------------------------------------------------- inputs
  function readBoxes() {
    // A route swap has taken the page these elements belong to: their boxes hold until rebind() hands over the
    // new page's (it does so in the same task).
    anyVisible = false;
    for (const w of wins) {
      if (fullMode && w.kind === 'strip') {
        w.box = { left: 0, top: -(window.scrollY || 0), width: cssW, height: cssH };
      } else if (w.el && w.el.isConnected) {
        const r = w.el.getBoundingClientRect();
        w.box = r.width > 0 && r.height > 0 ? { left: r.left - rect.left, top: r.top - rect.top, width: r.width, height: r.height } : null;
      } else if (!w.el) w.box = null;
      const b = w.box;
      w.vis = !!b && b.top < cssH && b.top + b.height > 0 && b.left < cssW && b.left + b.width > 0;
      if (w.vis) anyVisible = true;
    }
    // the horizon handover (desktop only): it fades in as the strip's bottom edge rises from 35% of the viewport to
    // the top, and out again as the closing's top rises from the bottom of the viewport to 70%
    const vh = innerHeight || cssH || 1;
    const s = wins[0], c = wins[1];
    const sb = s.box ? (s.box.top + s.box.height) / vh : -1;
    const ct = c.box ? c.box.top / vh : 9;
    hzTarget = hzOn || fullMode ? sstep(0.35, 0, sb) * (1 - sstep(1, 0.7, ct)) : 0;
  }
  function stepHz(snap) {
    let tg = hzTarget;
    if (forced === 'hero') tg = 0;
    else if (forced === 'horizon') tg = hzOn || fullMode ? 1 : 0;
    if (quantized()) tg = tg > 0.5 ? 1 : 0;
    if (snap || quantized()) { const moved = hzK !== tg; hzK = tg; return moved; }
    if (Math.abs(tg - hzK) < 1e-4) { if (hzK !== tg) { hzK = tg; return true; } return false; }
    hzK += Math.max(-HZ_STEP, Math.min(HZ_STEP, tg - hzK));
    return true;
  }

  // The union of an element's text lines (client rects of its text nodes), relative to its box; null if none.
  function textBox(el, r) {
    const c = textBoxes.get(el);
    if (c && c.w === r.width && c.h === r.height && c.f === fontGen) return c.box;
    let l = Infinity, t = Infinity, rt = -Infinity, b = -Infinity;
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let n = walk.nextNode(), i = 0; n && i < 400; n = walk.nextNode(), i++) {
      if (!n.data.trim()) continue;
      range.selectNodeContents(n);
      for (const q of range.getClientRects()) {
        if (q.width < 2 || q.height < 2) continue;   // collapsed or visually hidden
        l = Math.min(l, q.left); t = Math.min(t, q.top); rt = Math.max(rt, q.right); b = Math.max(b, q.bottom);
      }
    }
    const box = l < rt ? { l: l - r.left, t: t - r.top, r: rt - r.left, b: b - r.top } : null;
    textBoxes.set(el, { w: r.width, h: r.height, f: fontGen, box });
    return box;
  }
  function measureVeil() {
    veil.fill(-1);
    veilS.fill(0);
    veilF.fill(1);
    const notes = wins.map((w) => w.noteEl).filter(Boolean);
    if ((!veilEls.length && !notes.length) || !cssW) return;
    const seen = [];
    for (const el of veilEls.concat(notes)) {
      if (!el.isConnected) continue;
      let r = el.getBoundingClientRect();
      const v = notes.includes(el) ? '0.95' : (el.getAttribute('data-veil') || '').trim();
      let s = v !== '' && Number.isFinite(+v) ? clamp01(+v) : veilK;
      let f = 1;
      if (s >= RESERVE) {
        // A reserve (small print): solid paper only behind its own lines, with a tighter feather, and only once
        // they are on screen. The landscape around it keeps its ink.
        const tb = textBox(el, r);
        if (!tb) continue;
        r = { left: r.left + tb.l, top: r.top + tb.t, right: r.left + tb.r, bottom: r.top + tb.b };
        const vis = Math.min(r.bottom, rect.top + cssH) - Math.max(r.top, rect.top);
        s = sstep(0, RESERVE_IN, vis);
        f = RESERVE_FEATHER;
      }
      const x0 = Math.max(r.left, rect.left), x1 = Math.min(r.right, rect.left + cssW);
      const y0 = Math.max(r.top, rect.top), y1 = Math.min(r.bottom, rect.top + cssH);
      const area = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
      if (area <= 0 || s <= 0) continue;
      seen.push([area, r, s, f]);
    }
    seen.sort((a, b) => b[0] - a[0]);
    seen.slice(0, VEILS).forEach(([, r, s, f], k) => {
      veil[k * 4] = (r.left - rect.left) / cssW;
      veil[k * 4 + 2] = (r.right - rect.left) / cssW;
      veil[k * 4 + 1] = 1 - (r.bottom - rect.top) / cssH;
      veil[k * 4 + 3] = 1 - (r.top - rect.top) / cssH;
      veilS[k] = s;
      veilF[k] = f;
    });
  }
  // Each window's keep-out: the right edge of the text blocks that overlap it (box px), or null. Static while the
  // page scrolls (text and window move together), so it is read on measure frames only.
  function measureKeep() {
    for (const w of wins) {
      w.keepR = null;
      w.doc = !!w.el?.closest?.('.strip--doc');
      w.wakeOK = fullMode && w.kind === 'strip' ? wakeEls.length > 0 : !!w.el && (wakeEls.includes(w.el) || w.el.hasAttribute('data-wake'));
      // the strip's small "Draft art" note (SPEC-R4A §6.1) sits in the art's bottom feather: the engine keeps paper behind
      // its line (a reserve) and no figure or pigment under it
      w.noteEl = w.kind === 'strip' && w.el ? w.el.parentElement?.querySelector(':scope > .strip__note') || null : null;
      w.note = null;
      if (!w.box || !w.el) continue;
      const b = w.box;
      if (w.noteEl && w.noteEl.getClientRects().length) {
        const r = w.noteEl.getBoundingClientRect();
        const l = r.left - rect.left - b.left, t = r.top - rect.top - b.top;
        w.note = [Math.round(l - 24), Math.round(t - 14), Math.round(l + r.width + 24), Math.round(t + r.height + 10)];
      }
      for (const el of keepEls) {
        if (!el.isConnected) continue;
        const r = el.getBoundingClientRect();
        const top = r.top - rect.top, left = r.left - rect.left;
        if (r.width <= 0 || r.height <= 0) continue;
        if (top < b.top + b.height && top + r.height > b.top && left < b.left + b.width && left + r.width > b.left) {
          w.keepR = Math.max(w.keepR ?? 0, left + r.width - b.left);
        }
      }
      if (w.keepR !== null) w.keepR = Math.round(w.keepR);
    }
  }

  // the wake: fine pointers, inside a [data-wake] region, never under reduced motion or still
  const wakeOn = () => opts.pointer !== false && !quantized() && mode === 'webgl' && mqFine.matches && wakeEls.length > 0;
  function insideWake(x, y) {
    if (!wakeRects) wakeRects = wakeEls.filter((el) => el.isConnected).map((el) => el.getBoundingClientRect());
    for (const r of wakeRects) if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
    return false;
  }
  function resetWake() {
    wake.s = wake.target = 0;
    wake.has = wake.inWin = wake.moving = false;
    trail.length = 0;
    wakeBox.set([2, 2, -1, -1]);
    trailU.fill(0);
  }
  // the wake's radius, viewport heights (WAKE_VH of the viewport, clamped to WAKE_PX CSS px)
  const wakeR = () => { const h = cssH || innerHeight || 900; return Math.min(WAKE_PX[1], Math.max(WAKE_PX[0], WAKE_VH * h)) / h; };
  // the wake needs frames only while it moves (a parked pointer's parted mist is a still picture)
  const wakeLive = () => wake.moving;

  // any input keeps the mist drifting (and wakes it after an idle stop)
  const onInput = () => {
    lastInput = performance.now();
    if (driftT < 1 && drifting()) pace(S_PRESENT, 0);
  };
  const onPointer = (e) => {
    onInput();
    if (e.pointerType === 'touch' || !wakeOn()) return;
    wake.tx = e.clientX;
    wake.ty = e.clientY;
    if (!wake.has) { wake.x = wake.tx; wake.y = wake.ty; wake.has = true; }
    wake.inWin = true;
    wake.dirty = true;
    pace(S_PRESENT, POINTER_MS);
  };
  const onLeave = () => { wake.inWin = false; wake.dirty = true; pace(S_PRESENT, POINTER_MS); };
  // Scrolling moves the windows and the veils: one present per frame while a window or the horizon is on screen.
  // With neither (a phone reading on paper) a scroll costs nothing until a window comes near again.
  const onScroll = () => {
    lastScroll = performance.now();
    wakeRects = null;
    wake.dirty = true;
    lastInput = lastScroll;
    if (!hzOn && !fullMode && !wasVisible && !wins.some((w) => w.near)) return;
    if (driftT < 1 && drifting()) pace(S_PRESENT, 0);
    request(S_SCROLL);
  };
  const onVis = () => {
    hidden = document.visibilityState === 'hidden';
    if (hidden) { finishPan(); endSweep(); stop(); return; }
    lastInput = performance.now();
    // The hidden time never counts. A bloom that has not been seen yet (a page loaded in a
    // background tab) starts from its beginning.
    clockLast = 0;
    if (arriving && !arriveSeen) arrive = 0;
    if (renderer && !renderer.ready) whenReady();
    request(drawnOnce ? S_PRESENT | S_SCROLL | S_MEASURE : S_ALL);
  };
  const onReduce = () => {
    if (typeof opts.reducedMotion === 'boolean') return;
    reduced = mqReduce.matches;
    if (reduced) { arriving = false; arrive = 9; finishPan(); endSweep(); resetWake(); }
    request(S_ALL);
  };
  const onHz = () => { hzOn = mqHz.matches; request(S_SCROLL | S_PRESENT); };
  let mqDpr = null;
  const onDpr = () => { watchDpr(); if (resize(true)) request(S_ALL); };
  function watchDpr() {
    mqDpr?.removeEventListener('change', onDpr);
    mqDpr = matchMedia(`(resolution: ${devicePixelRatio || 1}dppx)`);
    mqDpr.addEventListener('change', onDpr);
  }

  // resizes: the canvas (a new buffer), the windows and the veiled text (new boxes: re-frame, debounced repaint)
  let reframeTimer = 0;
  const reframeSoon = () => { clearTimeout(reframeTimer); reframeTimer = setTimeout(() => request(S_MEASURE | S_SCROLL), 150); };
  const ro = typeof ResizeObserver === 'function'
    ? new ResizeObserver((entries) => {
      let surf = false, other = false;
      for (const e of entries) { if (e.target === surface) surf = true; else other = true; }
      if (surf && resize()) {
        // Changing the buffer size clears it: repaint right now, before the browser paints.
        if (running()) draw(performance.now(), true); else need |= S_ALL;
      }
      if (other || surf) { wakeRects = null; request(S_MEASURE | S_SCROLL | S_PRESENT); reframeSoon(); }
    })
    : null;
  const onWinResize = () => { wakeRects = null; if (resize()) request(S_ALL); else request(S_MEASURE | S_SCROLL | S_PRESENT); };
  const io = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver((entries) => {
      onscreen = entries[entries.length - 1].isIntersecting;
      if (onscreen) request(S_PRESENT | S_SCROLL | S_MEASURE); else stop();
    })
    : null;
  // is a window near the viewport? (a scroll far from both on a phone needs no frame at all)
  const winIO = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver((entries) => {
      for (const e of entries) for (const w of wins) if (w.el === e.target) w.near = e.isIntersecting;
      request(S_SCROLL);
    }, { rootMargin: '30% 0px 30% 0px' })
    : null;

  function observeSurface(on) {
    if (on) { ro?.observe(surface); io?.observe(surface); } else { ro?.unobserve(surface); io?.unobserve(surface); }
  }
  function observeEls(on) {
    for (const w of wins) {
      if (!w.el) { w.near = false; continue; }
      if (on) { ro?.observe(w.el); winIO?.observe(w.el); w.near = true; } else { ro?.unobserve(w.el); winIO?.unobserve(w.el); }
    }
    for (const el of veilEls) if (el !== surface && ro) { if (on) ro.observe(el); else ro.unobserve(el); }
  }

  // ---------------------------------------------------------------- frame scheduling
  const running = () => !destroyed && !deferred && !userPaused && !hidden && onscreen && !!renderer && renderer.ready;
  const awake = () => performance.now() - lastInput < IDLE_MS;
  // the mist drifts inside the windows only (never in the horizon band, behind the reading)
  const drifting = () => ambientWanted && !quantized() && mode === 'webgl' && (anyVisible || wake.s > 0.01);
  const ambientOn = () => drifting() && (awake() || driftT > 0);

  /** Paint on the next animation frame (scroll, resize, pans, arrival). */
  function request(flags) {
    need |= flags;
    if (!running() || raf) return;
    clearTimer();
    raf = requestAnimationFrame(frame);
  }
  /** Paint no sooner than `gap` ms after the last present (wake, ambient mist). */
  function pace(flags, gap) {
    need |= flags;
    wakeAt(lastPresent + gap);
  }
  function wakeAt(at) {
    if (!running() || raf) return;
    if (timer && timerAt <= at) return;
    clearTimer();
    timerAt = at;
    timer = setTimeout(() => { timer = 0; timerAt = 0; request(0); }, Math.max(0, at - performance.now()));
  }
  function clearTimer() {
    if (timer) clearTimeout(timer);
    timer = timerAt = 0;
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    clearTimer();
    raf = 0;
    clockLast = 0;
    heavyLast = 0;
    gov = [];
  }
  // The first frame of a page hidden under the old wash: drawn under the full cover, or as soon as the hold ends.
  function deferFirst() {
    deferTimer = setTimeout(undefer, DEFER_MAX);
    const watch = () => { deferRaf = 0; if (!deferred) return; if (heldByWash()) deferRaf = requestAnimationFrame(watch); else undefer(); };
    deferRaf = requestAnimationFrame(watch);
  }
  function undefer() {
    if (!deferred) return;
    deferred = false;
    clearTimeout(deferTimer);
    cancelAnimationFrame(deferRaf);
    deferTimer = deferRaf = 0;
    if (destroyed) return;
    if (running()) draw(performance.now(), true); else whenReady();
    clockLast = 0;
    request(S_PRESENT);
  }
  const onWashReveal = () => {
    if (destroyed) return;
    undefer();
    if (mode === 'webgl' && renderer?.busy?.()) renderer.settle?.();
  };

  // wait for a renderer that was not ready (e.g. a context still being restored), then paint
  function whenReady(tries = 0) {
    clearTimeout(readyTimer);
    if (destroyed || !renderer) return;
    if (renderer.ready) { request(S_ALL); return; }
    if (tries < 60) readyTimer = setTimeout(() => whenReady(tries + 1), 100);
  }

  function frame(now) {
    raf = 0;
    if (!running()) return;
    // The GPU is still painting an earlier frame (a slow or software renderer): skip this one instead
    // of queueing another behind it, so the browser's own frames keep flowing. Animations stay on time
    // (they advance by the elapsed time); they only drop frames.
    const busy = renderer.busy ? renderer.busy() : 0;
    if (busy && busy < GPU_WAIT_MAX) { raf = requestAnimationFrame(frame); return; }
    const start = performance.now(); // the rAF timestamp can be a frame early; pace from here
    counts.frames++;
    const { animating, heavy, due } = draw(now, false);
    govern(start, heavy);
    if (animating) { raf = requestAnimationFrame(frame); return; }
    // otherwise sleep until the next thing that is due (or until something asks for a frame)
    let at = due;
    if (wakeLive()) at = Math.min(at, lastPresent + POINTER_MS);
    if (ambientOn()) at = Math.min(at, lastPresent + AMBIENT_MS);
    if (at < Infinity) wakeAt(at);
  }

  // Adaptive quality. Heavy frames (a scene painted for motion: arrival, pan, a figure's fade) that keep arriving
  // slower than SLOW_MS are first painted as drafts at a lower internal scale; if they are still slow, the whole
  // buffer drops to fewer pixels (never below 0.5).
  function govern(start, heavy) {
    if (fixedQ || mode !== 'webgl') return;
    if (!heavy) { if (start - heavyLast > 250) gov = []; return; }
    if (heavyLast && start - heavyLast < 250) {
      gov.push(start - heavyLast);
      if (gov.length > GOV_N) gov.shift();
    }
    heavyLast = start;
    if (gov.length < GOV_N || gov.reduce((a, b) => a + b, 0) / GOV_N <= SLOW_MS) return;
    gov = [];
    if (draftScale > 0.5) { draftScale = 0.5; return; }
    if (quality <= 0.5) return;
    quality = Math.max(0.5, quality * 0.8);
    // a new buffer size clears the canvas: repaint it at once
    if (resize(true)) draw(performance.now(), true);
  }

  // ---------------------------------------------------------------- the views
  function framingOf(w) {
    if (!w.box) return null;
    if (fullMode && w.kind === 'strip') {
      const { hs, wvis } = framing(aspect);
      const left = cameraLeft(stretch, wvis);
      return { worldLeft: left, worldTop: 1, scale: cssW / wvis, focus: [0, 0], full: true, hs, wvis };
    }
    const kind = forced === 'closing' && w.kind === 'strip' ? 'closing' : w.kind;
    return framingBlend(stretch, cls, { width: w.box.width, height: w.box.height, keepoutRight: w.keepR, doc: w.doc && kind === 'strip' }, kind);
  }
  const specKey = () => `${curSpec.presence.toFixed(3)}:${curSpec.w.level.toFixed(3)}:${curSpec.w.high.toFixed(3)}:${curSpec.w.deep.toFixed(3)}`;
  // can a window at this framing see that figure layer?
  function seen(fr, b, s) {
    if (fr.full) return false;
    const r = s.L.meta.rect;
    const u0 = fr.worldLeft, u1 = u0 + b.width / fr.scale;
    return u1 > r[0] && u0 < r[1];
  }
  /** Paint one window's scene (if its key changed, or it is in motion). Returns true when it painted. */
  function paintWin(w, U0, slots, force) {
    const fr = w.fr = framingOf(w);
    if (!fr || !w.box) return false;
    const b = w.box;
    const bw = Math.max(2, Math.round(b.width * bufS)), bh = Math.max(2, Math.round(b.height * bufS));
    const remade = renderer.view(w.id, bw, bh);
    const vis = slots.filter((s) => s.k > 0.001 && seen(fr, b, s));
    const fa = vis[0] ? figU(vis[0]) : null;
    const fb = vis[1] ? figU(vis[1]) : null;
    const fk = (f) => (f ? `${f.id}@${f.k.toFixed(2)}` : '-');
    const key = [fr.worldLeft.toFixed(5), fr.worldTop.toFixed(5), fr.scale.toFixed(2), bw, bh, palette, specKey(), w.keepR, String(w.note), fk(fa), fk(fb),
      w.kind === 'strip' ? arrive.toFixed(3) : 'a', U0.draft ? 'd' : 'f', mode].join('|');
    if (!remade && !force && key === w.key && !w.pending) return false;
    const t0 = performance.now();
    let view, P, left, wvis, asp, hs;
    if (fr.full) {
      P = resolve(curSpec, aspect);
      left = fr.worldLeft; wvis = fr.wvis; asp = aspect; hs = fr.hs;
      view = [left * hs, 1, 1, aspect];
    } else {
      P = resolve(curSpec, 1.6);
      const vh = fr.scale / HS;                     // CSS px per scene unit
      left = fr.worldLeft; wvis = b.width / fr.scale; asp = b.width / vh; hs = HS;
      view = [left * HS, fr.worldTop, b.height / vh, asp];
    }
    const samples = mode === 'webgl' ? Math.min(1536, Math.max(96, Math.round(bw / 1.25))) : Math.min(480, Math.max(120, Math.round(bw / 3)));
    w.buf = buildRidges(samples, { left, wvis, aspect: asp, palette, pigment: 1 }, P, w.buf);
    w.samples = samples;
    counts.ridgeMs = Math.round((performance.now() - t0) * 10) / 10;
    counts.ridges++;
    renderer.ridges(w.id, w.buf, samples);
    // keep-out, in box uv: the text's right edge, active, the mist ramp's half-width (140 px), the figure guard (+40 px)
    const keep = w.keepR !== null && w.keepR > 0
      ? new Float32Array([w.keepR / b.width, 1, 140 / b.width, (w.keepR + 40) / b.width]) : new Float32Array(4);
    w.keepU = keep;
    w.viewU = new Float32Array(view);
    const note = w.note ? new Float32Array([w.note[0] / b.width, 1 - w.note[3] / b.height, w.note[2] / b.width, 1 - w.note[1] / b.height]) : null;
    const U = {
      ...U0, view: w.viewU, hs, feet: layerFeet(P), keep, note, figA: fa, figB: fb,
      arrive: w.kind === 'strip' ? arrive : 9, hz: hzZero, hzK: 0, lift: 0, P, box: b, fr,
    };
    const t1 = performance.now();
    const done = renderer.scene(w.id, U) !== false;
    counts.sceneMs = Math.round((performance.now() - t1) * 10) / 10;
    counts.scenes++;
    w.pending = !done;
    w.key = done ? key : '';
    w.painted = w.painted || done;
    w.draft = !!U.draft;
    if (done) { if (U.draft) { counts.drafts++; counts.draftAt = Math.round(performance.now()); } else counts.fullAt = Math.round(performance.now()); }
    return true;
  }
  /** Paint the horizon band's scene (full viewport, ink only, mist at rest). */
  function paintHorizon(U0, force) {
    const remade = renderer.view(hzv.id, W, H);
    const { hs, wvis } = framing(aspect);
    const left = cameraLeft(stretch, wvis);
    const key = [left.toFixed(5), W, H, specKey(), horizonP.toFixed(3), U0.draft ? 'd' : 'f', mode].join('|');
    if (!remade && !force && key === hzv.key && !hzv.pending) return false;
    const P = resolve(curSpec, aspect);
    const samples = mode === 'webgl' ? Math.min(1536, Math.max(320, Math.round(W / 1.25))) : Math.min(480, Math.max(200, Math.round(W / 3)));
    hzv.buf = buildRidges(samples, { left, wvis, aspect, pigment: 0 }, P, hzv.buf);
    hzv.samples = samples;
    renderer.ridges(hzv.id, hzv.buf, samples);
    // each plane flattened and sunk until its highest crest stands at its line (never less than the plane behind)
    crestMax(hzv.buf, samples, crest);
    const pf = framing(aspect).portrait;
    const ratio = (0.6 + 0.4 * horizonP) / (0.6 + 0.4 * curSpec.presence);
    let prev = 0, shift = 0;
    for (let l = 0; l < LAYERS; l++) {
      const top = HZ_TOP[l] * (1 - 0.2 * pf);
      prev = Math.max(0, crest[l] * HZ_SQUASH - top, prev);
      hzU[l * 4] = prev;
      hzU[l * 4 + 1] = (HZ_TOP[l] - HZ_BAND) * (1 - 0.2 * pf);
      hzU[l * 4 + 2] = HZ_INK[l] * ratio;
      hzU[l * 4 + 3] = HZ_SQUASH;
      if (l <= 2) shift = Math.max(shift, crest[l] - top);
    }
    hzv.view.set([left * hs, 1, 1, aspect]);
    const U = { ...U0, view: hzv.view, hs, feet: layerFeet(P), keep: null, figA: null, figB: null, arrive: 9, hz: hzU, hzK: 1, lift: 0, hzShift: shift, P, horizon: true };
    const done = renderer.scene(hzv.id, U) !== false;
    counts.scenes++;
    hzv.pending = !done;
    hzv.key = done ? key : '';
    hzv.painted = hzv.painted || done;
    hzv.draft = !!U.draft;
    return true;
  }

  function updateWake(dt, now) {
    if (wake.dirty) {
      wake.dirty = false;
      wake.target = wakeOn() && wake.has && wake.inWin && insideWake(wake.tx, wake.ty) ? 1 : 0;
    }
    if (!wakeOn()) { if (wake.s || trail.length) { resetWake(); return true; } return false; }
    const kp = 1 - Math.exp(-dt / WAKE_LAG);
    wake.x += (wake.tx - wake.x) * kp;
    wake.y += (wake.ty - wake.y) * kp;
    const tau = wake.target > wake.s ? WAKE_ATTACK : WAKE_RELEASE;
    wake.s += (wake.target - wake.s) * (1 - Math.exp(-dt / tau));
    if (wake.s < 0.002 && !wake.target) wake.s = 0;
    // the trail: a point where the wake has been, every ~40 ms of travel
    const last = trail[0];
    if (wake.s > 0.02 && now - wake.pushedAt > 40 && (!last || Math.hypot(wake.x - last.x, wake.y - last.y) > 0.012 * cssH)) {
      trail.unshift({ x: wake.x, y: wake.y, s0: wake.s, t: now });
      wake.pushedAt = now;
      if (trail.length > TRAIL - 1) trail.length = TRAIL - 1;
    }
    while (trail.length && now - trail[trail.length - 1].t > TRAIL_AGE) trail.pop();
    // uniforms (uv, origin bottom-left)
    trailU.fill(0);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const put = (i, x, y, s) => {
      const u = (x - rect.left) / (cssW || 1), v = 1 - (y - rect.top) / (cssH || 1);
      trailU[i * 4] = u; trailU[i * 4 + 1] = v; trailU[i * 4 + 2] = s;
      x0 = Math.min(x0, u); x1 = Math.max(x1, u); y0 = Math.min(y0, v); y1 = Math.max(y1, v);
    };
    let n = 0;
    if (wake.s > 0.001 || trail.length) put(n++, wake.x, wake.y, Math.max(wake.s, 1e-4));
    for (const p of trail) {
      const s = p.s0 * Math.exp(-(now - p.t) / TRAIL_TAU);
      if (s < 0.004) break;
      put(n++, p.x, p.y, s);
    }
    if (n) {
      const ry = wakeR() * 2.7, rx = ry / (aspect || 1);   // the gaussian is < 0.001 beyond 2.6 radii
      wakeBox[0] = x0 - rx; wakeBox[1] = y0 - ry; wakeBox[2] = x1 + rx; wakeBox[3] = y1 + ry;
    } else wakeBox.set([2, 2, -1, -1]);
    wake.moving = Math.abs(wake.tx - wake.x) + Math.abs(wake.ty - wake.y) > 0.5 || Math.abs(wake.target - wake.s) > 0.002 || trail.length > 0;
    return wake.moving || n > 0;
  }

  function updateSweep(dt) {
    sweepU[2] = 0;
    if (!sw) return false;
    sw.t += dt;
    const u = Math.min(1, sw.t / sw.dur);
    // a bank of mist slides across with the scenery (from the side the new stretch comes in from),
    // densest while it crosses the middle, gone as the pan settles
    const e = sstep(0, 1, u);
    const x = sw.dir > 0 ? 1.18 - 1.36 * e : -0.18 + 1.36 * e;
    const a = sstep(0, 0.32, u) * (1 - sstep(0.62, 1, u));
    const thick = tween && tween.cut ? 1 : 0;
    sweepU[0] = x; sweepU[1] = SWEEP_W; sweepU[2] = a; sweepU[3] = thick;
    sweepSeed = sw.seed;
    if (u >= 1) { endSweep(); return false; }
    return true;
  }
  function endSweep() {
    sweepU[2] = 0;
    if (!sw) return;
    const s = sw;
    sw = null;
    s.resolve();
  }

  /** Advance animations and paint what is dirty. `animating`: another frame is needed right away; `due`: when the
   *  next frame is due otherwise (a full-quality scene after drafts). */
  function draw(now) {
    const dt = clockLast ? Math.max(0, Math.min(250, now - clockLast)) : 0;
    clockLast = now;
    let animating = false, due = Infinity, heavy = false;

    // Veils are viewport rects (they follow their text as the page scrolls), so a scroll re-measures them too; a
    // window's keep-out and note are box-relative and only change on measure frames.
    if (need & S_SCROLL) { readBoxes(); if (!(need & S_MEASURE)) measureVeil(); need |= S_PRESENT; }
    if (need & S_MEASURE) { measureVeil(); measureKeep(); need |= S_PRESENT; }

    const panning = !!tween;   // the frame that ends a pan is still painted as a pan frame
    if (tween) {
      tween.t = tween.dur > 0 ? Math.min(1, tween.t + dt / tween.dur) : 1;
      const ease = tween.ease === 'cubic' ? easeCubic : easeWhip;
      const e = ease(tween.t);
      if (tween.cut) {
        // travel CUT_SPAN on screen; the middle of the journey is spliced out under the thick mist
        const D = tween.to - tween.from, sg = Math.sign(D), span = Math.min(CUT_SPAN, Math.abs(D));
        stretch = tween.from + sg * (span * e + (e >= ease(CUT_AT) ? Math.abs(D) - span : 0));
      } else stretch = tween.from + (tween.to - tween.from) * e;
      curSpec = blendSpec(tween.fromSpec, tween.toSpec, e);
      if (tween.t >= 1) finishPan(); else animating = true;
    }
    if (arriving) {
      if (dt > 0 && !hidden) arriveSeen = true;
      arrive += (dt / 1000) * arriveRate;
      if (arrive >= ARRIVE_END) { arriving = false; arrive = 9; } else animating = true;
    }
    if (stepHz(false)) need |= S_PRESENT;
    if (Math.abs(hzK - hzTarget) > 1e-4 && !quantized() && forced === null) animating = true;
    if (sw) { if (updateSweep(dt)) animating = true; need |= S_PRESENT; }
    if (wake.has || wake.s > 0 || trail.length) { if (updateWake(dt, now)) need |= S_PRESENT; }
    if (drifting() && dt > 0) {
      driftT = awake() ? Math.min(1, driftT + dt / EASE_IN_MS) : Math.max(0, driftT - dt / EASE_OUT_MS);
      const d = driftT * driftT * (3 - 2 * driftT);
      if (d > 0) { time += (dt / 1000) * d; need |= S_PRESENT; }
    }

    // the scenes: a window repaints when its framing, palette, keep-out or figures change, while it is in motion,
    // and once at full quality after motion stops. Never while the page merely scrolls (its key stays the same).
    const moving = panning || arriving;
    const draft = mode === 'webgl' ? moving && draftScale < 1 : panning;
    const U0 = { tide, draft, draftScale, aspect };
    const slots = lastSlots = figSlots();
    for (const s of slots) if (s.k < 1) animating = true;
    const scrollIdle = performance.now() - lastScroll > 100;
    const settleDue = !moving && performance.now() - counts.draftAt >= FULL_MS - 8;
    for (const w of wins) {
      if (!w.box || !(w.vis || (w.want && scrollIdle))) continue;
      if (w.draft && !moving && !settleDue) due = Math.min(due, counts.draftAt + FULL_MS);
      if (paintWin(w, U0, slots, ((need & S_SCENE) !== 0 && w.vis) || (w.draft && settleDue))) {
        heavy = heavy || moving;
        need |= S_PRESENT;
        w.want = false;
      }
      if (w.pending) animating = true;
    }
    if ((hzOn || fullMode) && W && (hzK > 0 || (hzv.want && scrollIdle))) {
      if (hzv.draft && !moving && !settleDue) due = Math.min(due, counts.draftAt + FULL_MS);
      if (paintHorizon(U0, hzv.draft && settleDue)) { need |= S_PRESENT; hzv.want = false; heavy = heavy || moving; }
      if (hzv.pending) animating = true;
    }
    if (!drawnFigs && wins.some((w) => w.painted)) drawnFigs = true;

    if (anyVisible !== wasVisible) need |= S_PRESENT;
    if ((need & S_PRESENT) && (anyVisible || wasVisible || hzK > 0 || !drawnOnce || sw)) {
      const t = performance.now();
      renderer.present(presentU());
      lastPresent = t;
      counts.presentMs = Math.round((performance.now() - t) * 10) / 10;
      counts.presents++;
      drawnOnce = true;
      wasVisible = anyVisible || hzK > 0;
    }
    need = 0;
    return { animating, heavy, due };
  }

  function presentU() {
    const windows = [];
    for (const w of wins) {
      if (!w.vis || !w.box || !w.viewU || !w.painted) continue;
      const b = w.box;
      const full = fullMode && w.kind === 'strip';
      const [ft, fb] = full ? [0.5, 0.1 * b.height] : featherOf(cls);
      const k = w.doc ? 0.5 : 1;
      windows.push({
        id: w.id,
        rect: new Float32Array([b.left / cssW, 1 - (b.top + b.height) / cssH, (b.left + b.width) / cssW, 1 - b.top / cssH]),
        box: b,
        view: w.viewU,
        feather: new Float32Array([Math.max(1e-3, (ft * k) / b.height), Math.max(1e-3, (fb * k) / b.height), w.wakeOK ? 1 : 0, 1]),
        keep: w.keepU ? new Float32Array([w.keepU[0], w.keepU[1], w.keepU[2], 0]) : null,
      });
    }
    return {
      aspect,
      windows,
      horizon: hzK > 0 && hzv.painted ? { id: hzv.id, k: hzK, view: hzv.view } : null,
      hzK,
      time,
      veil, veilS, veilF,
      veilR: 0.13 * Math.min(1, aspect),   // the veil's feather: 13% of the shorter side (x veilF per veil)
      trail: trailU, wakeBox, wakeR: wakeR(),
      sweep: sweepU, sweepSeed,
      px: cssW / W,
      panPx: stretch * HS * (cssH || 1),
      grain: grainK,
      grainPx: Math.min(1, 2 / Math.max(1, devicePixelRatio || 1)),   // a grain texel: 1 CSS px, at most 2 device px
    };
  }

  // ---------------------------------------------------------------- pans
  function finishPan() {
    if (!tween) return;
    const t = tween;
    tween = null;
    stretch = t.to;
    curSpec = t.toSpec;
    // the destination's layer has faded in with the pan: it stays at full strength
    const L = layerFor(t.to, false);
    if (ready(L)) L.shownSince = Math.min(L.shownSince || Infinity, performance.now() - 1e4);
    need |= S_SCENE | S_PRESENT;
    t.resolve();
  }
  function panTo(to, o = {}) {
    if (destroyed || !renderer) return Promise.resolve();
    const dest = num(to, stretch);
    const toSpec = spec(o.distance ?? specName(tween ? tween.toSpec : curSpec), o.presence ?? (tween ? tween.toSpec : curSpec).presence);
    const dur = Math.max(0, num(o.duration, 900));
    finishPanAt();
    const Lb = layerFor(dest);
    return new Promise((res) => {
      if (quantized() || dur === 0 || hidden) {
        stretch = dest;
        curSpec = toSpec;
        // a cut: the new page's figures come in at the quick fade (from whenever they are ready), never pop
        if (Lb) Lb.shownSince = ready(Lb) ? performance.now() : 0;
        need |= S_SCENE | S_PRESENT;
        if (running()) draw(performance.now(), true);
        res();
        return;
      }
      // a long jump splices out its middle under a thick mist: its own, unless a sweep is (about to be)
      // running; with cloud: false (back/forward) it travels the whole way instead
      const cut = Math.abs(dest - stretch) > 2 && o.cloud !== false && mode === 'webgl';
      tween = { from: stretch, to: dest, fromSpec: curSpec, toSpec, t: 0, dur, ease: o.ease === 'cubic-out' ? 'cubic' : 'whip', cut, resolve: res };
      // the destination's layer fades in over the pan's last 40% (or from whenever it is ready, if later)
      if (Lb && !ready(Lb)) Lb.shownSince = 0;
      if (cut && !sw) startSweep(Math.sign(dest - stretch), Math.min(420, dur * 0.75));
      request(S_SCENE);
    });
  }
  // a new pan starts from wherever the previous one is now; the old promise resolves
  function finishPanAt() {
    if (!tween) return;
    const t = tween;
    tween = null;
    t.resolve();
  }
  function specName(s) {
    let best = 'level', w = -1;
    for (const k in s.w) if (s.w[k] > w) { w = s.w[k]; best = k; }
    return best;
  }

  // ---------------------------------------------------------------- the sweep
  function startSweep(dir, dur) {
    return new Promise((res) => {
      sw = { t: 0, dur, dir: dir < 0 ? -1 : 1, seed: ((sweepN++ * 0.6180339887) % 1) * 9, resolve: res };
      request(S_PRESENT);
    });
  }
  function sweep(o = {}) {
    if (destroyed || !renderer) return Promise.resolve();
    const dur = Math.max(0, num(o.duration, 420));
    const dir = num(o.dir, 1) < 0 ? -1 : 1;
    endSweep();
    if (quantized() || mode !== 'webgl' || hidden || dur === 0) return Promise.resolve();
    return startSweep(dir, dur);
  }

  // ---------------------------------------------------------------- idle work: what may be needed next
  // Once the first screen is up: the closing's painting (before it can be reached), the horizon band (desktop), and
  // the next stretch's figure layer (the closing looks down the road toward it; "Next" goes there).
  function idleSoon() {
    cancelIdle();
    const ric = window.requestIdleCallback || ((f) => setTimeout(() => f({ timeRemaining: () => 8 }), 700));
    idleId = ric(() => {
      idleId = 0;
      if (destroyed) return;
      if (wins[1].el) wins[1].want = true;
      if (hzOn) hzv.want = true;
      layerFor(Math.round(stretch) + 1);
      request(S_SCROLL | S_MEASURE);
    }, { timeout: 2500 });
  }
  function cancelIdle() {
    if (!idleId) return;
    (window.cancelIdleCallback || clearTimeout)(idleId);
    idleId = 0;
  }

  // ---------------------------------------------------------------- wire up
  const passive = { passive: true };
  addEventListener('scroll', onScroll, passive);
  addEventListener('pointermove', onPointer, passive);
  addEventListener('pointerdown', onInput, passive);
  addEventListener('wheel', onInput, passive);
  addEventListener('keydown', onInput, passive);
  document.documentElement.addEventListener('pointerleave', onLeave);
  document.addEventListener('visibilitychange', onVis);
  document.addEventListener(REVEAL_EVENT, onWashReveal);
  mqReduce.addEventListener('change', onReduce);
  mqHz.addEventListener('change', onHz);
  document.fonts?.addEventListener?.('loadingdone', onFonts);
  if (!ro) addEventListener('resize', onWinResize);
  watchDpr();
  observeSurface(true);
  observeEls(true);

  resize(true);
  readBoxes();
  measureVeil();
  measureKeep();
  stepHz(true);   // the first frame shows the state the page is in (a deep link starts at the horizon)
  // a page that loads scrolled away from its strip has nothing to bloom
  if (arriving && !wins[0].vis) { arriving = false; arrive = 9; }
  layerFor(Math.round(target0));
  need = S_ALL;
  // Arriving from another stretch: start the pan first, so even the first frame belongs to it.
  if (hasFrom) panTo(target0, { duration: num(opts.panDuration, 900), distance: opts.distance ?? 'level', presence: opts.presence ?? 1 });
  // First frame synchronously: the canvas is never shown blank (or black).
  if (deferred) deferFirst();
  else if (renderer && renderer.ready) draw(performance.now(), true);
  else whenReady();
  clockLast = 0;
  request(S_PRESENT);
  idleSoon();

  const handle = {
    get mode() { return mode; },
    panTo,
    sweep,
    setPalette(p) {
      const next = paletteName(p);
      if (destroyed || next === palette) return;
      palette = next;
      layerFor(Math.round(stretch));
      for (const v of [...wins, hzv]) v.key = '';
      request(S_SCENE | S_PRESENT);
      surface.dispatchEvent(new CustomEvent('landscape:palette', { bubbles: true, detail: { palette } }));
    },
    prepare(k) {
      if (destroyed) return Promise.resolve();
      const L = layerFor(num(k, stretch));
      if (!L || L.status !== 'pending') return Promise.resolve();
      return new Promise((res) => L.waiters.push(res));
    },
    rebind(o = {}) {
      if (destroyed) return;
      const has = (k) => Object.prototype.hasOwnProperty.call(o, k);
      observeEls(false);
      if (has('strip') || has('head')) wins[0].el = elOr(has('strip') ? o.strip : null, has('head') ? o.head : null);
      if (has('closing') || has('descend')) wins[1].el = elOr(has('closing') ? o.closing : null, has('descend') ? o.descend : null);
      for (const w of wins) { w.key = ''; w.box = null; w.want = false; }
      fullMode = !wins[0].el && !wins[1].el;
      if (has('keepout')) keepEls = toList(o.keepout);
      if (has('wake')) { wakeEls = toList(o.wake); wakeRects = null; wake.dirty = true; }
      if (has('horizon')) { horizonP = clamp01(num(o.horizon, 0.6)); hzv.key = ''; }
      if (has('veil')) veilEls = toList(o.veil);
      observeEls(true);
      // the new page's boxes and framings, and its horizon state at once (no blend: a page entered mid-scroll
      // shows the right state on its first frame)
      readBoxes();
      measureVeil();
      measureKeep();
      stepHz(true);
      hzv.key = '';
      need |= S_ALL;
      if (running()) draw(performance.now(), true);
      request(S_PRESENT);
      idleSoon();
    },
    setVeil(els) {
      observeEls(false);
      veilEls = toList(els);
      observeEls(true);
      request(S_MEASURE | S_PRESENT);
    },
    setStill(on) {
      on = !!on;
      if (on === still || destroyed) return;
      still = on;
      if (still) {
        finishPan();
        endSweep();
        resetWake();
        if (arriving) { arriving = false; arrive = 9; }
      } else lastInput = performance.now();
      request(S_SCROLL | S_SCENE | S_PRESENT);
    },
    setState(s) {
      const next = FORCED.has(s) ? s : null;
      if (next === forced) return;
      forced = next;
      for (const w of wins) w.key = '';
      stepHz(true);
      request(S_SCROLL | S_SCENE | S_PRESENT);
    },
    refresh() {
      if (resize()) need |= S_ALL;
      wakeRects = null;
      request(S_SCROLL | S_MEASURE | S_PRESENT | S_SCENE);
    },
    pause() { userPaused = true; finishPan(); endSweep(); stop(); },
    resume() { if (!userPaused) return; userPaused = false; request(S_PRESENT | S_SCROLL | S_MEASURE); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stop();
      cancelIdle();
      clearTimeout(lostTimer);
      clearTimeout(readyTimer);
      clearTimeout(deferTimer);
      clearTimeout(reframeTimer);
      cancelAnimationFrame(deferRaf);
      document.removeEventListener(REVEAL_EVENT, onWashReveal);
      finishPanAt();
      endSweep();
      removeEventListener('scroll', onScroll);
      removeEventListener('pointermove', onPointer);
      removeEventListener('pointerdown', onInput);
      removeEventListener('wheel', onInput);
      removeEventListener('keydown', onInput);
      removeEventListener('resize', onWinResize);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVis);
      mqReduce.removeEventListener('change', onReduce);
      mqHz.removeEventListener('change', onHz);
      document.fonts?.removeEventListener?.('loadingdone', onFonts);
      mqDpr?.removeEventListener('change', onDpr);
      ro?.disconnect();
      io?.disconnect();
      winIO?.disconnect();
      for (const L of layers.values()) L.waiters.splice(0).forEach((f) => f());
      layers.clear();
      figSrc?.destroy();
      figSrc = null;
      try { renderer?.destroy(); } catch { /* ignore */ }
      renderer = null;
      if (surface !== canvas) {
        surface.remove();
        canvas.style.display = hiddenDisplay ?? '';
        surface = canvas;
      }
      if (live.get(canvas) === handle) live.delete(canvas);
    },
    stats() {
      const winStat = (w) => (w.box ? { top: Math.round(w.box.top), height: Math.round(w.box.height), visible: w.vis } : { top: null, height: 0, visible: false });
      const frStat = (w) => (w.fr ? { worldLeft: r3(w.fr.worldLeft), worldTop: r3(w.fr.worldTop), scale: Math.round(w.fr.scale), focus: w.fr.focus.map(Math.round), keepoutRight: w.keepR } : null);
      const figs = {};
      for (let k = 0; k < STRETCH_COUNT; k++) {
        if (!figureMeta(k) || !figuresOn) { figs[k] = 'none'; continue; }
        const L = layers.get(layerKey(k));
        figs[k] = !L ? 'none' : L.status === 'ready' ? 'ready' : L.status === 'failed' ? 'none' : 'pending';
      }
      const state = forced || (hzK >= 0.5 ? 'horizon' : 'hero');
      return {
        mode,
        renderer: renderer?.rendererName ?? '',
        software,
        quality,
        draftScale,
        buffer: [W, H],
        css: [cssW, cssH],
        palette,
        widthClass: cls,
        windows: { strip: winStat(wins[0]), closing: winStat(wins[1]) },
        framing: { strip: frStat(wins[0]), closing: frStat(wins[1]) },
        hzK: r3(hzK),
        horizonOn: hzOn,
        figures: figs,
        figureMs: counts.figureMs,
        figureSlots: lastSlots.map((s) => ({ stretch: s.L.stretch, k: r3(s.k) })),
        stretch,
        scene: sceneName(stretch),
        state,
        stateK: r3(hzK),
        forced,
        full: fullMode,
        horizon: horizonP,
        wake: r3(wake.s),
        trail: trail.length,
        still,
        sweeping: !!sw,
        arriving,
        ambient: ambientOn(),
        drift: r3(driftT),
        draft: wins.some((w) => w.draft) || hzv.draft,
        pending: wins.some((w) => w.pending) || hzv.pending,
        deferred,
        running: running(),
        ...counts,
      };
    },
  };
  return handle;
}
