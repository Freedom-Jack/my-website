// engine/index.ts — public API of the generative ink-landscape background.
// Everything else in the site talks to the landscape only through mountLandscape() and the handle
// it returns (plus the DOM-free export cameraFor()). Internals:
// compose.ts (where the mountains and the water stand, how each window frames them), ridges.ts (profiles),
// palette.ts (pigments), figures.ts + figures.worker.ts (the figure layers), gl.ts + shaders.ts (WebGL2 painter),
// canvas2d.ts (fallback).
//
// One fixed canvas paints into windows, boxes on the page: the page's strip ([data-landscape="strip"]) and its
// closing ([data-landscape="closing"]). Each window is its own painting of the one handscroll at its own framing
// (framingAt), rendered once into its own buffer and presented at the box's live position, so it moves 1:1 with the
// page and never re-renders while you scroll. Between them, on desktops, the low ink horizon band fades in (hzK);
// outside them the canvas is paper. The mist drifts and parts around a fine pointer only inside the windows. On wide
// screens a living page's ground is the stage instead (STAGE, THE UNROLL, THE PLATES); below 1200 px the windows into
// the painting open at the page's breaks (GLIMPSE). Figure layers (sets/: the traveller and hut, the river market,
// the pavilion...) are drawn once per (stretch, composition, scale, width class, palette) off the main thread, for the
// composition and at the scale of the window that shows them, and painted into the scene, under the same mist.
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
import { spec, blendSpec, resolve, framing, cameraLeft, framingBlend, widthClass, HS, STRETCH_COUNT, featherOf, REF_PX } from './compose';
import { VEILS, TRAIL, LIFE } from './shaders';
import { paletteName } from './palette';
import { figureMeta } from './figure-meta';
import { el } from '../elements';
import { BAND } from '../band';
import { createFigureSource, type FigureSource } from './figure-source';
import { framingAt, pageSpec, layerScaleAt, SCENES } from './compose';
import type { Distance, Framing, Spec, WindowKind } from './compose';
import type { FigureMeta, LifeKind, LifeOut, Pt } from './figures';
import type { FigureImage, FigureSlot, LifeTable, PresentGlimpse, PresentU, PresentWindow, Renderer, SceneBase, StageU } from './renderer';
import type { LandscapeHandle, LandscapeTargets, Mode, MountOptions, PanOptions, PlateBox, PlateGeometry, PlateKind } from '../types';

// (the figure sets are the worker's: the main thread keeps their metas only, figure-meta.ts; the fallback without a
// worker loads the drawing code on demand, figure-source.ts)

export { cameraFor } from './compose';

/** The handle mountLandscape() returns: the contract's (types.ts LandscapeHandle); QA builds add qa. */
export interface EngineHandle extends LandscapeHandle {
  qa?(o?: { hold?: boolean }): void;
}

const S_SCENE = 2, S_PRESENT = 4, S_MEASURE = 8, S_SCROLL = 16, S_ALL = 31;   // dirty flags
const ARRIVE_END = 1.7;   // s, the bloom is over (matches the shader's "settled")
const LONG_CAP = 3072;    // internal buffer: long side cap (the canvas is the band: 1 / BAND.zoom of the window wide)
const AMBIENT_MS = 70;    // drifting mist: < 15 fps on every GPU
// THE PLATES: the stage developed into the page's own layers on wide screens (see the controller's section)
const PLATE_MS = 33;      // their small life: <= 30 fps, and only the part of a plate that holds it is repainted
const PLATE_IDLE = 60000;    // ...asleep after a minute without input (the band is on every screen of every page)
const PLATE_TILE = 2048;  // a plate is developed in tiles no larger than this (and never larger than the darkroom)
const POINTER_MS = 33;    // the wake: <= 30 fps
const IDLE_MS = 45000;    // no pointer / scroll / key / visibility input for this long: the drift...
const EASE_OUT_MS = 2000; // ...eases to a stop over ~2 s (the loop then sleeps)
const EASE_IN_MS = 800;   // and eases back in on the next input
const FULL_MS = 150;      // motion stopped: one full-quality scene follows the draft frames
const HOLD_MAX = 6000;    // firstFrame 'complete': the first present waits at most this long for the figures and the stage
const HELD_MS = 120;      // the scroll mode's hand (hold): a held frame counts as motion for this long after the call
const GPU_WAIT_MAX = 400; // a frame waits at most this long for the GPU to finish the previous one
const GOV_N = 12;         // governor window: heavy frames sampled...
const SLOW_MS = 45;       // ...and their mean interval that counts as slow
const PRESENT_SLOW = 30;  // plain presents (scroll, drift) are sampled too, by how long the GPU was still seen painting
                          // each one (a lower bound of its cost, to the frame): this mean is < 30 fps (governPresent)
const RESERVE = 0.9;      // a veil this strong is a paper reserve for small print (see measureVeil)...
const RESERVE_FEATHER = 0.5;  // ...with half the feather...
const RESERVE_IN = 24;    // ...reaching its strength once this many CSS px of its lines are on screen
const BAND_TOL = 160;     // living veils: a band of lines this much wider or narrower than the one above starts its own
const BAND_MIN = 100;     // ...once it is this tall (textBands)
// The horizon band: every plane is flattened (HZ_SQUASH) and sinks until its highest crest stands at HZ_TOP (viewport
// heights from the bottom), never less than the plane behind it, its peaks rising from a low mist HZ_BAND below that
// line, its ink times HZ_INK (and the presence ratio).
const HZ_TOP = [0.25, 0.23, 0.205, 0.1, 0.05];
const HZ_INK = [1, 0.97, 0.9, 0.6, 0.4];
const HZ_BAND = 0.17;
const HZ_SQUASH = 0.55;
const HZ_STEP = 0.12;     // hzK eases at most this much per frame (a fast scroll never pops the band in)
const HZ_MEDIA = '(min-width: 64rem) and (min-aspect-ratio: 1/1)';
// The wake: its radius is a share of the viewport's height in CSS px, clamped (WAKE_VH, WAKE_PX: ~115 px at 900 tall,
// half strength ~95 px from the path), so it opens the mist around the pointer inside a strip without reaching across
// the whole band; position lag, strength attack and release (time constants, ms: ~120 ms and ~700 ms to settle), trail
// points' closing time constant.
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
// ...and at most figBudget() bytes of them: the memory gate (45 MB on a laptop at DPR 2, 20 MB on a phone at DPR 3;
// MB = 10^6 bytes) less what the views hold at this viewport (renderer.memory(): 21.0e6 at 1440 x 900 @2, 6.5e6 at
// 390 x 844 @3), never under FIG_FLOOR. Past it the least recently used go first, the neighbours too; never a layer
// on show.
const MEM_GATE_WIDE = 45e6;
const MEM_GATE_PHONE = 20e6;
const FIG_FLOOR = 8e6;
const FIG_GRACE = 3000;   // ...nor one drawn ahead less than this long ago (it is about to be shown)
// A window shows a layer drawn at another scale only between these magnifications: a closing within them shares the
// strip's layer (a mipmapped layer minifies cleanly), and a stand-in must lie within LAYER_STANDIN (never soft or jumpy)
const LAYER_SHARE = [0.6, 1.16];
const LAYER_STANDIN = [0.4, 1.16];
// (The windows' feathers, CSS px, top out of paper and bottom into paper, are compose.ts's featherOf: the band
// framings keep summits and ground clear of them.)
// The living ground (main[data-ground="living"]: every page on the map). On wide screens the page's own scene is
// painted once, full-bleed, into three depth layers (far: the sky and the far ranges; middle: the host and, on the
// river, the water and the town; near: the near crags, Home's traveller and hut), each with real coverage, which
// slide west with the scroll (THE UNROLL, below). A scroll never repaints a layer.
// Below 1200 px, and wherever no hardware GPU paints it (Canvas2D, a software rasteriser: stageOn), the strip and the
// closing stay windows (PART).
const STAGE_IDS = ['stage0', 'stage1', 'stage2'];
const GLIDE_TAU = 150;      // ms: after a pan, and when one combined layer gives way to the three, the pose glides to
                            // where the scroll puts it (an exponential approach) instead of jumping
/** The living ground's numbers (STAGE, per place STAGE_AT): see each one's comment there. */
interface StageTunables {
  split: number[];
  sink: number[];
  seaK: number;
  soft: number;
  billow: number;
  core: number;
  feather: number;
  swell: number;
  clear: number;
  far: number;
  sky: number;
  drift: number;
  /** An inner place (> 0: the hero strip's grade is laid on its stage), its stage dissolving into paper above the
   *  footer (0/1), a per-place seed for their lobes, and how much of each transparent layer's crop height its foot
   *  dissolves over (0 = a hard crop: Home and Work, whose sea covers it). */
  air: number;
  foot: number;
  seed: number;
  botF: number;
}
const STAGE: StageTunables = {
  split: [2, 3],              // the first plane of the middle layer and of the near one (far: 0..1, middle: 2, near: 3..4)
  sink: [0.05, 0.17, 0.26],   // each layer's sink (viewport heights): far, middle, near. They set where a transparent
                              // layer's crop ends below the sea's surface (stageCrops: the sea keeps to the deepest sink,
                              // a layer that sinks less runs that much lower), and so an inner place's foot (botF)
  seaK: 1,                    // the sea's strength (its surface is the strip's own bottom edge)
  soft: 0.06,                 // its surface's softness (viewport heights) and...
  billow: 0.035,              // ...its billows' amplitude
  core: 40,                   // living veils: solid paper this far around the text's own lines (CSS px)...
  feather: 56,                // ...then a torn mist edge this wide...
  swell: 72,                  // ...whose line swells in and out over this much (CSS px: up to 28 in, 44 out), so a
                              // column of text never leaves a ruled edge (the swell travels with the words)...
  clear: 170,                 // ...and the pale mist and the sky deck thin out over this much beyond it (no paper lane)
  far: 0.5,                   // the far layer's resolution (it is soft: half the buffer's, a quarter of its memory)
  sky: 0.45,                  // the sky deck's strength (the drift, gently perceptible in open sky; every page)
  drift: 1.25,                // the drift clock's speed, x real time (every page)
  air: 0,                     // Home and Work: no inner grade; the inner places' > 0 (STAGE_AT)
  foot: 0,                    // ...and their stage clears to paper above the footer (Home and Work: the sea at the footer)
  seed: 0,
  botF: 0,
};
// Per place (stretch): its layers' sinks, and the inner places' grade, footer and soft crops. Home keeps STAGE's
// numbers. The river town is the middle layer (its near layer holds nothing on screen), so the sea keeps to the town's
// sink.
const STAGE_AT: Record<number, Partial<StageTunables>> = {
  1: { sink: [0.06, 0.24, 0.24] },
  2: { sink: [0.02, 0.12, 0.3], air: 0.9, foot: 1, seed: 0.17, botF: 0.3 },     // Writing, the lake
  3: { sink: [0.03, 0.08, 0.12], air: 0.65, foot: 1, seed: 0.53, botF: 0.3 },   // the Résumé, the terraces
  4: { sink: [0.02, 0.1, 0.2], air: 0.85, foot: 1, seed: 0.81, botF: 0.35 },    // Contact, the crossing
};
const PLACE_KEYS = ['sink', 'air', 'foot', 'seed', 'botF'] as const;
// Where the stage is not painted (below 1200 px, or a stage given up: stageVeto), a living page's strip and closing are
// each painted at rest, on a hardware GPU, as two depth layers: the back (the sky and the far ranges) and the front
// (the place: its planes from `split` on, with its figures), which drifts sideways over the back with the scroll
// (THE UNROLL's drift; one view in motion, under reduced motion and Still: partSplit). Present-only: a scroll never
// repaints a layer.
const PART = {
  split: [3, 2, 2, 2, 2] as number[],   // per place (stretch): the first plane of the front (Home: the near crags, its
                                        // hut and traveller; elsewhere the place itself, plane 2, with its figures)
};
/**
 * THE UNROLL. On wide screens the stage is the handscroll: its three layers are painted once at the hero framing,
 * wider to the east by the page's travel (the reach), and slid west linearly with the page's scroll (readStage; on the
 * plates, the page's own scroll timeline), so the page's end stands `share` of the way to the next place's hero
 * framing (measureSlide: from compose.ts's framings, so a page read to its end is already most of the way there) and
 * the page change's pan carries the rest: a pan takes over from where the slide has brought the painting (draw: the
 * slide decays with the pan's ease while the camera travels, so the first frame is the picture on screen and nothing
 * jumps back). The camera (stretch) stays at the page's place while it is read. The stage runs the whole width behind
 * the page, and the words keep their paper by their living veils. The sideways rate is capped (maxRate) so a short
 * page never whips. Reduced motion and Still: the hero pose, then one cut to the end pose once the ending is on
 * screen. Below 1200 px: the strip's painting rides with its box and drifts west as it leaves, the closing's comes in
 * from the east (drift, box widths), and the windows into the painting take their east-going, level poses (GLIMPSE).
 */
const UNROLL = {
  share: BAND.share, // of the way from this page's hero to the next place's (band.ts: the page's styles use it too)
  reach: BAND.reach, // stretches: Contact's travel (no next place; the crossing's open water runs on)
  maxRate: 0.75,     // CSS px of travel per CSS px of scroll at most (a short page travels less; the pan carries more)
  holdAt: 0.25,      // a place's last named thing (compose.ts Frame.holdU) stops the travel this far into the margin
                     // (of the margin's width, from the reading column's edge): the margin shows a drawn place to the end
  endZone: 0.6,      // quantized (reduced motion, Still): the one cut to the end pose, this many viewports before the end
  drift: 0.09,       // below 1200 px: the strip's west drift as it leaves, the closing's as it arrives (box widths)
};

// Windows into the painting (elements.ts glimpses), below 1200 px. At a page's major breaks (<Glimpse>,
// [data-landscape="glimpse"]) a short box opens onto the page's own place. Each window is painted for itself (its own
// framing of the one world, at the screen's resolution: never the strip's layers magnified), once per layout, at
// scroll idle, into one view holding two depth layers (the back: sky, light and far ranges; the front: the place and
// its figures), so a scroll only slides them in the present (no scene is painted while the page scrolls). A page's
// windows are one handscroll unrolled: the same scale in every window, each one further along the place (x),
// east-going and level. While a window passes up the screen the layers pan sideways (a stretch of the river going by;
// the near more than the far), the front drops away below the back where its place lets it (GLIMPSE.splitF px over the
// passage; the back never drops), the sea of cloud climbs a little from the window's foot and the near ink deepens
// toward mid-screen. Reduced motion and Still: each window at its rest (the passage's middle).
interface GlWin {
  /** World x of the window's centre (stretch-local: k + x) and y of its view's centre (scene heights, 0 = the foot). */
  x: number;
  y: number;
  /** The sea of cloud's surface at the passage's start (box uv of the painted band, up; < -0.3 none). */
  sea: number;
  /** The mist between the layers (box uv, up; < -0.5 none). */
  mist: number;
  /** The light's bloom kept (1) or veiled (0). */
  sun: number;
  /** How far the front drops over this window's passage, of its place's (< 1 where the subject is a far peak,
   *  which must still read as the window leaves at the top of the screen). */
  dk: number;
  /** The left side's melt into the mist, CSS px (0: the usual ~44-66), where a near hill comes in
   *  from the left edge: it dissolves into the mist instead of standing cut at the edge. */
  ml: number;
}
interface GlClass {
  /** The world width a window shows (stretches; the same in every window of the page: one scale). */
  w: number;
  win: GlWin[];
  /** A short page's end (the closing's own box). */
  end?: GlWin;
}
interface GlPlace {
  phone: GlClass;
  tablet?: GlClass;
  /** The first plane of the front layer. */
  split: number;
  /** How far the front drops over a passage, of GLIMPSE.splitF (the place itself is the front on the inner pages). */
  drop: number;
  /** The end's water feathers softly into the mist (shaders.ts endS): Contact's only. */
  soft?: boolean;
  /** False where the set paints no sprite of its own (Writing): its windows share the strip's layer. */
  inlay?: boolean;
  /** CSS px added to a mid-page window's 10 px bottom ramp (default 14, shaders.ts uGlD.w; Work's first window keeps
   *  its crisp 10 px foot: 0). */
  ramp?: number;
}
const GW = (x: number, y: number, sea: number, mist = -1, sun = 0, dk = 1, ml = 0): GlWin => ({ x, y, sea, mist, sun, dk, ml });
const GLIMPSE = {
  max: 2,                       // windows on screen at once (shaders.ts GLN; they are >= 1.1 viewports apart)
  clear: 40,                    // CSS px at the box's top and bottom where only paper and mist lie (the words are beyond)
  clearShort: 14,               // ...a sideways phone's slim window: its box keeps 26 px of margin outside it (layout.css)
  mx: 40, my: 26,               // the view's margins round the box (CSS px): room for the pans (they reach 29 px either way;
                                // the margin stays under the phone's 20 MB; the front only ever samples above the box as
                                // it drops, where its own sky is clear)
  splitF: 115, splitB: 0,       // how far the front and the back drop over a passage (CSS px): the back never drops
  panF: 58, panB: 36,           // how far they pan sideways over a passage (CSS px): the near more than the far
  seaRise: 0.1,                 // the sea climbs this share of the window over a passage
  cap: 1.5,                     // view px per CSS px at most (the painting is soft; DPR <= 2 x 0.75)
  ahead: 99,                    // paint every window of the page at idle, nearest first (so a reader who scrolls on
  keep: 99,                     // without a pause never meets one being painted), and keep them while the page is shown
  fade: 300,                    // ms: the place's still cross-fades to the painted window
  at: [
    // Home, the host peak: the hut side close (the near crags, the fall, the hut), then above the sea of cloud, only the
    // host's summit and the light (one pan west along the place, one climb; looking east and level there would show the
    // near crags' layer's cut edge in the first window)
    { split: 3, drop: 1,
      phone: { w: 0.58, win: [GW(0.9, 0.39, 0.2, -1, 0), GW(0.72, 0.47, -0.05, -1, 1)] },
      tablet: { w: 0.75, win: [GW(0.9, 0.39, 0.2, -1, 0), GW(0.7, 0.47, -0.05, -1, 1)] } },
    // Work, the river town, east of the bridge: the quay and the moored boats, then the town's east end going into the
    // reeds (the front never drops)
    { split: 2, drop: 0, ramp: 0,
      phone: { w: 0.36, win: [GW(0.66, 0.33, 0.0, -1, 0), GW(0.92, 0.3, 0.1, 0.45, 0, 0.35)] },
      tablet: { w: 0.5, win: [GW(0.66, 0.34, 0.0, -1, 0), GW(0.9, 0.3, 0.1, 0.45, 0, 0.35)] } },
    // Writing, the lake (a short page: its end only): the islet's pine and pavilion close on the lit lake, the mountain's
    // reflection beside them
    { split: 2, drop: 0.55, inlay: false,
      phone: { w: 0.297, win: [], end: GW(0.9, 0.3, -0.05, -1, 1) },
      tablet: { w: 0.45, win: [], end: GW(0.66, 0.33, -0.05, -1, 1) } },   // (the mountain and its reflection: the strip above shows the pavilion)
    // The Résumé, the terraces (closer: its own figure layer): its two hills, east-going, before Experience and before
    // Skills (no window inside the timeline, which it would break, and no far tip alone above the sea, too small to read
    // at 390 and 320). Their fronts never drop (dk 0), so each reads at every scroll position; on a phone the second's
    // near hill, coming in from the left, melts into the mist over ~85 px instead of standing cut
    { split: 2, drop: 0.55,
      phone: { w: 0.27, win: [GW(0.5, 0.382, 0.0, -1, 0, 0), GW(0.88, 0.385, 0.0, 0.45, 1, 0, 85)] },
      tablet: { w: 0.5, win: [GW(0.5, 0.33, 0.05, -1, 0, 0), GW(0.9, 0.38, 0.1, 0.55, 1, 0)] } },   // (a little lower than the phone's)
    // Contact, the crossing (a short page: its end only): the ferry at the jetty and its reeds, the far shore
    { split: 2, drop: 0.55, soft: true,
      phone: { w: 0.297, win: [], end: GW(0.69, 0.24, -0.05, -1, 1) },   // (the ferry whole, clear of the left feather, and low, so the boat and the ferryman stand whole above the water and the water runs on below them into the mist)
      tablet: { w: 0.45, win: [], end: GW(0.74, 0.275, -0.05, -1, 1) } },   // (low, the hull whole above its water)
  ] as GlPlace[],
};

