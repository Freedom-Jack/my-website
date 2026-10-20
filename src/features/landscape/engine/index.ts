// landscape/index.ts — public API of the generative ink-landscape background.
// Everything else in the site talks to the landscape ONLY through mountLandscape() and the handle
// it returns (plus the DOM-free exports stripSVG(), sceneAt(), framingAt(), PALETTES and PIGMENTS). Internals:
// compose.ts (where the mountains and the water stand, how each window frames them), ridges.ts (profiles),
// palette.ts (pigments), figures.ts + figures.worker.ts (the figure layers), gl.ts + shaders.ts (WebGL2 painter),
// canvas2d.ts (fallback), strip.ts (the footer's story map).
//
// Round 4a (SPEC-R4A §7, §12): one fixed canvas paints into *windows*, boxes on the page: the page's strip
// ([data-landscape="strip"]) and its closing ([data-landscape="closing"]). Each window is its own painting of the
// one handscroll at its own framing (framingAt), rendered once into its own buffer and presented at the box's live
// position, so it moves 1:1 with the page and never re-renders while you scroll. Between them, on desktops, the
// low ink horizon of round 3 fades in (hzK); outside them the canvas is paper. The mist drifts and parts around a
// fine pointer only inside the windows. Figure layers (sets/: the traveller and hut, the river market, the pavilion...)
// are drawn once per (stretch, composition, scale, width class, palette) off the main thread, for the composition and
// at the scale of the window that shows them, and painted *into* the scene, under the same mist.
//
// Frame loop: nothing spins. A frame is requested only when something is dirty (resize, pan, scroll, veil,
// arrival, a figure's fade, a sweep), the pointer's wake is open (<= 30 fps) or the ambient mist is due (<= 15 fps)
// while a window is on screen. After ~45 s with no input the drift eases to a stop and the loop sleeps. With no
// window on screen and no horizon (a phone reading on paper) the engine requests no frames at all. Frames in motion
// (pans, the bloom) are governed: when they run slow they are painted as drafts at a lower internal scale, and one
// full-quality scene follows ~150 ms after they stop.

import { createGL, type TaintedError } from './gl';
import { createCanvas2D } from './canvas2d';
import { buildRidges, layerFeet, crestMax, LAYERS } from './ridges';
import { spec, blendSpec, resolve, framing, cameraLeft, sceneName, framingBlend, widthClass, HS, STRETCH_COUNT, featherOf, REF_PX } from './compose';
import { VEILS, TRAIL, LIFE } from './shaders';
import { paletteName } from './palette';
import { figureMeta, registerSets } from './figures';
import { el } from '../elements';
import { createFigureSource, type FigureSource } from './figure-source';
import { SETS } from './sets';
import { framingAt, pageSpec, layerScaleAt } from './compose';
import type { Distance, Framing, Resolved, Spec, WidthClass, WindowKind } from './compose';
import type { FigureMeta, LifeKind, LifeOut, Pt } from './figures';
import type { FigureImage, FigureSlot, LifeTable, PresentU, PresentWindow, Renderer, SceneBase, StageU } from './renderer';
import { elementOn } from '../elements';
import type { LandscapeHandle, LandscapeStats, LandscapeTargets, Mode, MountOptions, PanOptions } from '../types';

registerSets(SETS);   // the figure sets, on the main thread (the worker registers its own)

export { stripSVG } from './strip';
export { PALETTES, PIGMENTS } from './palette';
export { framingAt } from './compose';

/** The scene painted at a stretch (DOM-free): 'peak' | 'river' | 'lake' | 'shore' | 'crossing' | 'lone-peak'. */
export function sceneAt(stretch: number): string { return sceneName(stretch); }

/** mountLandscape()'s options: the site's (types.ts MountOptions) and the lab's and QA's (see its JSDoc below). */
export interface EngineOptions extends Omit<MountOptions, 'veil'> {
  veil?: Element | Iterable<Element> | null;
  /** Aliases of strip and closing. */
  head?: Element | null;
  descend?: Element | null;
  figures?: boolean;
  horizonMedia?: string;
  fromStretch?: number | null;
  fromDistance?: Distance;
  fromPresence?: number;
  panDuration?: number;
  arrivalMs?: number;
  veilStrength?: number;
  grain?: number;
  tide?: number;
  pointer?: boolean;
  reducedMotion?: boolean;
  widthClass?: WidthClass;
  /** QA only: the strip window's framing, fixed (world x at its left edge, scene height at its top, CSS px per stretch). */
  frame?: { left: number; top: number; scale: number; light?: number }; // light (P4 sun): which place keeps its sun in a still (-1: none)
}
/** rebind()'s targets: the contract's (types.ts), with the head / descend aliases and a single veil element. */
export type EngineTargets = Partial<Omit<LandscapeTargets, 'veil'>> & Pick<EngineOptions, 'veil' | 'head' | 'descend'>;
/** The handle mountLandscape() returns: the contract's (types.ts LandscapeHandle) and the lab's; QA builds add setState
 *  and qa. */
export interface EngineHandle extends LandscapeHandle {
  setPalette(p: string): void;
  setVeil(els: Element | Iterable<Element> | null): void;
  rebind(o: EngineTargets): void;
  setState?(s: unknown): void;
  qa?(o?: { veils?: boolean }): void;
  stats(): LandscapeStats;
}

const S_SCENE = 2, S_PRESENT = 4, S_MEASURE = 8, S_SCROLL = 16, S_ALL = 31;   // dirty flags
const ARRIVE_END = 1.7;   // s, the bloom is over (matches the shader's "settled")
// P2 "Morning opens" (elements.ts morning): Home's first full load of a session runs the arrival a little longer, to
// MORN_END: the light rises and opens, the mist parts, the silk unfurls (shaders.ts uMorn); the waterfall's own lights
// come up with it (the hand-off: no separate glint). On phones (< 768 px) the same morning runs in 1.6 s, inside the
// plain bloom's 1.7 s, so phones never get a longer arrival.
const MORN_END = 2.3;
const MORN_PHONE = 1.6;
const MORN_SUNUP = 1.8;   // morning s: the light has risen (shaders.ts mornE ~1): the name's swash catches it (swash.ts)
const MORN_KEY = 'ink:morning';
const firstMorning = () => {
  try {
    if (sessionStorage.getItem(MORN_KEY)) return false;
    sessionStorage.setItem(MORN_KEY, '1');
  } catch {
    /* private mode: every load is a first load */
  }
  return true;
};
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
const PRESENT_SLOW = 30;  // 4b: plain presents (scroll, drift) are sampled too, by how long the GPU was still seen painting
                          // each one (a lower bound of its cost, to the frame): this mean is < 30 fps (governPresent)
const RESERVE = 0.9;      // a veil this strong is a paper reserve for small print (see measureVeil)...
const RESERVE_FEATHER = 0.5;  // ...with half the feather...
const RESERVE_IN = 24;    // ...reaching its strength once this many CSS px of its lines are on screen
const BAND_TOL = 160;     // 4b, living veils: a band of lines this much wider or narrower than the one above starts its own
const BAND_MIN = 100;     // ...once it is this tall (textBands)
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
const FIG_KEEP = 6;       // figure layers cached (per stretch x composition x scale x width class x palette)
// A window shows a layer drawn at another scale only between these magnifications: a closing within them shares the
// strip's layer (a mipmapped layer minifies cleanly), and a stand-in must lie within LAYER_STANDIN (never soft or jumpy)
const LAYER_SHARE = [0.6, 1.16];
const LAYER_STANDIN = [0.4, 1.16];
// Window feathers, CSS px (painted by the engine): top out of paper, bottom into paper; a document's strip half.
// (compose.ts owns them: the band framings keep summits and ground clear of them.)
// The deferred first frame under the old page wash (retired in round 3; kept so an old boot script
// that still covers the page cannot catch the first GPU frame mid-reveal).
const REVEAL_EVENT = 'ink:reveal';
const FLOOD_TYPE = ':active-view-transition-type(ink)';
const COVERED = 'is-covered';
const DEFER_MAX = 1500;
const FORCED = new Set<unknown>(['hero', 'horizon', 'closing']);
// 4b, the living ground (body[data-ground="living"]: Home and Work; every other page is 4a). On wide screens the page's
// own scene is painted once, full-bleed, into three DEPTH LAYERS (far: the sky and the far ranges; middle: the host
// and, on the river, the water and the town; near: the near crags, Home's traveller and hut), each with real coverage.
// The present pass sinks each layer at its own rate as you scroll, so the camera seems to rise through cloud: the near
// crags drop away first, the middle peaks settle low over a sea of mist, the far ranges barely move. Near the page's end
// the camera comes back down to the opening composition behind "Next: …". A scroll never repaints a layer.
// Below 1200 px, and wherever no hardware GPU paints it (Canvas2D, a software rasteriser: stageOn), the strip stays a
// window that leaves at a slower rate (paper below), and the closing shows the opening.
// (The demo's 33 URL tunables over these numbers are not ported: a shared URL could thin the reading veils.)
const STAGE_IDS = ['stage0', 'stage1', 'stage2'];
const GLIDE_TAU = 150;      // ms: after a pan, and when one combined layer gives way to the three, the pose glides to
                            // where the scroll puts it (an exponential approach) instead of jumping
const HOLD_MS = 180;        // ms (round 3): a pan from a lifted pose first brings the camera down to the opening on the three
                            // layers (present-only, eased to exactly 0), and only then does the one combined layer take over:
                            // its planes all stand at one depth, so switching on a lifted pose jumped (shorter for a small pose)
/** The living ground's numbers (STAGE, per place STAGE_AT): see each one's comment there. */
interface StageTunables {
  split: number[];
  sink: number[];
  reach: number;
  ease: number;
  seaK: number;
  soft: number;
  billow: number;
  haze: number;
  hazeK: number;
  anchor: number;
  cluster: number;
  slide: number;
  slideAt: number[];
  curtain: number;
  reveal: number;
  revealAt: number[];
  /** [world x (stretches), scene height] points that must come out whole. */
  arch: [number, number][] | null;
  cloud: number;
  cloudAt: number[];
  rise: number;
  body: number[];
  descend: number;
  vmax: number;
  lead: number;
  descAt: number[];
  still: number;
  core: number;
  feather: number;
  swell: number;
  clear: number;
  far: number;
  sky: number;
  drift: number;
  lag: number;
}
const STAGE: StageTunables = {
  split: [2, 3],              // the first plane of the middle layer and of the near one (far: 0..1, middle: 2, near: 3..4)
  sink: [0.05, 0.17, 0.26],   // each layer's sink once the camera has settled (viewport heights): far, middle, near. The
                              // near layer parks low instead of dropping out, and the sea of mist keeps to the deepest
                              // sink, so whatever stood above the sea in the opening still stands above it at rest (Home:
                              // the right massif with the hut and the traveller, low at the right, over the sea)
  reach: 1,                   // the camera settles over this much scroll (viewports), easing out: then it is still
  ease: 2,                    // that ease's power: progress = 1 - (1 - scrolled / reach) ^ ease (the start follows the scroll)
  seaK: 1,                    // the sea's strength (at rest its surface is the strip's own bottom edge: 4a's feather)
  soft: 0.06,                 // its surface's softness (viewport heights) and...
  billow: 0.035,              // ...its billows' amplitude
  haze: 0.56,                 // the haze deck between far and middle once settled (from the top)...
  hazeK: 0.75,                // ...and its strength (none at rest)
  anchor: -1,                 // the world x (stretches) brought to the outer edge of the reading column's veil once settled
                              // (the scene steps sideways under the cloud); -1 = no sideways step
  cluster: 0,                 // ...and the width (stretches) of the cluster that follows it: never stepped off the screen
  slide: -1,                  // a fixed sideways step instead (CSS px at 1440, scaled with the width); -1 = from `anchor`
  slideAt: [0.38, 0.52],      // the scroll (viewports) over which the step is taken, inside the cloud's thick span
  curtain: 0,                 // a place with an anchor: once stepped, its middle and near layers dissolve into mist left
                              // of the anchor (a billowing curtain), so the margin holds one whole cluster whatever text
                              // passes beside it; it lifts again for the end pose (round 4: once the place's `arch` is
                              // clear of every text veil, clearing leftward from the anchor over...
  reveal: 0.9,                // ...this many seconds, rate-limited both ways, so it never pops in within one wheel tick)
  revealAt: [0.45, 1],        // (final review r1, item 3) and with the scroll: over this part of the descent (its linear
                              // progress, descP) the front sweeps the arch east to west whatever the text's veils, so the
                              // bridge grows out of the mist across the closing's run-in (~280 px at 1440) instead of
                              // coming in whole on the last wheel tick; a veil still over its crown there is the text's
                              // own mist, which clears as the text scrolls on (motion only: reduced motion and Still
                              // switch once, when the clearance rule says the arch comes out whole, or at the end)
  arch: null,                 // a place's landmark that must come out whole (world x in stretches, scene height): its points
                              // are checked against the text's veils before the curtain lifts (Work: the bridge's west
                              // foot, crown and east end)
  cloud: 0,                   // the cloud the camera rises through (0..1): it covers the middle and near layers mid-lift
  cloudAt: [0.1, 0.3, 0.62, 0.88],   // ...thickening over the first two scroll marks, thinning over the last two
  rise: 1,                    // mid-lift (cloudAt's profile) the sky deck thickens by this much (x its strength): the open
                              // sky beside the text drifts with cloud while the camera passes through it, then clears
  body: [0.45, 1],            // the sea's body (its drifting banks under the surface): strength once settled, and mid-lift
  descend: 1,                 // 1: the camera comes back down to the opening as the closing comes up (the opening framed
                              // behind "Next: …": its strip's bottom edge on the closing's, the sea at the footer); 0: stays
  vmax: 0.5,                  // ...but no layer ever sinks faster than this fraction of the scroll (the lift's own peak):
                              // the descent runs over at least 3x its drop (smoothstep peaks at 1.5x its mean) and never
                              // longer than the closing's run-in; beyond that the far layer's end is framed higher, and a
                              // place with a cloud takes the rest of its middle and near layers' drop inside it (descAt)
  lead: 0,                    // (round 4) the descent may start this many viewports before the closing's top shows: 0 =
                              // as the closing comes into view, at every size (round 3's `dmax` 1.6 started it ~1.1
                              // screens early on tall windows, through the reading)
  descAt: [0.02, 0.3, 0.55, 0.88],  // (round 4) a place with a cloud, when its drop is larger than the speed limit allows:
                              // over the descent (0..1 of its scroll) the cloud thickens over the first two marks and
                              // thins over the last two; the middle and near layers go under it, take the rest of their
                              // drop (the camera comes down through the cloud) and come out of it on the opening framing
  still: 0.25,                // a still, settled stretch (viewports) between the lift and the descent. A page too short
                              // for lift + still + descent lifts less (its sinks and reach scale down together, so the
                              // lift keeps its speed)
  core: 40,                   // living veils: solid paper this far around the text's own lines (CSS px)...
  feather: 56,                // ...then a torn mist edge this wide...
  swell: 72,                  // ...whose line swells in and out over this much (CSS px: up to 28 in, 44 out), so a
                              // column of text never leaves a ruled edge (the swell travels with the words)...
  clear: 170,                 // ...and the pale mist and the sky deck thin out over this much beyond it (no paper lane)
  far: 0.5,                   // the far layer's resolution (it is soft: half the buffer's, a quarter of its memory)
  sky: 0.45,                  // the sky deck's strength (the drift, gently perceptible in open sky; every page)
  drift: 1.25,                // the drift clock (x 4a's; every page)
  lag: 0.55,                  // below 1200 px: the strip's painting leaves at this rate of the scroll (inside its box)
};
// Per place (stretch). Home keeps STAGE's numbers. The river town is the middle layer (its near layer holds nothing on
// screen), so the sea keeps to the town's sink; the town east of the bridge and its boat (the two-storey house, the
// moored boats, the pollarded willow, the punt's lane: u 1.755-1.93) is brought to the margin beside the reading column
// under a cloud that is thick only while the step is taken, and a curtain of mist keeps the rest of the town, the
// bridge whole, out of the reading (the margin holds that one cluster whatever passes beside it); the bridge comes out
// of the mist at the end. (Final review r1, item 2: the anchor was u 1.625, where the arch comes down to the far bank,
// so the margin held the arch's east half as a sheared stump beside the reader for 3-4 screens.)
// (round 4: `arch`, the bridge's west foot, crown and east end, measured on the painting at 1440 and 2560)
const STAGE_AT: Record<number, Partial<StageTunables>> = { 1: { sink: [0.06, 0.24, 0.24], anchor: 1.755, cluster: 0.175, cloud: 1, cloudAt: [0.25, 0.37, 0.53, 0.65], curtain: 1,
  arch: [[1.482, 0.204], [1.572, 0.323], [1.655, 0.291]] } };
const PLACE_KEYS = ['sink', 'anchor', 'cluster', 'cloud', 'cloudAt', 'curtain', 'arch'] as const;

const live = new WeakMap<HTMLCanvasElement, EngineHandle>(); // canvas -> controller: one live landscape per canvas
// QA builds only (the probes' judging hooks: setState, qa, and stats().veils / memory). The bundler inlines the flag,
// so a production build carries none of them (design-demo/README "Port to Next.js": never ported to production).
const QA = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_INK_QA === '1';

/**
 * Mount the landscape on a fixed, full-viewport <canvas>.
 * Safe to call again on the same canvas (the previous mount is destroyed first), so it survives
 * React Strict Mode's mount → unmount → mount.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object}  [opts]
 * @param {number}  [opts.stretch=0]       Position along the one continuous handscroll. Each page has its own
 *                                         stretch (home 0, work 1, writing 2, résumé 3, contact 4, 404 5).
 *                                         Each stretch is a scene (sceneAt): peak, river, lake, shore, crossing,
 *                                         lone-peak. Seams pass through water or mist (round 5: one river).
 * @param {'level'|'high'|'deep'} [opts.distance='level']  Composition preset ("three distances"). Round 5: every page
 *                                         passes the one world composition (compose.ts WORLD).
 * @param {number}  [opts.presence=1]      0..1. How strongly the landscape shows (round 5: WORLD's, on every page).
 * @param {Element|null} [opts.strip]      [data-landscape="strip"]: window 1, the page's own scene at its strip framing,
 *                                         palette and figures, the drifting mist and the cursor's wake. Alias: `head`.
 * @param {Element|null} [opts.closing]    [data-landscape="closing"]: window 2, the page's own place once more (DESIGN
 *                                         11.B), never the road to the next one: a small version of its opening, with
 *                                         its figures; on a short page whose closing shares a screen with its strip, a
 *                                         different view of the same place without the strip's figures (compose.ts frame.closing.twin). Its
 *                                         figure layer is drawn at its own scale when that differs from the strip's.
 *                                         Alias: `descend`. With neither window, the first viewport acts as one
 *                                         full-screen window (round 3's hero; the lab).
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
 * @param {{left:number, top:number, scale:number}} [opts.frame]  QA builds only (round 5): the strip window looks at a
 *                                         fixed slice of the world (world x at its left edge, scene height at its top,
 *                                         CSS px per stretch), its figure layer drawn at that scale: the story map's
 *                                         stills (tools/build-stills.ts) and the panorama of the whole scroll.
 * @param {'living'|''} [opts.ground]     4b (body data-ground): 'living' makes the page's own scene its ground. Wide
 *                                         screens painted by a hardware GPU (WebGL, not a software rasteriser): full-bleed
 *                                         depth layers that sink as you scroll (STAGE), living veils on the text's own
 *                                         lines, the closing shown by the stage (it ends on the opening itself); the
 *                                         governor gives the stage up if its presents stay slow at the lowest quality.
 *                                         Otherwise (narrower, Canvas2D, software WebGL): the strip's painting sinks inside
 *                                         its box as it leaves; the closing, as on every page, shows the page's own place.
 *   `vistas` (round 3) and `banks` (round 2) are ignored.
 *
 * @returns {{ mode: 'webgl'|'canvas2d'|'static',
 *            panTo(stretch:number, o?:{duration?:number, distance?:string, presence?:number, ease?:'whip'|'cubic-out', cloud?:boolean}):Promise<void>,
 *            sweep(o?:{dir?:1|-1, duration?:number}):Promise<void>,
 *            setPalette(p:'ink'|'misted'|'rich'):void,
 *            prepare(stretch:number, o?:{distance?:string, presence?:number}):Promise<void>,
 *            rebind(o:{strip?, closing?, keepout?, veil?, wake?, horizon?, ground?}):void, qa(o:{veils?:boolean}):void,
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
 *   `prepare`: draws that stretch's figure layer (current width class and palette) off the main thread, for the
 *     composition `o` gives (the destination page's data-distance / data-presence), else the stretch's own page
 *     composition (SCENES[k].page); resolves when it is ready, at once if it has none or it is cached. Idempotent. The
 *     router calls it on prefetch. Figure layers are always drawn for the composition and scale they are shown at.
 *   `rebind`: after a route swap (aliases head/descend; vistas ignored). Re-reads the boxes and framings and
 *     recomputes hzK before the first present (a page entered mid-scroll shows the right state at once).
 *   `setState`: QA override: 'hero' forces hzK 0, 'horizon' 1, 'closing' puts the closing framing in the strip;
 *     null (or 'vista') = scroll-driven.
 *   `setStill(true)`: drift, wake, sweeps, the bloom and pans stop (pans snap). `pause()` is a hard freeze.
 *   `mode` is live: it changes to 'canvas2d' if the WebGL context is lost for good (a bubbling `landscape:mode`
 *     event on the canvas).
 *   `stats()` (QA): counters (frames, scenes, presents, drafts), `palette`, `widthClass`, `windows` ({ strip,
 *     closing }: top, height, visible), `hzK`, `figures` ({ [stretch]: 'none'|'pending'|'ready' }), `figureMs`,
 *     `framing` ({ strip, closing }: worldLeft, worldTop, scale, focus), `figureSlots` (what each window variant shows),
 *     `figureLayers` (the cached layers' keys and status), `stretch`, `scene`, `state`, `wake`, `still`,
 *     `sweeping`, `ambient`, `drift`, `draft`, `pending`, `running`.
 */