const NONE16 = new Float32Array([2, 2, -1, -1, 2, 2, -1, -1, 2, 2, -1, -1, 2, 2, -1, -1]);
const live = new WeakMap<HTMLCanvasElement, EngineHandle>(); // canvas -> controller: one live landscape per canvas
// QA builds only (the asset tools' hooks: qa, window.__glimSoft). A production build has no NEXT_PUBLIC_INK_QA, so the
// check stays in the bundle: the flag is false at run time and the hooks ship inert.
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
 *                                         Each stretch is a scene (compose.ts sceneName): peak, river, lake, shore, crossing,
 *                                         lone-peak. Seams pass through water or mist.
 * @param {'level'|'high'|'deep'} [opts.distance='level']  Composition preset ("three distances"). Every page
 *                                         passes the one world composition (compose.ts WORLD).
 * @param {number}  [opts.presence=1]      0..1. How strongly the landscape shows (WORLD's, on every page).
 * @param {Element|null} [opts.strip]      [data-landscape="strip"]: window 1, the page's own scene at its strip framing,
 *                                         palette and figures, the drifting mist and the cursor's wake.
 * @param {Element|null} [opts.closing]    [data-landscape="closing"]: window 2, the page's own place once more,
 *                                         never the road to the next one: a small version of its opening, with
 *                                         its figures; on a short page whose closing shares a screen with its strip, a
 *                                         different view of the same place without the strip's figures (compose.ts Frame.twinU). Its
 *                                         figure layer is drawn at its own scale when that differs from the strip's.
 * @param {Iterable<Element>} [opts.keepout] [data-landscape="keepout"] text blocks: where one overlaps a window, no
 *                                         pigment lies under it, the mist ramps from opaque 140 px left of its right
 *                                         edge to clear 140 px right of it, nothing figurative comes within 40 px,
 *                                         the scene's focus stands >= 180 px right of it and the wake keeps off it.
 * @param {'misted'} [opts.palette='misted']  Pigment strength (palette.ts PALETTES).
 * @param {number}  [opts.horizon=0.6]     The horizon band's presence (<main data-horizon>).
 * @param {Iterable<Element>} [opts.veil]  Text blocks that mist should thicken behind (the 12 largest
 *                                         visible at a time). An element's own `data-veil` value, when it is a
 *                                         number 0..1 (e.g. data-veil="0.95"), is its veil strength instead of
 *                                         the default 0.72; an empty value keeps the default. A veil of 0.9 or more
 *                                         is a paper reserve for small print: solid paper behind the element's own
 *                                         text lines (the union of their boxes), with half the feather.
 * @param {Iterable<Element>} [opts.glimpse] (elements.ts glimpses) [data-landscape="glimpse"] boxes between a page's
 *                                         major sections, in page order (and a short page's closing box,
 *                                         data-glimpse="end"): below 1200 px (where the stage is not painted, WebGL
 *                                         only) each is painted once, at idle, at its own framing further into the
 *                                         place (GLIMPSE), parting a little as it passes through the viewport (its
 *                                         rest pose under reduced motion and Still); 40 px of paper and mist at its
 *                                         top and bottom, never a figure there. A scroll only slides it in the
 *                                         present. Re-read by rebind({ glimpse }).
 * @param {Iterable<Element>} [opts.wake]  [data-wake] regions: the pointer's wake is allowed only while the pointer
 *                                         is inside one (and inside a window), times (1 - keep-out) and (1 - veil).
 * @param {'bloom'|'none'} [opts.arrival='bloom']  'bloom' paints the strip in on load (the wet front, ~1.2 s).
 * @param {'complete'|'now'} [opts.firstFrame='now']  'complete': the first present waits (at most HOLD_MAX) for the
 *                                         page's own figure layer and, on the living ground, its three depth layers:
 *                                         the strip's still (components/page/Strip) stands in meanwhile and hands over
 *                                         to a finished painting (no figures fading in, no combined layer giving way).
 *                                         The strip's box gets `data-live` at the first present that shows its
 *                                         painting (its still fades out), <html> the class `ink-live`.
 * @param {boolean} [opts.still=false]     Start stilled (see setStill).
 * @param {'living'|''} [opts.ground]     (<main data-ground>) 'living' makes the page's own scene its ground. Wide
 *                                         screens painted by a hardware GPU (WebGL, not a software rasteriser): full-bleed
 *                                         depth layers that slide west as you scroll (THE UNROLL), living veils on the
 *                                         text's own lines, the closing shown by the stage; the governor gives the stage
 *                                         up if its presents stay slow at the lowest quality. Otherwise (narrower,
 *                                         Canvas2D, software WebGL): the strip's painting rides with its box (its front
 *                                         layer drifting west as it leaves: PART); the closing, as on every page, shows
 *                                         the page's own place.
 *
 * @returns {{ mode: 'webgl'|'canvas2d'|'static',
 *            panTo(stretch:number, o?:{duration?:number, distance?:string, presence?:number, ease?:'whip'|'cubic-out', cloud?:boolean}):Promise<void>,
 *            hold(stretch:number):void,
 *            sweep(o?:{dir?:1|-1, duration?:number}):Promise<void>,
 *            prepare(stretch:number, o?:{distance?:string, presence?:number}):Promise<void>,
 *            rebind(o:{strip?, closing?, keepout?, veil?, wake?, horizon?, glimpse?, ground?, inside?}):void, setStill(on:boolean):void,
 *            refresh():void, pause():void, resume():void, destroy():void, stats():object,
 *            qa?(o:{hold?:boolean}):void }}
 *   `panTo`: ease 'whip' (default) or 'cubic-out'. The camera moves along world x; every window's framing moves
 *     from the old page's to the new page's with it (the pan plays in whatever window is on screen). A pan of more
 *     than 2 stretches travels 1.6 on screen and splices out the middle under a thick mist; `cloud: false`
 *     (back/forward) travels the whole way. Reduced motion and still: it cuts. The old figure layer fades out over
 *     the first 30% of the pan, the new one in over the last 40% (or within 300 ms of becoming ready).
 *   `hold(x)`: the camera under the hand (the scroll mode, src/features/scroll): the position is set at once, level
 *     composition, one governed scene per call (drafts while the hand moves, a full-quality scene once it rests); drag
 *     and wheel call it once per animation frame, keys and the stops use panTo. A cut under reduced motion and Still.
 *   `sweep`: a pale mist bank (never darker than #D5DCD9) that travels with the scenery across the view.
 *     WebGL only; none under reduced motion, still, or Canvas2D (resolves at once).
 *   `prepare`: draws that stretch's figure layer (current width class and palette) off the main thread, for the
 *     composition `o` gives (the destination page's data-distance / data-presence), else the stretch's own page
 *     composition (SCENES[k].page); resolves when it is ready, at once if it has none or it is cached. Idempotent. The
 *     router calls it on prefetch. Figure layers are always drawn for the composition and scale they are shown at.
 *   `rebind`: after a route swap. Re-reads the boxes and framings and
 *     recomputes hzK before the first present (a page entered mid-scroll shows the right state at once).
 *   `setStill(true)`: drift, wake, sweeps, the bloom and pans stop (pans snap). `pause()` is a hard freeze.
 *   `mode` is live: it changes to 'canvas2d' if the WebGL context is lost for good.
 *   `qa` (QA builds): { hold: true } stops the loop on its next present (the frame tools/build-heroes.ts and
 *     build-scroll.ts capture).
 *   `stats()`: what the site, the QA tools and the browser tests read: `mode`, `software`, `quality`, `draftScale`,
 *     `widthClass`, `stretch`, `figures` ({ [stretch]: 'none'|'pending'|'ready' }), `figureLayers` (each cached
 *     layer's status), `framing.strip` (worldLeft, worldTop, scale, focus, keepoutRight), `windows` ({ strip, closing }:
 *     visible), `glimpses` (on; each window's end, vis, painted, live, doc), `hzK`, `plates` (on, developed), `stage`
 *     (ready, painted, pendingSplit, framing), the state (`still`, `sweeping`, `panning`, `held`, `arriving`, `draft`,
 *     `pending`, `running`, `stageVeto`) and the counters (frames, scenes, presents, drafts, draftAt, fullAt,
 *     glimPaints).
 */
export function mountLandscape(canvas: HTMLCanvasElement, opts: MountOptions = {}): EngineHandle {
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
    hold() {},
    sweep: () => Promise.resolve(),
    prepare: () => Promise.resolve(),
    rebind() {},
    setStill() {},
    refresh() {},
    pause() {},
    resume() {},
    destroy() {},
    stats: () => ({ mode: 'static', hzK: 0, still: false, figures: {}, windows: {} }),
  };
}

// (undefined and null coerce to NaN and 0, both refused)
const num = (v: number | string | null | undefined, d: number): number => (Number.isFinite(+v!) && v !== null && v !== '' ? +v! : d);
const toList = (els: Element | Iterable<Element> | null | undefined): Element[] => (!els ? [] : els instanceof Element ? [els] : [...els].filter((e) => e instanceof Element));
const asEl = (a: unknown): Element | null => (a instanceof Element ? a : null);
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
/** The figure layers drawn for the strip (and the stage), for the closing (at its own scale), for a window into the
 *  painting, or (the unroll) for the stage's reach: the next place's layer at the reach's resolution (reachDpr). */
type Variant = 'strip' | 'closing' | 'glimpse' | 'reach';
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
  fr: Framing | null;
  key: string;
  buf: Float32Array | null;
  /** The ridges' own key (their inputs: framing, size, palette, composition) and whether `buf` is on the GPU: the
   *  bloom repaints the scene every frame, the ridges only when these change. */
  rkey: string;
  rup: boolean;
  draft: boolean;
  pending: boolean;
  painted: boolean;
  want: boolean;
  /** (PART) The front layer's view, its key and state; whether the window is parted; the front's sideways drift (box
   *  widths), read with the scroll. */
  nid: string;
  nkey: string;
  npainted: boolean;
  npending: boolean;
  parted: boolean;
  dx?: number;
}
/** The horizon band's view. */
interface HorizonView {
  id: string;
  key: string;
  buf: Float32Array | null;
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
}
/** The living ground's stage (`st`): its layers, its framing and its pose (see the comments where it is made). */
interface Stage {
  layers: StageLayer[];
  buf: Float32Array | null;
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
  bottomDoc: number;
  stripVis: boolean;
  /** (THE UNROLL) the page's travel (CSS px; negative: west), and the slide now and its target (0..1 of it). */
  slidePx: number;
  slideK: number;
  slideT: number;
  glide: boolean;
  sepK: number;
  offsets: Float32Array;
  k: Float32Array;
  sea: Float32Array;
  rects: Float32Array;
  /** The footer's top (doc px); the inner places' soft-crop, footer and grade uniforms (shaders.ts uStX, uStF, uStG). */
  footDoc: number;
  airU: Float32Array;
  footU: Float32Array;
  gradeU: Float32Array;
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
  /** Set on its first frame: its clock. */
  clock?: number;
  /** Its eased progress this frame (the unroll's slide decays with it). */
  e?: number;
  /** (the unroll) the slide the pan took over from (0..1 of the page's travel) and that page's travel (CSS px, west):
   *  kept through the pan, decaying with its ease. */
  slideK0?: number;
  slidePx0?: number;
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
  /** device px per CSS px it was drawn at (the strip's layerDpr, the reach's reachDpr): a layer's bytes scale with it */
  dpr: number;
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
  /** A stage view: the layer's slide (canvas uv, east), which map includes and a pinned sprite leaves out. */
  ox: number;
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
}
/** A figure layer that is drawn and uploaded (ready()). */
type ReadyLayer = Layer & { status: 'ready' };
/** A timer's id (the project's types include Node's timers; in the browser it is a number). */
type Timer = ReturnType<typeof setTimeout>;

function controller(canvas: HTMLCanvasElement, opts: MountOptions): EngineHandle {
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const mqFine = matchMedia('(pointer: fine)');
  const mqHz = matchMedia(HZ_MEDIA);
  let reduced = mqReduce.matches;
  let still = !!opts.still;
  const quantized = () => reduced || still;

  // ---------------------------------------------------------------- renderer + fallbacks
  let surface = canvas;      // the element painted on (a sibling clone if WebGL died on `canvas`)
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
  // The canvas shows nothing until its first frame is presented (draw()): a WebGL canvas with no frame yet composites
  // black (alpha: false), and the first frame waits for the programs to link off the main thread (gl.ts poll).
  canvas.style.visibility = 'hidden';
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
  if (!renderer) surface.style.visibility = '';   // (nothing will ever be presented: html.no-landscape hides it)

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
  }

  // ---------------------------------------------------------------- state
  const software = !!renderer?.software;
  let quality = software ? 0.6 : 1;
  // frames in motion (pans, the bloom) are painted at this internal scale; the governor lowers it
  let draftScale = software ? 0.5 : 1;
  // the living stage given up for this mount: its plain presents stayed slow at the lowest quality (governPresent)
  let stageVeto = false;
  const grainK = 0.4;     // the paper grain's strength
  const tide = 1;         // the faint dried-wash edges ("tide lines") at rest, 0..1
  const veilK = 0.72;     // a veil's strength where its element's data-veil names none
  // the living ground (see STAGE): its tunables (STAGE, with the place's own from STAGE_AT: placeT) and its state
  let ground: 'living' | '' = opts.ground === 'living' ? 'living' : '';
  const T = { ...STAGE };
  const placeT = () => {   // the place's own numbers (the destination's during a pan)
    const at = STAGE_AT[Math.round(tween ? tween.to : stretch)] || {};
    for (const k of PLACE_KEYS) (T as Record<(typeof PLACE_KEYS)[number], unknown>)[k] = at[k] ?? STAGE[k];
  };
  const living = () => ground === 'living';
  // the page opens inside its place (compose.ts framingAt `inside`): true, or its own stretch-local u
  const insideOf = (v: unknown): boolean | number => (typeof v === 'number' && Number.isFinite(v) ? v : !!v);
  let inside: boolean | number = insideOf(opts.inside);
  const insideBox = () => ({ inside: !!inside, insideU: typeof inside === 'number' ? inside : undefined });

  // ---------------------------------------------------------------- THE PLATES
  // On wide screens, while the page is read, each of the stage's depth layers is developed once, at the hero pose, into
  // a canvas of the page's own (the sink's plates), and the page moves them with a scroll timeline: a scroll runs no
  // script and draws nothing, and the painting can never slip against the words. This canvas is then the darkroom,
  // hidden. What moves in the painting (the small life) repaints only the part of the one plate that holds it. A page
  // change (a pan), the arrival and a sweep are laid on this canvas; the plates take over again when they end.
  const sink = opts.plates || null;
  let platesHold = false;   // (leaving the plates for a pan: the scroll's own pose is read once more)
  const platesOn = () => !!sink && !platesHold && mode === 'webgl' && !!renderer?.plate && !tween && !arriving && !sw && !settling
    && stageOn();
  let platesShown = false, platesAll = true, platesGeo = '', plateTile = '';
  const plateCtx = new Map<PlateKind, { c: HTMLCanvasElement; x: CanvasRenderingContext2D } | null>();
  const plateLast = new Map<PlateKind, number[]>();   // the part of each plate repainted last (plate px)
  let plateLifeCss: number[] | null = null;           // where the free life lies on the screen at the page's top (CSS px)
  let platePin = false;                                // something is pinned to the frame
  let platesDeveloped = 0;                             // whole plates developed (stats)

  // ---------------------------------------------------------------- the water's rings, Still's settle (elements.ts)
  // ring sets on the open water (contactLife: the ferry's drops), kept in the world (so they ride the page's scroll)
  // with the view they lie in
  const STIR_N = 4;
  const STIR_LIFE = 4.4;   // s: a drop's rings (shaders.ts lifeStir)
  interface Stir { wx: number; wy: number; t: number; t0: number; seed: number }
  const stirs: Stir[] = [];
  const stirU = new Float32Array(16).fill(-1), stirKU = new Float32Array(4);
  let stirSeq = 0;
  const autoNext = new Map<string, number>();     // contactLife: when each auto drop falls next
  // stillSettle: the drift easing to rest before Still takes hold
  const SETTLE_MS = 800;
  let settling = false;

  const palette = paletteName(opts.palette);
  const target0 = num(opts.stretch, 0);
  let stretch = target0;
  let curSpec = spec(opts.distance, opts.presence);
  let tween: Tween | null = null;

  let arriving = !quantized() && opts.arrival !== 'none';
  let arrive = arriving ? 0 : 9;      // shader seconds: the bloom is authored as 1.25 s
  let arriveSeen = false;             // has any of the bloom been painted while the page was visible?
  // (firstFrame 'complete') the first present waits for the page's own figure layer and, on the living ground, its three
  // depth layers (holdingFirst, at most HOLD_MAX): the strip's still stands in meanwhile, and the hand-over is invisible
  // because the first frame is the finished one
  const firstComplete = opts.firstFrame === 'complete';
  const holdAt = performance.now();
  let heldPresent = false;   // a frame skipped its present for the hold: the next one that is free presents
  let stripLive = false;     // has the strip's box been told its painting is on screen (data-live: its still fades out)?

  let cssW = 0, cssH = 0, W = 0, H = 0, aspect = 1.6, bufS = 1;
  let rect = { left: 0, top: 0, width: 1, height: 1 };
  const classNow = () => widthClass(innerWidth, innerHeight);
  let cls = classNow();
  let heldAt = 0;           // hold(): when the hand last set the camera (performance.now ms); 0 = never
  let time = 40;             // ambient clock, seconds (never jumps after a pause)
  let driftT = 1;            // 0..1: the drift eases out after IDLE_MS without input, and back in
  let lastInput = performance.now();
  const veil = new Float32Array(VEILS * 4).fill(-1);
  const veilS = new Float32Array(VEILS);
  const veilF = new Float32Array(VEILS).fill(1);   // each veil's feather, x the shared one (a reserve's is tighter)
  let veilEls = toList(opts.veil);
  // a reserve's text box, as offsets inside its element's box: re-read when the box or the fonts change
  const textBoxes = new WeakMap<Element, { w: number; h: number; f: number; box: Offsets | null }>();
  let fontGen = 0;
  const onFonts = () => { fontGen++; request(S_MEASURE | S_SCROLL); };

  // ---------------------------------------------------------------- windows and views
  // A window: a box on the page, painted at its own framing. A view: its painting (and the horizon's).
  const mkWin = (kind: WindowKind, el: Element | null): Win => ({
    kind, id: kind, el, box: null, vis: false, near: !!el, keepR: null, keepU: null, viewU: null, wakeOK: false,
    fr: null, key: '', buf: null, rkey: '', rup: false, draft: false, pending: false, painted: false, want: false,
    nid: `${kind}~n`, nkey: '', npainted: false, npending: false, parted: false,
  });
  const wins = [mkWin('strip', asEl(opts.strip)), mkWin('closing', asEl(opts.closing))];
  // (GLIMPSE) the windows into the painting at the page's breaks, in page order; `end` = a short page's end,
  // which is the closing's own box (data-glimpse="end"). Each one has its own view (`id`: two depth layers, back below
  // and front above, painted for its own framing at idle), its place on the page (doc: its middle; NaN: not laid out),
  // its index among the page's laid-out windows (j: its pose), and the time its painting first showed (the still's fade).
  interface Glim {
    el: Element; box: Rect | null; vis: boolean; near: boolean; i: number; j: number; end: boolean; short: boolean;
    doc: number; id: string; key: string; painted: boolean; buf: Float32Array | null; vw: number; vh: number;
    view: Float32Array; shownAt: number; live: boolean; waitAt: number;
  }
  const mkGlims = (els: Element[]): Glim[] => els.map((e, i) => ({
    el: e, box: null, vis: false, near: true, i, j: i, end: (e as HTMLElement).dataset?.glimpse === 'end', short: false,
    doc: NaN, id: `glimpse~${i}`, key: '', painted: false, buf: null, vw: 0, vh: 0, view: new Float32Array(4), shownAt: 0, live: false, waitAt: 0,
  }));
  let glims = mkGlims(toList(opts.glimpse));
  const glimU = {
    rects: new Float32Array(8), a: new Float32Array(8), b: new Float32Array(8), f: new Float32Array(8), c: new Float32Array(8),
    d: new Float32Array(8), m: new Float32Array(8),
  };
  // the page's layout for the windows (glimpseLayout): its key, scroll range and viewport
  const glimRun = { key: '', max: 1, bw: 0 };
  /** A window's place on the page is within ~a viewport of the screen (its box is measured then, whatever the
   *  intersection observer last said: its callback comes a frame or more after a jump). */
  const glimClose = (g: Glim) => Number.isFinite(g.doc) && Math.abs(g.doc - ((window.scrollY || 0) + (innerHeight || 1) / 2)) < (innerHeight || 1) * 1.2;
  let glimLive = false;   // the engine paints the windows (else each keeps its place's still)
  const hzv: HorizonView = { id: 'horizon', key: '', buf: null, draft: false, painted: false, pending: false, want: false, view: new Float32Array(4) };
  // the living ground's stage: three depth layers, one framing (the strip's, extended to the viewport)
  // Each layer is painted into its own view: the far one (opaque: sky, far ranges, the keep-out's mist) over the whole
  // viewport at T.far of the buffer's resolution; the middle and near ones (transparent) only over the box where they hold
  // anything (`crop`, viewport CSS px at the page's top: right of the keep-out's mist, from their highest crest down to
  // where the sea always covers them), at full resolution. While a pan or the bloom runs, one combined layer is painted,
  // full size, into the far layer's view.
  const st: Stage = {
    layers: STAGE_IDS.map((id) => ({ id, key: '', painted: false, pending: false, draft: false, crop: [0, 0, 1, 1] })),
    buf: null, samples: 0, view: new Float32Array(4), fr: null, left: 0, wvis: 1, wvisX: 1, ext: 0, ok: false, single: true, alloc: false,
    topDoc: 0, bottomDoc: 0, stripVis: false, slidePx: 0, slideK: 0, slideT: 0,
    glide: false, sepK: 1,   // the pose glides to its targets (after a pan); the far layer's own depth (0 while combined)
    offsets: new Float32Array(12), k: new Float32Array(4), sea: new Float32Array(4), rects: new Float32Array(12),
    footDoc: -1, airU: new Float32Array(4), footU: new Float32Array(4), gradeU: new Float32Array(4),
  };
  /** The stage replaces the strip and the closing windows: a living page on a wide screen, with a strip to frame from,
   *  painted by a hardware GPU. (On a software rasteriser or in Canvas2D the stage's full-viewport present on every
   *  scroll frame runs at 10-20 fps behind text scrolling at 60; there, and once the governor has given it up
   *  (stageVeto: too slow at the lowest quality), a living page keeps the strip and closing windows, which those paths
   *  paint well.) */
  const stageOn = () => living() && cls === 'wide' && mode === 'webgl' && !software && !stageVeto && !!wins[0].el;
  // (QA only: window.__glimSoft lets tools/build-stills.ts cut each window's still under SwiftShader)
  const glimSoft = () => QA && (globalThis as { __glimSoft?: boolean }).__glimSoft === true;
  /** (elements.ts glimpses) The windows into the painting show (below 1200 px, where the stage is not painted; WebGL
   *  only: Canvas2D keeps their paper and the static fallback its ridge hint). */
  const glimpseOn = () => glims.length > 0 && el('glimpses') && !stageOn() && mode === 'webgl' && (!software || glimSoft()) && !stageVeto && !!wins[0].el;
  /** The stage is on screen (it covers the whole viewport once painted). */
  const stageShown = () => stageOn() && st.ok;
  /** The stage stands complete: its three layers painted at full quality and shown, the combined one gone, every glide
   *  over (stats().stage.ready; firstFrame 'complete' waits for it). */
  const stageReady = () => st.ok && !st.single && !st.pendingSplit && !st.glide && st.sepK >= 1 && st.layers.every((L) => L.painted && !L.draft && !L.pending);
  /** The sea's sink: it keeps to the deepest layer's (so nothing that stood above it in the opening goes under). */
  const seaSink = () => Math.max(T.sink[0], T.sink[1], T.sink[2]);
  let keepEls = toList(opts.keepout);
  let wakeEls = toList(opts.wake);
  let horizonP = clamp01(num(opts.horizon, 0.6));
  let hzOn = mqHz.matches;
  let hzK = 0, hzTarget = 0;
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
  const sweepU = new Float32Array(4);
  let sweepSeed = 0;

  let raf = 0, timer: Timer | 0 = 0, timerAt = 0, need = 0, clockLast = 0, lastPresent = 0;
  let userPaused = false, hidden = document.visibilityState === 'hidden', onscreen = true, destroyed = false;
  let anyVisible = false, wasVisible = true;   // a window on screen now / something painted on screen at the last present
  let drawnOnce = false;
  let lastScroll = 0;        // performance.now() of the last scroll event
  let gov: number[] = [], heavyLast = 0;
  let gpuWait = 0, prevPlain = false, govP: number[] = [], polled = false, telling = false;   // governPresent()
  let idleId: number | Timer = 0;
  let lastSlots: Slot[] = [];
  const counts = {
    frames: 0, scenes: 0, presents: 0, drafts: 0,
    draftAt: 0, fullAt: 0,                            // performance.now() of the last draft / full-quality scene
    glimPaints: 0,                                    // windows into the painting painted (each two scene passes)
  };

  // ---------------------------------------------------------------- figure layers
  // One layer per (stretch, composition, scale, palette, resolution, width class): drawn off the main thread
  // (figures.worker.ts), uploaded once (never while scrolling), cached. A layer is drawn for the composition it is
  // painted into (the windows': curSpec at rest, each end's own during a pan), so its figures stand on the ground and the
  // waterline the window paints, and at the scale of the window that shows it: the strip and the stage at layerScale(k),
  // the closing at its own framing's (closingScale; a phone's close view of the pavilion is drawn at its own scale, not
  // the strip's layer magnified). It is shown with an alpha (fades; see figSlots).
  const layers = new Map<string, Layer>();
  let figSrc: FigureSource | null = null;
  let drawnFigs = false;     // the first full scene is up (a layer ready before it follows the bloom instead of fading)
  const figSource = () => (figSrc ??= createFigureSource());
  const layerScale = (k: number) => {
    if (cls === 'wide') return Math.round(Math.min(innerWidth, 1700) / 40) * 40;   // (the window's width: the canvas is the band, wider)
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
  /** The windows' layer scale: the strip's own while it is within 1.33 of it (its layer is drawn at 2 x 0.75
   *  device px per CSS px against the windows' 1.5: never magnified past a texel), else the windows' own (to 40 px). */
  function glimScale(k: number) {
    const s0 = layerScale(k), C = glimClass();
    if (!C || !glimRun.bw) return s0;
    const sc = glimRun.bw / C.w;
    return sc / s0 <= 1.33 ? s0 : Math.max(40, Math.round(sc / 40) * 40);
  }
  const scaleOf = (k: number, v: Variant) => (v === 'closing' ? closingScale(k) : v === 'glimpse' ? glimScale(k) : layerScale(k));
  /** The composition a layer is drawn for: the preset (a blend's dominant one) and the presence to 0.01. */
  const figSpec = (s: Spec) => ({ distance: specName(s), presence: Math.round(s.presence * 100) / 100 });
  /** A stretch's own page composition, as a spec (what the router's destination and the "Next" pan will use). */
  const ownSpec = (k: number) => { const p = pageSpec(k); return spec(p.distance, p.presence); };
  const layerDpr = () => Math.min(2, Math.max(1, Math.round(bufS * 1.34 * 4) / 4));
  /** A window's own figure layer (never the strip's: its sprites are painted in) is drawn at the windows' resolution
   *  (GLIMPSE.cap): one texel per view pixel, no more (at the strip's scale too, so the layer it does not share costs
   *  ~0.56 of the strip's). */
  // (a place whose set has no sprite of its own, Writing's lake, needs no inlay layer: its end shares the strip's layer
  // at the strip's resolution)
  const inlayOf = (k: number, v: Variant) => v === 'glimpse' && GLIMPSE.at[k]?.inlay !== false;
  /** (the unroll) the reach's resolution: just under the buffer's own texel (within LAYER_STANDIN's 1.16, never soft),
   *  never above the strip's; a neighbour's town in the margin at a fraction of a full layer's bytes (the 45 MB gate). */
  const reachDpr = () => Math.min(layerDpr(), Math.max(1, Math.round(bufS * 0.94 * 4) / 4));
  const dprOf = (k: number, v: Variant) => (v === 'reach' ? reachDpr() : inlayOf(k, v) || (v === 'glimpse' && glimScale(k) !== layerScale(k)) ? Math.min(layerDpr(), Math.max(1, Math.round(Math.min(bufS, GLIMPSE.cap) * 4) / 4)) : layerDpr());
  const layerKey = (k: number, v: Variant = 'strip', s: Spec = curSpec) => {
    const f = figSpec(s);
    // (a window's layer is its own, even at the strip's scale: its sprites are painted in, inlay)
    return `${k}|${f.distance}:${f.presence}|${scaleOf(k, v)}|${palette}|${dprOf(k, v)}|${mode}|${cls}${inlayOf(k, v) ? '|in' : ''}`;
  };
  const ready = (L: Layer | null | undefined): L is ReadyLayer => !!L && L.status === 'ready' && L.uploaded;
  /** An uploaded layer's bytes on the GPU, as gl.ts counts them (its mipmapped texture, w x h x 4 x 4/3, and each of
   *  its sprites' the same way); 0 before the upload. */
  const layerBytes = (L: Layer | null | undefined) => {
    if (!L || !L.uploaded || !L.img) return 0;
    let b = Math.round(L.img.width * L.img.height * 4 * 4 / 3);
    for (const [w, h] of L.sprites || []) b += Math.round(w * h * 4 * 4 / 3);
    return b;
  };
  /** The memory gate on what is shown: would layer F, for stretch j, fit beside the current place's own layer within
   *  the figures' budget (figBudget)? The reach: the next place's full layer, drawn ahead by a link's intent, serves
   *  the reach in place of its own lighter one only when the two then fit (Work's town beside Home's mountain at 1440 x
   *  900 @2 does not: 20 + 12 MB against a budget of 26); otherwise the full one is a neighbour the trim lets go after
   *  FIG_GRACE, and the reach keeps its own. */
  function fitsBeside(F: Layer, j: number) {
    const k = Math.round(tween ? tween.to : stretch);
    if (j === k) return true;
    const own = layerFor(k, false, 'strip', tween ? tween.toSpec : curSpec);
    return layerBytes(F) + (ready(own) && own !== F ? layerBytes(own) : 0) <= figBudget();
  }
  /** ...and ahead of its drawing: could stretch j's full layer be held on show at all? Its size is taken from a layer
   *  of that stretch already drawn at another resolution or scale (the reach's), scaled by the square of the ratio;
   *  with none drawn, yes (the trim lets it go FIG_GRACE later if it does not fit). */
  function fitsAhead(j: number) {
    let est = 0;
    for (const L of layers.values()) {
      if (L.stretch !== j || !ready(L) || L.key.endsWith('|in')) continue;
      const r = (layerDpr() * scaleOf(j, 'strip')) / (L.dpr * L.scale);
      est = Math.max(est, layerBytes(L) * r * r);
    }
    if (!est) return true;
    const k = Math.round(tween ? tween.to : stretch);
    if (j === k) return true;
    const own = layerFor(k, false, 'strip', tween ? tween.toSpec : curSpec);
    return est + (ready(own) ? layerBytes(own) : 0) <= figBudget();
  }
  /** Stretch k's layer for a window variant ('strip': the strip and the stage; 'closing') and a composition. */
  function layerFor(k: number, create = true, v: Variant = 'strip', s: Spec = curSpec): Layer | null {
    k = Math.round(k);
    if (mode === 'static' || !renderer || k < 0 || k >= STRETCH_COUNT) return null;
    const meta = figureMeta(k);
    if (!meta) return null;
    const key = layerKey(k, v, s);
    let L = layers.get(key);
    if (L || !create) { if (L) L.used = performance.now(); return L || null; }
    const scale = scaleOf(k, v), f = figSpec(s), dpr = dprOf(k, v);
    L = { key, stretch: k, scale, dpr, meta, status: 'pending', img: null, readyAt: 0, uploaded: false, waiters: [], used: performance.now(), shownSince: 0 };
    layers.set(key, L);
    figSource().request({
      stretch: k, scale, dpr, palette, distance: f.distance, presence: f.presence, inlay: inlayOf(k, v),
      out: mode === 'webgl' ? (renderer.bitmaps ? 'gpu' : 'bytes') : 'bitmap',
    }).then((res) => {
      if (destroyed || layers.get(key) !== L) return;
      L.img = res;
      // the small life: the layer's anchors (figures.ts THE LIFE API), and the sprites cut out of it (the worker's 'gpu'
      // output; uploaded with the layer as `${key}#${i}`): their sizes, for the present pass's filtering
      L.life = Array.isArray(res.life) ? res.life : [];
      L.sprites = (res.sprites || []).map((sp) => [sp.width, sp.height]);
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
  // a stand-in while a layer is drawn: the same stretch's layer at another width or composition (never a gap),
  // drawn at a scale this window may show it at (LAYER_STANDIN: never a soft magnified one, never figures drawn for a
  // far other scale that would then jump)
  function standIn(k: number, scale: number) {
    let best: Layer | null = null;
    for (const L of layers.values()) {
      if (L.stretch !== k || !ready(L) || L.key.endsWith('|in')) continue;   // (never a window's layer: its sprites are in it)
      if (scale && (scale / L.scale < LAYER_STANDIN[0] || scale / L.scale > LAYER_STANDIN[1])) continue;
      if (!best || L.readyAt > best.readyAt) best = L;
    }
    return best;
  }
  // upload a finished layer, but never while the page is scrolling (it waits for a quiet moment)
  function uploadSoon(L: Layer) {
    if (destroyed || !L.img || L.uploaded) return;
    // (a layer the trim has let go while its bitmap waited for a quiet moment is never uploaded: its texture would be
    // held and counted by the renderer and seen by nothing, one whole layer leaked)
    if (layers.get(L.key) !== L) { L.img = null; return; }
    const since = performance.now() - lastScroll;
    if (since < 120) { setTimeout(() => uploadSoon(L), 140 - since); return; }
    if (!renderer || !renderer.figure(L.key, L.img)) { L.status = 'failed'; L.waiters.splice(0).forEach((f) => f()); return; }
    if (mode === 'webgl') L.img = { width: L.img.width, height: L.img.height };   // the bytes live on the GPU now
    L.uploaded = true;
    L.status = 'ready';
    L.readyAt = performance.now();
    // its bytes count now: past the budget the least recently used layers go, and a layer asked for ahead (a link's
    // intent, the reach's stand-in once the full layer has replaced it) that is not on show FIG_GRACE later goes too
    trimLayers(L.key);
    setTimeout(() => { if (!destroyed) trimLayers(''); }, FIG_GRACE + 100);
    // replacing a stand-in (another width or composition of the same layer): no fade, the swap is in place
    if (lastSlots.some((s) => s.want === L.key)) L.shownSince = performance.now() - 1e4;
    // the closing, painted ahead off screen, takes it in idle time, not as it scrolls in
    if (wins[1].painted && !wins[1].vis) wins[1].want = true;
    L.waiters.splice(0).forEach((f) => f());
    request(S_PRESENT);
  }
  /** The figure layers' byte budget now: the memory gate less what the views hold at this viewport (FIG_FLOOR at least). */
  function figBudget() {
    let views = 0;
    try { const m = renderer?.memory(); if (m) views = Math.max(0, m.total - m.figures); } catch { /* none */ }
    return Math.max(FIG_FLOOR, (cls === 'phone' ? MEM_GATE_PHONE : MEM_GATE_WIDE) - views);
  }
  // keep what is on show (and what it stands in for), the current stretch's layers, the neighbours' for the "Next" and
  // back pans, a pan's ends and the layer just asked for; the rest go, least recently used first. Past the budget
  // (figBudget: the memory gate) the neighbours and the off-screen windows' layers go too, least recently used first,
  // except one drawn within FIG_GRACE (it is about to be shown); never a layer on show.
  function trimLayers(fresh: string) {
    const bytes = () => { try { return renderer?.memory().figures ?? 0; } catch { return 0; } };
    const budget = figBudget();
    if (layers.size <= FIG_KEEP && bytes() <= budget) return;
    const k = Math.round(stretch);
    // on show (never evicted): the slots, the layer just asked for, a pan's destination
    const shown = new Set([fresh]);
    for (const s of lastSlots) { shown.add(s.L.key); if (s.want) shown.add(s.want); }
    if (tween) shown.add(layerKey(Math.round(tween.to), 'strip', tween.toSpec));
    // kept while there is room: the current place's layers and the neighbours' (the "Next" and back pans)
    const keep = new Set([...shown, layerKey(k), layerKey(k, 'closing'), layerKey(k, 'glimpse'), layerKey(k + 1, stageOn() ? 'reach' : 'strip', ownSpec(k + 1)), layerKey(k - 1, 'strip', ownSpec(k - 1))]);
    const evict = (L: Layer) => {
      layers.delete(L.key);
      try { renderer?.figure(L.key, null); } catch { /* ignore */ }
      L.waiters.splice(0).forEach((f) => f());
    };
    const lru = (keepSet: Set<string>) => [...layers.values()].filter((L) => !keepSet.has(L.key)).sort((a, b) => a.used - b.used);
    const old = lru(keep);
    while ((layers.size > FIG_KEEP || bytes() > budget) && old.length) evict(old.shift()!);
    // still over the bytes: the neighbours and the off-screen windows' layers go too (redrawn off-thread when asked)
    const now = performance.now();
    const more = lru(shown).filter((L) => L.status === 'ready' && now - L.readyAt > FIG_GRACE);
    while (bytes() > budget && more.length) evict(more.shift()!);
  }
  function dropLayers() {
    for (const L of layers.values()) { try { renderer?.figure(L.key, null); } catch { /* ignore */ } L.waiters.splice(0).forEach((f) => f()); }
    layers.clear();
    lastSlots = [];
  }
  const fadeIn = () => (quantized() ? FIG_IN_RM : FIG_IN);
  /** The window a slot is for: the strip's layers (and the stage's), or the closing's own (its scale may differ). */
  const variantOf = (w: Win): Variant => (w.kind === 'closing' ? 'closing' : 'strip');
  /** The figure layers on show now, each with its alpha and the window variant it is for: the current stretch's, the
   *  pan's two ends, a neighbour whose layer a window already holds for this composition (never asked for at rest). At
   *  most two per variant; the closing's only while it is near (and not shown by the stage). */
  function figSlots(): Slot[] {
    if (mode === 'static') return [];
    const now = performance.now();
    const out: Slot[] = [];
    const late = (L: Layer) => {
      if (!L.shownSince) L.shownSince = drawnFigs ? now : now - 1e4;
      return clamp01((now - L.shownSince) / fadeIn());
    };
    // the layer itself, or a stand-in for it ({ L, want: the key it stands in for })
    const show = (k: number, v: Variant, s: Spec, create: boolean): { L: Layer; want?: string } | null => {
      // (the reach: the place's full layer, where one is held and fits the memory gate beside this place's own
      // (fitsBeside), serves it; else its own at reachDpr)
      if (v === 'reach') { const F = layerFor(k, false, 'strip', s); if (ready(F) && fitsBeside(F, Math.round(k))) return { L: F }; }
      const L = layerFor(k, create, v, s);
      if (ready(L)) return { L };
      const j = Math.round(k), S = standIn(j, scaleOf(j, v));
      return S ? { L: S, want: L ? L.key : layerKey(j, v, s) } : null;
    };
    const c = wins[1];
    const vs: Variant[] = c.box && (c.vis || c.want) && !stageOn() ? ['strip', 'closing'] : ['strip'];
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
          // (the unroll: the next place's figures stand in the stage's eastern stretch, the reach, so its layer is asked
          // for at the reach's resolution (never the 404's: the path lies off the map); otherwise a neighbour's layer is
          // shown only where a window already holds it)
          if (j !== k) { const m = figureMeta(j); if (!m || !windowsSee(m.rect)) continue; }
          const reach = j === k + 1 && v === 'strip' && stageOn() && j < STRETCH_COUNT - 1;
          const S = j === k ? show(j, v, curSpec, true) : reach ? show(j, 'reach', ownSpec(j), true) : { L: layerFor(j, false, v, curSpec) };
          if (!S || !ready(S.L)) continue;
          out.push({ ...S, v, k: late(S.L) } as Slot);
          n++;
        }
      }
    }
    return out;   // (alpha 0 included: a layer about to fade in still asks for its frames)
  }
  /** Is everything the closing will show ready, so a paint ahead of time (off screen) is its last one? Each figure
   *  layer its view sees (its own place's and a neighbour's) is asked for, loaded and past its fade-in; otherwise the
   *  closing would repaint as it scrolls in (phones: 2 scenes at the arrival, a stall risk on a low-end GPU). */
  let aheadT = 0;
  function closingAhead() {
    if (mode === 'static' || tween) return true;
    const k = Math.round(stretch), now = performance.now();
    for (const j of [k, k + 1, k - 1]) {
      const m = figureMeta(j);
      if (!m || !closingSees(j)) continue;
      const L = layerFor(j, true, 'closing', curSpec);
      if (!L) continue;
      if (L.status === 'failed') continue;
      if (!ready(L)) return false;
      if (L.shownSince && now - L.shownSince < fadeIn()) return false;
    }
    return true;
  }
  /** Does the closing, at its framing now, see stretch k's figure layer? (True when that cannot be told yet.) */
  function closingSees(k: number) {
    const m = figureMeta(k), c = wins[1];
    if (!m || !c.box) return true;
    const fr = framingOf(c);
    if (!fr) return true;
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
      if (!fr) continue;
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
    // (the canvas's layout size, never its rect: it is the band's own box (styles/band.css: 1 / BAND.zoom of the
    // window's width, the band's height), which a scroll scales; at the page's top its origin is the viewport's)
    const w = Math.round(surface.clientWidth) || innerWidth;
    const h = Math.round(surface.clientHeight) || innerHeight;
    rect = { left: 0, top: 0, width: w, height: h };
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
    for (const w of wins) w.nkey = '';
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
      if (w.el && w.el.isConnected) {
        const r = w.el.getBoundingClientRect();
        w.box = r.width > 0 && r.height > 0 ? { left: r.left - rect.left, top: r.top - rect.top, width: r.width, height: r.height } : null;
      } else if (!w.el) w.box = null;
      // (PART) the front's drift (used once the window is parted). THE UNROLL below 1200 px: the painting rides with its
      // box; the strip's place drifts west as the box leaves (the river flowing on) and the closing's comes in from the
      // east as it arrives. (The back fills in behind the front as it drifts, so no edge of the painting ever shows.)
      w.dx = 0;
      if (w.box && living() && !stageOn() && !quantized()) {
        const y = Math.max(0, window.scrollY || 0), h = Math.max(1, w.box.height);
        if (w.kind === 'strip') w.dx = -UNROLL.drift * sstep(0, 1, Math.min(1, y / h));
        else {
          const maxY = Math.max(0, document.documentElement.scrollHeight - innerHeight);
          const r = Math.max(0, maxY - y), run = Math.max(h * 0.6, (cssH || innerHeight) - (w.box.top - r));
          w.dx = UNROLL.drift * sstep(0, 1, clamp01(r / run));
        }
      }
      const b = w.box;
      w.vis = !!b && b.top < cssH && b.top + b.height > 0 && b.left < cssW && b.left + b.width > 0;
      if (w.vis) anyVisible = true;
    }
    // the windows into the painting (their boxes only while one is near: a phone reading on paper measures
    // nothing; the page's run once per layout)
    const gOn = glimpseOn();
    if (gOn) glimpseLayout();
    for (const g of glims) {
      // (a painted window is measured while its place on the page is within a viewport of the screen, whatever the
      // intersection observer last said: its callback comes a frame or more after a jump)
      if (!gOn || !(g.near || glimClose(g)) || !g.el.isConnected) { g.box = null; g.vis = false; continue; }
      const r = g.el.getBoundingClientRect();
      g.box = r.width > 0 && r.height > 0 ? { left: r.left - rect.left, top: r.top - rect.top, width: r.width, height: r.height } : null;
      const b = g.box;
      g.vis = !!b && b.top < cssH && b.top + b.height > 0;
      if (g.vis && g.painted) anyVisible = true;
    }
    // the horizon handover (desktop only): it fades in as the strip's bottom edge rises from 35% of the viewport to
    // the top, and out again as the closing's top rises from the bottom of the viewport to 70%
    const vh = innerHeight || cssH || 1;
    const s = wins[0], c = wins[1];
    const sb = s.box ? (s.box.top + s.box.height) / vh : -1;
    const ct = c.box ? c.box.top / vh : 9;
    hzTarget = hzOn && !stageOn() ? sstep(0.35, 0, sb) * (1 - sstep(1, 0.7, ct)) : 0;
    if (stageOn()) readStage();
  }
  // The stage replaces both windows (they keep their boxes and their honest visibility). THE UNROLL: the whole
  // painting slides west with the scroll, linearly, from the hero at the page's top (slide 0) to the page's travel at its
  // end (slide 1: st.slidePx, measureSlide). Reduced motion and Still: the hero pose, then one cut to the end pose once
  // the ending is within UNROLL.endZone viewports.
  function readStage() {
    placeT();
    const y = window.scrollY || 0;
    const vh = cssH || innerHeight || 1;
    const s = wins[0];
    st.stripVis = s.vis;
    if (s.box) { st.topDoc = s.box.top + y; st.bottomDoc = s.box.top + s.box.height + y; }
    const maxY = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    pageMaxY = maxY;
    // THE PLATES: the stage is developed at the hero pose whatever the scroll; the scroll's motion is the page's own
    if (platesOn()) { st.slideT = 0; return; }
    let slide = maxY > 0 ? clamp01(y / maxY) : 0;
    if (quantized()) slide = maxY > 0 && y >= maxY - vh * UNROLL.endZone ? 1 : 0;
    st.slideT = slide;
  }
  function stepHz(snap: boolean) {
    let tg = hzTarget;
    if (quantized()) tg = tg > 0.5 ? 1 : 0;
    if (snap || quantized()) { const moved = hzK !== tg; hzK = tg; return moved; }
    if (Math.abs(tg - hzK) < 1e-4) { if (hzK !== tg) { hzK = tg; return true; } return false; }
    hzK += Math.max(-HZ_STEP, Math.min(HZ_STEP, tg - hzK));
    return true;
  }

  /** Text folded away (inside a closed <details>, or any content-visibility: hidden subtree) still answers getClientRects
   *  with boxes laid out below the fold: it is not on the page, so it veils nothing (else Work's closed "Early work" fold
   *  would veil the whole closing on phones). */
  function unrendered(pe: Element) {
    const d = pe.closest('details');
    if (d && !(d as HTMLDetailsElement).open && !pe.closest('summary')) return true;
    const cv = (pe as Element & { checkVisibility?: (o: object) => boolean }).checkVisibility;
    return typeof cv === 'function' && !cv.call(pe, { contentVisibilityAuto: true, visibilityProperty: true });
  }
  // The union of an element's text lines (client rects of its text nodes), relative to its box; null if none.
  function textBox(el: Element, r: DOMRect) {
    const c = textBoxes.get(el);
    if (c && c.w === r.width && c.h === r.height && c.f === fontGen) return c.box;
    let l = Infinity, t = Infinity, rt = -Infinity, b = -Infinity;
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let n = walk.nextNode(), i = 0; n && i < 400; n = walk.nextNode(), i++) {
      if (!(n as Text).data.trim()) continue;
      const pe = n.parentElement;
      if (!pe || unrendered(pe)) continue;
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
  // Living veils: an element's text and pictures as a few bands down its height, each the union of its own lines, so a
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
      if (!pe || pe.closest('svg') || (pe.closest('.margin-note') && !el.matches?.('.margin-note')) || unrendered(pe)) continue;
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
    if (!veilEls.length || !cssW) return;
    const seen: [area: number, r: Edges, s: number, f: number][] = [];
    const live = stageOn();
    // living: every text block the painting must keep clear of (veils, keep-outs) is veiled on its own lines;
    // the margin notes in the rail on their own (the column's veil keeps to the column)
    // (otherwise a keep-out with no veil of its own (no data-veil, inside no veil) is a paper reserve under its lines,
    // so the drift and the sky deck never move under its words)
    const bare = live ? [] : keepEls.filter((el) => el.isConnected && !el.hasAttribute('data-veil') && !veilEls.some((v) => v.contains(el)));
    let els = live ? [...new Set(veilEls.concat(keepEls))] : veilEls.concat(bare);
    if (live) for (const el of veilEls) if (el.isConnected) els = els.concat([...el.querySelectorAll('.margin-note')]);
    for (const el of els) {
      if (!el.isConnected) continue;
      let r: DOMRect | Edges = el.getBoundingClientRect();
      const v = bare.includes(el) ? '0.95' : (el.getAttribute('data-veil') || '').trim();
      let s = v !== '' && Number.isFinite(+v) ? clamp01(+v) : veilK;
      let f = 1;
      if (live) {
        if ((r as DOMRect).width < 2 || (r as DOMRect).height < 2) continue;
        // (every band of the element's lines is veiled on its own)
        const m = T.core + (T.feather + T.swell * 1.3 + T.clear) * Math.min(1.8, Math.max(1, cssW / 1440));   // (a living veil counts while its edge or clearing shows)
        for (const tb of textBands(el, r as DOMRect)) {
          const q = { left: r.left + tb.l, top: r.top + tb.t, right: r.left + tb.r, bottom: r.top + tb.b };
          const x0 = Math.max(q.left - m, rect.left), x1 = Math.min(q.right + m, rect.left + cssW);
          const y0 = Math.max(q.top - m, rect.top), y1 = Math.min(q.bottom + m, rect.top + cssH);
          const area = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
          if (area > 0) seen.push([area, q, 1, 1]);
        }
        continue;
      } else if (s >= RESERVE) {
        // A reserve (small print): solid paper only behind its own lines, with a tighter feather, and only once
        // they are on screen. The landscape around it keeps its ink.
        const tb = textBox(el, r as DOMRect);
        if (!tb) continue;
        r = { left: r.left + tb.l, top: r.top + tb.t, right: r.left + tb.r, bottom: r.top + tb.b };
        const vis = Math.min(r.bottom, rect.top + cssH) - Math.max(r.top, rect.top);
        s = sstep(0, Math.min(RESERVE_IN, r.bottom - r.top), vis);   // (a one-line reserve is solid once its line is on screen)
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
      w.wakeOK = !!w.el && (wakeEls.includes(w.el) || w.el.hasAttribute('data-wake'));
      if (!w.box || !w.el) continue;
      const b = w.box;
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
  // THE UNROLL's travel, layout-only (measured with the keep-outs, never per scroll frame): UNROLL.share of the way from
  // this hero's framing to the next place's (Contact, with no next place: a reach of open water), capped at
  // UNROLL.maxRate px per px of the page's scroll (a short page travels less; the pan carries the rest). During a pan the
  // travel of the page being left is kept (the slide decays with the pan, draw()). And the footer's top (stageU).
  function measureSlide() {
    placeT();
    const ft = document.querySelector('.site-footer');
    const fr0 = ft ? ft.getBoundingClientRect() : null;
    st.footDoc = fr0 && fr0.height > 0 ? fr0.top - rect.top + (window.scrollY || 0) : -1;
    const sb0 = wins[0].box;
    // (the reading column's edge, where the hold stops the travel (below): the title block's right edge in the hero,
    // the strip's keep-out (41 rem, 776 px at 1440), the same lane on every page, past it the veil's core and feather;
    // a wider block below (Home's About paragraphs, Work's table and diagram, the Résumé's dense column) keeps its own
    // paper by its veil. Where no title block overlaps the strip there is no hold.)
    const kr0 = wins[0].keepR !== null && wins[0].keepR > 0 && sb0 ? wins[0].keepR + sb0.left : 0;
    const colX = kr0 > 0 ? kr0 + T.core + T.feather : -1;
    if (tween && tween.slidePx0 !== undefined) st.slidePx = tween.slidePx0;
    else if (sb0) {
      const k = Math.min(STRETCH_COUNT - 1, Math.max(0, Math.round(tween ? tween.to : stretch)));
      const box = { width: sb0.width, height: sb0.height, keepoutRight: wins[0].keepR, ...insideBox() };
      const A = framingAt(k, 'wide', box, 'strip');
      // (the next place on the chain: Home → Work → Writing → the Résumé → Contact; the 404 is off the map)
      const B = k <= 3 ? framingAt(k + 1, 'wide', { ...box, inside: false, insideU: undefined }, 'strip') : null;
      const travel = B ? UNROLL.share * Math.max(0, B.worldLeft - A.worldLeft) : UNROLL.reach;
      const maxY = Math.max(0, document.documentElement.scrollHeight - innerHeight);
      let px = Math.min(travel * A.scale, UNROLL.maxRate * maxY);
      // THE HOLD: the unroll always shows a drawn place. Where the next place lies beyond an empty reach (Work: the
      // river opening into the lake, nothing drawn between the town's east moorings at u 1.9 and the pavilion at 2.78;
      // the Résumé: half a stretch of open water before the crossing), a share of the way to it would slide the
      // place's last named thing behind the words with nothing to take its place. The travel stops where that thing
      // (compose.ts Frame.holdU) would stand UNROLL.holdAt into the margin; the page change's pan carries the rest.
      const hu = SCENES[k]?.frame.holdU;
      if (hu !== undefined && colX > 0 && cssW > colX) {
        const cap = (k + hu - A.worldLeft) * A.scale - (colX + UNROLL.holdAt * (cssW - colX));
        if (cap > 0) px = Math.min(px, cap);
      }
      st.slidePx = -px;
    } else st.slidePx = 0;
  }

  // the wake: fine pointers, inside a [data-wake] region, never under reduced motion, Still or on the plates
  const wakeOn = () => !quantized() && !settling && mode === 'webgl' && mqFine.matches && wakeEls.length > 0 && !platesOn();
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
  // ---------------------------------------------------------------- the water's rings (elements.ts contactLife)
  function addStir(S: Stir) {
    // (sparse: with every slot in use a drop waits its turn, so no ring ever vanishes mid-life)
    const now = performance.now();
    for (let i = stirs.length - 1; i >= 0; i--) if (now - stirs[i].t0 > STIR_LIFE * 1000) stirs.splice(i, 1);
    if (stirs.length >= STIR_N) return;
    stirs.unshift(S);
  }
  /** Still is settling: paced at the wake's <= 30 fps (the ambient drops only ride the ambient frames). */
  const fxFast = () => mode === 'webgl' && settling;
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
    // (on the plates the wake is off (wakeOn), but a move still marks the pointer as on the page, so the wake can answer
    // as soon as the plates give way)
    if (platesShown) wake.inWin = true;
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
    if (!hzOn && !wasVisible && !wins.some((w) => w.near) && !stageOn() && !(glimpseOn() && glims.some((g) => g.near || glimClose(g) || (!g.painted && Number.isFinite(g.doc))))) return;
    if (driftT < 1 && drifting()) pace(S_PRESENT, 0);
    // THE PLATES: the page moves the plates itself; a scroll draws nothing (their life wakes if it has come back on screen)
    if (platesOn() && platesShown && !need) { if (ambientOn()) wakeAt(lastPresent + PLATE_MS); return; }
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
      for (const e of entries) {
        for (const w of wins) if (w.el === e.target) w.near = e.isIntersecting;
        for (const g of glims) if (g.el === e.target) g.near = e.isIntersecting;
      }
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
    for (const g of glims) { if (on) { winIO?.observe(g.el); g.near = true; } else winIO?.unobserve(g.el); }
    for (const el of veilEls) if (el !== surface && ro) { if (on) ro.observe(el); else ro.unobserve(el); }
  }

  // ---------------------------------------------------------------- frame scheduling
  const running = () => !destroyed && !userPaused && !hidden && onscreen && !!renderer && renderer.ready;
  const awake = () => performance.now() - lastInput < (platesShown ? PLATE_IDLE : IDLE_MS);
  // the mist drifts inside the windows and on the stage only (never in the horizon band, behind the reading)
  const drifting = () => !quantized() && mode === 'webgl' && (anyVisible || stageShown() || wake.s > 0.01) && !glimRests() && (!platesShown || plateLifeSeen());
  /** With only windows into the painting on screen (no strip, closing or stage), their mist comes to rest
   *  3 s after the last scroll, so a phone reading beside one lets its GPU sleep. */
  const glimRests = () => !stageShown() && !wins.some((w) => w.vis && w.painted) && glims.some((g) => g.vis) && performance.now() - lastScroll > 3000;
  const ambientOn = () => drifting() && (awake() || driftT > 0);

  /** Paint on the next animation frame (scroll, resize, pans, arrival). */
  function request(flags: number) {
    need |= flags;
    if (!running()) {
      // (a renderer still getting ready, its programs linking or its context being restored: the frame comes when it is)
      if (!destroyed && renderer && !renderer.ready && !readyTimer) whenReady();
      return;
    }
    if (raf) return;
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

  // Wait for a renderer that is not ready yet (WebGL's programs still linking on the driver's threads: gl.ts poll, asked
  // every 16 ms without a blocking wait; a context still being restored), then paint. The boot's first scene comes
  // from here, in a frame of its own, never in the task that mounted the engine.
  function whenReady(tries = 0) {
    clearTimeout(readyTimer);
    readyTimer = 0;
    if (destroyed || !renderer) return;
    renderer.poll?.();
    if (renderer.ready) { request(S_ALL); return; }
    if (tries < 600) readyTimer = setTimeout(() => whenReady(tries + 1), 16);
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
    if (ambientOn()) at = Math.min(at, lastPresent + (platesShown ? PLATE_MS : AMBIENT_MS));
    // Still settling at the wake's <= 30 fps; the ambient drops only ride the ambient frames
    if (fxFast()) at = Math.min(at, lastPresent + POINTER_MS);
    else if (stirs.length && !quantized()) at = Math.min(at, lastPresent + AMBIENT_MS);
    if (at < Infinity) wakeAt(at);
  }

  // Adaptive quality. Heavy frames (a scene painted for motion: arrival, pan, a figure's fade) that keep arriving
  // slower than SLOW_MS are first painted as drafts at a lower internal scale; if they are still slow, the whole
  // buffer drops to fewer pixels (never below 0.5).
  function govern(start: number, heavy: boolean) {
    if (mode !== 'webgl') return;
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
  // A present (the whole viewport: the stage, or the windows and the horizon) runs on every scroll and drift frame, and
  // govern() never sees it (it is not heavy). Each plain present (no scene painted with it, something on screen) is
  // sampled by how long the GPU was still seen painting it when the next frame came (gpuWait: 0 on a GPU that keeps up;
  // otherwise a lower bound of its cost, to the frame), when that look tells (`telling`: the GPU was still at it, or the
  // look came within PRESENT_SLOW of the present; an ambient frame 70 ms later tells nothing). When GOV_N of them
  // average PRESENT_SLOW or more, the buffer drops to fewer pixels (never below 0.5, as above); still slow at 0.5, a
  // living page gives its stage up and keeps the strip and closing windows (stageVeto).
  function governPresent(presented: boolean, painted: boolean) {
    if (!presented) return;
    if (prevPlain && telling && mode === 'webgl') {
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
  function framingOf(w: Win): Framing | null {
    if (!w.box) return null;
    // the closing shows the page's own place once more (compose.ts frame.closing): a small version of its opening, or on a
    // short page, whose closing shares a screen with its strip, a different view of it (twin, without the strip's figures)
    return framingBlend(stretch, cls, { width: w.box.width, height: w.box.height, keepoutRight: w.keepR, twin: w.kind === 'closing' && twinNow(), ...insideBox() }, w.kind);
  }
  /** A short page: its strip and its closing share a screen (their gap is under a viewport), so the closing frames a
   *  different view of the place, never the same picture (or the same figures) twice. (Box tops move together: scroll-invariant.) */
  function twinNow() {
    const s = wins[0].box, c = wins[1].box;
    return !!s && !!c && c.top - (s.top + s.height) < (cssH || innerHeight);
  }
  const specKey = () => `${curSpec.presence.toFixed(3)}:${curSpec.w.level.toFixed(3)}:${curSpec.w.high.toFixed(3)}:${curSpec.w.deep.toFixed(3)}`;
  // can a window at this framing see that figure layer?
  function seen(fr: Framing, b: Rect, s: Slot) {
    const r = s.L.meta.rect;
    const u0 = fr.worldLeft, u1 = u0 + b.width / fr.scale;
    return u1 > r[0] && u0 < r[1];
  }
  /** (PART) The plane a window's front layer starts at, 0 when it is painted as one view (a page that is not living,
   *  the stage, Canvas2D or a software rasteriser, reduced motion or Still, and while it moves: a pan, the bloom). */
  function partSplit(w: Win, draft: boolean) {
    if (!living() || stageOn() || mode !== 'webgl' || software || quantized()) return 0;
    if (draft || tween || (w.kind === 'strip' && arriving)) return 0;
    const k = Math.round(stretch);
    return PART.split[k] ?? 0;
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
    const key0 = [fr.worldLeft.toFixed(5), fr.worldTop.toFixed(5), fr.scale.toFixed(2), bw, bh, palette, specKey(), w.keepR, fk(fa), fk(fb),
      w.kind === 'strip' ? arrive.toFixed(3) : 'a', U0.draft ? 'd' : 'f', mode].join('|');
    // at rest a living page's window is two depth layers (the back in its own view, the front in w.nid)
    const split = partSplit(w, !!U0.draft);
    const key = `${key0}|${split ? `b${split}` : 'a'}`;
    const keyN = split ? `${key0}|n${split}` : '';
    let needN = false;
    if (split) needN = renderer!.view(w.nid, bw, bh) || force || keyN !== w.nkey || w.npending;
    else if (w.nkey || w.npainted) { renderer!.dropView?.(w.nid); w.nkey = ''; w.npainted = false; w.npending = false; }
    const needM = remade || force || key !== w.key || w.pending;
    if (!needM && !needN) return false;
    const P = resolve(curSpec, 1.6);
    const vh = fr.scale / HS;                     // CSS px per scene unit
    const left = fr.worldLeft, wvis = b.width / fr.scale, asp = b.width / vh;
    const view = [left * HS, fr.worldTop, b.height / vh, asp];
    const samples = mode === 'webgl' ? Math.min(1536, Math.max(96, Math.round(bw / 1.25))) : Math.min(480, Math.max(120, Math.round(bw / 3)));
    // the ridges depend on the framing, the size, the palette and the composition only (never on the bloom's clock
    // or a figure's fade): built once per such key, uploaded once per view buffer
    const rkey = [samples, left.toFixed(6), wvis.toFixed(6), asp.toFixed(6), palette, specKey(), mode].join('|');
    if (rkey !== w.rkey || !w.buf) {
      w.buf = buildRidges(samples, { left, wvis, aspect: asp, palette, pigment: 1 }, P, w.buf);
      w.rkey = rkey;
      w.rup = false;
    }
    // keep-out, in box uv: the text's right edge, active, the mist ramp's half-width (140 px), the figure guard (+40 px)
    const keep = w.keepR !== null && w.keepR > 0
      ? new Float32Array([w.keepR / b.width, 1, 140 / b.width, (w.keepR + 40) / b.width]) : new Float32Array(4);
    w.keepU = keep;
    w.viewU = new Float32Array(view);
    const U = {
      ...U0, view: w.viewU, hs: HS, feet: layerFeet(P), keep, figA: fa, figB: fb,
      arrive: w.kind === 'strip' ? arrive : 9, hz: hzZero, hzK: 0,
    };
    // (the front first, behind the one view still on show; then the back, and only then does the present part them)
    if (needN) {
      renderer!.ridges(w.nid, w.buf, samples);
      const okN = renderer!.scene(w.nid, { ...U, planes: new Float32Array([split, LAYERS - 1, 1, 0]) }) !== false;
      counts.scenes++;
      w.npending = !okN;
      w.nkey = okN ? keyN : '';
      w.npainted = w.npainted || okN;
    }
    if (needM) {
      if (remade || !w.rup) { renderer!.ridges(w.id, w.buf, samples); w.rup = true; }
      const done = renderer!.scene(w.id, split ? { ...U, planes: new Float32Array([0, split - 1, 0, 0]) } : U) !== false;
      counts.scenes++;
      w.pending = !done;
      w.key = done ? key : '';
      w.painted = w.painted || done;
      w.draft = !!U.draft;
      if (done) { if (U.draft) { counts.drafts++; counts.draftAt = Math.round(performance.now()); } else counts.fullAt = Math.round(performance.now()); }
    }
    w.parted = !!split && w.key === key && w.nkey === keyN && w.npainted;
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
    const U = { ...U0, view: hzv.view, hs, feet: layerFeet(P), keep: null, figA: null, figB: null, arrive: 9, hz: hzU, hzK: 1, hzShift: shift, horizon: true };
    const done = renderer!.scene(hzv.id, U) !== false;
    counts.scenes++;
    hzv.pending = !done;
    hzv.key = done ? key : '';
    hzv.painted = hzv.painted || done;
    hzv.draft = !!U.draft;
    return true;
  }

  /** Free the stage's views (leaving the living ground: a page that is not living, or a window narrower than 1200 px). */
  function dropStage() {
    for (const L of st.layers) { renderer!.dropView?.(L.id); L.key = ''; L.painted = false; L.pending = false; L.draft = false; }
    st.ok = false; st.single = true; st.pendingSplit = false; st.alloc = false; st.geo = ''; st.buf = null;
    st.slideK = st.slideT = 0;
    st.glide = false; st.sepK = 1;
  }
  /** Free the windows' views (entering the living ground: the stage stands in for the strip, the closing and the horizon). */
  function dropWindowViews() {
    for (const w of wins) {
      renderer!.dropView?.(w.id); w.key = ''; w.painted = false; w.pending = false; w.draft = false; w.buf = null;
      renderer!.dropView?.(w.nid); w.nkey = ''; w.npainted = false; w.npending = false; w.parted = false;
    }
    renderer!.dropView?.(hzv.id); hzv.key = ''; hzv.painted = false; hzv.pending = false; hzv.draft = false; hzv.buf = null;
  }
  /**
   * Paint the stage's depth layers (the page's own scene at the strip's framing, extended to the whole viewport).
   * In motion (a pan, the bloom) one combined layer is painted per frame, full size, into the far layer's view, and the
   * other two are freed; at rest the three layers are painted (near and middle first, behind the combined one still on
   * show, then the far one at its own resolution, and only then does the present switch over). Each transparent layer
   * covers only its crop (stageCrops). Returns true when it painted anything.
   */
  function paintStage(U0: SceneBase, slots: Slot[], force: boolean, single: boolean) {
    const sb = wins[0].box;
    if (!sb || !W) return false;
    placeT();
    const fr = st.fr = framingBlend(stretch, 'wide', { width: sb.width, height: sb.height, keepoutRight: wins[0].keepR, ...insideBox() }, 'strip');
    const unit = HS / fr.scale;                       // scene units per CSS px
    st.left = fr.worldLeft - sb.left / fr.scale;      // world x (stretches) at the viewport's left edge
    st.wvis = cssW / fr.scale;
    // THE UNROLL: every layer, the far one too, is painted the page's whole travel wider (st.ext CSS px, the reach: the
    // next place comes in from the east as the painting slides), a pan's combined layer as wide as the slide still is;
    // and with the same ridge columns per CSS px as the viewport-wide painting (the extension rounds up to whole
    // columns), so the rest frame keeps its silhouettes to the pixel.
    // (THE BAND: the canvas is the band's own box, 1 / BAND.zoom of the window's width, so the settled band is full of
    // painting; the reach below is the page's travel beyond that)
    const left0 = Math.max(0, -st.slidePx) * (single ? st.slideK : 1);
    // (every layer wider than its furthest travel by 64 px, so no crop's edge can come into view)
    const sBase = Math.min(1536, Math.max(320, Math.round(W / 1.25)));
    let samples = sBase;
    if (left0 > 0) {
      st.ext = Math.ceil(left0) + 64;
      // (whole ridge columns and whole pixels of the coarsest layer, the far one at T.far: the painting within the
      // viewport then samples exactly as the viewport-wide one does, with no sub-pixel phase of its own)
      const colW = cssW / sBase;                                                   // CSS px per ridge column
      const farPx = (cssW / W) / (single ? 1 : Math.min(1, Math.max(0.25, T.far)));   // CSS px per far-layer pixel
      let m = Math.ceil((cssW + st.ext) / colW);
      for (let i = 0; i < 4096; i++, m++) { const q = (m * colW) / farPx; if (Math.abs(q - Math.round(q)) < 1e-6) break; }
      samples = m;
      st.ext = m * colW - cssW;
    } else st.ext = 0;
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
    const geo =[st.view[0].toFixed(5), top.toFixed(5), fr.scale.toFixed(2), W, H, palette, specKey(), kr, samples, Math.round(st.bottomDoc),
      T.sink.join(','), T.split.join(','), T.seaK, T.soft, T.billow, Math.round(stretch * 1000), st.ext].join('|');
    if (geo !== st.geo || !st.buf) {
      st.buf = buildRidges(samples, { left: st.left, wvis: st.wvisX, aspect: cssWX * unit, palette, pigment: 1 }, P, st.buf);
      st.samples = samples;
      stageCrops(unit, top, kr, cssWX);
      st.geo = geo;
    }
    const base = [geo, U0.draft ? 'd' : 'f', mode, arrive.toFixed(3)].join('|');
    const sp = T.split;
    const ranges = single ? [[0, LAYERS - 1, 0]] : [[0, sp[0] - 1, 0], [sp[0], sp[1] - 1, 1], [sp[1], LAYERS - 1, 1]];
    // what each layer would paint now, and whether it is stale
    const jobs: { j: number; lo: number; hi: number; layer: number; fa: FigureSlot | null; fb: FigureSlot | null; key: string; c: number[]; bw: number; bh: number }[] = [];
    ranges.forEach(([lo, hi, layer], j) => {
      const L = st.layers[j];
      // (the unroll: the far ranges slide with the rest, so the far layer is painted as wide as the others, cssWX)
      const c = j === 0 ? [0, 0, cssWX, cssH] : L.crop;
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
      renderer!.view(L.id, job.bw, job.bh);
      st.alloc = true;
      renderer!.ridges(L.id, st.buf, samples);
      const c = job.c;
      const view = new Float32Array(job.j === 0 ? vX : [vX[0], top - c[1] * unit, (c[3] - c[1]) * unit, vX[3]]);
      const U = {
        ...U0, view, hs: HS, feet: layerFeet(P), keep, figA: job.fa, figB: job.fb,
        arrive, hz: hzZero, hzK: 0, planes: new Float32Array([job.lo, job.hi, job.layer, 0]),
        crop: new Float32Array([c[0] / cssWX, (c[2] - c[0]) / cssWX, 0, 0]),
      };
      const ok = renderer!.scene(L.id, U) !== false;
      platesAll = true;
      counts.scenes++;
      L.pending = !ok;
      L.key = ok ? job.key : '';
      L.painted = L.painted || ok;
      L.draft = !!U.draft;
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
   * from their highest crest or figure down to the line below which the sea always covers them (the sea keeps to the
   * deepest sink: a layer that sinks less shows at most that difference more of itself).
   */
  function stageCrops(unit: number, top: number, kr: number | null, cssWX = cssW) {
    const sp = T.split, n = st.samples, buf = st.buf!;   // (paintStage has just built the ridges)
    // (left of the keep-out's mist a layer is clear)
    const x0 = kr !== null ? Math.max(0, Math.floor(kr - 240)) : 0;
    const c0 = Math.min(n - 1, Math.max(0, Math.floor((x0 / (cssWX || 1)) * n)));
    const vh = cssH || 1;
    const rest = st.bottomDoc / vh;
    const figs = [Math.round(stretch) - 1, Math.round(stretch), Math.round(stretch) + 1].map((k) => figureMeta(k)).filter(Boolean) as FigureMeta[];
    [[sp[0], sp[1] - 1], [sp[1], LAYERS - 1]].forEach(([lo, hi], i) => {
      const L = st.layers[i + 1];
      let h = -Infinity;
      for (let l = lo; l <= hi; l++) for (let c = c0, o = (l * n + c0) * 4; c < n; c++, o += 4) if (buf[o] > h) h = buf[o];
      // (the crops start at the crests and the figures: less to paint and to hold, the reach being wider)
      for (const m of figs) if (m.plane >= lo && m.plane <= hi && m.rect[1] > st.left && m.rect[0] < st.left + st.wvisX) h = Math.max(h, m.rect[3]);
      h += 0.03;                                                                // soft ink edges, crest texture
      let y0 = Math.min(cssH - 8, Math.max(0, Math.floor((top - h) / unit)));
      const below = rest + (seaSink() - T.sink[i + 1]) + T.billow * 0.75 + T.soft;
      let y1 = T.seaK >= 0.99 ? Math.min(cssH, Math.max(y0 + 8, Math.ceil(below * vh) + 6)) : cssH;
      // (the crop's rows on the layer's own pixel grid, whole pixels from the viewport's top, so the painting samples
      // with no sub-pixel phase: y0 down and y1 up to the grid, the viewport's edges kept)
      const ppx = cssH / (H || 1);   // CSS px per layer pixel (the transparent layers paint at full resolution)
      y0 = Math.max(0, Math.floor(y0 / ppx) * ppx);
      y1 = Math.min(cssH, Math.ceil(y1 / ppx) * ppx);
      L.crop = [x0, y0, cssWX, y1];   // (viewport CSS px at the page's top; past the right edge by st.ext)
      const R = st.rects;
      R.set([x0 / cssW, 1 - y1 / vh, cssWX / cssW, 1 - y0 / vh], (i + 1) * 4);
    });
    st.rects.set([0, 0, cssWX / (cssW || 1), 1], 0);   // (the far layer's width, viewports: the unroll paints it as wide as the reach)
  }
  /** The stage's present uniforms: each layer's slide, alpha and crop, the sea, and the inner places' soft crops, footer
   *  and grade. */
  function stageU(): StageU {
    const vh = cssH || 1;
    // THE UNROLL: the whole painting slides as one, the far ranges included, and no layer sinks (y and w stay 0)
    const slide = (st.slidePx / (cssW || 1)) * st.slideK;
    const single = st.single;
    for (let i = 0; i < 3; i++) {
      st.offsets[i * 4] = slide;
      st.offsets[i * 4 + 1] = 0;
      st.offsets[i * 4 + 2] = i === 0 ? 1 : single ? 0 : 1;   // (combined: the far layer's view holds every plane)
      st.offsets[i * 4 + 3] = 0;
    }
    // the sea: its surface lies on the strip's bottom edge
    const rest = clamp01(st.bottomDoc / vh);
    st.sea.set([1 - rest, T.soft, 0, T.billow]);   // (z: unused)
    st.k.set([1, 0, T.seaK, 0]);                     // (y, w: unused)
    // an inner place's soft crops (its seed) and its stage clearing above the footer
    st.airU.set([0, T.botF, 0, T.seed]);             // (x, z: unused)
    const fy = st.footDoc >= 0 ? 1 - (st.footDoc - (window.scrollY || 0)) / vh : -9;
    st.footU.set([fy, 110 / vh, T.foot, 0]);   // (w: unused)
    // (the window's inner grade on the stage: the hero box at the page's top and its words' keep-out, inner places only)
    const kG = wins[0].keepR !== null && wins[0].keepR > 0 && wins[0].box ? (wins[0].keepR + wins[0].box.left) / (cssW || 1) : 0;
    if (T.air > 0) st.gradeU.set([1 - st.bottomDoc / vh, 1 - st.topDoc / vh, kG, 140 / (cssW || 1)]); else st.gradeU.fill(0);
    return { ids: STAGE_IDS, offsets: st.offsets, view: st.view, k: st.k, sea: st.sea, rects: st.rects, air: st.airU, foot: st.footU, grade: st.gradeU };
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
    // asking for frames
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
    sweepU[0] = x; sweepU[1] = SWEEP_W * sw.dir; sweepU[2] = a; sweepU[3] = thick;   // (the half-width's sign carries its travel; the bank squares it)
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

  /** (firstFrame 'complete') Is the first present still waiting: for the page's own figure layer (the worker is drawing
   *  it), for the stage's three layers, or for the strip's full-quality scene? Never past HOLD_MAX. */
  function holdingFirst() {
    if (!firstComplete || drawnOnce || performance.now() - holdAt >= HOLD_MAX) return false;
    const L = layerFor(Math.round(stretch), false);
    if (L && L.status === 'pending') return true;
    // (the unroll: the next place's layer too, where the hero already shows a part of its place in the reach)
    if (stageOn()) {
      const j = Math.round(stretch) + 1;
      const R = j < STRETCH_COUNT - 1 ? layerFor(j, false, 'reach', ownSpec(j)) : null;
      if (R && R.status === 'pending' && windowsSee(R.meta.rect)) return true;
    }
    if (stageOn() && W > 0) return !stageReady();
    return wins[0].vis && (!wins[0].painted || wins[0].draft);
  }

  /** Advance animations and paint what is dirty. `animating`: another frame is needed right away; `due`: when the
   *  next frame is due otherwise (a full-quality scene after drafts). */
  function draw(now: number) {
    const dt = clockLast ? Math.max(0, Math.min(250, now - clockLast)) : 0;
    clockLast = now;
    let animating = false, due = Infinity, heavy = false, paintedNow = false;

    // Veils are viewport rects (they follow their text as the page scrolls), so a scroll re-measures them too; a
    // window's keep-out is box-relative and only changes on measure frames.
    if (need & S_SCROLL) { readBoxes(); if (!(need & S_MEASURE)) measureVeil(); need |= S_PRESENT; }
    if (need & S_MEASURE) { measureVeil(); measureKeep(); need |= S_PRESENT; }

    const panning = !!tween;   // the frame that ends a pan is still painted as a pan frame
    let dtT = dt;
    if (tween && tween.clock === undefined) {
      // the pan's first frame: its clock starts here, never with the stale gap since the last ambient frame (up to
      // 250 ms: the whip ease front-loads, so the first frame would jump a quarter of the way)
      tween.clock = 0;
      dtT = 0;
      if (stageOn() && st.ok && st.slideK > 0.0005) {
        // THE UNROLL: the pan takes over where the slide has brought the painting. The page's travel is kept through
        // the pan (slidePx0) and the slide decays with the pan's ease (slideK0, the glide below) while the camera
        // travels, so the first frame is the picture on screen and nothing jumps back; a page read to its end is already
        // most of the way: the pan runs the rest in proportion (at least 160 ms).
        tween.slideK0 = st.slideK; tween.slidePx0 = st.slidePx;
        const sc = st.fr ? st.fr.scale : cssW || 1;
        const moved = (-st.slidePx * st.slideK) / Math.max(1, sc);   // (stretches east)
        const whole = Math.abs(tween.to - tween.from), rest = Math.abs(tween.to - tween.from - moved);
        if (whole > 1e-3) tween.dur = Math.max(160, tween.dur * Math.min(1.5, rest / whole));
      }
    }
    if (tween) {
      tween.t = tween.dur > 0 ? Math.min(1, tween.t + dtT / tween.dur) : 1;
      const ease = tween.ease === 'cubic' ? easeCubic : easeWhip;
      const e = ease(tween.t);
      tween.e = e;
      if (tween.cut) {
        // travel CUT_SPAN on screen; the middle of the journey is spliced out under the thick mist
        const D = tween.to - tween.from, sg = Math.sign(D), span = Math.min(CUT_SPAN, Math.abs(D));
        stretch = tween.from + sg * (span * e + (e >= ease(CUT_AT) ? Math.abs(D) - span : 0));
      } else stretch = tween.from + (tween.to - tween.from) * e;
      curSpec = blendSpec(tween.fromSpec, tween.toSpec, e);
      if (tween.t >= 1) {
        finishPan();
        // the pan is over: the scroll, the boxes and the slide are read again at the page's own stretch (the camera was
        // held at the opening while it ran; it then glides to where the scroll puts it)
        if (stageOn()) { readBoxes(); measureVeil(); measureKeep(); }
      } else animating = true;
    }
    if (arriving) {
      if (dt > 0 && !hidden) arriveSeen = true;
      arrive += dt / 1000;
      if (arrive >= ARRIVE_END) { arriving = false; arrive = 9; } else animating = true;
    }
    if (stepHz(false)) need |= S_PRESENT;
    if (Math.abs(hzK - hzTarget) > 1e-4 && !quantized()) animating = true;
    if (sw) { if (updateSweep(dt)) animating = true; need |= S_PRESENT; }
    if (wake.has || wake.s > 0 || trail.length) { if (updateWake(dt, now)) need |= S_PRESENT; }
    if (settling) {
      // (elements.ts stillSettle) Still was asked for: the drift and the small life ease to rest over
      // SETTLE_MS (at the wake's pace), then the painting is still
      driftT = Math.max(0, driftT - dt / SETTLE_MS);
      const d = driftT * driftT * (3 - 2 * driftT);
      if (d > 0) time += (dt / 1000) * d * T.drift;
      need |= S_PRESENT;
      if (driftT <= 0) {
        settling = false;
        still = true;
        stirs.length = 0;
        need |= S_SCROLL | S_SCENE | S_PRESENT;
      }
    } else if (drifting() && dt > 0) {
      driftT = awake() ? Math.min(1, driftT + dt / EASE_IN_MS) : Math.max(0, driftT - dt / EASE_OUT_MS);
      const d = driftT * driftT * (3 - 2 * driftT);
      if (d > 0) { time += (dt / 1000) * d * T.drift; need |= S_PRESENT; }   // (every page: gently perceptible)
    }
    // Still settling and the water's rings ask for presents while they move
    if (fxFast() || stirs.length) need |= S_PRESENT;

    // the scenes: a window repaints when its framing, keep-out or figures change, while it is in motion,
    // and once at full quality after motion stops. Never while the page merely scrolls (its key stays the same).
    const held = heldAt > 0 && now - heldAt < HELD_MS;   // (the scroll mode's hand: governed like a pan)
    const moving = panning || arriving || held;
    const draft = mode === 'webgl' ? moving && draftScale < 1 : panning;
    const U0 = { tide, draft, draftScale, aspect };
    const slots = lastSlots = figSlots();
    for (const s of slots) if (s.k < 1) animating = true;
    const scrollIdle = performance.now() - lastScroll > 100;
    const settleDue = !moving && performance.now() - counts.draftAt >= FULL_MS - 8;
    const staged = stageOn() && W > 0;
    // (the engine paints the windows into the painting (each window's still gives way to its painting: data-live, a 300 ms
    // cross-fade); off, the still stays)
    { const lv = glimpseOn();
      if (lv !== glimLive) { glimLive = lv; if (!lv) dropGlims(glims); } }
    for (const w of wins) {
      // (the closing is painted ahead, off screen, at idle or once it is within two viewports, and only when
      // what it will show is ready, so scrolling it into view never paints a scene)
      const near = !staged && w.kind !== 'strip' && !!w.box && w.box.top < (cssH || innerHeight) * 3 && !w.painted;
      if (near) w.want = true;
      if (staged || !w.box || !(w.vis || (w.want && (scrollIdle || near)))) continue;   // (the stage stands in for both windows)
      if (!w.vis && w.kind !== 'strip') {
        if (!aheadT) aheadT = now;
        // (at most 6 s: a layer that never comes never keeps the loop awake)
        if (now - aheadT < 6000 && !closingAhead()) { due = Math.min(due, now + 120); continue; }
      } else if (w.kind !== 'strip') aheadT = 0;
      if (w.draft && !moving && !settleDue) due = Math.min(due, counts.draftAt + FULL_MS);
      if (paintWin(w, U0, slots, ((need & S_SCENE) !== 0 && w.vis) || (w.draft && settleDue))) {
        heavy = heavy || moving;
        need |= S_PRESENT;
        w.want = false;
        paintedNow = true;
      }
      if (w.pending) animating = true;
    }
    // (the windows into the painting, each painted for itself, one per frame, at scroll idle only (never
    // while the page scrolls, never in a frame that painted another scene, never during a pan or the arrival): a frame
    // comes back for the next one 120 ms later)
    if (glimpseOn() && !staged) {
      const idle = scrollIdle && !moving && !paintedNow && !arriving && performance.now() - lastScroll > 250;
      const r = glimpseWork(U0, idle);
      if (r === 'painted') {
        need |= S_PRESENT; paintedNow = true; due = Math.min(due, now + 120);
        if (glims.some((g) => g.vis && g.painted)) anyVisible = true;   // (a window painted on screen shows at once)
      }
      else if (r === 'later') due = Math.min(due, now + 120);
      if (glimFading()) { animating = true; need |= S_PRESENT; }
    }
    if (staged) {
      // entering the living ground: the windows' views (the strip, the closing, the horizon band) are freed
      if (!st.alloc) dropWindowViews();
      // the slide: scroll-linked (exact) at rest; during a pan it decays with the pan's ease (the scroll's own target is
      // kept), and after it glides back to it: never a jump
      const pan = !!tween;
      // (a slow frame never takes a big step: the glide's step is capped at 50 ms of its time)
      const kG = dt > 0 ? 1 - Math.exp(-Math.min(dt, 50) / GLIDE_TAU) : 0;
      const gl = pan || (st.glide && !quantized());
      const ease = (a: number, b: number) => (!gl || Math.abs(b - a) < 2e-3 ? b : a + (b - a) * kG);
      // (the unroll's pan: the slide it took over decays with the pan's ease while the camera travels)
      st.slideK = pan && tween!.slideK0 !== undefined ? tween!.slideK0 * (1 - (tween!.e ?? 0)) : ease(st.slideK, pan ? 0 : st.slideT);
      if (gl) {
        if (pan || st.slideK !== st.slideT) animating = true; else st.glide = false;
      }
      const single = moving;
      if (st.layers.some((L) => L.draft) && !moving && !settleDue) due = Math.min(due, counts.draftAt + FULL_MS);
      if (paintStage(U0, slots, (need & S_SCENE) !== 0, single)) { need |= S_PRESENT; heavy = heavy || moving; }
      // (sepK: as the three layers take over from the combined one it glides to 1, quantized modes at once; every layer
      // has the same pose under the unroll, so it only paces the hand-over: stageReady and `pending` wait for it)
      if (st.single) st.sepK = 0;
      else if (st.sepK < 1) { st.sepK = quantized() || st.sepK > 0.998 ? 1 : st.sepK + (1 - st.sepK) * kG; if (st.sepK < 1) animating = true; }
      if (st.pendingSplit || st.layers.some((L) => L.pending)) animating = true;
      need |= S_PRESENT;
    } else if (st.alloc) dropStage();   // left the living ground (a page that is not living, or a narrower window): free the layers
    if (hzOn && W && !stageOn() && (hzK > 0 || (hzv.want && scrollIdle))) {
      if (hzv.draft && !moving && !settleDue) due = Math.min(due, counts.draftAt + FULL_MS);
      if (paintHorizon(U0, hzv.draft && settleDue)) { need |= S_PRESENT; hzv.want = false; heavy = heavy || moving; }
      if (hzv.pending) animating = true;
    }
    // (the first full scene is up once it has been presented: a layer ready before that follows it instead of fading)
    if (!drawnFigs && drawnOnce && (wins.some((w) => w.painted) || st.ok)) drawnFigs = true;

    const shown = anyVisible || stageShown();
    if (shown !== wasVisible) need |= S_PRESENT;
    // (firstFrame 'complete') the first present waits for the figures and the stage; a frame that waited asks for the
    // present back as soon as the wait is over (or HOLD_MAX is up)
    const holdFirst = holdingFirst();
    if (holdFirst) { heldPresent = true; due = Math.min(due, holdAt + HOLD_MAX); }
    else if (heldPresent) { heldPresent = false; need |= S_PRESENT; }
    if ((need & S_PRESENT) && !holdFirst && (shown || wasVisible || hzK > 0 || !drawnOnce || sw)) {
      const t = performance.now();
      if (platesOn() && st.ok) platesOut();
      else {
        if (platesShown) renderer!.resize(W, H);   // (the darkroom is the screen again)
        renderer!.present(presentU());
        if (platesShown) { platesShown = false; platesAll = true; sink!.show(false); }
      }
      lastPresent = t;
      counts.presents++;
      if (!drawnOnce) {
        surface.style.visibility = '';   // (the first frame is in the buffer: the canvas may show)
        document.documentElement.classList.add('ink-live');   // (the painting is live: later pages' stills never show)
      }
      drawnOnce = true;
      // the strip's painting is on screen: its box learns it (its still, components/page/Strip, fades out over it)
      if (!stripLive && wins[0].el && (wins[0].painted || st.ok)) { stripLive = true; wins[0].el.setAttribute('data-live', ''); }
      wasVisible = shown || hzK > 0;
      // QA only (the hold, qa()): the loop stops on this present, so the canvas holds exactly this frame for the capture
      if (QA && qaHold) { userPaused = true; stop(); }
    }
    need = 0;
    return { animating, heavy, due };
  }

  // ---------------------------------------------------------------- THE PLATES: the stage, developed
  /** How far right the stage's life may lie (canvas uv x): the screen, or on the plates the layers' whole painted width. */
  const lifeXMax = () => (platesOn() ? (cssW + st.ext) / (cssW || 1) : 1);
  let pageMaxY = 0;
  /** Is any of the plates' life on screen now? What rides the stage has gone west with the page's scroll (off the
   *  screen's edge); what is pinned to the frame is always there. */
  function plateLifeSeen() {
    if (platePin) return true;
    return plateFreeSeen();
  }
  /** How far west the page's scroll has carried the plates now (CSS px; the unroll). */
  function plateSlide() {
    if (!platesShown || quantized()) return 0;
    return -st.slidePx * clamp01((window.scrollY || 0) / Math.max(1, pageMaxY));
  }
  /** Is a box of the stage (screen CSS px at the page's top: x0, x1) on screen now? */
  const plateSeenX = (x0: number, x1: number) => { const sl = plateSlide(); return x1 - sl > 0 && x0 - sl < cssW; };
  function plateFreeSeen() {
    if (!plateLifeCss) return false;
    return plateSeenX(plateLifeCss[0], plateLifeCss[2]);
  }
  /** A plate: its box on the screen at the page's top (CSS px), its window in canvas uv, its size in buffer px, and
   *  (`off`) its foot above the foot of the plate it is a part of (px: its grain and dither are that plate's). */
  interface Plate { kind: PlateKind; css: PlateBox; uv: [number, number, number, number]; px: [number, number]; off?: number }
  function plateList(pin: PlateBox | null): Plate[] {
    const out: Plate[] = [];
    const vh = cssH || 1, s = W / (cssW || 1);
    const wx = cssW + st.ext;                       // the layers' painted width (CSS px)
    const P = (kind: PlateKind, l: number, t: number, w: number, h: number): Plate => ({ kind, css: [l, t, w, h],
      uv: [l / cssW, 1 - (t + h) / vh, w / cssW, h / vh], px: [Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))] });
    // the far plate travels west with the rest, so it holds the sky whole (the header stands on the sky itself)
    const far = P(1, 0, 0, wx, cssH);
    out.push(far);
    if (!st.single) for (let j = 1; j < 3; j++) {
      const c = st.layers[j].crop;
      if (c && st.layers[j].painted && c[2] > c[0] && c[3] > c[1]) out.push(P((j + 1) as PlateKind, c[0], c[1], c[2] - c[0], c[3] - c[1]));
    }
    // the sea of mist: from just above its highest billow to the screen's foot
    if (T.seaK > 0) {
      const top = Math.max(0, Math.floor((1 - st.sea[0] - st.sea[1] * 0.45 - st.sea[3] * 0.8) * vh) - 2);
      if (top < cssH - 2) out.push(P(4, 0, top, wx, cssH - top));
    }
    if (pin) out.push(P(5, pin[0], pin[1], pin[2], pin[3]));
    return out;
  }
  function plateCanvas(kind: PlateKind) {
    let e = plateCtx.get(kind);
    if (e === undefined) {
      const c = sink!.canvas(kind);
      const x = c ? c.getContext('2d') : null;
      e = c && x ? { c, x } : null;
      plateCtx.set(kind, e);
    }
    return e;
  }
  /** Develop a plate, or a part of it (plate px: x, y from its top, w, h), in tiles the darkroom holds. */
  function develop(U: PresentU, B: Plate, part?: number[]) {
    const e = plateCanvas(B.kind);
    if (!e || !renderer?.plate) return;
    const [pw, ph] = B.px;
    if (e.c.width !== pw || e.c.height !== ph) { e.c.width = pw; e.c.height = ph; part = undefined; plateLast.delete(B.kind); }
    let [x0, y0, w, h] = part || [0, 0, pw, ph];
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
    w = Math.min(pw - x0, Math.ceil(w)); h = Math.min(ph - y0, Math.ceil(h));
    if (w < 1 || h < 1) return;
    const TW = Math.max(16, Math.min(PLATE_TILE, W)), TH = Math.max(16, Math.min(PLATE_TILE, H));
    for (let ty = y0; ty < y0 + h; ty += TH) {
      for (let tx = x0; tx < x0 + w; tx += TW) {
        const tw = Math.min(TW, x0 + w - tx), th = Math.min(TH, y0 + h - ty);
        const by = ph - ty - th;                    // the tile's foot, plate px from the plate's foot (canvas uv is y up)
        const src = renderer.plate(U, B.kind, [B.uv[0] + (tx / pw) * B.uv[2], B.uv[1] + (by / ph) * B.uv[3], (tw / pw) * B.uv[2], (th / ph) * B.uv[3]], tw, th, tx, by + (B.off ?? 0));
        if (!src) return;
        e.x.clearRect(tx, ty, tw, th);
        e.x.drawImage(src, 0, src.height - th, tw, th, tx, ty, tw, th);
      }
    }
    if (!part) platesDeveloped++;
  }
  /** The part of a plate (plate px, y from its top) that holds a box given in canvas uv (y up), with a margin. */
  function platePart(B: Plate, u: ArrayLike<number>, pad = 3): number[] {
    const [pw, ph] = B.px;
    const x0 = Math.floor(((u[0] - B.uv[0]) / B.uv[2]) * pw) - pad, x1 = Math.ceil(((u[2] - B.uv[0]) / B.uv[2]) * pw) + pad;
    const y0 = Math.floor((1 - (u[3] - B.uv[1]) / B.uv[3]) * ph) - pad, y1 = Math.ceil((1 - (u[1] - B.uv[1]) / B.uv[3]) * ph) + pad;
    const l = Math.max(0, x0), t = Math.max(0, y0);
    return [l, t, Math.min(pw, x1) - l, Math.min(ph, y1) - t];
  }
  const partUnion = (a: number[] | undefined, b: number[]) => {
    if (!a || a[2] <= 0 || a[3] <= 0) return b;
    if (b[2] <= 0 || b[3] <= 0) return a;
    const l = Math.min(a[0], b[0]), t = Math.min(a[1], b[1]);
    return [l, t, Math.max(a[0] + a[2], b[0] + b[2]) - l, Math.max(a[1] + a[3], b[1] + b[3]) - t];
  };
  function plateGeometry(list: Plate[]): PlateGeometry {
    const boxes: PlateGeometry['boxes'] = {};
    for (const B of list) boxes[B.kind] = B.css.map((v) => Math.round(v * 100) / 100) as PlateBox;
    return {
      boxes,
      travel: Math.max(0, Math.round(-st.slidePx * 100) / 100),
      maxY: Math.max(1, Math.round(pageMaxY)),
      still: quantized(),
    };
  }
  /** Leaving the plates (a pan starts): the stage takes the pose the page's scroll has given them, so the first frame
   *  laid on this canvas is the picture on screen. */
  function platesLeave() {
    platesHold = true;
    readBoxes();
    platesHold = false;
    st.slideK = st.slideT;
    st.glide = false;
  }
  /** The plates' frame: every plate when the stage was painted (or the plates come back on show), else only the part
   *  of the plate that holds what moves. */
  function platesOut() {
    const all = platesAll || !platesShown;
    platesAll = false;
    // what is pinned to the frame (the unroll: Writing's willow): a plate of its own, where it stands
    // (its table first: the life tables share their arrays)
    const Up = presentU(2);
    let pin: PlateBox | null = null;
    if (Up.life) {
      const u = Up.life.union, mx = 0.07 * (u[2] - u[0]) * cssW + 10, my = 0.07 * (u[3] - u[1]) * cssH + 10;
      const q = (v: number) => Math.round(v / 8) * 8;
      const l = Math.max(0, q(u[0] * cssW - mx)), r = Math.min(cssW, q(u[2] * cssW + mx));
      const t = Math.max(0, q((1 - u[3]) * cssH - my)), b = Math.min(cssH, q((1 - u[1]) * cssH + my));
      if (r > l && b > t) pin = [l, t, r - l, b - t];
    }
    platePin = !!pin;
    const list = plateList(pin);
    const G = plateGeometry(list), geo = JSON.stringify(G);
    if (geo !== platesGeo) { platesGeo = geo; sink!.layout(G); }
    const pinB = list.find((B) => B.kind === 5);
    if (pinB) develop(Up, pinB);
    // the stage's own layers and the sea, with the life that rides them
    const Uf = presentU(1);
    const lk = Uf.life ? Uf.life.starts[5] - 1 : 0;   // the plate that holds it (its view: 2 the far layer, 3 the middle, 4 the near)
    const u = Uf.life ? Uf.life.union : null;
    plateLifeCss = u ? [u[0] * cssW, (1 - u[3]) * cssH, u[2] * cssW, (1 - u[1]) * cssH] : null;
    const seen = plateFreeSeen();
    for (const B of list) {
      if (B.kind === 5) continue;
      const e = plateCanvas(B.kind);
      // (the band's plate lies over the far plate's top: what moves on the far plate there moves on it too)
      const holds = B.kind === lk;
      if (all || (e && (e.c.width !== B.px[0] || e.c.height !== B.px[1]))) { develop(Uf, B); if (holds && u) plateLast.set(B.kind, platePart(B, u)); continue; }
      if (!holds || !u || !seen) continue;
      const now = platePart(B, u);
      develop(Uf, B, partUnion(plateLast.get(B.kind), now));
      plateLast.set(B.kind, now);
    }
    // the paper tile (one period of the grain, 512 CSS px a side): once per buffer scale
    const tileKey = `${W}/${cssW}|${grainK}`;
    if (tileKey !== plateTile) {
      plateTile = tileKey;
      const n = 512 * Math.min(1, 2 / Math.max(1, devicePixelRatio || 1));
      const px = Math.max(8, Math.round(n * (W / (cssW || 1))));
      develop(Uf, { kind: 6, css: [0, 0, n, n], uv: [0, 0, n / cssW, n / (cssH || 1)], px: [px, px] });
      sink!.developed?.(6);
    }
    // a plate the stage does not hold now is blank
    for (const k of [2, 3, 4, 5] as PlateKind[]) if (!list.some((B) => B.kind === k)) { const e = plateCtx.get(k); if (e && e.c.width > 1) { e.c.width = 1; e.c.height = 1; } }
    if (!platesShown) { platesShown = true; sink!.show(true); }
    // the darkroom is only as large as what still moves (every copy out of it copies the whole of it): after the
    // plates were developed whole it shrinks to the largest moving part; a larger part grows it again (gl.ts plate)
    if (all) {
      let dw = 256, dh = 128;
      for (const B of list) if (B.kind === 5) { dw = Math.max(dw, B.px[0]); dh = Math.max(dh, B.px[1]); }
      const lp = lk ? plateLast.get(lk as PlateKind) : undefined;
      if (lp) { dw = Math.max(dw, lp[2]); dh = Math.max(dh, lp[3]); }
      renderer!.resize(Math.min(W, Math.ceil(dw / 128) * 128), Math.min(H, Math.ceil(dh / 128) * 128));
    }
  }

  // ---------------------------------------------------------------- small life (the present pass)
  // The figure layers' life anchors (figures.ts THE LIFE API), placed each frame on the canvas through the view each one
  // lies in (a window at its live box and sink; the stage's layer at the stage's slide), as a small table the
  // present shader works out once per pixel and lays into that view's sample (shaders.ts, lifePrep / lifeLay): the
  // water's shimmer, a thread of smoke, the willows' sway, one drifting boat (a sprite the worker cut out of its layer).
  // No frame of its own: it rides the ambient frames, on the drift's clock, so it stops with the mist (reduced motion,
  // Still, the idle sleep, a hidden tab, nothing on screen), and its strength eases to the still painting with the drift
  // (the boat stays, where it stands). With nothing that moves on screen, gl.ts draws with the program without life.
  // (a walker is drawn as a boat is: a sprite from the layer's atlas, kind 4)
  const LIFE_KIND: Record<LifeKind, number> = { shimmer: 1, smoke: 2, willow: 3, boat: 4, walker: 4 };
  const LIFE_ORDER: Record<LifeKind, number> = { boat: 0, walker: 0, shimmer: 1, smoke: 2, willow: 3 };   // (sprites first: they are cut out of their layer)
  const SPRITED = (a: LifeOut): a is LifeOut & Required<Pick<LifeOut, 'cut' | 'atlas'>> => (a.kind === 'boat' || a.kind === 'walker') && Array.isArray(a.cut) && Array.isArray(a.atlas);
  const LIFE_AMP: Partial<Record<LifeKind, number>> = { shimmer: 0.3, smoke: 1, willow: 1.8 };   // the shimmer's strength; the sway in CSS px (the willow sways widest)
  const lifeR = new Float32Array(LIFE * 4), lifeA = new Float32Array(LIFE * 4), lifeB = new Float32Array(LIFE * 4);
  const lifeK = new Float32Array(4), lifeUb = new Float32Array(4), lifeFR = new Float32Array(4);
  const lifeTs = new Float32Array(8);
  const lifeT: LifeTable = { rect: lifeR, a: lifeA, b: lifeB, k: lifeK, union: lifeUb, figR: lifeFR, starts: lifeTs, ridge: null, sprite: null, fig: null,
    stir: stirU, stirK: stirKU };
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

  function lifeU(windows: PresentWindow[], stage: StageU | null, pick = 0): LifeTable | null {
    let lifeN = 0;
    lifeK[0] = 0;
    // (THE PLATES: pick 1 = what rides the stage, 2 = what is pinned to the frame, each for its own plate)
    if (mode !== 'webgl' || !W || !lastSlots.length) return null;
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
        views.push({ t: 2 + j, lo, hi, clip: [cx, 0, lifeXMax(), 1], bloom: true, vr: 'strip', ox,
          map: (w) => [(w[0] - M[0]) / M[3] + ox, 1 - (M[1] - w[1]) / M[2] - oy] });
      }
    } else {
      windows.forEach((w, i) => {
        const M = w.view, R = w.rect, sink = w.sink || 0;
        // (a parted window's front, where the figures are, drifts sideways by dx box widths: its life rides along)
        const dx = w.part ? w.part[3] || 0 : 0;
        // (a window holds only the slots of its own variant, as paintWin does: the closing may show its own
        // layer, drawn at another scale, and a strip layer's anchors must not land in it)
        const src = wins.find((x) => x.id === w.id);
        views.push({ t: i, lo: 0, hi: LAYERS - 1, clip: R, bloom: w.id === 'strip', vr: src ? variantOf(src) : 'strip', ox: 0,
          map: (p) => [R[0] + ((p[0] - M[0]) / M[3] + dx) * (R[2] - R[0]), R[1] + (1 - (M[1] - p[1]) / M[2] - sink) * (R[3] - R[1])] });
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
        if (!(a.kind in LIFE_KIND) || a.params?.lamp) return;   // (no life: Home's lamp anchor only holds its index, so the anchors after it keep their phase seeds)
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
        if (pick) { const pinned = !!(sprite && a.params?.pinned); if ((pick === 2) !== pinned) return; }
        for (const v of views) {
          if (a.plane < v.lo || a.plane > v.hi || v.vr !== (slot.v || 'strip')) continue;
          const bloom = v.bloom ? clamp01((arrive - a.plane * 0.1 - 0.35) / 0.6) : 1;
          const p0 = v.map(lifeW(box[0], box[3])), p1 = v.map(lifeW(box[2], box[1]));   // (canvas uv is y up)
          const rc = [Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1]), Math.max(p0[0], p1[0]), Math.max(p0[1], p1[1])];
          // THE UNROLL: a sprite pinned to the frame (figures.ts LifeParams.pinned: Writing's willow, a near framing
          // element) stays where the hero put it while the stage slides west under it: its root, past the frame's edge
          // on the layer's eastern reach, never comes into view as a cut end. A pan's camera carries it (it fades
          // with its layer over the pan's first 30 %); the windows ignore the flag.
          if (sprite && a.params?.pinned && v.ox) { rc[0] -= v.ox; rc[2] -= v.ox; }
          const c = v.clip;
          if (rc[2] < Math.max(0, c[0]) || rc[0] > c[2] || rc[3] < Math.max(0, c[1]) || rc[1] > Math.min(1, c[3])) continue;
          list.push({ a, n, L, v, rc, k: slot.k * bloom * alpha, sprite, area: (rc[2] - rc[0]) * (rc[3] - rc[1]) });
        }
      });
    }
    // life's strength: eased with the drift (the idle sleep), none when the painting is still; then only a boat (cut out
    // of its layer) still has to be drawn
    const d = !quantized() ? driftT * driftT * (3 - 2 * driftT) : 0;
    if (d <= 0) for (let i = list.length - 1; i >= 0; i--) if (!list[i].sprite) list.splice(i, 1);
    if (!list.length) return null;
    // one view holds life in a frame (the shader works it out once per pixel): the boat's, else the one with the first
    // entry by priority. In practice there is only one: the stage's layer of the page's own set, or the window in which
    // its place shows (two windows both with life on screen at once: the strip keeps it).
    list.sort((p, q) => LIFE_ORDER[p.a.kind] - LIFE_ORDER[q.a.kind] || p.v.t - q.v.t || q.area - p.area);
    // (a neighbour's layer on screen never takes life from the page's own place: the page's own small life keeps it)
    const own = Math.round(tween ? tween.to : stretch);
    const lv = (list.find((e) => e.L.stretch === own) || list[0]).v;
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
        B = [1, 0.15, a.params?.rings ?? 0, 0];   // (z = ripple rings)
        if (!lifeT.fig) {
          const r = e.L.meta.rect;
          lifeT.fig = e.L.key;
          lifeFR.set([r[0] * HS, r[2], 1 / ((r[1] - r[0]) * HS), 1 / (r[3] - r[2])]);
        }
      } else if (a.kind === 'smoke' && a.params?.fall) {
        // (elements.ts waterfall) the fall's column: its x, its lip's and its foot's y (canvas uv), its half-width
        const f = a.params.fall;
        const lip = v.map(lifeW(f.x, f.y0)), foot = v.map(lifeW(f.x, f.y1)), side = v.map(lifeW(f.x + f.hw, f.y0));
        B = [lip[0], lip[1], foot[1], Math.abs(side[0] - lip[0])];
        if (!lifeT.fig) {
          const r = e.L.meta.rect;
          lifeT.fig = e.L.key;
          lifeFR.set([r[0] * HS, r[2], 1 / ((r[1] - r[0]) * HS), 1 / (r[3] - r[2])]);
        }
      } else if (a.kind === 'smoke') {
        const src = Array.isArray(a.params?.src) ? a.params.src : [a.x + a.w / 2, a.y + a.h];
        const s0 = v.map(lifeW(src[0], src[1]));
        const H = Math.max(1, a.h);
        B = [s0[0], s0[1], ((a.x + a.w / 2 - src[0]) / H) * 1.2, Math.max(0.08, (a.w / H) * 0.22)];
      } else if (a.kind === 'willow') {
        const f = Array.isArray(a.params?.foot) ? a.params.foot : [a.x + a.w / 2, a.y + a.h];
        const p = v.map(lifeW(f[0], f[1]));
        // (LIFE_AMP's CSS px, at most 2.2, calmer on phones)
        B = [p[0], p[1], Math.max(1e-4, rc[3] - p[1]), (Math.min(2.2, amp * (phone ? 0.6 : 1)) / (cssW || 1))];
        amp = 1;
      } else if (e.sprite) {
        if (lifeT.sprite && lifeT.sprite !== e.sprite.id) continue;   // (one layer's sprite atlas on show at a time)
        lifeT.sprite = e.sprite.id;
        // its crisp tap's level: sprite texels per buffer pixel; its place in the atlas
        const lod = Math.max(0, Math.log2(e.sprite.px[0] / Math.max(1e-3, (rc[2] - rc[0]) * W)));
        B = [e.k, lod, e.sprite.atlas[0], e.sprite.atlas[1]];
        amp = 1;
      }
      // (contactLife: a clump that bends in the breeze gets 8 % more room each side, so its bent tips are never cut;
      // the shader maps back into the sprite)
      const bend = !!(e.sprite && a.params?.bend && el('contactLife'));
      const rcB = bend ? [rc[0] - (rc[2] - rc[0]) * 0.08, rc[1], rc[2] + (rc[2] - rc[0]) * 0.08, rc[3]] : rc;
      lifeR.set(rcB, i * 4);
      lifeA.set([LIFE_KIND[a.kind], e.sprite ? e.sprite.atlas[2] : (a.params?.fall ? -2 : 0), e.sprite ? (bend ? (phone ? 4.6 : 4.99) : 1) : amp * e.k, ((e.n * 0.618 + e.L.stretch * 0.31) % 1) * 6.28], i * 4);
      lifeB.set(B, i * 4);
      U[0] = Math.min(U[0], rcB[0]); U[1] = Math.min(U[1], rcB[1]); U[2] = Math.max(U[2], rcB[2]); U[3] = Math.max(U[3], rcB[3]);
      // (elements.ts contactLife) the shimmer's auto drops (the ferryman's pole, the bow) fall now and then, each on
      // its own slow beat, only while the painting is awake (they ride the ambient frames)
      if (a.kind === 'shimmer' && Array.isArray(a.params?.drops) && el('contactLife') && d > 0.5) {
        a.params.drops.forEach((pt, k) => {
          const key = `${e.L.key}|${e.n}|${k}`, now = performance.now();
          const next = autoNext.get(key);
          if (next === undefined) { autoNext.set(key, now + 900 + k * 2600); return; }
          if (now < next) return;
          const w = lifeW(pt[0], pt[1]);
          addStir({ wx: w[0], wy: w[1], t: v.t, t0: now, seed: (stirSeq++ * 0.618034) % 1 });
          autoNext.set(key, now + 5200 + 2400 * (((stirSeq * 0.37) % 1)));
        });
      }
      lifeN++;
    }
    if (!lifeN) return null;
    // (elements.ts contactLife) the live ring sets in this view, at their world points (they ride the scroll)
    const now = performance.now();
    stirU.fill(-1);
    for (let i = stirs.length - 1; i >= 0; i--) if (stirs[i].t !== lv.t || now - stirs[i].t0 > STIR_LIFE * 1000) stirs.splice(i, 1);
    stirs.forEach((S, i) => {
      const p = lv.map([S.wx, S.wy]);
      stirU.set([p[0], p[1], (now - S.t0) / 1000, 4 + S.seed], i * 4);   // (w: 2 x kind + seed; the drops are kind 2)
      const rx = 78 / (cssW || 1), ry = 78 / 3.4 / vh + 8 / vh;
      U[0] = Math.min(U[0], p[0] - rx); U[1] = Math.min(U[1], p[1] - ry); U[2] = Math.max(U[2], p[0] + rx); U[3] = Math.max(U[3], p[1] + ry);
    });
    stirKU.set([stirs.length ? 1 : 0, 0, stage ? cssW / ((cssW + st.ext) || 1) : 1, 0]);
    // where each kind's run starts (shimmer, smoke, willow, sprite), the count, the view
    const from = (k: number) => { let i = 0; while (i < lifeN && lifeA[i * 4] < k) i++; return i; };
    lifeTs.set([from(1), from(2), from(3), from(4), lifeN, lv.t, 0, 0]);
    lifeUb.set([Math.max(0, U[0]), Math.max(0, U[1]), Math.min(stage ? lifeXMax() : 1, U[2]), Math.min(1, U[3])]);
    lifeK.set([d, 1 / W, 1 / H, 40 / vh]);
    return lifeT;
  }

  const liveU = new Float32Array(4), liveU2 = new Float32Array(4);
  let qaHold = false;   // QA: stop the loop on the next present (tools/build-heroes.ts and build-scroll.ts capture that frame)
  function presentU(pick = 0): PresentU {
    // Every page: the veil's tear moves only its edge, the drift keeps off the paper under text, and the sky deck lets
    // the mist drift gently perceptibly in open sky. Living (the stage): a solid core of T.core px round the text's own
    // lines, then a torn edge that swells in and out with the words, and a clearing beyond it (viewport heights).
    const vhPx = cssH || 1;
    const staged = stageOn();
    // (the living veils' feather, swell and clearing grow with a wide window's margins beside a block, up to 1.8x at
    // 2592 px: the painting there is larger, and a 56 px edge would cut a peak; the solid core stays T.core. The
    // painter scales them itself, beside a block only (above and below it they keep their 1440 reach))
    liveU.set([staged ? 2 : 1, T.core / vhPx, T.feather / vhPx, mode === 'webgl' ? T.sky : 0]);
    liveU2.set([platesOn() ? 0 : (window.scrollY || 0) / vhPx, T.clear / vhPx, T.swell / vhPx, 1 / vhPx]);
    if (platesOn()) { veil.fill(-1); veilS.fill(0); }   // (THE PLATES: the veils are the page's own layers)
    const windows: PresentWindow[] = [];
    for (const w of wins) {
      if (staged || !w.vis || !w.box || !w.viewU || !w.painted) continue;
      const b = w.box;
      const [ft, fb] = featherOf(cls);
      windows.push({
        id: w.id,
        rect: new Float32Array([b.left / cssW, 1 - (b.top + b.height) / cssH, (b.left + b.width) / cssW, 1 - b.top / cssH]),
        view: w.viewU,
        feather: new Float32Array([Math.max(1e-3, ft / b.height), Math.max(1e-3, fb / b.height), w.wakeOK ? 1 : 0, 1]),
        // (w = 1 marks the page's own hero window: the inner pages' sky grade stays inside it)
        keep: new Float32Array(w.keepU ? [w.keepU[0], w.keepU[1], w.keepU[2], w.kind === 'strip' ? 1 : 0] : [0, 0, 0, w.kind === 'strip' ? 1 : 0]),
        sink: 0,   // (the painting rides with its box)
        // the front layer's view and [on, the back's sink (none), 0, the front's drift]
        near: w.parted ? w.nid : null,
        part: w.parted ? new Float32Array([1, 0, 0, w.dx || 0]) : null,
      });
    }
    const stage = stageOn() && st.ok ? stageU() : null;
    const glimpse = glimpseU();
    return {
      aspect,
      windows,
      life: lifeU(windows, stage, pick),
      horizon: hzK > 0 && hzv.painted ? { id: hzv.id, k: hzK, view: hzv.view } : null,
      time,
      veil, veilS, veilF,
      veilR: 0.13 * Math.min(1, aspect),   // the veil's feather: 13% of the shorter side (x veilF per veil)
      trail: trailU, wakeBox, wakeR: wakeR(),
      sweep: sweepU, sweepSeed,
      stage,
      glimpse,
      paperOut: glimpseOn(),
      live: liveU,
      live2: liveU2,
      px: cssW / W,
      panPx: stretch * HS * (cssH || 1),
      grain: grainK,
      grainPx: Math.min(1, 2 / Math.max(1, devicePixelRatio || 1)),   // a grain texel: 1 CSS px, at most 2 device px
    };
  }

  /** Where each window into the painting stands on the page and which pose it takes (its index among the page's laid-out
   *  windows: a tablet lays out one fewer), once per layout (the page's height or the viewport changed). */
  function glimpseLayout() {
    const de = document.documentElement;
    const key = `${de.scrollHeight}|${cssW}|${cssH}|${glims.length}`;
    if (key === glimRun.key) return;
    glimRun.key = key;
    const y = window.scrollY || 0, vh = innerHeight || cssH || 1;
    glimRun.max = Math.max(0, de.scrollHeight - vh);
    glimRun.bw = 0;
    let j = 0;
    for (const g of glims) {
      const r = g.el.isConnected ? g.el.getBoundingClientRect() : null;
      g.doc = r && r.height > 0 ? r.top + y + r.height / 2 : NaN;
      g.short = cls === 'short';
      if (!g.end && Number.isFinite(g.doc)) { g.j = j++; if (!glimRun.bw && r) glimRun.bw = r.width; }
    }
  }
  /** The place's windows for this width class. */
  function glimClass(): GlClass | null {
    const P = GLIMPSE.at[Math.round(stretch)];
    if (!P) return null;
    return (cls === 'tablet' ? P.tablet : null) ?? P.phone;   // (a phone held sideways lays out no window: layout.css)
  }
  /** A window's pose: its place's entry in GLIMPSE for this width class. */
  function glimPose(g: Glim): { C: GlClass; W: GlWin } | null {
    const C = glimClass();
    if (!C) return null;
    const W = g.end ? C.end : C.win[Math.min(g.j, C.win.length - 1)];
    return W ? { C, W } : null;
  }
  /** The framing a window's view is painted at: its box plus the travel margins, centred on its pose. */
  function glimFraming(g: Glim, C: GlClass, Wn: GlWin) {
    const b = g.box!;
    const vw = b.width + 2 * GLIMPSE.mx, vh = b.height + 2 * GLIMPSE.my;
    const scale = b.width / C.w;                        // CSS px per stretch (one scale for the page's windows)
    const k = Math.round(stretch);
    const unit = HS / scale;                            // scene units per CSS px
    // (an inner place's window stays inside its own stretch: across the next place's edge its water and air change
    // under a straight line: a pale rectangle on the Résumé)
    let left = k + Wn.x - (vw / scale) / 2;
    if (k >= 2) left = Math.max(k - 0.02, Math.min(k + 1.0 - vw / scale, left));
    return { vw, vh, fr: { worldLeft: left, worldTop: Wn.y + (vh * unit) / 2, scale, focus: [0, 0] as [number, number] } };
  }
  /** Paint a window's view (back below, front above), once per layout and composition; at idle only. True: painted. */
  function paintGlim(g: Glim, U0: SceneBase): boolean {
    if (!g.box || !renderer) return false;
    const pz = glimPose(g);
    if (!pz) return false;
    const { vw, vh, fr } = glimFraming(g, pz.C, pz.W);
    const s = Math.min(bufS, GLIMPSE.cap);
    const bw = Math.max(2, Math.round(vw * s)), bh = Math.max(2, Math.round(vh * s));
    const k = Math.round(stretch);
    const split = GLIMPSE.at[k]?.split ?? 2;
    // its figures: the place's layer drawn at this scale (the strip's own when it is close enough: no soft magnified one)
    const L = layerFor(k, true, 'glimpse');
    const now = performance.now();
    if (L && !ready(L) && L.status !== 'failed') {
      if (!g.waitAt) g.waitAt = now;
      if (now - g.waitAt < 6000) return false;          // (at most 6 s: a layer that never comes is not waited for)
    }
    const u1 = fr.worldLeft + vw / fr.scale;
    const fa = L && ready(L) && u1 > L.meta.rect[0] && fr.worldLeft < L.meta.rect[1] ? figU({ L, v: 'glimpse', k: 1 }) : null;
    const key = [fr.worldLeft.toFixed(5), fr.worldTop.toFixed(5), fr.scale.toFixed(2), bw, bh, palette, specKey(), fa ? fa.id : '-', split, mode].join('|');
    const remade = renderer.view(g.id, bw, bh * 2);
    if (!remade && key === g.key && g.painted) return false;
    const P = resolve(curSpec, 1.6);
    const upx = fr.scale / HS;                           // CSS px per scene unit
    const asp = vw / upx;
    const samples = Math.min(1536, Math.max(96, Math.round(bw / 1.25)));
    g.buf = buildRidges(samples, { left: fr.worldLeft, wvis: vw / fr.scale, aspect: asp, palette, pigment: 1 }, P, g.buf);
    renderer.ridges(g.id, g.buf, samples);
    g.view.set([fr.worldLeft * HS, fr.worldTop, vh / upx, asp]);
    const U = {
      ...U0, draft: false, view: g.view, hs: HS, feet: layerFeet(P), keep: new Float32Array(4), figA: fa, figB: null,
      arrive: 9, hz: hzZero, hzK: 0,
    };
    renderer.scene(g.id, { ...U, planes: new Float32Array([0, split - 1, 0, 0]), half: 0 });
    renderer.scene(g.id, { ...U, planes: new Float32Array([split, LAYERS - 1, 1, 0]), half: 1 });
    counts.scenes += 2;
    counts.glimPaints++;
    g.key = key; g.vw = vw; g.vh = vh; g.waitAt = 0;
    if (!g.painted) { g.painted = true; g.shownAt = 0; }
    // (painted off screen, it is live at once: its still gives way while no one sees it, and it needs no fade when it
    // scrolls in; only a window painted while on screen cross-fades from its still. Under reduced motion and Still the
    // CSS swap has no transition either: a jump between two rest states, never an animation after a scroll)
    if (!g.vis) { g.shownAt = -1; setLive(g, true); }
    return true;
  }
  function dropGlims(list: Glim[]) {
    for (const g of list) { renderer?.dropView?.(g.id); g.key = ''; g.painted = false; g.buf = null; g.shownAt = 0; setLive(g, false); }
  }
  function setLive(g: Glim, on: boolean) {
    if (g.live === on) return;
    g.live = on;
    try { if (on) (g.el as HTMLElement).dataset.live = ''; else delete (g.el as HTMLElement).dataset.live; } catch { /* ignore */ }
  }
  /** The windows to paint now (at idle: the nearest unpainted or stale one within GLIMPSE.ahead viewports) and those to
   *  free (beyond GLIMPSE.keep). */
  function glimpseWork(U0: SceneBase, idle: boolean): 'painted' | 'later' | null {
    const vh = innerHeight || cssH || 1, y = window.scrollY || 0;
    let todo: Glim | null = null, dBest = Infinity;
    for (const g of glims) {
      if (!Number.isFinite(g.doc)) { if (g.painted) dropGlims([g]); continue; }
      const d = Math.abs(g.doc - (y + vh / 2)) / vh;
      if (d > GLIMPSE.keep) { if (g.painted) dropGlims([g]); continue; }
      if (d > GLIMPSE.ahead) continue;
      if (!g.box) {
        // (off screen: its box from the layout, so it can be painted ahead)
        const r = g.el.getBoundingClientRect();
        if (!(r.width > 0 && r.height > 0)) continue;
        g.box = { left: r.left - rect.left, top: r.top - rect.top, width: r.width, height: r.height };
      }
      const pz = glimPose(g);
      if (!pz) continue;
      const stale = !g.painted || g.key.split('|').slice(0, 5).join('|') !== glimKey0(g, pz);
      if (stale && d < dBest) { dBest = d; todo = g; }
    }
    if (!todo) return null;
    if (!idle) return 'later';
    return paintGlim(todo, U0) ? 'painted' : 'later';
  }
  function glimKey0(g: Glim, pz: { C: GlClass; W: GlWin }) {
    const { vw, vh, fr } = glimFraming(g, pz.C, pz.W);
    const s = Math.min(bufS, GLIMPSE.cap);
    return [fr.worldLeft.toFixed(5), fr.worldTop.toFixed(5), fr.scale.toFixed(2), Math.max(2, Math.round(vw * s)), Math.max(2, Math.round(vh * s))].join('|');
  }
  /** The windows into the painting on screen (GLIMPSE): each its own painted view, slid in the present. */
  function glimpseU(): PresentGlimpse | null {
    if (!glimpseOn()) return null;
    const on = glims.filter((g) => g.vis && g.box && g.painted && g.vw > 0 && (!g.end || g.box.height >= 180));
    if (!on.length) return null;
    const rest = quantized();
    const vh = cssH || innerHeight || 1, y = window.scrollY || 0;
    const { rects, a, b, f, c, d, m } = glimU;
    rects.set(NONE16.subarray(0, 8)); a.fill(0); b.fill(0); f.fill(0); c.fill(0); d.fill(0); m.fill(0);
    const ids: string[] = [];
    const now = performance.now();
    on.slice(0, GLIMPSE.max).forEach((g, j) => {
      const r = g.box!;
      const pz = glimPose(g);
      if (!pz) return;
      // where it stands: q = its middle in the viewport (-0.5 top .. 0.5 bottom); u = the passage, 0 coming in at the
      // foot of the screen, 1 leaving at its top (a short page's end: the page's own scroll, see below); rest: 0.5
      let q = (r.top + r.height / 2) / vh - 0.5;
      let u = clamp01((0.5 + r.height / (2 * vh) - q) / (1 + r.height / vh));
      // (a short page's end is driven by the page's own scroll (0 at its top, 1 at its end), never by where its box stands:
      // it comes out of the cloud as the reader reaches the end, its rest pose there; a page that scrolls less than 0.6
      // of a screen shows it at its rest pose, uncovered, from the start)
      let cover = 0;
      if (g.end) {
        const run = glimRun.max, pr = clamp01(y / Math.max(1, run));
        const short = run < 0.6 * vh;
        u = short ? 0.5 : 0.3 + 0.2 * sstep(0, 1, pr);
        cover = short ? 0 : 0.9 * (1 - sstep(0.15, 0.95, pr));
      }
      if (rest) { u = 0.5; q = 0; cover = 0; }
      const e = u - 0.5;
      // (the view's uv for the box's uv: offset and scale, and how far each layer travels, in view uv)
      const ox = GLIMPSE.mx / g.vw, sx = r.width / g.vw, oy = GLIMPSE.my / g.vh, sy = r.height / g.vh;
      // the camera rises: the front drops below the back (down = -y in uv: from its pose as the window comes in, so
      // nothing ever rises into the top feather), both pan east, the near more
      const dropK = GLIMPSE.at[Math.round(stretch)]?.drop ?? 1;
      const dyB = (GLIMPSE.splitB * e) / g.vh;
      const dyF = (g.end ? GLIMPSE.splitF * 0.35 * (0.5 - u) : GLIMPSE.splitF * dropK * (pz.W.dk ?? 1) * sstep(0.2, 1, u)) / g.vh;
      const dxB = (GLIMPSE.panB * e) / g.vw, dxF = (GLIMPSE.panF * e) / g.vw;
      rects.set([r.left / cssW, 1 - (r.top + r.height) / cssH, (r.left + r.width) / cssW, 1 - r.top / cssH], j * 4);
      a.set([dyB, dyF, dxB, dxF], j * 4);
      b.set([ox, sx, oy, sy], j * 4);
      const clear = g.short ? GLIMPSE.clearShort : GLIMPSE.clear;
      f.set([r.height, clear, r.width, (0.37 + g.i * 1.618) * (g.end ? -1 : 1)], j * 4);   // (a negative seed: an end)
      // the sea of cloud climbs over the passage; the near ink deepens toward mid-screen
      const Wn = pz.W;
      // (the pose's sea and mist are in the painted band's uv, 0 its foot, 1 its top: here in the box's)
      const band = (v: number) => (clear + v * Math.max(1, r.height - 2 * clear)) / r.height;
      const sea = Wn.sea < -0.3 && !g.end ? -1 : band(g.end ? Wn.sea + cover : Wn.sea + GLIMPSE.seaRise * u);
      const ink = rest ? 0.5 : 1 - sstep(0, 0.42, Math.abs(q));
      if (!g.shownAt) g.shownAt = now;
      const fade = rest || g.end ? 1 : clamp01((now - g.shownAt) / GLIMPSE.fade);
      c.set([0.5 + 0.5 * (g.j / Math.max(1, pz.C.win.length - 1)) * (g.end ? 0 : 1), Wn.sun, ink, fade], j * 4);
      d.set([sea, Wn.mist < -0.5 ? -1 : band(Wn.mist + 0.12 * u), g.short ? 1 : -(Wn.ml ?? 0), g.end ? (GLIMPSE.at[Math.round(stretch)]?.soft ? 1 : 0) : (GLIMPSE.at[Math.round(stretch)]?.ramp ?? 14)], j * 4);
      m.set(g.view, j * 4);
      ids.push(g.id);
      setLive(g, true);
    });
    if (!ids.length) return null;
    return { ids, rects, a, b, f, c, d, m };
  }
  /** A window's cross-fade from the place's still is still running (the loop keeps presenting). */
  function glimFading() { return glims.some((g) => g.vis && g.painted && g.shownAt > 0 && performance.now() - g.shownAt < GLIMPSE.fade + 50); }

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
    // (the page left behind keeps its layer as a neighbour while there is room; past the budget it goes, once the
    // pan has settled: the memory gate holds after a page change, not only on a fresh load)
    setTimeout(() => { if (!destroyed) trimLayers(''); }, FIG_GRACE + 100);
    // (the stage: the scroll and the slide are read again at this stretch, and the pose glides there from the opening)
    need |= S_SCENE | S_PRESENT | S_SCROLL | S_MEASURE;
    if (stageOn()) st.glide = true;
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
      if (platesShown) platesLeave();   // (THE PLATES: the pan is laid on this canvas, from the pose the scroll gave the plates)
      // (its clock is set on its first frame)
      tween = { from: stretch, to: dest, fromSpec: curSpec, toSpec, t: 0, dur, ease: o.ease === 'cubic-out' ? 'cubic' : 'whip', cut, resolve: res };
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
  /** The camera under the hand (the scroll mode, src/features/scroll): the position is set at once, the one level
   *  composition, one scene per call (governed: drafts while the hand moves, a full-quality scene FULL_MS after it
   *  rests). No tween, so figSlots() takes its rest branch (the rounded place's layer and a ready neighbour the window
   *  sees): nothing pops, nothing restarts a fade. Drag and wheel call it once per animation frame; keys and the stops
   *  use panTo. Under reduced motion and Still it is the same cut. */
  function hold(x: number) {
    if (destroyed || !renderer) return;
    const dest = Math.min(STRETCH_COUNT - 1, Math.max(0, num(x, stretch)));
    finishPanAt();
    stretch = dest;
    // the one composition under the hand: from a place seen high or deep it blends back over a few held frames, never a cut
    const level = spec('level');
    curSpec = specName(curSpec) === 'level' && Math.abs(curSpec.presence - 1) < 1e-3 ? level : blendSpec(curSpec, level, 0.35);
    heldAt = performance.now();
    need |= S_SCENE | S_PRESENT;
    request(S_SCENE);
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
      // (the unroll: the next place's layer at the reach's resolution, which the pan's first frames may stand in with;
      // the router's intent prefetch asks for the full one before a click)
      // (not on a phone: its 20 MB holds the page's own layers and its windows' (Work's town twice); the router's intent
      // prefetch asks for the next place's layer at the touch, and a layer that comes mid-pan fades in, never pops)
      const j = Math.round(stretch) + 1;
      if (cls === 'phone') { /* nothing ahead */ }
      else if (!stageOn()) layerFor(j, true, 'strip', ownSpec(j));
      else if (j < STRETCH_COUNT - 1) layerFor(j, true, 'reach', ownSpec(j));
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
  addEventListener('wheel', onInput, passive);
  addEventListener('keydown', onInput, passive);
  document.documentElement.addEventListener('pointerleave', onLeave);
  document.addEventListener('visibilitychange', onVis);
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
  // First frame synchronously: the canvas is never shown blank (or black).
  if (renderer && renderer.ready) draw(performance.now());
  else whenReady();
  clockLast = 0;
  request(S_PRESENT);
  idleSoon();

  const handle: EngineHandle = {
    get mode() { return mode; },
    panTo,
    hold,
    sweep,
    prepare(k, o = {}) {
      if (destroyed) return Promise.resolve();
      const j = Math.round(num(k, stretch));
      const sp = o.distance || o.presence !== undefined ? spec(o.distance, o.presence) : ownSpec(j);
      // (the memory gate: a full layer asked for ahead that could not be held beside what is on show (Home at 1440 x
      // 900 @2: its own layer and the reach's leave no room for the town at full resolution) is not drawn, uploaded and
      // let go three seconds later for nothing; the pan draws it when it starts, the reach's lighter layer standing in
      // until it lands and swaps in place)
      if (!layers.has(layerKey(j, 'strip', sp)) && !fitsAhead(j)) return Promise.resolve();
      const L = layerFor(j, true, 'strip', sp);
      if (!L || L.status !== 'pending') return Promise.resolve();
      return new Promise<void>((res) => L.waiters.push(res));
    },
    rebind(o = {}) {
      if (destroyed) return;
      const has = (k: keyof LandscapeTargets) => Object.prototype.hasOwnProperty.call(o, k);
      observeEls(false);
      if (has('strip')) { wins[0].el = asEl(o.strip); stripLive = false; }
      if (has('closing')) wins[1].el = asEl(o.closing);
      for (const w of wins) { w.key = ''; w.box = null; w.want = false; }
      if (has('keepout')) keepEls = toList(o.keepout);
      if (has('wake')) { wakeEls = toList(o.wake); wakeRects = null; wake.dirty = true; }
      if (has('horizon')) { horizonP = clamp01(num(o.horizon, 0.6)); hzv.key = ''; }
      if (has('veil')) veilEls = toList(o.veil);
      if (has('glimpse')) { dropGlims(glims); glims = mkGlims(toList(o.glimpse)); glimRun.key = ''; }
      if (has('ground')) ground = o.ground === 'living' ? 'living' : '';
      if (has('inside')) inside = insideOf(o.inside);
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
    setStill(on) {
      on = !!on;
      if (destroyed) return;
      if (!on && settling) { settling = false; lastInput = performance.now(); request(S_PRESENT); return; }
      if (on === still || (on && settling)) return;
      // (elements.ts stillSettle) with the painting alive, Still lets it settle first (draw(): the drift and the small
      // life ease to rest over SETTLE_MS, then still); reduced motion, a hidden page or a still drift cut
      // (THE PLATES: no settle; the plates are developed once more, at rest)
      if (on && el('stillSettle') && !reduced && mode === 'webgl' && !hidden && driftT > 0.02 && running() && !platesShown) {
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
      if (platesShown) { platesShown = false; try { sink?.show(false); } catch { /* ignore */ } }
      stop();
      cancelIdle();
      clearTimeout(lostTimer);
      clearTimeout(readyTimer);
      clearTimeout(reframeTimer);
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
      canvas.style.visibility = '';
      document.documentElement.classList.remove('ink-live');
      if (live.get(canvas) === handle) live.delete(canvas);
    },
    ...(QA ? {
      /** QA only: { hold: true } stops the loop on its next present (the frame the asset tools capture); { hold: false }
       *  and resume() let it run again. */
      qa(o: { hold?: boolean } = {}) {
        if ('hold' in o) qaHold = o.hold === true;
        request(S_SCROLL | S_MEASURE | S_PRESENT);
      },
    } : {}),
    stats() {
      const frStat = (w: Win) => (w.fr ? { worldLeft: r3(w.fr.worldLeft), worldTop: r3(w.fr.worldTop), scale: Math.round(w.fr.scale), focus: w.fr.focus.map(Math.round), keepoutRight: w.keepR } : null);
      const figs: Record<number, 'none' | 'pending' | 'ready'> = {};
      for (let k = 0; k < STRETCH_COUNT; k++) {
        if (!figureMeta(k)) { figs[k] = 'none'; continue; }
        // (the closing's own layer counts too: a closing awaiting its figures is not settled)
        const of = (L: Layer | undefined) => (!L ? 'none' : L.status === 'ready' ? 'ready' : L.status === 'failed' ? 'none' : 'pending');
        const a = of(layers.get(layerKey(k))), c = lastSlots.some((s) => s.v === 'closing') ? of(layers.get(layerKey(k, 'closing'))) : 'none';
        figs[k] = c === 'pending' ? 'pending' : a;
      }
      return {
        mode,
        software,
        quality,
        draftScale,
        widthClass: cls,
        // (THE PLATES: on show, and how many whole plates have been developed)
        plates: { on: platesShown, developed: platesDeveloped },
        windows: { strip: { visible: !!wins[0].box && wins[0].vis }, closing: { visible: !!wins[1].box && wins[1].vis } },
        glimpses: { on: glimpseOn(), list: glims.map((g) => ({ end: g.end, vis: g.vis, painted: g.painted, live: g.live, doc: Math.round(g.doc) })) },
        framing: { strip: frStat(wins[0]) },
        hzK: r3(hzK),
        figures: figs,
        figureLayers: [...layers.values()].map((L) => ({ status: L.status })),
        stretch,
        still,
        sweeping: !!sw,
        // (a pan in flight: the frame watch judges its frames by the motion limit, probe.ts limitFor)
        panning: !!tween,
        held: heldAt > 0 && performance.now() - heldAt < HELD_MS,
        arriving,
        // (a window painted ahead while the bloom ran stays a draft until it comes on screen: only what shows counts)
        draft: wins.some((w) => w.draft && w.vis) || (hzv.draft && hzK > 0) || (stageOn() && st.layers.some((L) => L.draft)),
        // something is still to be painted or settled: the first frame (the programs still linking), a window, the
        // horizon, a pan in progress, a figure layer still fading in, or the stage (a layer pending or a draft awaiting
        // its full-quality paint, or the combined layer still standing in for the three)
        pending: !drawnOnce || wins.some((w) => w.pending) || hzv.pending || !!tween || lastSlots.some((s) => s.k < 0.999)
          || (stageOn() && (!st.ok || st.single || !!st.pendingSplit || st.glide || st.sepK < 1 || st.layers.some((L) => L.pending || L.draft))),
        running: running(),
        // (the stage given up by the present governor)
        stageVeto,
        // the living stage: `ready` = the three layers are painted at full quality and shown; the framing it is painted at
        stage: stageOn() ? {
          ready: stageReady(),
          painted: st.layers.map((L) => L.painted), pendingSplit: !!st.pendingSplit,
          framing: st.fr ? { worldLeft: r3(st.left), scale: Math.round(st.fr.scale), keepoutRight: wins[0].keepR } : null,
        } : null,
        ...counts,
      };
    },
  };
  return handle;
}