export function mountLandscape(canvas: HTMLCanvasElement, opts: EngineOptions = {}): EngineHandle {
  const prev = canvas && live.get(canvas);
  if (prev) prev.destroy();
  if (!canvas || typeof canvas.getContext !== 'function') return inert();
  const handle = controller(canvas, opts);
  live.set(canvas, handle);
  return handle;
}

function inert(): EngineHandle {
  return {
    mode: 'static',
    panTo: () => Promise.resolve(),
    sweep: () => Promise.resolve(),
    setPalette() {},
    prepare: () => Promise.resolve(),
    rebind() {},
    setVeil() {},
    setStill() {},
    refresh() {},
    pause() {},
    resume() {},
    destroy() {},
    stats: () => ({ mode: 'static', state: null, hzK: 0, scene: '', wake: 0, still: false, figures: {}, windows: {} }),
  };
}

// (undefined and null coerce to NaN and 0, both refused)
const num = (v: number | string | null | undefined, d: number): number => (Number.isFinite(+v!) && v !== null && v !== '' ? +v! : d);
const toList = (els: Element | Iterable<Element> | null | undefined): Element[] => (!els ? [] : els instanceof Element ? [els] : [...els].filter((e) => e instanceof Element));
const elOr = (a: unknown, b: unknown): Element | null => (a instanceof Element ? a : b instanceof Element ? b : null);
const easeWhip = (t: number) => (t >= 1 ? 1 : (1 - Math.pow(2, -9 * t)) / (1 - Math.pow(2, -9))); // fast attack, long decay
const easeCubic = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(1 - t, 3));
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const sstep = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const r3 = (v: number) => Math.round(v * 1000) / 1000;

// ---------------------------------------------------------------- the controller's state, typed
/** A box on the page, viewport CSS px (relative to the canvas). */
interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}
/** A rect by its edges (a DOMRect, or a text block's lines). */
interface Edges {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
/** A text box inside its element's box: offsets of its left, top, right and bottom edges. */
interface Offsets {
  l: number;
  t: number;
  r: number;
  b: number;
}
/** A window's framing (framingOf): its own (compose.ts framingBlend), or the first viewport's in full mode. */
type ViewFraming = (Framing & { full?: false }) | (Framing & { full: true; hs: number; wvis: number });
/** The figure layers drawn for the strip (and the stage), or for the closing (at its own scale). */
type Variant = 'strip' | 'closing';
/** A window (mkWin): a box on the page, painted at its own framing into its own view. */
interface Win {
  kind: WindowKind;
  id: string;
  el: Element | null;
  box: Rect | null;
  vis: boolean;
  near: boolean;
  /** The text's right edge inside the box (box px), where the text overlaps it. */
  keepR: number | null;
  keepU: Float32Array | null;
  viewU: Float32Array | null;
  wakeOK: boolean;
  doc: boolean;
  note: number[] | null;
  noteEl: Element | null;
  fr: ViewFraming | null;
  key: string;
  buf: Float32Array | null;
  samples: number;
  draft: boolean;
  pending: boolean;
  painted: boolean;
  want: boolean;
  /** 4b, living below 1200 px: how far the strip's painting has sunk inside its box (0..1). */
  sink?: number;
}
/** The horizon band's view. */
interface HorizonView {
  id: string;
  key: string;
  buf: Float32Array | null;
  samples: number;
  draft: boolean;
  painted: boolean;
  pending: boolean;
  want: boolean;
  view: Float32Array;
}
/** One of the stage's three depth layers. */
interface StageLayer {
  id: string;
  key: string;
  painted: boolean;
  pending: boolean;
  draft: boolean;
  /** Viewport CSS px at the page's top: [x0, y0, x1, y1]. */
  crop: number[];
  px: number[];
}
/** The geometry a pan's hold shows (the pose it started from). */
interface HoldGeometry {
  bottomDoc: number;
  crest: number;
  slidePx: number;
  curtX: number;
  curtSweep: number;
  endSink: number;
  endMid: number;
  jump: number;
  liftF: number;
}
/** The living ground's stage (`st`): its layers, its framing and its pose (see the comments where it is made). */
interface Stage extends HoldGeometry {
  layers: StageLayer[];
  buf: Float32Array | null;
  bufC: Float32Array | null;
  samples: number;
  view: Float32Array;
  fr: Framing | null;
  left: number;
  wvis: number;
  wvisX: number;
  ext: number;
  ok: boolean;
  single: boolean;
  alloc: boolean;
  pendingSplit?: boolean;
  geo?: string;
  topDoc: number;
  stripVis: boolean;
  y: number;
  prog: number;
  progT: number;
  desc: number;
  descT: number;
  slideK: number;
  slideT: number;
  cloudK: number;
  cloudT: number;
  midK: number;
  midT: number;
  glide: boolean;
  sepK: number;
  span: number;
  curtH: number;
  holdP: number;
  holdC: number;
  holdS: number;
  holdG: HoldGeometry | null;
  descP: number;
  jumpK: number;
  jumpT: number;
  hideK: number;
  hideT: number;
  revK: number;
  revT: number;
  partK: number;
  archPx: number[][] | null;
  archNow: number[][] | null;
  bands: number[][];
  archGap: number;
  offsets: Float32Array;
  k: Float32Array;
  sea: Float32Array;
  rects: Float32Array;
  cloud: Float32Array;
  curt: Float32Array;
}
/** A pan in progress. */
interface Tween {
  from: number;
  to: number;
  fromSpec: Spec;
  toSpec: Spec;
  t: number;
  dur: number;
  ease: 'cubic' | 'whip';
  cut: boolean;
  resolve: () => void;
  /** Set on its first frame: its clock, and its hold (from a lifted pose: HOLD_MS) and how much of it has passed. */
  clock?: number;
  hold: number;
  held: number;
  /** Final round: the last frame drawn was before the splice (a long jump's cross-dissolve grabs it). */
  pre?: boolean;
}
/** A mist sweep in progress. */
interface Sweep {
  t: number;
  dur: number;
  dir: number;
  seed: number;
  resolve: () => void;
}
/** A figure layer (one per stretch x composition x scale x palette x resolution x width class). */
interface Layer {
  key: string;
  stretch: number;
  scale: number;
  meta: FigureMeta;
  status: 'pending' | 'ready' | 'failed';
  img: FigureImage | null;
  readyAt: number;
  uploaded: boolean;
  waiters: (() => void)[];
  used: number;
  shownSince: number;
  life?: LifeOut[];
  sprites?: number[][];
}
/** A figure layer on show: the layer (or a stand-in for the key `want`), its alpha and the window variant it is for. */
interface Slot {
  L: Layer;
  want?: string;
  v: Variant;
  k: number;
}
/** A view small life may lie in (lifeU): its canvas uv map, its clip, its planes and arrival. */
interface LifeView {
  t: number;
  lo: number;
  hi: number;
  clip: ArrayLike<number>;
  bloom: boolean;
  vr: Variant;
  map: (w: number[]) => number[];
  /** P3: canvas uv -> the world point (as map's inverse), the ridge column of a canvas uv x, and the ridges (water). */
  inv: (u: number, v: number) => [number, number];
  col: (u: number) => number;
  rid: () => { buf: Float32Array | null; samples: number };
}
/** A life anchor placed in a view this frame. */
interface LifeEntry {
  a: LifeOut;
  n: number;
  L: Layer;
  v: LifeView;
  rc: number[];
  k: number;
  sprite: { id: string; px: number[]; atlas: number[] } | null;
  area: number;
  /** (final round) the plum's arrival: how far its ink has bloomed from the root (1 = whole) */
  rev?: number;
}
/** A figure layer that is drawn and uploaded (ready()). */
type ReadyLayer = Layer & { status: 'ready' };
/** QA's forced states. */
type Forced = 'hero' | 'horizon' | 'closing';
/** A timer's id (the project's types include Node's timers; in the browser it is a number). */
type Timer = ReturnType<typeof setTimeout>;

function controller(canvas: HTMLCanvasElement, opts: EngineOptions): EngineHandle {
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const mqFine = matchMedia('(pointer: fine)');
  const mqHz = matchMedia(typeof opts.horizonMedia === 'string' && opts.horizonMedia ? opts.horizonMedia : HZ_MEDIA);
  let reduced = typeof opts.reducedMotion === 'boolean' ? opts.reducedMotion : mqReduce.matches;
  let still = !!opts.still;
  const quantized = () => reduced || still;

  // ---------------------------------------------------------------- renderer + fallbacks
  let surface = canvas;      // the element we draw on (a sibling clone if WebGL died on `canvas`)
  // (null only before the first paint and once destroyed: what paints (draw() and below) runs only while running())
  let renderer: Renderer | null = null;
  let mode: Mode = 'static';
  let lostTimer: Timer | 0 = 0, readyTimer: Timer | 0 = 0;
  let hiddenDisplay: string | null = null;
  const hooks = {
    lost() { stop(); clearTimeout(lostTimer); lostTimer = setTimeout(() => toCanvas2D(), 3000); },
    restored() { clearTimeout(lostTimer); W = H = 0; dropLayers(); resize(true); request(S_ALL); },
    failed() { clearTimeout(lostTimer); toCanvas2D(); },
  };
  try {
    renderer = createGL(canvas, hooks);
  } catch (err) {
    renderer = null;
    if (err && (err as TaintedError).tainted) cloneSurface();
  }
  if (renderer) mode = 'webgl';
  else {
    renderer = createCanvas2D(surface);
    mode = renderer ? 'canvas2d' : 'static';
  }

  function cloneSurface() {
    // A canvas that ever held a WebGL context cannot give a 2D one: paint on a sibling copy.
    // (Insert next to it instead of replacing it, so a framework that owns `canvas` is undisturbed.)
    const fresh = canvas.cloneNode(false) as HTMLCanvasElement;
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
  // the living stage given up for this mount: its plain presents stayed slow at the lowest quality (governPresent)
  let stageVeto = false;
  const grainK = Math.max(0, num(opts.grain, 1)) * 0.4;
  const tide = Math.min(1, Math.max(0, num(opts.tide, 1)));
  const veilK = Math.min(1, Math.max(0, num(opts.veilStrength, 0.72)));
  const ambientWanted = opts.ambient !== false;
  // 4b: the living ground (see STAGE), its tunables (demo URL params, main.js) and its state
  let ground: 'living' | '' = opts.ground === 'living' ? 'living' : '';
  const T = { ...STAGE };
  const placeT = () => {   // the place's own numbers (the destination's during a pan)
    const at = STAGE_AT[Math.round(tween ? tween.to : stretch)] || {};
    for (const k of PLACE_KEYS) (T as Record<(typeof PLACE_KEYS)[number], unknown>)[k] = at[k] ?? STAGE[k];
  };
  const living = () => ground === 'living';

  // ---------------------------------------------------------------- P3 "Life that answers you" (elements.ts)
  // 1. stir: ring sets on the open water, kept in the world (so they ride the page's scroll) with the view they lie in
  const STIR_N = 4;
  const STIR_LIFE = [1.4, 1.4, 4.4];   // s, per kind: the pointer's dwell, a tap's drop, the pole's / the bow's (shaders.ts lifeStir)
  const STIR_USER = 2;                 // (final round) at most two of the pointer's rings alive in a place
  const STIR_DWELL = 450;              // (final round) ms the pointer must rest over the water for one ring
  interface Stir { wx: number; wy: number; t: number; t0: number; seed: number; kind: number }
  const stirs: Stir[] = [];
  const stirU = new Float32Array(16).fill(-1), stirKU = new Float32Array(4);
  let stirAt = 0, stirTapAt = 0, stirPX = -1e9, stirPY = -1e9, stirSeq = 0;
  let dwellTimer: ReturnType<typeof setTimeout> | null = null;
  const autoNext = new Map<string, number>();     // 6. contactLife: when each auto drop falls next
  // the view life lies in, and how to read its water from a canvas point (lifeU)
  let lifeHit: LifeView | null = null;
  // 2. plumGust
  const gustU = new Float32Array([-1, 0, 0, 0]), gust2U = new Float32Array(4);
  let gust: { t0: number; dir: number; u: number; v: number } | null = null, gustAt = -1e9;
  let plumLimbUV: number[][] | null = null, petalR = 0;
  let lastPX = 0, lastPT = 0, pvx = 0;
  // (3. parallax: CUT in the final round: it turned the handscroll into a cut-paper diorama)
  // 7. stillSettle: the drift easing to rest before Still takes hold
  const SETTLE_MS = 800;
  let settling = false;
  let palette = paletteName(opts.palette);
  const figuresOn = opts.figures !== false;

  const target0 = num(opts.stretch, 0);
  const hasFrom = !quantized() && Number.isFinite(+opts.fromStretch!) && opts.fromStretch !== null;
  let stretch = hasFrom ? +opts.fromStretch! : target0;
  let curSpec = hasFrom
    ? spec(opts.fromDistance ?? opts.distance, opts.fromPresence ?? opts.presence)
    : spec(opts.distance, opts.presence);
  let tween: Tween | null = null;

  let arriving = !quantized() && opts.arrival !== 'none';
  // P2: the morning plays once per session, on Home only, inside the ink bloom (never on a route change: no arrival)
  const morning = arriving && !hasFrom && !(QA && opts.frame) && Math.round(target0) === 0 && elementOn('morning') && firstMorning();
  // (the morning's own clock: on phones it runs MORN_END / MORN_PHONE faster, so it ends inside the plain bloom)
  const mornK = () => ((cssW || innerWidth) < 768 ? MORN_END / MORN_PHONE : 1);
  const mornNow = () => (morning && arriving ? arrive * mornK() : 9);
  let sunUp = false;   // has 'ink:sunup' been sent (once per load: the light is up, on a morning or a plain arrival)?
  const sendSunUp = () => {
    if (sunUp) return;
    sunUp = true;
    try { dispatchEvent(new CustomEvent('ink:sunup', { detail: { morning } })); } catch { /* old browsers: the swash's own timer */ }
  };
  let arrive = arriving ? 0 : 9;      // shader seconds: the bloom is authored as 1.25 s
  let arriveSeen = false;             // has any of the bloom been painted while the page was visible?
  const arriveRate = 1250 / Math.min(20000, Math.max(300, num(opts.arrivalMs, 1250)));

  let cssW = 0, cssH = 0, W = 0, H = 0, aspect = 1.6, bufS = 1;
  let rect = { left: 0, top: 0, width: 1, height: 1 };
  const clsForced = ['wide', 'tablet', 'phone', 'short'].includes(opts.widthClass as string) ? opts.widthClass! : null;   // lab / QA only
  const classNow = () => clsForced || widthClass(innerWidth, innerHeight);
  let cls = classNow();
  // QA only (the panorama tool): the strip window looks at a fixed slice of the world at a fixed scale, its figure layer
  // drawn at that scale, so a row of such windows stitches into the whole handscroll at one scale
  const qaFrame = QA && opts.frame && [opts.frame.left, opts.frame.top, opts.frame.scale].every(Number.isFinite) ? opts.frame : null;
  // a still's lights (shaders.ts uStillL): 0 a live page; 1 Home's sun only (the M default); 2 none; 3 + k place k's
  const stillLight = () => {
    if (!qaFrame) return 0;
    const l = qaFrame.light;
    if (typeof l !== 'number' || !Number.isFinite(l)) return 1;
    return l < 0 ? 2 : 3 + Math.round(l);
  };
  let time = 40;             // ambient clock, seconds (never jumps after a pause)
  let driftT = 1;            // 0..1: the drift eases out after IDLE_MS without input, and back in
  let lastInput = performance.now();
  const veil = new Float32Array(VEILS * 4).fill(-1);
  const veilS = new Float32Array(VEILS);
  const veilF = new Float32Array(VEILS).fill(1);   // each veil's feather, x the shared one (a reserve's is tighter)
  let veilEls = toList(opts.veil);
  // a reserve's text box, as offsets inside its element's box: re-read when the box or the fonts change
  const textBoxes = new WeakMap<Element, { w: number; h: number; f: number; m: boolean; box: Offsets | null }>();
  let fontGen = 0;
  const onFonts = () => { fontGen++; request(S_MEASURE | S_SCROLL); };

  // ---------------------------------------------------------------- windows and views
  // A window: a box on the page, painted at its own framing. A view: its painting (and the horizon's).
  const mkWin = (kind: WindowKind, el: Element | null): Win => ({
    kind, id: kind, el, box: null, vis: false, near: !!el, keepR: null, keepU: null, viewU: null, wakeOK: false, doc: false, note: null, noteEl: null,
    fr: null, key: '', buf: null, samples: 0, draft: false, pending: false, painted: false, want: false,
  });
  const wins = [mkWin('strip', elOr(opts.strip, opts.head)), mkWin('closing', elOr(opts.closing, opts.descend))];
  const hzv: HorizonView = { id: 'horizon', key: '', buf: null, samples: 0, draft: false, painted: false, pending: false, want: false, view: new Float32Array(4) };
  // the living ground's stage: three depth layers, one framing (the strip's, extended to the viewport)
  // Each layer is painted into its own view: the far one (opaque: sky, far ranges, the keep-out's mist) over the whole
  // viewport at T.far of the buffer's resolution; the middle and near ones (transparent) only over the box where they hold
  // anything (`crop`, viewport CSS px at the page's top: right of the keep-out's mist, from their highest crest or cloud
  // belt down to where the sea always covers them), at full resolution. While a pan or the bloom runs, one combined
  // layer is painted, full size, into the far layer's view.
  const st: Stage = {
    layers: STAGE_IDS.map((id) => ({ id, key: '', painted: false, pending: false, draft: false, crop: [0, 0, 1, 1], px: [0, 0] })),
    buf: null, bufC: null, samples: 0, view: new Float32Array(4), fr: null, left: 0, wvis: 1, wvisX: 1, ext: 0, ok: false, single: true, alloc: false,
    topDoc: 0, bottomDoc: 0, stripVis: false, y: 0, prog: 0, progT: 0, desc: 0, descT: 0, endSink: 0,
    slidePx: 0, slideK: 0, slideT: 0, cloudK: 0, cloudT: 0, midK: 0, midT: 0, curtX: -1, curtSweep: 0,
    glide: false, sepK: 1, liftF: 1, span: 0, crest: 0,   // the pose glides to its targets (after a pan); the far layer's own depth (0 while combined)
    curtH: 1, holdP: 0, holdC: 0, holdS: 0, holdG: null,   // a pan's hold (HOLD_MS): the curtain's share, the pose and cloud it started from, the geometry it shows
    // (round 4) the descent: its linear progress, the middle and near layers' end and the part of their drop taken inside
    // the cloud (`jumpK` 0..1 of it, `hideK` how far they are under it); the curtain's reveal (`revK` follows `revT` at
    // T.reveal's rate) once the arch (`archPx`: at rest, viewport px) is clear of every text band near it (`bands`, doc px)
    descP: 0, endMid: 0, jump: 0, jumpK: 0, jumpT: 0, hideK: 0, hideT: 0, revK: 0, revT: 0, partK: 1, archPx: null, archNow: null, bands: [], archGap: 0,
    offsets: new Float32Array(12), k: new Float32Array(4), sea: new Float32Array(4), rects: new Float32Array(12), cloud: new Float32Array(4),
    curt: new Float32Array(4),
  };
  /** The stage replaces the strip and the closing windows: a living page on a wide screen, with a strip to frame from,
   *  painted by a hardware GPU. (Final review r1, item 8: the stage's full-viewport present on every scroll frame has no
   *  floor on a software rasteriser or in Canvas2D, where it ran at 10-20 fps behind text scrolling at 60; there, and
   *  once the governor has given it up (stageVeto: too slow at the lowest quality), a living page keeps 4a's strip and
   *  closing, which those paths paint well.) */
  const stageOn = () => living() && cls === 'wide' && !fullMode && mode === 'webgl' && !software && !stageVeto && !!wins[0].el;
  /** The stage is on screen (it covers the whole viewport once painted). */
  const stageShown = () => stageOn() && st.ok;
  /** The sea's sink: it keeps to the deepest layer's (so nothing that stood above it in the opening goes under). */
  const seaSink = () => Math.max(T.sink[0], T.sink[1], T.sink[2]);
  let keepEls = toList(opts.keepout);
  let wakeEls = toList(opts.wake);
  let horizonP = clamp01(num(opts.horizon, 0.6));
  let hzOn = mqHz.matches;
  let hzK = 0, hzTarget = 0;
  let forced: Forced | null = null;
  let fullMode = !wins[0].el && !wins[1].el;   // no windows: the first viewport is one (round 3's hero; the lab)
  // the horizon's per-plane sinks and its uniform (sink, foot, ink, squash) x LAYERS
  const crest = new Float32Array(LAYERS);
  const hzU = new Float32Array(LAYERS * 4);
  const hzZero = new Float32Array(LAYERS * 4);

  // the wake (viewport CSS px), its trail, and the uniforms
  const wake = { x: 0, y: 0, tx: 0, ty: 0, s: 0, target: 0, has: false, inWin: false, dirty: false, pushedAt: 0, moving: false, px: 0, py: 0, pushed: false };
  const trail: { x: number; y: number; s0: number; t: number }[] = [];   // newest first
  const trailU = new Float32Array(TRAIL * 4);
  const wakeBox = new Float32Array([2, 2, -1, -1]);
  let wakeRects: DOMRect[] | null = null;
  // the sweep
  let sw: Sweep | null = null;
  let sweepN = 0;
  // (final round, silkVeil) a long jump's cross-dissolve: grab each frame before the splice, then hold the last one
  // over the new place for XF_MS while it dissolves away (xfT: ms since the splice, -1 = none)
  let xfGrab = false, xfT = -1;
  const XF_MS = 340;
  const xfMs = () => (QA && Number((globalThis as { __xfMs?: number }).__xfMs)) || XF_MS;   // (QA: a slow-motion check)
  const sweepU = new Float32Array(4);
  let sweepSeed = 0;

  let raf = 0, timer: Timer | 0 = 0, timerAt = 0, need = 0, clockLast = 0, lastPresent = 0;
  let userPaused = false, hidden = document.visibilityState === 'hidden', onscreen = true, destroyed = false;
  let anyVisible = false, wasVisible = true;   // a window on screen now / something painted on screen at the last present
  // hidden under the old page wash: the first frame waits for the full cover (see DEFER_MAX)
  const heldByWash = () => {
    const h = document.documentElement;
    if (h.classList.contains(COVERED)) return true;
    try { return h.matches(FLOOD_TYPE); } catch { return false; }
  };
  let deferred = mode === 'webgl' && !reduced && heldByWash();
  let deferTimer: Timer | 0 = 0, deferRaf = 0;
  let drawnOnce = false;
  let lastScroll = 0;        // performance.now() of the last scroll event
  let gov: number[] = [], heavyLast = 0;
  let gpuWait = 0, prevPlain = false, govP: number[] = [], polled = false, telling = false;   // governPresent()
  let idleId: number | Timer = 0;
  let lastSlots: Slot[] = [];
  const counts = {
    frames: 0, scenes: 0, presents: 0, drafts: 0, ridges: 0,
    ridgeMs: 0, sceneMs: 0, presentMs: 0,             // CPU time of the last call
    draftAt: 0, fullAt: 0,                            // performance.now() of the last draft / full-quality scene
    figureMs: 0,                                      // the last figure layer's drawing time (worker or idle chunks)
    stageScenes: 0,                                   // 4b: depth-layer paints (each one a scene pass)
  };

  // ---------------------------------------------------------------- figure layers
  // One layer per (stretch, composition, scale, palette, resolution, width class): drawn off the main thread
  // (figures.worker.ts), uploaded once (never while scrolling), cached. A layer is drawn for the composition it is
  // painted into (the windows': curSpec at rest, each end's own during a pan), so its figures stand on the ground and the
  // waterline the window paints, and at the scale of the window that shows it: the strip and the stage at layerScale(k),
  // the closing at its own framing's (closingScale; a phone's close view of the pavilion is drawn at its own scale, not
  // the strip's layer magnified). A set gets the width class too (env.cls), so it may cull what that class never sees.
  // It is shown with an alpha (fades; see figSlots).
  const layers = new Map<string, Layer>();
  let figSrc: FigureSource | null = null;
  let drawnFigs = false;     // the first full scene is up (a layer ready before it follows the bloom instead of fading)
  const figSource = () => (figSrc ??= createFigureSource());
  const layerScale = (k: number) => {
    if (qaFrame) return Math.max(40, Math.round(qaFrame.scale / 40) * 40);
    if (cls === 'wide') return Math.round(Math.min(cssW || innerWidth, 1700) / 40) * 40;
    return layerScaleAt(k, cls, cssW || innerWidth);
  };
  /** The closing's layer scale at stretch k: the strip's when the closing shows it within LAYER_SHARE, else its own
   *  framing's nominal scale (to 40 px). */
  function closingScale(k: number) {
    const s0 = layerScale(k), b = wins[1].box;
    if (!b) return s0;
    const fr = framingAt(k, cls, { width: b.width, height: b.height, twin: twinNow() }, 'closing');
    const m = fr.scale / s0;
    return m >= LAYER_SHARE[0] && m <= LAYER_SHARE[1] ? s0 : Math.max(40, Math.round(fr.nominal / 40) * 40);
  }
  const scaleOf = (k: number, v: Variant) => (v === 'closing' ? closingScale(k) : layerScale(k));
  /** The composition a layer is drawn for: the preset (a blend's dominant one) and the presence to 0.01. */
  const figSpec = (s: Spec) => ({ distance: specName(s), presence: Math.round(s.presence * 100) / 100 });
  /** A stretch's own page composition, as a spec (what the router's destination and the "Next" pan will use). */
  const ownSpec = (k: number) => { const p = pageSpec(k); return spec(p.distance, p.presence); };
  const layerDpr = () => Math.min(2, Math.max(1, Math.round(bufS * 1.34 * 4) / 4));
  const layerKey = (k: number, v: Variant = 'strip', s: Spec = curSpec) => {
    const f = figSpec(s);
    return `${k}|${f.distance}:${f.presence}|${scaleOf(k, v)}|${palette}|${layerDpr()}|${mode}|${cls}`;
  };
  const ready = (L: Layer | null | undefined): L is ReadyLayer => !!L && L.status === 'ready' && L.uploaded;
  /** Stretch k's layer for a window variant ('strip': the strip and the stage; 'closing') and a composition. */
  function layerFor(k: number, create = true, v: Variant = 'strip', s: Spec = curSpec): Layer | null {
    k = Math.round(k);
    if (!figuresOn || mode === 'static' || !renderer || k < 0 || k >= STRETCH_COUNT) return null;
    const meta = figureMeta(k);
    if (!meta) return null;
    const key = layerKey(k, v, s);
    let L = layers.get(key);
    if (L || !create) { if (L) L.used = performance.now(); return L || null; }
    const scale = scaleOf(k, v), f = figSpec(s);
    L = { key, stretch: k, scale, meta, status: 'pending', img: null, readyAt: 0, uploaded: false, waiters: [], used: performance.now(), shownSince: 0 };
    layers.set(key, L);
    figSource().request({
      stretch: k, scale, dpr: layerDpr(), palette, distance: f.distance, presence: f.presence, cls, still: !!qaFrame,
      out: mode === 'webgl' ? (renderer.bitmaps ? 'gpu' : 'bytes') : 'bitmap',
    }).then((res) => {
      if (destroyed || layers.get(key) !== L) return;
      L.img = res;
      // 4b small life: the layer's anchors (figures.ts THE LIFE API), and the sprites cut out of it (the worker's 'gpu'
      // output; uploaded with the layer as `${key}#${i}`): their sizes, for the present pass's filtering
      L.life = Array.isArray(res.life) ? res.life : [];
      L.sprites = (res.sprites || []).map((sp) => [sp.width, sp.height]);
      counts.figureMs = Math.round(res.ms * 10) / 10;
      uploadSoon(L);
    }, (err) => {
      if (layers.get(key) !== L) return;
      console.warn('landscape: figure layer failed', err);
      L.status = 'failed';
      L.waiters.splice(0).forEach((f) => f());
    });
    trimLayers(key);
    return L;
  }
  // a stand-in while a layer is drawn: the same stretch's layer at another palette, width or composition (never a gap),
  // drawn at a scale this window may show it at (LAYER_STANDIN: never a soft magnified one, never figures drawn for a
  // far other scale that would then jump)
  function standIn(k: number, scale: number) {
    let best: Layer | null = null;
    for (const L of layers.values()) {
      if (L.stretch !== k || !ready(L)) continue;
      if (scale && (scale / L.scale < LAYER_STANDIN[0] || scale / L.scale > LAYER_STANDIN[1])) continue;
      if (!best || L.readyAt > best.readyAt) best = L;
    }
    return best;
  }
  // upload a finished layer, but never while the page is scrolling (it waits for a quiet moment)
  function uploadSoon(L: Layer) {
    if (destroyed || !L.img || L.uploaded) return;
    const since = performance.now() - lastScroll;
    if (since < 120) { setTimeout(() => uploadSoon(L), 140 - since); return; }
    if (!renderer || !renderer.figure(L.key, L.img)) { L.status = 'failed'; L.waiters.splice(0).forEach((f) => f()); return; }
    if (mode === 'webgl') L.img = { width: L.img.width, height: L.img.height };   // the bytes live on the GPU now
    L.uploaded = true;
    L.status = 'ready';
    L.readyAt = performance.now();
    // replacing a stand-in (another palette, width or composition of the same layer): no fade, the swap is in place
    if (lastSlots.some((s) => s.want === L.key)) L.shownSince = performance.now() - 1e4;
    // the closing, painted ahead off screen, takes it in idle time, not as it scrolls in
    if (wins[1].painted && !wins[1].vis) wins[1].want = true;
    L.waiters.splice(0).forEach((f) => f());
    request(S_PRESENT);
  }
  // keep what is on show (and what it stands in for), the current stretch's layers, the neighbours' for the "Next" and
  // back pans, a pan's ends and the layer just asked for; the rest go, least recently used first
  function trimLayers(fresh: string) {
    if (layers.size <= FIG_KEEP) return;
    const k = Math.round(stretch);
    const keep = new Set([fresh, layerKey(k), layerKey(k, 'closing'), layerKey(k + 1, 'strip', ownSpec(k + 1)), layerKey(k - 1, 'strip', ownSpec(k - 1))]);
    for (const s of lastSlots) { keep.add(s.L.key); if (s.want) keep.add(s.want); }
    if (tween) keep.add(layerKey(Math.round(tween.to), 'strip', tween.toSpec));
    const old = [...layers.values()].filter((L) => !keep.has(L.key)).sort((a, b) => a.used - b.used);
    while (layers.size > FIG_KEEP && old.length) {
      const L = old.shift()!;
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
  /** The window a slot is for: the strip's layers (and the stage's), or the closing's own (its scale may differ). */
  const variantOf = (w: Win): Variant => (kindOf(w) === 'closing' ? 'closing' : 'strip');
  /** The figure layers on show now, each with its alpha and the window variant it is for: the current stretch's, the
   *  pan's two ends, a neighbour whose layer a window already holds for this composition (never asked for at rest). At
   *  most two per variant; the closing's only while it is near (and not shown by the stage). */
  function figSlots(): Slot[] {
    if (!figuresOn || mode === 'static') return [];
    const now = performance.now();
    const out: Slot[] = [];
    const late = (L: Layer) => {
      if (!L.shownSince) L.shownSince = drawnFigs ? now : now - 1e4;
      return clamp01((now - L.shownSince) / fadeIn());
    };
    // the layer itself, or a stand-in for it ({ L, want: the key it stands in for })
    const show = (k: number, v: Variant, s: Spec, create: boolean): { L: Layer; want?: string } | null => {
      const L = layerFor(k, create, v, s);
      if (ready(L)) return { L };
      const j = Math.round(k), S = standIn(j, scaleOf(j, v));
      return S ? { L: S, want: L ? L.key : layerKey(j, v, s) } : null;
    };
    const c = wins[1];
    const vs: Variant[] = ((c.box && (c.vis || c.want)) || forced === 'closing') && !stageOn() ? ['strip', 'closing'] : ['strip'];
    for (const v of vs) {
      if (tween) {
        // (the destination's closing layer is never asked for mid-pan: the next page brings its own closing)
        const a = show(tween.from, v, tween.fromSpec, false), b = show(tween.to, v, tween.toSpec, v === 'strip');
        const t = tween.t;
        if (a) out.push({ ...a, v, k: (1 - sstep(0, 0.3, t)) * late(a.L) });
        if (b && b.L !== a?.L) out.push({ ...b, v, k: sstep(0.6, 1, t) * late(b.L) });
      } else {
        const k = Math.round(stretch);
        // (a closing whose view holds none of the place's figures, a twin's: no layer of its own is drawn for it)
        if (v === 'closing' && !closingSees(k)) continue;
        let n = 0;
        for (const j of [k, k + 1, k - 1]) {
          if (n >= 2) break;
          const S = j === k ? show(j, v, curSpec, true) : { L: layerFor(j, false, v, curSpec) };
          if (!S || !ready(S.L)) continue;
          if (j !== k && !windowsSee(S.L.meta.rect)) continue;
          out.push({ ...S, v, k: late(S.L) } as Slot);
          n++;
        }
      }
    }
    return out;   // (alpha 0 included: a layer about to fade in still asks for its frames)
  }
  /** Does the closing, at its framing now, see stretch k's figure layer? (True when that cannot be told yet.) */
  function closingSees(k: number) {
    const m = figureMeta(k), c = wins[1];
    if (!m || !c.box) return true;
    const fr = framingOf(c);
    if (!fr || fr.full) return true;
    const u0 = fr.worldLeft, u1 = u0 + c.box.width / fr.scale;
    return u1 > m.rect[0] && u0 < m.rect[1];
  }
  // does any window, at its framing now, see that world rect? (an unpainted or off-screen window counts only when it
  // is about to be painted: its stale framing from another stretch must not hold a layer)
  function windowsSee(r: number[]) {
    if (stageOn() && st.fr && st.left + (st.wvisX || st.wvis) > r[0] && st.left < r[1]) return true;
    for (const w of wins) {
      if (!w.box || !(w.vis || w.want)) continue;
      const fr = framingOf(w);
      if (!fr || fr.full) continue;
      const u0 = fr.worldLeft, u1 = u0 + w.box.width / fr.scale;
      if (u1 > r[0] && u0 < r[1]) return true;
    }
    return false;
  }
  const figU = (s: Slot | undefined): FigureSlot | null => (s ? {
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
    for (const v of [...wins, hzv, ...st.layers]) v.key = '';
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
      // 4b, living, below 1200 px: the strip's painting sinks inside its box as the box scrolls away, so it leaves at
      // T.lag of the page's speed, clipped by the box's own feathers (it never slides under the text; paper below)
      w.sink = 0;
      if (w.kind === 'strip' && w.box && living() && !stageOn() && !fullMode && T.lag < 1 && !quantized()) {
        const y = Math.max(0, window.scrollY || 0);
        w.sink = Math.min(1, (y * (1 - Math.max(0, T.lag))) / Math.max(1, w.box.height));
      }
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
    hzTarget = (hzOn || fullMode) && !stageOn() ? sstep(0.35, 0, sb) * (1 - sstep(1, 0.7, ct)) : 0;
    if (stageOn()) readStage();
  }
  // 4b: the stage replaces both windows (they keep their boxes and their honest visibility: the framing and the descent
  // read them). The camera's progress follows the scroll and settles (prog = 1 - (1 - s/reach)^ease, s = viewports
  // scrolled; still once s >= reach) and comes back down as the closing comes up, ending exactly at the page's end
  // whatever the viewport. Reduced motion and still: one quiet change at half a viewport (and back at the end).
  function readStage() {
    placeT();
    const y = window.scrollY || 0;
    const vh = cssH || innerHeight || 1;
    const s = wins[0], c = wins[1];
    st.stripVis = s.vis;
    st.y = y;
    if (s.box) { st.topDoc = s.box.top + y; st.bottomDoc = s.box.top + s.box.height + y; }
    let sv = Math.max(0, y / vh);
    let desc = 0, f = 1, p = 0;
    st.endSink = st.endMid = st.jump = 0;
    if (c.box && T.descend > 0) {
      const maxY = Math.max(0, document.documentElement.scrollHeight - innerHeight);
      const ctEnd = c.box.top - (maxY - y);           // the closing's top once the page is at its end
      // the end pose wanted: the opening composition lowered so its strip's bottom edge lies on the closing's bottom edge
      const E0 = Math.max(0, (ctEnd + c.box.height) - (st.bottomDoc)) / vh;
      const D0 = Math.min(T.sink[0], T.sink[1], T.sink[2]);
      const vmax = Math.max(0.05, T.vmax);
      // the descent runs over the last `span` of scroll and is complete AT the page's end: the closing's run-in (a short
      // closing low in a tall window starts it a little before the closing shows), shorter where its deepest drop allows
      const minSpan = Math.max(vh * 0.35, vh - ctEnd);
      const lift = Math.max(0, T.reach + T.still) * vh;
      // (round 4: never longer than the run-in, plus T.lead: the descent happens as the closing comes into view at every
      // size. Round 3 let a long page take up to 1.6 viewports for it, so on a tall window the counter-directional
      // descent started ~1.1 screens before the closing, through the reading)
      const cap = minSpan + Math.max(0, T.lead) * vh;
      const want = Math.min(Math.max(minSpan, (1.5 * Math.max(0, E0 - D0) * vh) / vmax), cap);
      // a short page: the lift, its still stretch and the descent share the scroll. The lift scales down (to half) before
      // the descent gives up its length; on a very short page both shrink (the lift to 0.3, the descent to its run-in or
      // 35% of the scroll), and a still stretch always remains between them
      const floor = Math.max(1, Math.min(minSpan, maxY * 0.35));
      const f1 = lift > 0 ? (maxY - want) / lift : 1;
      f = f1 >= 0.5 ? Math.min(1, f1) : Math.min(0.5, Math.max(0.3, (maxY - floor) / lift));
      const span = Math.max(floor, Math.min(want, maxY - f * lift));
      p = clamp01(1 - (maxY - y) / span);
      desc = sstep(0, 1, p) * T.descend;
      // ...and the far layer's end pose is framed as low as that speed allows (M: the most any layer may sink by motion)
      const M = (span * vmax) / (1.5 * vh);
      st.endSink = Math.min(E0, f * D0 + M);
      // the middle and near layers (round 4) end together, as low as the same limit allows from their own, deeper settled
      // sink (on a tall window the far ranges end a little higher above them); a place with a cloud (Work) ends them on
      // the opening framing itself (the bridge behind "Next: …", whole), the rest of their drop taken inside the cloud
      const Dm = Math.min(T.sink[1], T.sink[2]) * f;
      st.endMid = T.cloud > 0 ? E0 : Math.min(E0, Dm + M);
      st.jump = T.cloud > 0 ? Math.max(0, E0 - (Dm + M)) : 0;
      st.span = span;
    }
    st.descP = p;
    st.liftF = f;
    sv /= f;                                         // (the lift's own profiles run in lift viewports)
    const t = T.reach > 0 ? clamp01(sv / T.reach) : 1;
    let prog = 1 - Math.pow(1 - t, Math.max(1, T.ease));
    let slide = sstep(T.slideAt[0], T.slideAt[1], sv);
    const ca = T.cloudAt;
    let mid = sstep(ca[0], ca[1], sv) * (1 - sstep(ca[2], ca[3], sv));
    let cloud = T.cloud * mid;
    // (round 4) the camera comes back down through the cloud: where the middle and near layers' drop is larger than the
    // speed limit allows (tall windows), the cloud thickens over them as the closing comes into view (descAt), they go
    // under it (hide), take the rest of their drop there (jump: never seen) and come out of it on the opening framing
    let jump = 0, hide = 0;
    if (st.jump > 0) {
      const da = T.descAt;
      cloud = Math.max(cloud, T.cloud * sstep(da[0], da[1], p) * (1 - sstep(da[2], da[3], p)) * T.descend);
      hide = sstep(da[1] - 0.08, da[1], p) * (1 - sstep(da[2], da[2] + 0.08, p));
      jump = sstep(da[1] + 0.04, da[2] - 0.04, p);
    }
    if (quantized()) {
      // (round 4: a place with an arch takes its end pose, in one quiet change, only once the arch can come out whole there)
      const end = desc > 0.5 && revealTarget(prog, 1, 1, sv > 0.5 ? 1 : 0, vh) >= 0.5;
      prog = sv > 0.5 && !end ? 1 : 0; desc = end ? 1 : 0; slide = sv > 0.5 ? 1 : 0; cloud = mid = hide = 0; jump = desc;
    }
    if (forced === 'hero' || forced === 'closing') { prog = 0; desc = forced === 'closing' ? 1 : 0; slide = desc; cloud = mid = hide = 0; jump = desc; }
    else if (forced === 'horizon') { prog = 1; desc = 0; slide = 1; cloud = mid = hide = jump = 0; }
    st.descT = desc;
    st.progT = prog;
    st.slideT = slide;   // (the step is kept through the descent: the scene never slides back in view)
    st.cloudT = cloud;
    st.midT = mid;
    st.jumpT = jump;
    st.hideT = hide;
    const rv = revealTarget(prog, desc, jump, slide, vh);
    st.revT = quantized() ? (rv >= 0.5 ? 1 : 0) : rv;
  }
  // (round 4) the curtain's reveal, 0..1: a place's arch (Work: the bridge) comes out of the mist only once every point of
  // it stands clear of the text's veils where the scroll will put it (its crown used to show under the last table's
  // bottom veil while its west leg stood alone below it), late in the descent, and always at the end pose. Read with the
  // scroll's targets; draw() lets the curtain follow at T.reveal's rate, so it never pops in within one wheel tick.
  function revealTarget(prog: number, desc: number, jump: number, slide: number, vh: number) {
    st.archNow = null;
    if (!(st.curtX >= 0) || !(T.curtain > 0)) return quantized() ? 1 : st.revK;   // (no curtain: nothing to reveal)
    if (st.descP >= 0.999 || forced === 'closing') return 1;                   // (the page's end: always whole)
    // (final review r1, item 3) the scroll-paced growth is motion: quantized modes (reduced motion, Still) have no
    // growth, only one switch to the end pose, so they keep the clearance rule alone (r2, item 2: fed into that switch,
    // the growth flipped Work to its end pose ~120 px before the page end, its crown still in the last block's veil, and
    // left a sheared arch on screen until the next scroll)
    const grow = quantized() ? 0 : sstep(T.revealAt[0], T.revealAt[1], st.descP);
    if (!st.archPx) return Math.max(grow, desc >= 0.999 ? 1 : 0);
    if (desc <= 0.5) return grow;
    const f = st.liftF, y = st.y;
    // the middle layer's sink there (as stageU puts it) and the step
    const sink = (T.sink[1] * f * prog * (1 - desc) + (st.endMid - st.jump) * desc + st.jump * jump) * vh;
    const dx0 = st.slidePx * slide;
    // a veil's reach: the solid core, the feather and the swell's tongues (CSS px); beside a block on a wide window the
    // painter widens it (up to 1.8x at 2592 px), above and below a block it keeps the 1440 reach
    const g1 = T.core * 0.8 + T.feather + T.swell * 0.85, g0 = g1 - T.feather * 0.6;
    const wk = Math.min(1.8, Math.max(1, cssW / 1440));
    let gap = Infinity;
    st.archNow = st.archPx.map(([x, yr]) => [Math.round(x + dx0), Math.round(yr + sink)]);
    for (const [x, yy] of st.archNow) {
      for (const [l, t, r, b] of st.bands) {
        const ddx = Math.max(0, l - x, x - r), ddy = Math.max(0, t - y - yy, yy - (b - y));
        gap = Math.min(gap, Math.hypot(ddx / wk, ddy));
      }
    }
    st.archGap = Number.isFinite(gap) ? Math.round(gap) : 9999;
    return Math.max(grow, sstep(g0, g1, gap));
  }
  function stepHz(snap: boolean) {
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
  function textBox(el: Element, r: DOMRect, media = false) {
    const c = textBoxes.get(el);
    if (c && c.w === r.width && c.h === r.height && c.f === fontGen && c.m === media) return c.box;
    let l = Infinity, t = Infinity, rt = -Infinity, b = -Infinity;
    // (living veils: pictures and drawings count as text, so the photo and the diagrams sit on paper too)
    if (media) {
      for (const m of el.querySelectorAll('img, svg, video, canvas')) {
        if (m.closest('svg') !== m && m.tagName.toLowerCase() === 'svg') continue;
        const q = m.getBoundingClientRect();
        if (q.width < 2 || q.height < 2) continue;
        l = Math.min(l, q.left); t = Math.min(t, q.top); rt = Math.max(rt, q.right); b = Math.max(b, q.bottom);
      }
    }
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let n = walk.nextNode(), i = 0; n && i < 400; n = walk.nextNode(), i++) {
      if (!(n as Text).data.trim()) continue;
      // (living: a margin note in the rail is veiled on its own lines, so the column's veil keeps to the column)
      if (media && n.parentElement?.closest('.margin-note') && el.matches?.(':not(.margin-note)')) continue;
      range.selectNodeContents(n);
      for (const q of range.getClientRects()) {
        if (q.width < 2 || q.height < 2) continue;   // collapsed or visually hidden
        // (living: a folded case keeps laid-out lines outside its block; only what lies inside the block counts)
        if (media && (q.bottom <= r.top || q.top >= r.bottom || q.right <= r.left || q.left >= r.right)) continue;
        l = Math.min(l, q.left); t = Math.min(t, q.top); rt = Math.max(rt, q.right); b = Math.max(b, q.bottom);
      }
    }
    if (media && l < rt) { l = Math.max(l, r.left); t = Math.max(t, r.top); rt = Math.min(rt, r.right); b = Math.min(b, r.bottom); }
    const box = l < rt ? { l: l - r.left, t: t - r.top, r: rt - r.left, b: b - r.top } : null;
    textBoxes.set(el, { w: r.width, h: r.height, f: fontGen, m: media, box });
    return box;
  }
  // 4b, living: an element's text and pictures as a few bands down its height, each the union of its own lines, so a
  // block with a wide diagram over narrow text is veiled wide only beside the diagram (the painting comes back beside the
  // narrow text below it). A band ends where something at least BAND_TOL px wider starts below it, or where a run of
  // narrower lines at least BAND_MIN tall follows it; ragged line ends and short last lines never split a band. Offsets
  // inside the element's box, cached like textBox.
  const textBandsC = new WeakMap<Element, { w: number; h: number; f: number; bands: Offsets[] }>();
  function textBands(el: Element, r: DOMRect) {
    const c = textBandsC.get(el);
    if (c && c.w === r.width && c.h === r.height && c.f === fontGen) return c.bands;
    const items: number[][] = [];
    const inside = (q: Edges) => !(q.bottom <= r.top || q.top >= r.bottom || q.right <= r.left || q.left >= r.right);
    for (const m of el.querySelectorAll('img, svg, video, canvas')) {
      if (m.tagName.toLowerCase() === 'svg' && m.parentElement?.closest('svg')) continue;
      const q = m.getBoundingClientRect();
      if (q.width >= 2 && q.height >= 2 && inside(q)) items.push([q.left, q.top, q.right, q.bottom]);
    }
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let n = walk.nextNode(), i = 0; n && i < 600; n = walk.nextNode(), i++) {
      if (!(n as Text).data.trim()) continue;
      const pe = n.parentElement;
      if (pe?.closest('svg') || (pe?.closest('.margin-note') && !el.matches?.('.margin-note'))) continue;
      range.selectNodeContents(n);
      for (const q of range.getClientRects()) if (q.width >= 2 && q.height >= 2 && inside(q)) items.push([q.left, q.top, q.right, q.bottom]);
    }
    items.sort((a, b) => a[1] - b[1]);
    const bands: number[][] = [];
    const uni = (a: number[] | null, b: number[]) => (a ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] : b.slice());
    let cur: number[] | null = null, nar: number[] | null = null;
    for (const q of items) {
      if (!cur) { cur = q.slice(); continue; }
      if (q[1] < cur[3] - 4 && !nar) { cur = uni(cur, q); continue; }       // beside what is already in the band
      if (q[2] > cur[2] + BAND_TOL) {                                     // something wider starts below
        if (nar) { cur = uni(cur, nar); nar = null; }
        if (cur[3] - cur[1] >= BAND_MIN) { bands.push(cur); cur = q.slice(); } else cur = uni(cur, q);
      } else if (q[2] < cur[2] - BAND_TOL) {                              // narrower: a run of it may become a band
        nar = uni(nar, q);
        if (nar[3] - nar[1] >= BAND_MIN) { bands.push(cur); cur = nar; nar = null; }
      } else {
        if (nar) { cur = uni(cur, nar); nar = null; }
        cur = uni(cur, q);
      }
    }
    if (nar) cur = uni(cur, nar);
    if (cur) bands.push(cur);
    const out = bands.map((b) => {
      const l = Math.max(b[0], r.left), t = Math.max(b[1], r.top), rt = Math.min(b[2], r.right), bt = Math.min(b[3], r.bottom);
      return { l: l - r.left, t: t - r.top, r: rt - r.left, b: bt - r.top };
    }).filter((b) => b.r > b.l && b.b > b.t);
    textBandsC.set(el, { w: r.width, h: r.height, f: fontGen, bands: out });
    return out;
  }
  function measureVeil() {
    veil.fill(-1);
    veilS.fill(0);
    veilF.fill(1);
    const notes = wins.map((w) => w.noteEl).filter(Boolean) as Element[];
    if ((!veilEls.length && !notes.length) || !cssW) return;
    const seen: [area: number, r: Edges, s: number, f: number][] = [];
    const live = stageOn();
    // living: every text block the painting must keep clear of (veils, keep-outs, the note) is veiled on its own lines;
    // the margin notes in the rail on their own (the column's veil keeps to the column)
    // (every page: a keep-out with no veil of its own, the closing's "Next: …", keeps a paper reserve under its line, so
    // the drift and the sky deck never move under its words)
    const bare = live ? [] : keepEls.filter((el) => el.isConnected && !el.hasAttribute('data-veil') && !veilEls.some((v) => v.contains(el)));
    let els = live ? [...new Set(veilEls.concat(notes, keepEls))] : veilEls.concat(notes, bare);
    if (live) for (const el of veilEls) if (el.isConnected) els = els.concat([...el.querySelectorAll('.margin-note')]);
    for (const el of els) {
      if (!el.isConnected) continue;
      let r: DOMRect | Edges = el.getBoundingClientRect();
      const v = notes.includes(el) || bare.includes(el) ? '0.95' : (el.getAttribute('data-veil') || '').trim();
      let s = v !== '' && Number.isFinite(+v) ? clamp01(+v) : veilK;
      let f = 1;
      if (live) {
        if ((r as DOMRect).width < 2 || (r as DOMRect).height < 2) continue;
        // (every band of the element's lines is veiled on its own; the "Draft art" note stands in the first screen's
        // sky: a tight reserve, its line and a little round it)
        const fl = notes.includes(el) ? 0.35 : 1;
        const m = (T.core + (T.feather + T.swell * 1.3 + T.clear) * Math.min(1.8, Math.max(1, cssW / 1440))) * fl;   // (a living veil counts while its edge or clearing shows)
        for (const tb of textBands(el, r as DOMRect)) {
          const q = { left: r.left + tb.l, top: r.top + tb.t, right: r.left + tb.r, bottom: r.top + tb.b };
          const x0 = Math.max(q.left - m, rect.left), x1 = Math.min(q.right + m, rect.left + cssW);
          const y0 = Math.max(q.top - m, rect.top), y1 = Math.min(q.bottom + m, rect.top + cssH);
          const area = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
          if (area > 0) seen.push([area, q, 1, fl]);
        }
        continue;
      } else if (s >= RESERVE) {
        // A reserve (small print): solid paper only behind its own lines, with a tighter feather, and only once
        // they are on screen. The landscape around it keeps its ink.
        const tb = textBox(el, r as DOMRect);
        if (!tb) continue;
        r = { left: r.left + tb.l, top: r.top + tb.t, right: r.left + tb.r, bottom: r.top + tb.b };
        const vis = Math.min(r.bottom, rect.top + cssH) - Math.max(r.top, rect.top);
        s = sstep(0, Math.min(RESERVE_IN, r.bottom - r.top), vis);   // (4b: a one-line reserve, the note, is solid once its line is on screen)
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
    if (stageOn()) measureSlide();
  }
  // 4b, the stage's sideways step (a place with an `anchor`): once settled, that world x stands at the outer edge of the
  // reading column's veil (the right edge of the page's widest block, margin notes aside, plus the veil's core and
  // feather), so a whole cluster of the scene fills the margin beside it. Layout-only: measured with the keep-outs, never
  // per scroll frame. The step is taken under the cloud (readStage) and kept to the end.
  function measureSlide() {
    placeT();
    st.curtX = -1;
    st.archPx = null;
    st.bands = [];
    if (T.slide >= 0) { st.slidePx = T.slide * cssW / 1440; return; }
    const sb = wins[0].box;
    if (!sb || !(T.anchor >= 0)) { st.slidePx = 0; return; }
    let right = 0;
    for (const el of new Set(veilEls.concat(keepEls))) {
      if (!el.isConnected || el.closest?.('.strip')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2) continue;
      const tb = textBox(el, r, true);
      if (tb) right = Math.max(right, r.left + tb.r - rect.left);
    }
    // (at the pan's destination: a page swapped in mid-pan is measured as it will stand, and again when the pan ends)
    const fr = framingBlend(tween ? tween.to : stretch, 'wide', { width: sb.width, height: sb.height, keepoutRight: wins[0].keepR, doc: false }, 'strip');
    const left = fr.worldLeft - sb.left / fr.scale;               // world x at the viewport's left edge
    const ax = (T.anchor - left) * fr.scale;                     // the anchor's x at rest, before the step
    // (final review r1, item 2) the step goes either way, and only as far as it must: the anchor (the cluster's west end,
    // the curtain's edge) is kept between the veil's outer edge and the x that puts the cluster [anchor, anchor + cluster]
    // whole on screen, so the cluster stands whole in the margin (1440: a step left; 1920 and wider: none). Where the
    // margin is narrower than the cluster (1280), its east end is brought to the viewport's right edge and the curtain
    // stays at the veil's edge, so the margin holds the cluster's east part whole (the curtain eats into the town from the
    // west, through roofs) rather than a slice cut by the viewport's edge. (The smaller the step, the nearer the end pose
    // is to the opening: the step is kept to the end.)
    const veilX = right + T.core + T.feather;
    const fitX = cssW - 8 - (T.cluster || 0) * fr.scale;         // the anchor's x that puts the cluster's east end on screen
    const want = veilX <= fitX ? Math.min(fitX, Math.max(veilX, ax)) : fitX;
    st.slidePx = Math.max(-cssW * 0.3, Math.min(cssW * 0.3, want - ax));
    st.curtX = Math.max(veilX, ax + st.slidePx);                 // the curtain's edge once stepped (viewport CSS px)
    st.curtSweep = cssW * 0.3;                                   // ...and how far its front clears leftward as it lifts
    // (round 4) the arch the curtain reveals: its points at rest before the step (viewport CSS px; the scroll's sink and
    // step are added in revealTarget), and the text bands near it (doc px, x viewport): the veils it must stand clear of
    if (!T.arch || !T.curtain) return;
    const unit = HS / fr.scale, top = fr.worldTop + st.topDoc * unit;
    st.archPx = T.arch.map(([u, h]) => [(u - left) * fr.scale, (top - h) / unit]);
    // (the front clears the arch from its east end to just past its west foot over the whole reveal, so the arch comes out
    // east to west at the reveal's pace on every width; the rest of the town follows as the curtain fades)
    st.curtSweep = Math.max(120, st.curtX - (Math.min(...st.archPx.map((q) => q[0])) + st.slidePx) + 110);
    const xs = st.archPx.map((q) => q[0] + st.slidePx), reach = 600;
    const y = window.scrollY || 0;
    const els = new Set(veilEls.concat(keepEls));
    for (const el of veilEls) if (el.isConnected) for (const n of el.querySelectorAll('.margin-note')) els.add(n);
    for (const el of els) {
      if (!el.isConnected) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      for (const b of textBands(el, r)) {
        const l = r.left + b.l - rect.left, rt = r.left + b.r - rect.left;
        if (rt < Math.min(...xs) - reach || l > Math.max(...xs) + reach) continue;
        st.bands.push([l, r.top + b.t - rect.top + y, rt, r.top + b.b - rect.top + y]);
      }
    }
    // (read again here: a measure frame runs after the scroll's read, and a page that loads near its end has no scroll yet)
    const rv = revealTarget(st.progT, st.descT, st.jumpT, st.slideT, cssH || innerHeight || 1);
    st.revT = quantized() ? (rv >= 0.5 ? 1 : 0) : rv;
  }

  // the wake: fine pointers, inside a [data-wake] region, never under reduced motion or still
  const wakeOn = () => opts.pointer !== false && !quantized() && !settling && mode === 'webgl' && mqFine.matches && wakeEls.length > 0;
  function insideWake(x: number, y: number) {
    if (stageOn()) return true;   // the stage is everywhere (the veils keep the wake off the text)
    if (!wakeRects) wakeRects = wakeEls.filter((el) => el.isConnected).map((el) => el.getBoundingClientRect());
    for (const r of wakeRects) if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
    return false;
  }
  function resetWake() {
    wake.s = wake.target = 0;
    wake.has = wake.inWin = wake.moving = wake.pushed = false;
    trail.length = 0;
    wakeBox.set([2, 2, -1, -1]);
    trailU.fill(0);
  }
  // ---------------------------------------------------------------- P3 "Life that answers you" (elements.ts)
  const p3OK = () => mode === 'webgl' && !quantized() && !settling && ambientWanted && !hidden;
  function addStir(S: Stir) {
    // (sparse: with every slot in use a pass or an auto drop waits its turn, so no ring ever vanishes mid-life; a tap
    // takes the oldest's slot, which is fading by then)
    const now = performance.now();
    for (let i = stirs.length - 1; i >= 0; i--) if (now - stirs[i].t0 > STIR_LIFE[stirs[i].kind] * 1000) stirs.splice(i, 1);
    if (stirs.length >= STIR_N && S.kind !== 1) return false;
    // (final round: the pointer's own rings, at most STIR_USER at once: a dwell waits, a tap takes the oldest's place)
    const own = stirs.filter((q) => q.kind < 2);
    if (S.kind < 2 && own.length >= STIR_USER) {
      if (S.kind === 0) return false;
      stirs.splice(stirs.indexOf(own[own.length - 1]), 1);
    }
    stirs.unshift(S);
    if (stirs.length > STIR_N) stirs.length = STIR_N;
    return true;
  }
  /** 1. Is canvas point (u, v) on the open water of the view life lies in? (its ridge rows, as the shader reads them:
   *  below the waterline, past a river's near bank, no near headland standing over it) */
  function waterAt(h: LifeView, u: number, v: number) {
    const { buf, samples: n } = h.rid();
    if (!buf || !n) return false;
    const c = h.col(u);
    if (!(c >= 0 && c < n)) return false;
    const wy = h.inv(u, v)[1];
    const o5 = (LAYERS * n + c) * 4, o7 = ((LAYERS + 2) * n + c) * 4;
    if (!(buf[o5] > 0.3) || !(buf[o5 + 1] - wy > 0.006)) return false;
    if (buf[o7] > -0.5 && wy < buf[o7] + 0.02) return false;
    for (let l = 3; l < LAYERS; l++) if (buf[(l * n + c) * 4] > wy) return false;
    return true;
  }
  /** 1. A ring set where the pointer passes (kind 0) or a tap lands (kind 1), if that point is open water. */
  function spawnStir(x: number, y: number, kind: number, now: number) {
    const h = lifeHit;
    if (!h || !(el('stir'))) return false;
    const u = (x - rect.left) / (cssW || 1), v = 1 - (y - rect.top) / (cssH || 1);
    const c = h.clip;
    if (u < c[0] || u > c[2] || v < c[1] || v > c[3] || !waterAt(h, u, v)) return false;
    const w = h.inv(u, v);
    if (!addStir({ wx: w[0], wy: w[1], t: h.t, t0: now, seed: (stirSeq++ * 0.618034) % 1, kind })) return false;
    pace(S_PRESENT, 0);
    return true;
  }
  /** The pointer's P3 answers: the stirred water, the plum's gust, the stage's depth (fine pointers only). */
  function p3Pointer(e: PointerEvent) {
    if (!p3OK() || e.pointerType === 'touch' || !mqFine.matches) return;
    const now = performance.now(), x = e.clientX, y = e.clientY;
    // (the pointer's horizontal speed, CSS px per s, eased: the gust leans with it)
    const dtp = Math.max(1, now - lastPT);
    pvx += (((x - lastPX) / dtp) * 1000 - pvx) * Math.min(1, dtp / 120);
    lastPX = x; lastPT = now;
    // 1. stir (final round): no rings on a pass. One ring when the pointer rests over the water for STIR_DWELL ms (each
    // move restarts the wait; one ring per rest), or on a tap (onTap)
    if (el('stir')) {
      if (dwellTimer) clearTimeout(dwellTimer);
      dwellTimer = setTimeout(() => {
        dwellTimer = null;
        if (!p3OK() || !wake.inWin) return;
        if (Math.hypot(x - stirPX, y - stirPY) < 6 && performance.now() - stirAt < 2000) return;
        const t1 = performance.now();
        if (spawnStir(x, y, 0, t1)) { stirAt = t1; stirPX = x; stirPY = y; }
      }, STIR_DWELL);
    }
    // 2. plumGust: the pointer passing within ~60 px of the bough's limb, moving, at most once every 8 s; the petals let
    // go from the limb where it came nearest, a little under it (where the blossoms hang)
    if (el('plumGust') && plumLimbUV && plumLimbUV.length > 1 && lifeHit && now - gustAt > 8000 && Math.abs(pvx) > 60) {
      const px = x - rect.left, py = y - rect.top;
      let best = Infinity, bx = 0, by = 0;
      for (let i = 1; i < plumLimbUV.length; i++) {
        const ax = plumLimbUV[i - 1][0] * cssW, ay = (1 - plumLimbUV[i - 1][1]) * cssH, qx = plumLimbUV[i][0] * cssW, qy = (1 - plumLimbUV[i][1]) * cssH;
        const dx = qx - ax, dy = qy - ay, L2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2));
        const cx = ax + dx * t, cy = ay + dy * t, dd = Math.hypot(px - cx, py - cy);
        if (dd < best) { best = dd; bx = cx; by = cy; }
      }
      if (best < 60) {
        const u = bx / (cssW || 1), v = 1 - (by + 14) / (cssH || 1);
        gust = { t0: now, dir: pvx > 0 ? 1 : -1, u, v };
        gustAt = now;
        pace(S_PRESENT, 0);
      }
    }
  }
  /** 1. A tap (or a click) on the water drops a stone: three rings. On a touch screen at most one every 2 s. */
  const onTap = (e: PointerEvent) => {
    if (!p3OK() || !el('stir')) return;
    const now = performance.now();
    if (now - stirTapAt < (e.pointerType === 'touch' ? 2000 : 450)) return;
    if (spawnStir(e.clientX, e.clientY, 1, now)) { stirTapAt = now; stirAt = now; stirPX = e.clientX; stirPY = e.clientY; }
  };
  /** P3: something that answers the pointer is moving (paced at the wake's <= 30 fps), or only the ambient drops. */
  const fxFast = (now: number) => mode === 'webgl' && (settling || (!!gust && now - gust.t0 < 7600)
    || stirs.some((S) => S.kind < 2 && now - S.t0 < STIR_LIFE[S.kind] * 1000));
  // the wake's radius, viewport heights (WAKE_VH of the viewport, clamped to WAKE_PX CSS px)
  const wakeR = () => { const h = cssH || innerHeight || 900; return Math.min(WAKE_PX[1], Math.max(WAKE_PX[0], WAKE_VH * h)) / h; };
  // the wake needs frames only while it moves (a parked pointer's parted mist is a still picture)
  const wakeLive = () => wake.moving;

  // any input keeps the mist drifting (and wakes it after an idle stop)
  const onInput = () => {
    lastInput = performance.now();
    if (driftT < 1 && drifting()) pace(S_PRESENT, 0);
  };
  const onPointer = (e: PointerEvent) => {
    onInput();
    p3Pointer(e);
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
    if (!hzOn && !fullMode && !wasVisible && !wins.some((w) => w.near) && !stageOn()) return;
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
  let mqDpr: MediaQueryList | null = null;
  const onDpr = () => { watchDpr(); if (resize(true)) request(S_ALL); };
  function watchDpr() {
    mqDpr?.removeEventListener('change', onDpr);
    mqDpr = matchMedia(`(resolution: ${devicePixelRatio || 1}dppx)`);
    mqDpr.addEventListener('change', onDpr);
  }

  // resizes: the canvas (a new buffer), the windows and the veiled text (new boxes: re-frame, debounced repaint)
  let reframeTimer: Timer | 0 = 0;
  const reframeSoon = () => { clearTimeout(reframeTimer); reframeTimer = setTimeout(() => request(S_MEASURE | S_SCROLL), 150); };
  const ro = typeof ResizeObserver === 'function'
    ? new ResizeObserver((entries) => {
      let surf = false, other = false;
      for (const e of entries) { if (e.target === surface) surf = true; else other = true; }
      if (surf && resize()) {
        // Changing the buffer size clears it: repaint right now, before the browser paints.
        if (running()) draw(performance.now()); else need |= S_ALL;
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

  function observeSurface(on: boolean) {
    if (on) { ro?.observe(surface); io?.observe(surface); } else { ro?.unobserve(surface); io?.unobserve(surface); }
  }
  function observeEls(on: boolean) {
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
  const drifting = () => ambientWanted && !quantized() && mode === 'webgl' && (anyVisible || stageShown() || wake.s > 0.01);
  const ambientOn = () => drifting() && (awake() || driftT > 0);

  /** Paint on the next animation frame (scroll, resize, pans, arrival). */
  function request(flags: number) {
    need |= flags;
    if (!running() || raf) return;
    clearTimer();
    raf = requestAnimationFrame(frame);
  }
  /** Paint no sooner than `gap` ms after the last present (wake, ambient mist). */
  function pace(flags: number, gap: number) {
    need |= flags;
    wakeAt(lastPresent + gap);
  }
  function wakeAt(at: number) {
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
    govP = []; prevPlain = false; gpuWait = 0; polled = telling = false;
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
    if (running()) draw(performance.now()); else whenReady();
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

  function frame(now: number) {
    raf = 0;
    if (!running()) return;
    // The GPU is still painting an earlier frame (a slow or software renderer): skip this one instead
    // of queueing another behind it, so the browser's own frames keep flowing. Animations stay on time
    // (they advance by the elapsed time); they only drop frames.
    const busy = renderer!.busy ? renderer!.busy() : 0;
    // (the first look at the GPU after a present tells its cost only if the GPU is still at it, or if it came soon enough
    // that being done means it was quick: governPresent)
    if (!polled) { polled = true; telling = busy > 0 || performance.now() - lastPresent <= PRESENT_SLOW; }
    if (busy) gpuWait = Math.max(gpuWait, busy);
    if (busy && busy < GPU_WAIT_MAX) { raf = requestAnimationFrame(frame); return; }
    const start = performance.now(); // the rAF timestamp can be a frame early; pace from here
    counts.frames++;
    const p0 = counts.presents, s0 = counts.scenes;
    const { animating, heavy, due } = draw(now);
    govern(start, heavy);
    governPresent(counts.presents !== p0, counts.scenes !== s0);
    if (animating) { raf = requestAnimationFrame(frame); return; }
    // otherwise sleep until the next thing that is due (or until something asks for a frame)
    let at = due;
    if (wakeLive()) at = Math.min(at, lastPresent + POINTER_MS);
    if (ambientOn()) at = Math.min(at, lastPresent + AMBIENT_MS);
    // P3: a response to the pointer (rings, the gust, the depth, the page change's swallow, Still settling) at the
    // wake's <= 30 fps while it moves; the ambient drops only ride the ambient frames
    const nowF = performance.now();
    if (fxFast(nowF)) at = Math.min(at, lastPresent + POINTER_MS);
    else if (stirs.length && !quantized()) at = Math.min(at, lastPresent + AMBIENT_MS);
    if (at < Infinity) wakeAt(at);
  }

  // Adaptive quality. Heavy frames (a scene painted for motion: arrival, pan, a figure's fade) that keep arriving
  // slower than SLOW_MS are first painted as drafts at a lower internal scale; if they are still slow, the whole
  // buffer drops to fewer pixels (never below 0.5).
  function govern(start: number, heavy: boolean) {
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
    if (resize(true)) draw(performance.now());
  }
  // 4b (final review r1, item 8): a present (the whole viewport: the stage, or the windows and the horizon) runs on every
  // scroll and drift frame, and govern() never sees it (it is not heavy), so a slow one had no floor: the living stage
  // presented at ~11 fps on a software rasteriser, behind text scrolling at 60. Each plain present (no scene painted with
  // it, something on screen) is sampled by how long the GPU was still seen painting it when the next frame came (gpuWait:
  // 0 on a GPU that keeps up; otherwise a lower bound of its cost, to the frame), when that look tells (`telling`: the GPU
  // was still at it, or the look came within PRESENT_SLOW of the present; an ambient frame 70 ms later tells nothing). When GOV_N
  // of them average PRESENT_SLOW or more, the buffer drops to fewer pixels (never below 0.5, as above); still slow at 0.5,
  // a living page gives its stage up and keeps 4a's strip and closing (stageVeto).
  function governPresent(presented: boolean, painted: boolean) {
    if (!presented) return;
    if (prevPlain && telling && !fixedQ && mode === 'webgl') {
      govP.push(gpuWait);
      if (govP.length > GOV_N) govP.shift();
      if (govP.length >= GOV_N && govP.reduce((a, b) => a + b, 0) / GOV_N >= PRESENT_SLOW) {
        govP = [];
        if (quality > 0.5) {
          quality = Math.max(0.5, quality * 0.8);
          if (resize(true)) need |= S_ALL;
          request(S_ALL);
        } else if (stageShown()) {
          stageVeto = true;
          request(S_ALL);
        }
      }
    }
    gpuWait = 0; polled = telling = false;
    prevPlain = !painted && (stageShown() || anyVisible || hzK > 0);
  }

  // ---------------------------------------------------------------- the views
  function framingOf(w: Win): ViewFraming | null {
    if (!w.box) return null;
    if (fullMode && w.kind === 'strip') {
      const { hs, wvis } = framing(aspect);
      const left = cameraLeft(stretch, wvis);
      return { worldLeft: left, worldTop: 1, scale: cssW / wvis, focus: [0, 0], full: true, hs, wvis };
    }
    if (qaFrame && w.kind === 'strip') return { worldLeft: qaFrame.left, worldTop: qaFrame.top, scale: qaFrame.scale, focus: [0, 0] };
    // the closing shows the page's own place once more (compose.ts frame.closing): a small version of its opening, or on a
    // short page, whose closing shares a screen with its strip, a different view of it (twin, without the strip's figures)
    const kind = kindOf(w);
    return framingBlend(stretch, cls, { width: w.box.width, height: w.box.height, keepoutRight: w.keepR, doc: w.doc && kind === 'strip', twin: kind === 'closing' && twinNow() }, kind);
  }
  /** The framing a window paints: its own, except that QA's setState('closing') puts the closing's in the strip. */
  function kindOf(w: Win) { return forced === 'closing' && w.kind === 'strip' ? 'closing' : w.kind; }
  /** A short page: its strip and its closing share a screen (their gap is under a viewport), so the closing frames a
   *  different view of the place, never the same picture (or the same figures) twice. (Box tops move together: scroll-invariant.) */
  function twinNow() {
    const s = wins[0].box, c = wins[1].box;
    return !!s && !!c && c.top - (s.top + s.height) < (cssH || innerHeight);
  }
  const specKey = () => `${curSpec.presence.toFixed(3)}:${curSpec.w.level.toFixed(3)}:${curSpec.w.high.toFixed(3)}:${curSpec.w.deep.toFixed(3)}`;
  // can a window at this framing see that figure layer?
  function seen(fr: ViewFraming, b: Rect, s: Slot) {
    if (fr.full) return false;
    const r = s.L.meta.rect;
    const u0 = fr.worldLeft, u1 = u0 + b.width / fr.scale;
    return u1 > r[0] && u0 < r[1];
  }
  /** Paint one window's scene (if its key changed, or it is in motion). Returns true when it painted. */
  function paintWin(w: Win, U0: SceneBase, slots: Slot[], force: boolean) {
    const fr = w.fr = framingOf(w);
    if (!fr || !w.box) return false;
    const b = w.box;
    const bw = Math.max(2, Math.round(b.width * bufS)), bh = Math.max(2, Math.round(b.height * bufS));
    const remade = renderer!.view(w.id, bw, bh);
    const v = variantOf(w);
    const vis = slots.filter((s) => s.v === v && s.k > 0.001 && seen(fr, b, s));
    const fa = vis[0] ? figU(vis[0]) : null;
    const fb = vis[1] ? figU(vis[1]) : null;
    const fk = (f: FigureSlot | null) => (f ? `${f.id}@${f.k.toFixed(2)}` : '-');
    const key = [fr.worldLeft.toFixed(5), fr.worldTop.toFixed(5), fr.scale.toFixed(2), bw, bh, palette, specKey(), w.keepR, String(w.note), fk(fa), fk(fb),
      w.kind === 'strip' ? arrive.toFixed(3) : 'a', U0.draft ? 'd' : 'f', mode].join('|');
    if (!remade && !force && key === w.key && !w.pending) return false;
    const t0 = performance.now();
    let view: number[], P: Resolved, left: number, wvis: number, asp: number, hs: number;
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
    renderer!.ridges(w.id, w.buf, samples);
    // keep-out, in box uv: the text's right edge, active, the mist ramp's half-width (140 px), the figure guard (+40 px)
    const keep = w.keepR !== null && w.keepR > 0
      ? new Float32Array([w.keepR / b.width, 1, 140 / b.width, (w.keepR + 40) / b.width]) : new Float32Array(4);
    w.keepU = keep;
    w.viewU = new Float32Array(view);
    const note = w.note ? new Float32Array([w.note[0] / b.width, 1 - w.note[3] / b.height, w.note[2] / b.width, 1 - w.note[1] / b.height]) : null;
    const U = {
      ...U0, view: w.viewU, hs, feet: layerFeet(P), keep, note, figA: fa, figB: fb,
      arrive: w.kind === 'strip' ? arrive : 9, morn: w.kind === 'strip' ? mornNow() : 9, hz: hzZero, hzK: 0, lift: 0, P, box: b, fr,
    };
    const t1 = performance.now();
    const done = renderer!.scene(w.id, U) !== false;
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
  function paintHorizon(U0: SceneBase, force: boolean) {
    const remade = renderer!.view(hzv.id, W, H);
    const { hs, wvis } = framing(aspect);
    const left = cameraLeft(stretch, wvis);
    const key = [left.toFixed(5), W, H, specKey(), horizonP.toFixed(3), U0.draft ? 'd' : 'f', mode].join('|');
    if (!remade && !force && key === hzv.key && !hzv.pending) return false;
    const P = resolve(curSpec, aspect);
    const samples = mode === 'webgl' ? Math.min(1536, Math.max(320, Math.round(W / 1.25))) : Math.min(480, Math.max(200, Math.round(W / 3)));
    hzv.buf = buildRidges(samples, { left, wvis, aspect, pigment: 0 }, P, hzv.buf);
    hzv.samples = samples;
    renderer!.ridges(hzv.id, hzv.buf, samples);
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
    const done = renderer!.scene(hzv.id, U) !== false;
    counts.scenes++;
    hzv.pending = !done;
    hzv.key = done ? key : '';
    hzv.painted = hzv.painted || done;
    hzv.draft = !!U.draft;
    return true;
  }

  /** Free the stage's views (leaving the living ground: a 4a page, or a window narrower than 1200 px). */
  function dropStage() {
    for (const L of st.layers) { renderer!.dropView?.(L.id); L.key = ''; L.painted = false; L.pending = false; L.draft = false; L.px = [0, 0]; }
    st.ok = false; st.single = true; st.pendingSplit = false; st.alloc = false; st.geo = ''; st.buf = null;
    st.prog = st.progT = st.desc = st.descT = st.slideK = st.slideT = st.cloudK = st.cloudT = st.midK = st.midT = 0;
    st.jumpK = st.jumpT = st.hideK = st.hideT = st.revK = st.revT = 0; st.partK = 1;
    st.glide = false; st.sepK = 1; st.curtH = 1; st.holdG = null;
  }
  /** Free 4a's views (entering the living ground: the stage stands in for the strip, the closing and the horizon). */
  function drop4a() {
    for (const w of wins) { renderer!.dropView?.(w.id); w.key = ''; w.painted = false; w.pending = false; w.draft = false; w.buf = null; }
    renderer!.dropView?.(hzv.id); hzv.key = ''; hzv.painted = false; hzv.pending = false; hzv.draft = false; hzv.buf = null;
  }
  /**
   * 4b: paint the stage's depth layers (the page's own scene at the strip's framing, extended to the whole viewport).
   * In motion (a pan, the bloom) one combined layer is painted per frame, full size, into the far layer's view, and the
   * other two are freed; at rest the three layers are painted (near and middle first, behind the combined one still on
   * show, then the far one at its own resolution, and only then does the present switch over). Each transparent layer
   * covers only its crop (stageCrops). Returns true when it painted anything.
   */
  function paintStage(U0: SceneBase, slots: Slot[], force: boolean, single: boolean) {
    const sb = wins[0].box;
    if (!sb || !W) return false;
    placeT();
    const fr = st.fr = framingBlend(stretch, 'wide', { width: sb.width, height: sb.height, keepoutRight: wins[0].keepR, doc: false }, 'strip');
    const unit = HS / fr.scale;                       // scene units per CSS px
    st.left = fr.worldLeft - sb.left / fr.scale;      // world x (stretches) at the viewport's left edge
    st.wvis = cssW / fr.scale;
    // (final review r1, item 2) a step to the left brings in what lies past the viewport's right edge at rest: the
    // middle and near layers are painted that much wider (st.ext CSS px), the far one (which never steps) is not
    st.ext = !single && st.slidePx < 0 ? Math.ceil(-st.slidePx) + 8 : 0;
    const cssWX = cssW + st.ext;
    st.wvisX = cssWX / fr.scale;
    const top = fr.worldTop + (st.topDoc) * unit;     // scene height at the viewport's top while the page is at its top
    st.view.set([st.left * HS, top, cssH * unit, cssW * unit]);   // (the viewport: what the present pass maps)
    const vX = [st.left * HS, top, cssH * unit, cssWX * unit];     // (what the layers are painted over)
    const kr = wins[0].keepR !== null && wins[0].keepR > 0 ? wins[0].keepR + sb.left : null;
    const keep = kr !== null ? new Float32Array([kr / cssWX, 1, 140 / cssWX, (kr + 40) / cssWX]) : new Float32Array(4);
    const P = resolve(curSpec, 1.6);
    const vis = slots.filter((s) => s.k > 0.001 && st.left + st.wvisX > s.L.meta.rect[0] && st.left < s.L.meta.rect[1]);
    const fk = (f: FigureSlot | null) => (f ? `${f.id}@${f.k.toFixed(2)}` : '-');
    // the ridges (shared by the three layers: a crop reads them at its own columns) and the crops, per geometry
    const samples = mode === 'webgl' ? Math.min(1536, Math.max(320, Math.round((W * cssWX) / cssW / 1.25))) : Math.min(480, Math.max(200, Math.round(W / 3)));
    const geo = [st.view[0].toFixed(5), top.toFixed(5), fr.scale.toFixed(2), W, H, palette, specKey(), kr, samples, Math.round(st.bottomDoc),
      T.sink.join(','), T.split.join(','), T.seaK, T.soft, T.billow, Math.round(stretch * 1000), st.ext].join('|');
    if (geo !== st.geo || !st.buf) {
      const t0 = performance.now();
      st.buf = buildRidges(samples, { left: st.left, wvis: st.wvisX, aspect: cssWX * unit, palette, pigment: 1 }, P, st.buf);
      st.samples = samples;
      counts.ridgeMs = Math.round((performance.now() - t0) * 10) / 10;
      counts.ridges++;
      stageCrops(P, unit, top, kr, cssWX);
      st.geo = geo;
    }
    // (Canvas2D paints no bloom: its layers are not repainted while the bloom runs)
    const base = [geo, U0.draft ? 'd' : 'f', mode, mode === 'webgl' ? arrive.toFixed(3) : '-'].join('|');
    const sp = T.split;
    const ranges = single ? [[0, LAYERS - 1, 0]] : [[0, sp[0] - 1, 0], [sp[0], sp[1] - 1, 1], [sp[1], LAYERS - 1, 1]];
    // what each layer would paint now, and whether it is stale
    const jobs: { j: number; lo: number; hi: number; layer: number; fa: FigureSlot | null; fb: FigureSlot | null; key: string; c: number[]; bw: number; bh: number }[] = [];
    ranges.forEach(([lo, hi, layer], j) => {
      const L = st.layers[j];
      const c = j === 0 ? [0, 0, cssW, cssH] : L.crop;
      const k = j === 0 && !single ? Math.min(1, Math.max(0.25, T.far)) : 1;
      const bw = Math.max(2, Math.round((c[2] - c[0]) * (W / cssW) * k)), bh = Math.max(2, Math.round((c[3] - c[1]) * (H / cssH) * k));
      const mine = vis.filter((s) => s.L.meta.plane >= lo && s.L.meta.plane <= hi);
      const fa = mine[0] ? figU(mine[0]) : null, fb = mine[1] ? figU(mine[1]) : null;
      const key = `${base}|${lo}-${hi}-${layer}|${c.map(Math.round).join(',')}|${bw}x${bh}|${fk(fa)}|${fk(fb)}`;
      const has = renderer!.hasView ? renderer!.hasView(L.id) : true;
      if (!has) { L.painted = false; L.key = ''; }
      if (!has || force || key !== L.key || L.pending || (L.draft && !U0.draft)) jobs.push({ j, lo, hi, layer, fa, fb, key, c, bw, bh });
    });
    if (single) {
      // in motion only the combined layer shows: the middle and near views are freed (repainted once at rest)
      for (const L of st.layers.slice(1)) if (L.painted || L.key) { renderer!.dropView?.(L.id); L.painted = false; L.key = ''; L.draft = false; L.pending = false; }
    }
    if (!jobs.length) {
      if (!single && st.single && st.layers.every((L) => L.painted)) st.single = false;
      return false;
    }
    // single -> three layers, at rest: one layer per frame, the far (combined) one last, so nothing flashes
    const gradual = !single && st.single && st.layers[0].painted && !force;
    const todo = gradual ? [jobs[jobs.length - 1]] : jobs;
    let done = true;
    for (const job of todo) {
      const L = st.layers[job.j];
      renderer!.view(L.id, job.bw, job.bh, job.j > 0 && !single);
      st.alloc = true;
      renderer!.ridges(L.id, st.buf, samples);
      const c = job.c;
      const view = new Float32Array(job.j === 0 ? vX : [vX[0], top - c[1] * unit, (c[3] - c[1]) * unit, vX[3]]);
      const U = {
        ...U0, view, hs: HS, feet: layerFeet(P), keep, note: null, figA: job.fa, figB: job.fb,
        arrive, morn: mornNow(), hz: hzZero, hzK: 0, lift: 0, P, planes: new Float32Array([job.lo, job.hi, job.layer, 0]),
        crop: new Float32Array([c[0] / cssWX, (c[2] - c[0]) / cssWX, 0, 0]),
      };
      const t1 = performance.now();
      const ok = renderer!.scene(L.id, U) !== false;
      counts.sceneMs = Math.round((performance.now() - t1) * 10) / 10;
      counts.scenes++;
      counts.stageScenes++;
      L.pending = !ok;
      L.key = ok ? job.key : '';
      L.painted = L.painted || ok;
      L.draft = !!U.draft;
      L.px = [job.bw, job.bh];
      done = done && ok;
      if (ok) { if (U.draft) { counts.drafts++; counts.draftAt = Math.round(performance.now()); } else counts.fullAt = Math.round(performance.now()); }
    }
    if (single) st.single = true;
    else if (done && (!gradual || jobs.length === 1)) st.single = false;
    st.ok = st.layers[0].painted;
    st.pendingSplit = !single && st.single;
    return true;
  }
  /**
   * The transparent layers' crops (viewport CSS px at the page's top): right of where the keep-out's mist clears them,
   * from their highest crest, cloud belt or figure down to the line below which the sea always covers them (the sea
   * keeps to the deepest sink: a layer that sinks less shows at most that difference more of itself).
   */
  function stageCrops(P: Resolved, unit: number, top: number, kr: number | null, cssWX = cssW) {
    const feet = layerFeet(P);
    const sp = T.split, n = st.samples, buf = st.buf!;   // (paintStage has just built the ridges)
    // (left of the keep-out's mist a layer is clear; Canvas2D's painter draws whole widths, so it keeps them)
    const x0 = kr !== null && mode === 'webgl' ? Math.max(0, Math.floor(kr - 240)) : 0;
    const c0 = Math.min(n - 1, Math.max(0, Math.floor((x0 / (cssWX || 1)) * n)));
    const vh = cssH || 1;
    const rest = st.bottomDoc / vh;
    const figs = [Math.round(stretch) - 1, Math.round(stretch), Math.round(stretch) + 1].map((k) => figureMeta(k)).filter(Boolean) as FigureMeta[];
    [[sp[0], sp[1] - 1], [sp[1], LAYERS - 1]].forEach(([lo, hi], i) => {
      const L = st.layers[i + 1];
      let h = -Infinity, hm = -Infinity;
      const cm = Math.max(c0, Math.floor(n * 0.5 * cssW / cssWX));
      for (let l = lo; l <= hi; l++) for (let c = c0, o = (l * n + c0) * 4; c < n; c++, o += 4) { if (buf[o] > h) h = buf[o]; if (c >= cm && buf[o] > hm) hm = buf[o]; }
      // (the middle layer's own highest crest in the right half, viewport CSS px at the page's top: the mid-lift cloud
      // bank's top rides just above it, so the far ranges above stay in view while the town steps inside the bank)
      if (i === 0) st.crest = Number.isFinite(hm) ? (top - hm) / unit : 0;
      if (lo <= 2 && hi >= 2) h = Math.max(h, feet[3] + 0.17 + 0.045 + 0.1);   // the cloud belt painted with plane 2
      if (lo <= 3 && hi >= 3) h = Math.max(h, feet[9] + 0.15 + 0.04 + 0.1);    // ...and the one with plane 3
      for (const m of figs) if (m.plane >= lo && m.plane <= hi && m.rect[1] > st.left && m.rect[0] < st.left + st.wvisX) h = Math.max(h, m.rect[3]);
      h += 0.03;                                                                // soft ink edges, crest texture
      const y0 = Math.min(cssH - 8, Math.max(0, Math.floor((top - h) / unit)));
      const below = rest + (seaSink() - T.sink[i + 1]) + T.billow * 0.75 + T.soft;
      const y1 = T.seaK >= 0.99 ? Math.min(cssH, Math.max(y0 + 8, Math.ceil(below * vh) + 6)) : cssH;
      L.crop = [x0, y0, cssWX, y1];   // (viewport CSS px at the page's top; past the right edge by st.ext)
      const R = st.rects;
      R.set([x0 / cssW, 1 - y1 / vh, cssWX / cssW, 1 - y0 / vh], (i + 1) * 4);
    });
    st.rects.set([0, 0, 1, 1], 0);
  }
  /** The stage's present uniforms: each layer's step, sink, alpha and crop, the sea, the haze deck and the cloud. */
  function stageU(): StageU {
    const vh = cssH || 1;
    const g = st.holdG || st;                           // (during a pan's hold: the geometry the views on show were painted at)
    const d = st.desc, pk = st.prog * (1 - d);
    // the end pose: the opening, framed lower. Round 4: the far layer ends as low as the speed limit allows (Ef); the
    // middle and near layers (Em) on the opening framing, a place with a cloud taking the rest of their drop inside it
    // (jumpK, only while they are under it); on a place without one every layer ends alike, as before
    const Ef = g.endSink * d;
    const Emo = (g.endMid - g.jump) * d;                // (by motion: the cloud's top keeps to it)
    const Em = Emo + g.jump * st.jumpK;
    const slide = (g.slidePx / (cssW || 1)) * st.slideK;
    const D = T.sink.map((v) => v * g.liftF);            // (a short page lifts less: see `still`)
    const single = st.single;
    const sep = single ? 0 : st.sepK;                   // (combined: every plane at the middle's depth and step)
    for (let i = 0; i < 3; i++) {
      st.offsets[i * 4] = i === 0 ? slide * (1 - sep) : slide;   // (the far ranges never step sideways)
      // (when the three layers take over from the combined one, the far AND the near layer glide from the middle's depth
      // to their own: round 3, the near layer used to jump there in one frame)
      // (round 4: the far layer's end parts from the middle's as the three layers take over, and a pan's hold joins them
      // again before the combined layer, which has one depth, takes over)
      st.offsets[i * 4 + 1] = (i === 1 ? D[1] : D[1] + (D[i] - D[1]) * sep) * pk + (i === 0 ? Em + (Ef - Em) * sep * st.partK : Em);
      st.offsets[i * 4 + 2] = i === 0 ? 1 : single ? 0 : 1;
      // (w: round 4, how far the middle and near layers are under the descent's cloud, which hides them whole there)
      st.offsets[i * 4 + 3] = i === 0 ? 0 : st.hideK * sep;
    }
    // the sea: at rest its surface lies on the strip's bottom edge (where 4a's feather was); it keeps to the deepest sink,
    // and at the end it lies on the closing's bottom edge (the footer stands in it)
    const rest = clamp01(g.bottomDoc / vh);
    const surf = rest + seaSink() * g.liftF * pk + Em;  // from the top
    const hz = 0.72 + (T.haze - 0.72) * pk;
    st.sea.set([1 - surf, T.soft, 1 - hz, T.billow]);
    st.k.set([1, pk, T.seaK, T.hazeK * sstep(0, 0.6, pk)]);
    // the cloud the camera rises through: from just above the middle layer's highest crest (where it stands now) down
    // (round 4: and, coming back down, where its motion puts it: the drop taken inside never moves the bank's top)
    const ctop = (g.crest / vh) + D[1] * pk + Emo - 0.03;
    // (w: the sea's body, calmer once settled than while the camera rises through it)
    st.cloud.set([st.cloudK * sep, 1 - ctop, 0.08, sstep(0, 0.45, pk) * (T.body[0] + (T.body[1] - T.body[0]) * st.midK)]);
    // the curtain (a place with an anchor): its edge where the anchor stands once stepped, ~110 px wide
    // (round 3: it lifts as a front that clears leftward from the anchor, so the bridge comes out of the mist east to
    // west, crown before the west leg. Round 4: it lifts once the whole arch stands clear of the text's veils, at
    // T.reveal's rate (revK, draw()); timed by the descent, it lifted while the crown was still under the last table's
    // bottom veil, or within one wheel tick)
    if (g.curtX >= 0 && T.curtain > 0) {
      const lift = st.revK;
      st.curt.set([(g.curtX - lift * (g.curtSweep ?? cssW * 0.3)) / (cssW || 1), T.curtain * st.slideK * (1 - sstep(0.7, 1, lift)) * sep * st.curtH, 85 / (cssW || 1), 0]);
    }
    else st.curt.fill(0);
    return { ids: STAGE_IDS, offsets: st.offsets, view: st.view, k: st.k, sea: st.sea, rects: st.rects, cloud: st.cloud, curt: st.curt };
  }

  function updateWake(dt: number, now: number) {
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
    // the trail: a point where the wake has been, every ~40 ms of travel. Only travel pushes one (measured from the last
    // point pushed, which outlives the trail): a parked pointer's trail ages out and is not re-seeded, so the wake stops
    // asking for frames (round 3: an empty trail used to be re-seeded at once, which kept the loop at the wake's ~30 fps
    // for the whole 45 s awake wherever the pointer rested on a living page)
    const moved = !wake.pushed || Math.hypot(wake.x - wake.px, wake.y - wake.py) > 0.012 * cssH;
    if (wake.s > 0.02 && now - wake.pushedAt > 40 && moved) {
      trail.unshift({ x: wake.x, y: wake.y, s0: wake.s, t: now });
      wake.pushedAt = now;
      wake.px = wake.x; wake.py = wake.y; wake.pushed = true;
      if (trail.length > TRAIL - 1) trail.length = TRAIL - 1;
    }
    while (trail.length && now - trail[trail.length - 1].t > TRAIL_AGE) trail.pop();
    // uniforms (uv, origin bottom-left)
    trailU.fill(0);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const put = (i: number, x: number, y: number, s: number) => {
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

  function updateSweep(dt: number) {
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
    sweepU[0] = x; sweepU[1] = SWEEP_W * sw.dir; sweepU[2] = a; sweepU[3] = thick;   // (P1: the sign carries its travel, for the silk veil; the bank squares it)
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
  function draw(now: number) {
    const dt = clockLast ? Math.max(0, Math.min(250, now - clockLast)) : 0;
    clockLast = now;
    let animating = false, due = Infinity, heavy = false;

    // Veils are viewport rects (they follow their text as the page scrolls), so a scroll re-measures them too; a
    // window's keep-out and note are box-relative and only change on measure frames.
    if (need & S_SCROLL) { readBoxes(); if (!(need & S_MEASURE)) measureVeil(); need |= S_PRESENT; }
    if (need & S_MEASURE) { measureVeil(); measureKeep(); need |= S_PRESENT; }

    const panning = !!tween;   // the frame that ends a pan is still painted as a pan frame
    let dtT = dt;
    if (tween && tween.clock === undefined) {
      // the pan's first frame: its clock starts here (round 3: it used to take the stale gap since the last ambient frame,
      // up to 250 ms, and the whip ease front-loads, so the pan's first frame jumped a quarter of the way)
      tween.clock = 0;
      dtT = 0;
      // 4b: from a lifted pose the camera first comes down to the opening on the three layers (HOLD_MS, shorter for a
      // small pose), then the combined layer takes over exactly where they stand: never a jump while the old text shows
      // (round 4: and where the descent has parted the far layer from the middle one, it brings them together first)
      const m = stageOn() && st.ok && !st.single && W > 0 && !quantized() ? Math.max(st.prog * (1 - st.desc), st.cloudK, st.curt[1], st.slideK * Math.min(1, Math.abs(st.slidePx) / 40),
        Math.min(1, (Math.abs(st.endMid - st.endSink) * st.desc * (cssH || 0)) / 120)) : 0;
      tween.hold = m > 0.02 ? HOLD_MS * Math.sqrt(Math.min(1, m)) : 0;
      tween.held = 0;
      if (tween.hold) {
        st.holdP = st.prog; st.holdC = st.cloudK; st.holdS = st.slideK;
        st.holdG = st.holdG || { bottomDoc: st.bottomDoc, crest: st.crest, slidePx: st.slidePx, curtX: st.curtX, curtSweep: st.curtSweep, endSink: st.endSink, endMid: st.endMid, jump: st.jump, liftF: st.liftF };
      }
    }
    const holding = !!tween && tween.held < tween.hold && stageOn() && st.ok;
    if (holding) { tween!.held += dtT; animating = true; }
    else if (tween) {
      tween.t = tween.dur > 0 ? Math.min(1, tween.t + dtT / tween.dur) : 1;
      const ease = tween.ease === 'cubic' ? easeCubic : easeWhip;
      const e = ease(tween.t);
      if (tween.cut) {
        // travel CUT_SPAN on screen; the middle of the journey is spliced out under the thick mist
        const D = tween.to - tween.from, sg = Math.sign(D), span = Math.min(CUT_SPAN, Math.abs(D));
        stretch = tween.from + sg * (span * e + (e >= ease(CUT_AT) ? Math.abs(D) - span : 0));
        const pre = e < ease(CUT_AT);
        if (el('silkVeil')) {
          if (tween.pre && !pre) xfT = 0;
          xfGrab = pre;
        }
        tween.pre = pre;
      } else stretch = tween.from + (tween.to - tween.from) * e;
      curSpec = blendSpec(tween.fromSpec, tween.toSpec, e);
      if (tween.t >= 1) {
        finishPan();
        // the pan is over: the scroll, the boxes and the step are read again at the page's own stretch (the camera was
        // held at the opening while it ran; it now glides to where the scroll puts it)
        if (stageOn()) { readBoxes(); measureVeil(); measureKeep(); }
      } else animating = true;
    }
    if (arriving) {
      if (dt > 0 && !hidden) arriveSeen = true;
      arrive += (dt / 1000) * arriveRate;
      if (morning ? arrive * mornK() >= MORN_SUNUP : arrive >= 1.24) sendSunUp();
      if (morning ? arrive >= Math.max(ARRIVE_END, MORN_END / mornK()) : arrive >= ARRIVE_END) { arriving = false; arrive = 9; sendSunUp(); } else animating = true;
    }
    if (stepHz(false)) need |= S_PRESENT;
    if (Math.abs(hzK - hzTarget) > 1e-4 && !quantized() && forced === null) animating = true;
    if (sw) { if (updateSweep(dt)) animating = true; need |= S_PRESENT; }
    if (!tween || !tween.cut) xfGrab = false;
    if (xfT >= 0) {
      xfT += dt;
      if (xfT >= xfMs() || quantized() || hidden) xfT = -1;
      animating = true; need |= S_PRESENT;
    }
    if (wake.has || wake.s > 0 || trail.length) { if (updateWake(dt, now)) need |= S_PRESENT; }
    if (settling) {
      // P3 (elements.ts stillSettle): Still was asked for: the drift, the small life and the plum ease to rest over
      // SETTLE_MS (at the wake's pace), then the painting is still
      driftT = Math.max(0, driftT - dt / SETTLE_MS);
      const d = driftT * driftT * (3 - 2 * driftT);
      if (d > 0) time += (dt / 1000) * d * T.drift;
      need |= S_PRESENT;
      if (driftT <= 0) {
        settling = false;
        still = true;
        stirs.length = 0; gust = null;
        need |= S_SCROLL | S_SCENE | S_PRESENT;
      }
    } else if (drifting() && dt > 0) {
      driftT = awake() ? Math.min(1, driftT + dt / EASE_IN_MS) : Math.max(0, driftT - dt / EASE_OUT_MS);
      const d = driftT * driftT * (3 - 2 * driftT);
      if (d > 0) { time += (dt / 1000) * d * T.drift; need |= S_PRESENT; }   // (every page: gently perceptible)
    }
    // P3: the gust, Still settling and the stirred water ask for presents while they move
    if (fxFast(now) || stirs.length) need |= S_PRESENT;

    // the scenes: a window repaints when its framing, palette, keep-out or figures change, while it is in motion,
    // and once at full quality after motion stops. Never while the page merely scrolls (its key stays the same).
    const moving = (panning && !holding) || arriving;
    const draft = mode === 'webgl' ? moving && draftScale < 1 : panning && !holding;
    const U0 = { tide, draft, draftScale, aspect, stillL: stillLight() };
    const slots = lastSlots = figSlots();
    for (const s of slots) if (s.k < 1) animating = true;
    const scrollIdle = performance.now() - lastScroll > 100;
    const settleDue = !moving && performance.now() - counts.draftAt >= FULL_MS - 8;
    const staged = stageOn() && W > 0;
    for (const w of wins) {
      if (staged || !w.box || !(w.vis || (w.want && scrollIdle))) continue;   // (the stage stands in for both windows)
      if (w.draft && !moving && !settleDue) due = Math.min(due, counts.draftAt + FULL_MS);
      if (paintWin(w, U0, slots, ((need & S_SCENE) !== 0 && w.vis) || (w.draft && settleDue))) {
        heavy = heavy || moving;
        need |= S_PRESENT;
        w.want = false;
      }
      if (w.pending) animating = true;
    }
    if (staged) {
      // entering the living ground: 4a's views (the strip, the closing, the horizon band) are freed
      if (!st.alloc) drop4a();
      // the camera: scroll-linked (exact) at rest; during a pan it comes down to the opening (the scroll's own targets
      // are kept), and after it glides back to them: never a jump
      const pan = !!tween;
      // (a slow frame never takes a big step: the glide's step is capped at 50 ms of its time)
      const kG = dt > 0 ? 1 - Math.exp(-Math.min(dt, 50) / GLIDE_TAU) : 0;
      const gl = pan || (st.glide && !quantized());
      const ease = (a: number, b: number) => (!gl || Math.abs(b - a) < 2e-3 ? b : a + (b - a) * kG);
      if (holding) {
        // the hold: the lift, the cloud and the sideways step come down to exactly 0 (eased in time) and the curtain lifts,
        // on the three layers (the combined layer has one depth and one step for every plane)
        const h = 1 - sstep(0, tween!.hold, tween!.held);
        st.prog = st.holdP * h;
        st.cloudK = st.holdC * h;
        st.slideK = st.holdS * h;
        st.curtH = h;
        st.partK = h;
      } else {
        st.prog = ease(st.prog, pan ? 0 : st.progT);
        st.cloudK = ease(st.cloudK, pan ? 0 : st.cloudT);
        st.slideK = ease(st.slideK, pan ? 0 : st.slideT);
        st.holdG = null;
        if (pan) st.curtH = 0;
      }
      // (the descent holds still during the hold: lowering every layer alike, it never parts them, and easing it there
      // would bring the lift and the curtain back for a moment on the way down)
      if (!holding) st.desc = ease(st.desc, pan ? 0 : st.descT);
      st.midK = ease(st.midK, pan ? 0 : st.midT);
      // (round 4: the part of the drop taken inside the descent's cloud holds with the descent; under the cloud they go)
      if (!holding) st.jumpK = ease(st.jumpK, pan ? 0 : st.jumpT);
      st.hideK = holding ? Math.min(st.hideK, st.cloudK) : ease(st.hideK, pan ? 0 : st.hideT);
      if (gl) {
        const off = pan || st.prog !== st.progT || st.desc !== st.descT || st.slideK !== st.slideT || st.cloudK !== st.cloudT || st.midK !== st.midT
          || st.jumpK !== st.jumpT || st.hideK !== st.hideT;
        if (off) animating = true; else st.glide = false;
      }
      // the curtain's reveal follows its target at T.reveal's rate (both ways), in time rather than with the scroll, so a
      // burst of wheel ticks never pops the bridge in; quantized modes and forced poses switch at once
      if (st.revK !== st.revT) {
        const rate = Math.min(dt, 50) / (Math.max(0.05, T.reveal) * 1000);
        st.revK = quantized() || forced !== null ? st.revT : st.revK + Math.max(-rate, Math.min(rate, st.revT - st.revK));
        if (Math.abs(st.revK - st.revT) < 1e-3) st.revK = st.revT;
        need |= S_PRESENT;
        if (st.revK !== st.revT) animating = true;
      }
      const single = moving;
      if (st.layers.some((L) => L.draft) && !moving && !settleDue) due = Math.min(due, counts.draftAt + FULL_MS);
      // (no paint during the hold: the three views on show are kept as they are, even across a route swap)
      if (!holding && paintStage(U0, slots, (need & S_SCENE) !== 0, single)) { need |= S_PRESENT; heavy = heavy || moving; }
      // one combined layer carries every plane at the middle one's depth; when the three take over, the far layer glides
      // from there to its own depth and step (it never jumps; quantized modes switch at once)
      if (st.single) st.sepK = 0;
      else if (st.sepK < 1) { st.sepK = quantized() || st.sepK > 0.998 ? 1 : st.sepK + (1 - st.sepK) * kG; if (st.sepK < 1) animating = true; }
      if (st.pendingSplit || st.layers.some((L) => L.pending)) animating = true;
      need |= S_PRESENT;
    } else if (st.alloc) dropStage();   // left the living ground (a 4a page, or a narrower window): free the layers
    if ((hzOn || fullMode) && W && !stageOn() && (hzK > 0 || (hzv.want && scrollIdle))) {
      if (hzv.draft && !moving && !settleDue) due = Math.min(due, counts.draftAt + FULL_MS);
      if (paintHorizon(U0, hzv.draft && settleDue)) { need |= S_PRESENT; hzv.want = false; heavy = heavy || moving; }
      if (hzv.pending) animating = true;
    }
    if (!drawnFigs && (wins.some((w) => w.painted) || st.ok)) drawnFigs = true;

    const shown = anyVisible || stageShown();
    if (shown !== wasVisible) need |= S_PRESENT;
    if ((need & S_PRESENT) && (shown || wasVisible || hzK > 0 || !drawnOnce || sw)) {
      const t = performance.now();
      renderer!.present(presentU());
      lastPresent = t;
      counts.presentMs = Math.round((performance.now() - t) * 10) / 10;
      counts.presents++;
      drawnOnce = true;
      wasVisible = shown || hzK > 0;
    }
    need = 0;
    return { animating, heavy, due };
  }

  // ---------------------------------------------------------------- 4b small life (the present pass)
  // The figure layers' life anchors (figures.ts THE LIFE API), placed each frame on the canvas through the view each one
  // lies in (a window at its live box and sink; the stage's layer at its own slide and sink), as a small table the
  // present shader works out once per pixel and lays into that view's sample (shaders.ts, lifePrep / lifeLay): the
  // water's shimmer, a thread of smoke, the willows' sway, one drifting boat (a sprite the worker cut out of its layer).
  // No frame of its own: it rides the ambient frames, on the drift's clock, so it stops with the mist (reduced motion,
  // Still, the idle sleep, a hidden tab, nothing on screen), and its strength eases to the still painting with the drift
  // (the boat stays, where it stands). With nothing that moves on screen, gl.ts draws with the program without life.
  // (a walker is drawn as a boat is: a sprite from the layer's atlas, kind 4)
  const LIFE_KIND: Record<LifeKind, number> = { shimmer: 1, smoke: 2, willow: 3, boat: 4, walker: 4 };
  const LIFE_ORDER: Record<LifeKind, number> = { boat: 0, walker: 0, shimmer: 1, smoke: 2, willow: 3 };   // (sprites first: they are no longer in their layer)
  const SPRITED = (a: LifeOut): a is LifeOut & Required<Pick<LifeOut, 'cut' | 'atlas'>> => (a.kind === 'boat' || a.kind === 'walker') && Array.isArray(a.cut) && Array.isArray(a.atlas);
  const LIFE_AMP: Partial<Record<LifeKind, number>> = { shimmer: 0.3, smoke: 1, willow: 1.8 };   // (M n1: the willow sways 1.5x wider)          // the shimmer's strength; the sway in CSS px
  const lifeR = new Float32Array(LIFE * 4), lifeA = new Float32Array(LIFE * 4), lifeB = new Float32Array(LIFE * 4);
  const lifeK = new Float32Array(4), lifeUb = new Float32Array(4), lifeFR = new Float32Array(4);
  const lifeTs = new Float32Array(8);
  const lifeT: LifeTable = { rect: lifeR, a: lifeA, b: lifeB, k: lifeK, union: lifeUb, figR: lifeFR, starts: lifeTs, ridge: null, sprite: null, fig: null,
    stir: stirU, stirK: stirKU, gust: gustU, gust2: gust2U };
  let lifeN = 0, lifeKinds: LifeKind[] = [];
  /** The world point (viewport heights across, scene height up) of a world px point of a figure layer. */
  const lifeW = (x: number, y: number) => [(x / REF_PX) * HS, 1 - (y * HS) / REF_PX];
  // A walker's place on its path now (world px from its home) and its alpha (out of the mist at the path's start, into it
  // at its end): the path's arc length is walked at params.speed from the point nearest home, and comes round again.
  const walkCache = new WeakMap<LifeOut, { s: number[]; len: number; home: Pt; hs: number }>();
  function walkerAt(a: LifeOut, t: number) {
    const p = a.params || {}, path = Array.isArray(p.path) ? p.path : null;
    if (!path || path.length < 2) return null;
    let W = walkCache.get(a);
    if (!W) {
      const s = [0];
      for (let i = 1; i < path.length; i++) s.push(s[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
      const home = Array.isArray(p.home) ? p.home : path[0];
      let hs = 0, best = Infinity;
      for (let i = 0; i < path.length; i++) { const d = Math.hypot(path[i][0] - home[0], path[i][1] - home[1]); if (d < best) { best = d; hs = s[i]; } }
      W = { s, len: s[s.length - 1], home, hs };
      walkCache.set(a, W);
    }
    if (!(W.len > 1)) return null;
    const run = W.hs + (p.speed || 0) * (t - 40);
    const at = ((run % W.len) + W.len) % W.len;
    let i = 1;
    while (i < W.s.length - 1 && W.s[i] < at) i++;
    const f = (at - W.s[i - 1]) / Math.max(1e-6, W.s[i] - W.s[i - 1]);
    const x = path[i - 1][0] + (path[i][0] - path[i - 1][0]) * f, y = path[i - 1][1] + (path[i][1] - path[i - 1][1]) * f;
    const fade = Math.min(30, W.len * 0.12);
    return { x: x - W.home[0], y: y - W.home[1], alpha: sstep(0, fade, at) * sstep(W.len, W.len - fade, at) };
  }

  function lifeU(windows: PresentWindow[], stage: StageU | null): LifeTable | null {
    lifeN = 0; lifeKinds = []; lifeK[0] = 0;
    lifeHit = null; plumLimbUV = null;
    if (mode !== 'webgl' || !figuresOn || fullMode || !W || !lastSlots.length) return null;   // (full mode: no figures)
    const vh = cssH || 1, phone = cls === 'phone';
    // the views on screen, each with its map from world to canvas uv, the planes it holds and its arrival (the strip and
    // the stage ink in with the bloom, as their figures do; the closing never blooms)
    const views: LifeView[] = [];
    if (stage) {
      const M = st.view, sp = T.split;
      const ranges = st.single ? [[0, LAYERS - 1, 0]] : [[0, sp[0] - 1, 0], [sp[0], sp[1] - 1, 1], [sp[1], LAYERS - 1, 2]];
      for (const [lo, hi, j] of ranges) {
        const ox = st.offsets[j * 4], oy = st.offsets[j * 4 + 1];
        if (st.offsets[j * 4 + 2] <= 0) continue;
        // (a transparent layer holds nothing left of where the keep-out's mist has cleared it: 140 px left of its edge)
        const kr = wins[0].keepR !== null && wins[0].keepR > 0 && wins[0].box ? (wins[0].keepR + wins[0].box.left - 140) / (cssW || 1) : 0;
        const cx = j > 0 ? Math.max(st.rects[j * 4], kr) + ox : 0;
        views.push({ t: 2 + j, lo, hi, clip: [cx, 0, 1, 1], bloom: true, vr: 'strip',
          map: (w) => [(w[0] - M[0]) / M[3] + ox, 1 - (M[1] - w[1]) / M[2] - oy],
          inv: (u, v) => [M[0] + (u - ox) * M[3], M[1] - (1 - v - oy) * M[2]],
          col: (u) => Math.floor((u - ox) * (cssW / ((cssW + st.ext) || 1)) * st.samples), rid: () => ({ buf: st.buf, samples: st.samples }) });
      }
    } else {
      windows.forEach((w, i) => {
        const M = w.view, R = w.rect, sink = w.sink || 0;
        // (integration: a window holds only the slots of its own variant, as paintWin does: the closing may show its own
        // layer, drawn at another scale, and a strip layer's anchors must not land in it)
        const src = wins.find((x) => x.id === w.id);
        views.push({ t: i, lo: 0, hi: LAYERS - 1, clip: R, bloom: w.id === 'strip', vr: src ? variantOf(src) : 'strip',
          map: (p) => [R[0] + ((p[0] - M[0]) / M[3]) * (R[2] - R[0]), R[1] + (1 - (M[1] - p[1]) / M[2] - sink) * (R[3] - R[1])],
          inv: (u, v) => [M[0] + ((u - R[0]) / (R[2] - R[0])) * M[3], M[1] - (1 - (v - R[1]) / (R[3] - R[1]) - sink) * M[2]],
          col: (u) => Math.floor(((u - R[0]) / (R[2] - R[0])) * (src ? src.samples : 0)), rid: () => ({ buf: src ? src.buf : null, samples: src ? src.samples : 0 }) });
      });
    }
    if (!views.length) return null;
    const list: LifeEntry[] = [];
    for (const slot of lastSlots) {
      const L = slot.L;
      if (!L.life?.length || slot.k <= 0.001 || !renderer!.hasFigure?.(L.key)) continue;
      const r = L.meta.rect, lw = (r[1] - r[0]) * REF_PX, lh = (r[3] - r[2]) * (REF_PX / HS);
      const x0 = r[0] * REF_PX, y0 = (1 - r[3]) * (REF_PX / HS);
      L.life.forEach((a, n) => {
        if (!(a.kind in LIFE_KIND)) return;
        let box = [a.x, a.y, a.x + a.w, a.y + a.h], alpha = 1, sprite: LifeEntry['sprite'] = null;
        if (a.kind === 'boat' || a.kind === 'walker') {
          // it moves only if the worker made it a sprite (else it is painted, still, in the layer)
          if (!SPRITED(a) || !renderer!.hasFigure(`${L.key}#${a.sprite}`)) return;
          box = [x0 + a.cut[0] * lw, y0 + a.cut[1] * lh, x0 + a.cut[2] * lw, y0 + a.cut[3] * lh];
          const p = a.params || {};
          let dx = 0, dy = 0;
          if (a.kind === 'walker') {
            // one slow figure walking its path (world px per second of the drift's clock), out of the mist at the
            // path's start and into it at its end, then round again
            const at = walkerAt(a, time);
            if (at) { dx = at.x; dy = at.y; alpha = at.alpha; }
          } else if (p.bob && p.bob.amp > 0) {
            // a moored boat rising and falling with the water: one slow swell, a smaller faster one over it
            const ph = ((time - 40) / Math.max(1, p.bob.period || 6)) * Math.PI * 2 + (a.x % 7);
            dy = p.bob.amp * (0.78 * Math.sin(ph) + 0.22 * Math.sin(ph * 2.37 + 1.1));
          } else {
            // it drifts along its range at its own speed, and comes round again: into the mist near one end of its
            // range and out of it at the other
            const rg = Array.isArray(p.range) ? p.range : [box[0], box[2]];
            const home = (a.x + a.w / 2), span = Math.max(1, rg[1] - rg[0]);
            const run = (home - rg[0]) + (p.dir! < 0 ? -1 : 1) * (p.speed || 0) * (time - 40);   // (no dir: undefined < 0 is false)
            const at = rg[0] + (((run % span) + span) % span);
            const fade = Math.min(40, span * 0.2);
            alpha = sstep(rg[0], rg[0] + fade, at) * sstep(rg[1], rg[1] - fade, at);
            dx = at - home;
          }
          box = [box[0] + dx, box[1] + dy, box[2] + dx, box[3] + dy];
          sprite = { id: `${L.key}#${a.sprite}`, px: a.spx || [1, 1], atlas: a.atlas };
        }
        for (const v of views) {
          if (a.plane < v.lo || a.plane > v.hi || v.vr !== (slot.v || 'strip')) continue;
          const bloom = v.bloom ? clamp01((arrive - a.plane * 0.1 - 0.35) / 0.6) : 1;
          // (final round: the arrival never fades the plum or the swallow in at partial alpha (a grey "loading" ghost):
          // the plum's ink blooms from its root to its tips over 500 ms (a threshold in the shader, rev), and the
          // swallow flies in at full value, already moving along its heading, gliding up from the left into its place)
          const swing = !!(sprite && a.params?.swing), bird = !!(sprite && a.params?.bird);
          const rev = swing && v.bloom ? clamp01((arrive - a.plane * 0.1 - 0.35) / 0.5) : 1;
          let bx = box;
          if (bird && bloom < 1) { const s = (1 - bloom) * (1 - bloom) * (box[2] - box[0]); bx = [box[0] - s * 1.6, box[1] + s * 0.5, box[2] - s * 1.6, box[3] + s * 0.5]; }   // (along its heading, up from the left, clear of the peak and the header's paper)
          const p0 = v.map(lifeW(bx[0], bx[3])), p1 = v.map(lifeW(bx[2], bx[1]));   // (canvas uv is y up)
          const rc = [Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1]), Math.max(p0[0], p1[0]), Math.max(p0[1], p1[1])];
          const c = v.clip;
          if (rc[2] < Math.max(0, c[0]) || rc[0] > Math.min(1, c[2]) || rc[3] < Math.max(0, c[1]) || rc[1] > Math.min(1, c[3])) continue;
          list.push({ a, n, L, v, rc, k: slot.k * (swing || bird ? 1 : bloom) * alpha, sprite, area: (rc[2] - rc[0]) * (rc[3] - rc[1]), rev });
        }
      });
    }
    // life's strength: eased with the drift (the idle sleep), none when the painting is still; then only a boat (cut out
    // of its layer) still has to be drawn
    const d = ambientWanted && !quantized() ? driftT * driftT * (3 - 2 * driftT) : 0;
    if (d <= 0) for (let i = list.length - 1; i >= 0; i--) if (!list[i].sprite) list.splice(i, 1);
    if (!list.length) return null;
    // one view holds life in a frame (the shader works it out once per pixel): the boat's, else the one with the first
    // entry by priority. In practice there is only one: the stage's layer of the page's own set, or the window in which
    // its place shows (two windows both with life on screen at once: the strip keeps it).
    list.sort((p, q) => LIFE_ORDER[p.a.kind] - LIFE_ORDER[q.a.kind] || p.v.t - q.v.t || q.area - p.area);
    const lv = list[0].v;
    const mine = list.filter((e) => e.v === lv).slice(0, LIFE).sort((p, q) => LIFE_KIND[p.a.kind] - LIFE_KIND[q.a.kind]);
    lifeR.fill(-1); lifeA.fill(0); lifeB.fill(0);
    for (let i = 0; i < LIFE; i++) lifeR[i * 4] = 2;
    const U = [2, 2, -1, -1];
    lifeT.sprite = lifeT.fig = null;
    lifeT.ridge = lv.t >= 2 ? STAGE_IDS[lv.t - 2] : windows[lv.t]?.id || null;   // (the stage's layers share one set of ridges)
    for (const e of mine) {
      if (lifeN >= LIFE) break;
      const { a, v, rc } = e;
      const i = lifeN;
      let B = [0, 0, 0, 0], amp = LIFE_AMP[a.kind] ?? 1;
      if (a.kind === 'shimmer') {
        amp *= phone ? 0.8 : 1;
        B = [1, 0.15, a.params?.rings ?? 0, 0];   // (d5 f1: z = ripple rings)
        if (!lifeT.fig) {
          const r = e.L.meta.rect;
          lifeT.fig = e.L.key;
          lifeFR.set([r[0] * HS, r[2], 1 / ((r[1] - r[0]) * HS), 1 / (r[3] - r[2])]);
        }
      } else if (a.kind === 'smoke' && a.params?.fall) {
        // P3 (elements.ts waterfall): the fall's column: its x, its lip's and its foot's y (canvas uv), its half-width
        const f = a.params.fall;
        const lip = v.map(lifeW(f.x, f.y0)), foot = v.map(lifeW(f.x, f.y1)), side = v.map(lifeW(f.x + f.hw, f.y0));
        B = [lip[0], lip[1], foot[1], Math.abs(side[0] - lip[0])];
        if (!lifeT.fig) {
          const r = e.L.meta.rect;
          lifeT.fig = e.L.key;
          lifeFR.set([r[0] * HS, r[2], 1 / ((r[1] - r[0]) * HS), 1 / (r[3] - r[2])]);
        }
      } else if (a.kind === 'smoke' && a.params?.petals) {
        // d5 f1: falling petals (the present pass draws them in the box): count, speed, size (canvas uv x), 0
        const pp = a.params.petals;
        // (P2 morning: w holds the petals back until its end, then they come as a small gust once the light is up)
        B = [Math.min(12, pp.n), pp.speed ?? 1, (pp.size * (rc[2] - rc[0])) / Math.max(1, a.w), morning && arriving ? 1 - clamp01((mornNow() - 1.5) / 0.6) : 0];
        petalR = B[2];   // (P3 plumGust: the gust's petals are the plum's own size)
      } else if (a.kind === 'smoke') {
        const src = Array.isArray(a.params?.src) ? a.params.src : [a.x + a.w / 2, a.y + a.h];
        const s0 = v.map(lifeW(src[0], src[1]));
        const H = Math.max(1, a.h);
        B = [s0[0], s0[1], ((a.x + a.w / 2 - src[0]) / H) * 1.2, Math.max(0.08, (a.w / H) * 0.22)];
      } else if (a.kind === 'willow') {
        const f = Array.isArray(a.params?.foot) ? a.params.foot : [a.x + a.w / 2, a.y + a.h];
        const p = v.map(lifeW(f[0], f[1]));
        // (at most 1.5 CSS px, calmer on phones)
        B = [p[0], p[1], Math.max(1e-4, rc[3] - p[1]), (Math.min(2.2, amp * (phone ? 0.6 : 1)) / (cssW || 1))];
        amp = 1;
      } else if (e.sprite) {
        if (lifeT.sprite && lifeT.sprite !== e.sprite.id) continue;   // (one layer's sprite atlas on show at a time)
        lifeT.sprite = e.sprite.id;
        // its crisp tap's level: sprite texels per buffer pixel; its place in the atlas
        const lod = Math.max(0, Math.log2(e.sprite.px[0] / Math.max(1e-3, (rc[2] - rc[0]) * W)));
        B = [e.k, lod, e.sprite.atlas[0], e.sprite.atlas[1]];
        amp = 1;
        if (a.params?.swing) {   // (P3 plumGust: the bough's limb, its line on the canvas)
          plumLimbUV = Array.isArray(a.params.limb) ? a.params.limb.map((p) => v.map(lifeW(p[0], p[1]))) : null;
        }
      }
      // (P3 contactLife: a clump that bends in the breeze gets 8 % more room each side, so its bent tips are never cut;
      // the shader maps back into the sprite)
      const bend = !!(e.sprite && a.params?.bend && el('contactLife'));
      const rcB = bend ? [rc[0] - (rc[2] - rc[0]) * 0.08 / 1.0, rc[1], rc[2] + (rc[2] - rc[0]) * 0.08, rc[3]] : rc;
      lifeR.set(rcB, i * 4);
      lifeA.set([LIFE_KIND[a.kind], e.sprite ? e.sprite.atlas[2] : (a.params?.fall ? -2 : a.params?.petals ? -1 : 0), e.sprite ? (a.params?.bird ? 2 : a.params?.swing ? 3 + 0.45 * (1 - (e.rev ?? 1)) : bend ? (phone ? 4.6 : 4.99) : 1) : amp * e.k, ((e.n * 0.618 + e.L.stretch * 0.31) % 1) * 6.28], i * 4);
      lifeB.set(B, i * 4);
      U[0] = Math.min(U[0], rcB[0]); U[1] = Math.min(U[1], rcB[1]); U[2] = Math.max(U[2], rcB[2]); U[3] = Math.max(U[3], rcB[3]);
      // P3 (elements.ts contactLife): the shimmer's auto drops (the ferryman's pole, the bow) fall now and then, each on
      // its own slow beat, only while the painting is awake (they ride the ambient frames)
      if (a.kind === 'shimmer' && Array.isArray(a.params?.drops) && el('contactLife') && d > 0.5) {
        a.params.drops.forEach((pt, k) => {
          const key = `${e.L.key}|${e.n}|${k}`, now = performance.now();
          const next = autoNext.get(key);
          if (next === undefined) { autoNext.set(key, now + 900 + k * 2600); return; }
          if (now < next) return;
          const w = lifeW(pt[0], pt[1]);
          addStir({ wx: w[0], wy: w[1], t: v.t, t0: now, seed: (stirSeq++ * 0.618034) % 1, kind: 2 });
          autoNext.set(key, now + 5200 + 2400 * (((stirSeq * 0.37) % 1)));
        });
      }
      lifeKinds.push(a.kind);
      lifeN++;
    }
    if (!lifeN) return null;
    lifeHit = lv;
    // P3 (elements.ts stir, contactLife): the live ring sets in this view, at their world points (they ride the scroll)
    const now = performance.now();
    stirU.fill(-1);
    for (let i = stirs.length - 1; i >= 0; i--) if (stirs[i].t !== lv.t || now - stirs[i].t0 > STIR_LIFE[stirs[i].kind] * 1000) stirs.splice(i, 1);
    stirs.forEach((S, i) => {
      const p = lv.map([S.wx, S.wy]);
      stirU.set([p[0], p[1], (now - S.t0) / 1000, S.kind * 2 + S.seed], i * 4);
      const rx = 78 / (cssW || 1), ry = 78 / 3.4 / vh + 8 / vh;
      U[0] = Math.min(U[0], p[0] - rx); U[1] = Math.min(U[1], p[1] - ry); U[2] = Math.max(U[2], p[0] + rx); U[3] = Math.max(U[3], p[1] + ry);
    });
    stirKU.set([stirs.length ? 1 : 0, el('stillSettle') ? 1 : 0, stage ? cssW / ((cssW + st.ext) || 1) : 1, el('stir') ? 1 : 0]);
    // P3 (elements.ts plumGust): the gust's age, lean and the bough's nudge; its petals' origin (a world point, mapped back)
    gustU.set([-1, 0, 0, 0]);
    if (gust && (now - gust.t0) / 1000 > 7.6) gust = null;
    if (gust && el('plumGust')) {
      const p = lv.map(lv.inv(gust.u, gust.v)), age = (now - gust.t0) / 1000;
      gustU.set([age, gust.dir, 1, 0.04]);
      gust2U.set([p[0], p[1], petalR || 0.004, (gust.t0 * 0.001) % 97]);   // (w: this gust's seed)
      U[0] = Math.min(U[0], p[0] - 280 / (cssW || 1)); U[1] = Math.min(U[1], p[1] - 200 / vh); U[2] = Math.max(U[2], p[0] + 280 / (cssW || 1)); U[3] = Math.max(U[3], p[1] + 60 / vh);
    }
    // where each kind's run starts (shimmer, smoke, willow, boat), the count, the view
    const from = (k: number) => { let i = 0; while (i < lifeN && lifeA[i * 4] < k) i++; return i; };
    lifeTs.set([from(1), from(2), from(3), from(4), lifeN, lv.t, 0, 0]);
    lifeUb.set([Math.max(0, U[0]), Math.max(0, U[1]), Math.min(1, U[2]), Math.min(1, U[3])]);
    lifeK.set([d, 1 / W, 1 / H, 40 / vh]);
    return lifeT;
  }

  const liveU = new Float32Array(4), liveU2 = new Float32Array(4);
  let qaNoVeil = false;
  function presentU(): PresentU {
    // 4b, every page: the veil's tear moves only its edge, the drift keeps off the paper under text, and the sky deck
    // lets the mist drift gently perceptibly in open sky (_notes/r4b/RECORD.md §2.3). Living (the stage): a solid core of T.core
    // px round the text's own lines, then a torn edge that swells in and out with the words, and a clearing beyond it
    // (viewport heights).
    const vhPx = cssH || 1;
    const staged = stageOn();
    // (the living veils' feather, swell and clearing grow with a wide window's margins beside a block, up to 1.8x at
    // 2592 px: the painting there is larger, and a 56 px edge would cut a peak; the solid core stays T.core. Round 3: the
    // painter scales them itself, beside a block only (above and below it they keep their 1440 reach))
    liveU.set([staged ? 2 : 1, T.core / vhPx, T.feather / vhPx,
      mode === 'webgl' ? T.sky * (1 + (staged && st.ok ? T.rise * st.midK : 0)) : 0]);
    // (A r2: a story-map still has no header above it: its scroll is sent far down, so the header's paper band (shaders.ts)
    // never reaches the still)
    liveU2.set([qaFrame ? 100 : (window.scrollY || 0) / vhPx, T.clear / vhPx, T.swell / vhPx, 1 / vhPx]);
    if (qaNoVeil) { veil.fill(-1); veilS.fill(0); }
    const windows: PresentWindow[] = [];
    for (const w of wins) {
      if (staged || !w.vis || !w.box || !w.viewU || !w.painted) continue;
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
        // (M n1: w = 1 marks the page's own hero window: the inner pages' sky grade stays inside it)
        keep: new Float32Array(w.keepU ? [w.keepU[0], w.keepU[1], w.keepU[2], w.kind === 'strip' ? 1 : 0] : [0, 0, 0, w.kind === 'strip' ? 1 : 0]),
        sink: w.sink || 0,
      });
    }
    const stage = stageOn() && st.ok ? stageU() : null;
    return {
      aspect,
      stillL: stillLight(),
      morn: mornNow(),
      windows,
      life: lifeU(windows, stage),
      horizon: hzK > 0 && hzv.painted ? { id: hzv.id, k: hzK, view: hzv.view } : null,
      hzK,
      time,
      veil, veilS, veilF,
      veilR: 0.13 * Math.min(1, aspect),   // the veil's feather: 13% of the shorter side (x veilF per veil)
      trail: trailU, wakeBox, wakeR: wakeR(),
      sweep: sweepU, sweepSeed,
      grab: xfGrab,
      hold: xfT >= 0 ? 1 - sstep(0, xfMs(), xfT) : 0,
      sweepKeep: wins[0].keepR !== null && wins[0].keepR > 0 && wins[0].box ? (wins[0].keepR + wins[0].box.left) / (cssW || 1) : 0,
      stage,
      live: liveU,
      live2: liveU2,
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
    // (the stage: the scroll and the step are read again at this stretch, and the pose glides there from the opening)
    need |= S_SCENE | S_PRESENT | S_SCROLL | S_MEASURE;
    if (stageOn()) st.glide = true;
    st.curtH = 1; st.holdG = null;   // (the curtain comes back with the split: it is x sepK)
    st.partK = 1;
    t.resolve();
  }
  function panTo(to: number, o: PanOptions = {}) {
    if (destroyed || !renderer) return Promise.resolve();
    const dest = num(to, stretch);
    const toSpec = spec(o.distance ?? specName(tween ? tween.toSpec : curSpec), o.presence ?? (tween ? tween.toSpec : curSpec).presence);
    const dur = Math.max(0, num(o.duration, 900));
    finishPanAt();
    const Lb = layerFor(dest, true, 'strip', toSpec);
    return new Promise<void>((res) => {
      if (quantized() || dur === 0 || hidden) {
        stretch = dest;
        curSpec = toSpec;
        // a cut: the new page's figures come in at the quick fade (from whenever they are ready), never pop
        if (Lb) Lb.shownSince = ready(Lb) ? performance.now() : 0;
        need |= S_SCENE | S_PRESENT | S_SCROLL | S_MEASURE;
        if (running()) draw(performance.now());
        res();
        return;
      }
      // a long jump splices out its middle under a thick mist: its own, unless a sweep is (about to be)
      // running; with cloud: false (back/forward) it travels the whole way instead
      const cut = Math.abs(dest - stretch) > 2 && o.cloud !== false && mode === 'webgl';
      // (its clock and hold are set on its first frame)
      tween = { from: stretch, to: dest, fromSpec: curSpec, toSpec, t: 0, dur, ease: o.ease === 'cubic-out' ? 'cubic' : 'whip', cut, resolve: res } as Tween;
      // the destination's layer fades in over the pan's last 40% (or from whenever it is ready, if later)
      if (Lb && !ready(Lb)) Lb.shownSince = 0;
      if (cut && !sw) startSweep(Math.sign(dest - stretch), Math.min(340, dur * 0.75));
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
  function specName(s: Spec): Distance {
    let best: Distance = 'level', w = -1;
    for (const k in s.w) if (s.w[k as Distance] > w) { w = s.w[k as Distance]; best = k as Distance; }
    return best;
  }

  // ---------------------------------------------------------------- the sweep
  function startSweep(dir: number, dur: number) {
    return new Promise<void>((res) => {
      sw = { t: 0, dur, dir: dir < 0 ? -1 : 1, seed: ((sweepN++ * 0.6180339887) % 1) * 9, resolve: res };
      request(S_PRESENT);
    });
  }
  function sweep(o: { dir?: 1 | -1; duration?: number } = {}) {
    if (destroyed || !renderer) return Promise.resolve();
    const dur = Math.max(0, num(o.duration, 420));
    const dir = num(o.dir, 1) < 0 ? -1 : 1;
    endSweep();
    if (quantized() || mode !== 'webgl' || hidden || dur === 0) return Promise.resolve();
    return startSweep(dir, dur);
  }

  // ---------------------------------------------------------------- idle work: what may be needed next
  // Once the first screen is up: the closing's painting (before it can be reached; its own figure layer with it), the
  // horizon band (desktop), and the next stretch's figure layer for the "Next" pan (drawn for that page's composition).
  function idleSoon() {
    cancelIdle();
    // (no requestIdleCallback, Safari: a timer, with a deadline of 8 ms)
    const ric: (f: IdleRequestCallback, o?: IdleRequestOptions) => number | Timer = window.requestIdleCallback || ((f) => setTimeout(() => f({ timeRemaining: () => 8 } as IdleDeadline), 700));
    idleId = ric(() => {
      idleId = 0;
      if (destroyed) return;
      if (wins[1].el && !stageOn()) wins[1].want = true;
      if (hzOn && !stageOn()) hzv.want = true;
      layerFor(Math.round(stretch) + 1, true, 'strip', ownSpec(Math.round(stretch) + 1));
      request(S_SCROLL | S_MEASURE);
    }, { timeout: 2500 });
  }
  function cancelIdle() {
    if (!idleId) return;
    (window.cancelIdleCallback || clearTimeout)(idleId as number);
    idleId = 0;
  }

  // ---------------------------------------------------------------- wire up
  const passive = { passive: true };
  addEventListener('scroll', onScroll, passive);
  addEventListener('pointermove', onPointer, passive);
  addEventListener('pointerdown', onInput, passive);
  addEventListener('pointerdown', onTap, passive);
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
  if (arriving && !wins[0].vis && !(stageOn() && st.stripVis)) { arriving = false; arrive = 9; }
  layerFor(Math.round(target0), true, 'strip', spec(opts.distance, opts.presence));
  need = S_ALL;
  // Arriving from another stretch: start the pan first, so even the first frame belongs to it.
  if (hasFrom) panTo(target0, { duration: num(opts.panDuration, 900), distance: opts.distance ?? 'level', presence: opts.presence ?? 1 });
  // First frame synchronously: the canvas is never shown blank (or black).
  if (deferred) deferFirst();
  else if (renderer && renderer.ready) draw(performance.now());
  else whenReady();
  clockLast = 0;
  request(S_PRESENT);
  idleSoon();

  const handle: EngineHandle = {
    get mode() { return mode; },
    panTo,
    sweep,
    setPalette(p) {
      const next = paletteName(p);
      if (destroyed || next === palette) return;
      palette = next;
      layerFor(Math.round(tween ? tween.to : stretch), true, 'strip', tween ? tween.toSpec : curSpec);
      for (const v of [...wins, hzv, ...st.layers]) v.key = '';
      request(S_SCENE | S_PRESENT);
      surface.dispatchEvent(new CustomEvent('landscape:palette', { bubbles: true, detail: { palette } }));
    },
    prepare(k, o = {}) {
      if (destroyed) return Promise.resolve();
      const j = Math.round(num(k, stretch));
      const L = layerFor(j, true, 'strip', o.distance || o.presence !== undefined ? spec(o.distance, o.presence) : ownSpec(j));
      if (!L || L.status !== 'pending') return Promise.resolve();
      return new Promise<void>((res) => L.waiters.push(res));
    },
    rebind(o = {}) {
      if (destroyed) return;
      const has = (k: keyof EngineTargets) => Object.prototype.hasOwnProperty.call(o, k);
      observeEls(false);
      if (has('strip') || has('head')) wins[0].el = elOr(has('strip') ? o.strip : null, has('head') ? o.head : null);
      if (has('closing') || has('descend')) wins[1].el = elOr(has('closing') ? o.closing : null, has('descend') ? o.descend : null);
      for (const w of wins) { w.key = ''; w.box = null; w.want = false; }
      fullMode = !wins[0].el && !wins[1].el;
      if (has('keepout')) keepEls = toList(o.keepout);
      if (has('wake')) { wakeEls = toList(o.wake); wakeRects = null; wake.dirty = true; }
      if (has('horizon')) { horizonP = clamp01(num(o.horizon, 0.6)); hzv.key = ''; }
      if (has('veil')) veilEls = toList(o.veil);
      if (has('ground')) ground = o.ground === 'living' ? 'living' : '';
      for (const L of st.layers) L.key = '';
      st.geo = '';
      observeEls(true);
      // the new page's boxes and framings, and its horizon state at once (no blend: a page entered mid-scroll
      // shows the right state on its first frame)
      readBoxes();
      measureVeil();
      measureKeep();
      stepHz(true);
      hzv.key = '';
      need |= S_ALL;
      if (running()) draw(performance.now());
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
      if (destroyed) return;
      if (!on && settling) { settling = false; lastInput = performance.now(); request(S_PRESENT); return; }
      if (on === still || (on && settling)) return;
      // P3 (elements.ts stillSettle): with the painting alive, Still lets it settle first (draw(): the drift, the small
      // life and the plum ease to rest over SETTLE_MS, then still); reduced motion, a hidden page or a still drift cut
      if (on && el('stillSettle') && !reduced && mode === 'webgl' && !hidden && driftT > 0.02 && running()) {
        settling = true;
        finishPan();
        endSweep();
        resetWake();
        if (arriving) { arriving = false; arrive = 9; }
        request(S_PRESENT);
        return;
      }
      still = on;
      if (still) {
        finishPan();
        endSweep();
        resetWake();
        if (arriving) { arriving = false; arrive = 9; }
      } else lastInput = performance.now();
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
      if (dwellTimer) clearTimeout(dwellTimer);
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
      removeEventListener('pointerdown', onTap);
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
    ...(QA ? {
      /** QA only: force the opening ('hero'), the settled pose ('horizon') or the end ('closing'); null = the scroll. */
      setState(s: unknown) {
        const next = FORCED.has(s) ? (s as Forced) : null;
        if (next === forced) return;
        forced = next;
        for (const w of [...wins, ...st.layers]) w.key = '';
        stepHz(true);
        request(S_SCROLL | S_SCENE | S_PRESENT);
      },
      /** QA only: { veils: false } paints without the reading veils (to see the painting alone). */
      qa(o: { veils?: boolean } = {}) {
        if ('veils' in o) qaNoVeil = o.veils === false;
        request(S_SCROLL | S_MEASURE | S_PRESENT);
      },
    } : {}),
    stats() {
      const winStat = (w: Win) => (w.box ? { top: Math.round(w.box.top), height: Math.round(w.box.height), visible: w.vis } : { top: null, height: 0, visible: false });
      const frStat = (w: Win) => (w.fr ? { worldLeft: r3(w.fr.worldLeft), worldTop: r3(w.fr.worldTop), scale: Math.round(w.fr.scale), focus: w.fr.focus.map(Math.round), keepoutRight: w.keepR } : null);
      const figs: Record<number, 'none' | 'pending' | 'ready'> = {};
      for (let k = 0; k < STRETCH_COUNT; k++) {
        if (!figureMeta(k) || !figuresOn) { figs[k] = 'none'; continue; }
        // (the closing's own layer counts too: a closing awaiting its figures is not settled)
        const of = (L: Layer | undefined) => (!L ? 'none' : L.status === 'ready' ? 'ready' : L.status === 'failed' ? 'none' : 'pending');
        const a = of(layers.get(layerKey(k))), c = lastSlots.some((s) => s.v === 'closing') ? of(layers.get(layerKey(k, 'closing'))) : 'none';
        figs[k] = c === 'pending' ? 'pending' : a;
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
        figureSlots: lastSlots.map((s) => ({ stretch: s.L.stretch, k: r3(s.k), v: s.v, scale: s.L.scale, standIn: !!s.want })),
        figureLayers: [...layers.values()].map((L) => ({ key: L.key, status: L.status })),
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
        morning: mornNow(),
        ambient: ambientOn(),
        drift: r3(driftT),
        // (a window painted ahead while the bloom ran stays a draft until it comes on screen: only what shows counts)
        draft: wins.some((w) => w.draft && w.vis) || (hzv.draft && hzK > 0) || (stageOn() && st.layers.some((L) => L.draft)),
        // something is still to be painted or settled: a window, the horizon, a pan in progress, a figure layer still
        // fading in, or the stage (a layer pending or a draft awaiting its full-quality paint, or the combined layer still
        // standing in for the three)
        pending: wins.some((w) => w.pending) || hzv.pending || !!tween || lastSlots.some((s) => s.k < 0.999)
          || (stageOn() && (!st.ok || st.single || !!st.pendingSplit || st.glide || st.sepK < 1 || st.revK !== st.revT || st.layers.some((L) => L.pending || L.draft))),
        deferred,
        running: running(),
        ground,
        // (final review r1, item 8) the stage given up by the present governor, and its last samples (ms)
        stageVeto, govPresent: govP.slice(),
        // 4b small life on the last present: how many entries, their kinds, and its strength now (0 = still)
        life: { n: lifeN, kinds: lifeKinds.slice(), k: r3(lifeK[0]), bitmaps: !!renderer?.bitmaps },
        // P3 (elements.ts): what answers the pointer now
        p3: { stirs: stirs.length, gust: !!gust, settling, fine: mqFine.matches },
        ...(QA ? { veils: [...Array(VEILS).keys()].filter((k) => veil[k * 4] > -0.5).map((k) => [veil[k * 4], veil[k * 4 + 1], veil[k * 4 + 2], veil[k * 4 + 3]].map((v, i) => Math.round(i % 2 ? (1 - v) * (cssH || 0) : v * (cssW || 0))).concat(r3(veilS[k]))) } : {}),
        // the living state (QA): `y` is the scroll the state was read at; `ready` = the three layers are painted at full
        // quality and shown; `phase` hero | lifting | settled | descending | end; `prog` the camera's progress (0 at the
        // opening, 1 settled), `desc` the descent (1 = the end pose); `sink` each layer's sink now (CSS px)
        stage: stageOn() ? {
          on: true, y: Math.round(st.y), ready: st.ok && !st.single && !st.pendingSplit && !st.glide && st.sepK >= 1 && st.revK === st.revT && st.layers.every((L) => L.painted && !L.draft && !L.pending),
          phase: st.desc >= 0.999 ? 'end' : st.desc > 0.001 ? 'descending' : st.prog >= 0.999 ? 'settled' : st.prog > 0.001 ? 'lifting' : 'hero',
          single: st.single, glide: st.glide, sep: r3(st.sepK), hold: !!st.holdG, prog: r3(st.prog), lift: r3(st.prog), desc: r3(st.desc), settled: st.prog >= 0.999 && st.desc <= 0.001,
          end: st.desc >= 0.999, cloud: r3(st.cloudK), mid: r3(st.midK), step: r3(st.slideK), curtain: st.curtX >= 0 ? [Math.round(st.curtX), r3(st.curt[1])] : null,
          endSink: Math.round(st.endSink * (cssH || 0)), span: Math.round(st.span), liftF: r3(st.liftF), slide: Math.round(st.slidePx),
          // (round 4) the descent's linear progress; the middle and near layers' end, the drop they take inside the cloud
          // (px) and how far (jump), how far they are under it (hide); the curtain's reveal and its target; the arch's points
          // where the scroll puts them and their clearance from the nearest text band (px)
          descP: r3(st.descP), endMid: Math.round(st.endMid * (cssH || 0)), jumpPx: Math.round(st.jump * (cssH || 0)), jump: r3(st.jumpK),
          hide: r3(st.hideK), reveal: r3(st.revK), revealT: r3(st.revT), arch: st.archNow, archGap: st.archNow ? st.archGap : null,
          painted: st.layers.map((L) => L.painted), pendingSplit: !!st.pendingSplit,
          framing: st.fr ? { worldLeft: r3(st.left), scale: Math.round(st.fr.scale), keepoutRight: wins[0].keepR } : null,
          sink: [0, 1, 2].map((i) => Math.round(st.offsets[i * 4 + 1] * (cssH || 0))),
          crops: st.layers.map((L, i) => (i === 0 ? [0, 0, cssW, cssH] : L.crop.map(Math.round))),
          px: st.layers.map((L) => L.px),
        } : null,
        // QA: GPU / canvas memory held by the engine's views and figure layers (bytes), per view id
        ...(QA ? { memory: renderer?.memory ? renderer.memory() : null } : {}),
        ...counts,
      };
    },
  };
  return handle;
}
