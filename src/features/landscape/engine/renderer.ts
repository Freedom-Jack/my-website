// renderer.ts — the contract between the engine (index.ts) and its two painters, gl.ts (WebGL2) and canvas2d.ts
// (the fallback): what each frame hands them. Types only (nothing here exists at run time).
//
//   A *view* is one painting with its own buffer: a window (the page's strip, its closing), the desktop horizon band,
//   or one of the living ground's three depth layers (4b). scene() paints a view; present() lays the views on screen.

import type { Resolved } from './compose';
import type { LayerParams, LifeOut } from './figures';

/** A figure layer for figure(): premultiplied RGBA bytes (top row first), or an image of it (4b: with its sprites). */
export interface FigureImage {
  width: number;
  height: number;
  data?: Uint8ClampedArray;
  bitmap?: ImageBitmap | OffscreenCanvas | HTMLCanvasElement;
  /** Canvas2D: an image of the layer (a canvas, when the main thread drew it). */
  canvas?: CanvasImageSource;
  /** 4b small life: the layer's moving things, as one sprite atlas (gl.ts uploads it as `${id}#0`). */
  sprites?: { width: number; height: number; bitmap: ImageBitmap }[];
}
/** A drawn figure layer, as the figure source hands it back (figure-source.ts, figures.worker.ts). */
export interface FigureResult extends FigureImage {
  /** Drawing time, ms. */
  ms: number;
  /** Its life anchors (figures.ts, THE LIFE API). */
  life: LifeOut[];
}

/** figure-source.ts -> figures.worker.ts: draw this layer. */
export type FigureRequest = LayerParams & { id: number };
/** figures.worker.ts -> figure-source.ts: the layer drawn (transferred, never copied), or why it could not be. */
export type FigureReply = (FigureResult & { id: number; error?: undefined }) | { id: number; error: string };

/** A figure layer in a scene: its texture, alpha, plane and phase, its world rect as uniforms and as numbers. */
export interface FigureSlot {
  id: string;
  k: number;
  plane: number;
  phase: number;
  /** [u0, y0, 1 / width, 1 / height] (world: stretches, scene heights). */
  rect: Float32Array;
  /** [u0, u1, y0, y1]. */
  raw: number[];
}

/** The common part of every scene's uniforms (index.ts draw()). */
export interface SceneBase {
  tide: number;
  /** A frame in motion, painted at draftScale. */
  draft: boolean;
  draftScale: number;
  aspect: number;
  /** M n1: a story-map still (QA frame): only Home's light keeps its heart and bloom. */
  stillL?: number;
  /** P2 morning: seconds into Home's once-a-session morning (>= 9: none, at rest). */
  morn?: number;
}
/** What scene() paints: one view's framing, composition, figures and arrival. */
export interface SceneU extends SceneBase {
  /** [left (viewport heights), top (scene height), span (scene heights), width (viewport heights)]. */
  view: Float32Array;
  /** Viewport heights per stretch. */
  hs: number;
  /** Per plane [foot, fade, ink] (ridges.ts layerFeet). */
  feet: Float32Array;
  /** The keep-out, in box uv: [the text's right edge, active, the mist ramp's half-width, the figure guard]. */
  keep: Float32Array | null;
  /** A reserve for the strip's small note: [x0, y0, x1, y1] in box uv. */
  note?: Float32Array | null;
  figA: FigureSlot | null;
  figB: FigureSlot | null;
  /** The bloom's clock (shader seconds; 9 = settled). */
  arrive: number;
  /** The horizon band's per-plane sink, foot, ink and squash, and its strength. */
  hz: Float32Array;
  hzK: number;
  lift: number;
  P: Resolved;
  /** The horizon band's painting (Canvas2D sinks it by hzShift view heights). */
  horizon?: boolean;
  hzShift?: number;
  box?: { left: number; top: number; width: number; height: number };
  /** 4b depth layers: [first plane, last plane, 1 = over transparent paper, 0], and the crop [x0, width] (view uv). */
  planes?: Float32Array;
  crop?: Float32Array;
  /** M step 3b: paint into the lower (0) or upper (1) half of the view's buffer (a window's two depth layers). */
  half?: number;
}

/** A window as present() lays it: its view at its live box. */
export interface PresentWindow {
  id: string;
  /** Canvas uv, y up: [x0, y0, x1, y1]. */
  rect: Float32Array;
  box: { left: number; top: number; width: number; height: number };
  view: Float32Array;
  /** [top feather, bottom feather (of the box's height), the wake allowed, alpha]. */
  feather: Float32Array;
  keep: Float32Array | null;
  /** How far its painting has sunk inside its box (0..1 of its height). */
  sink: number;
  /** S1 (index.ts PART): the front depth layer's view (the window's own view is then its back), or null. */
  near?: string | null;
  /** S1: [on, the back's sink, the mist between the layers (box fraction), the front's sideways drift (box widths)]. */
  part?: Float32Array | null;
}
/** M step 3b (elements.ts glimpses): the windows into the painting on screen, below 1200 px (index.ts glimpseU), at most
 *  two (shaders.ts GLN). Each has its own view: two depth layers painted for its own framing, the back in the lower half
 *  of the view's buffer and the front (premultiplied, over transparent paper) in the upper half. */
export interface PresentGlimpse {
  /** Each window's view. */
  ids: string[];
  /** Per window (GLN x vec4): its box (canvas uv, y up); [the back's and the front's drop, their pans] (view uv); [the
   *  view's uv offset and scale for the box's uv: x0, sx, y0, sy]; [the box's height (CSS px), the words' margin (CSS
   *  px), the box's width (CSS px), seed (negative: a short page's end)]. */
  rects: Float32Array;
  a: Float32Array;
  b: Float32Array;
  f: Float32Array;
  /** [the camera's height 0..1 (cooler, paler air), the light's bloom kept 0..1, the front's ink deepened 0..1, the
   *  painting's fade-in 0..1]; [the sea of cloud's surface (box uv, < -0.5 none), the mist between the layers (box uv,
   *  < -0.5 none), a sideways phone's slim window 0/1, 0]; the view's world mapping (as a window's view). */
  c: Float32Array;
  d: Float32Array;
  m: Float32Array;
}
/** 4b: the living ground's three depth layers and the mist between them (index.ts stageU). */
export interface StageU {
  ids: string[];
  /** Per layer [step x, sink, alpha, under the descent's cloud] (canvas fractions). */
  offsets: Float32Array;
  view: Float32Array;
  k: Float32Array;
  sea: Float32Array;
  /** Per layer its crop, canvas uv. */
  rects: Float32Array;
  cloud: Float32Array;
  curt: Float32Array;
  /** M step 3: [the inner place's far-sky air 0..1, its layers' soft foot (crop fraction), the column's edge (uv x), a
   *  seed] and [the footer's top (uv y, up), its feather (uv), on 0/1, QA debug]. */
  air?: Float32Array;
  foot?: Float32Array;
  /** M step 3: the inner places' grade on the stage: [hero box y0, y1 (uv, up, at the page's top), keep-out x, ramp]. */
  grade?: Float32Array;
  /** s3fix 10: [the right end of the page's row rules (uv x; 0 none), how far the lifted middle and near layers clear it
   *  (0..1: the lift)]. */
  rule?: Float32Array;
}
/** 4b small life on show (index.ts lifeU): a small table the present shader works out once per pixel. */
export interface LifeTable {
  rect: Float32Array;
  a: Float32Array;
  b: Float32Array;
  k: Float32Array;
  union: Float32Array;
  figR: Float32Array;
  starts: Float32Array;
  /** The view whose ridges (its water) the life lies in, its sprite atlas and the figure layer the shimmer keeps off. */
  ridge: string | null;
  sprite: string | null;
  fig: string | null;
  /** P3 (elements.ts): the stirred water's ring sets (4 x [uv x, y, age s, 2 x kind + seed]) and their strength; the
   *  plum's gust ([age s, lean, strength, nudge rad]) and its petals ([origin uv x, y, size uv x, 0]). */
  stir: Float32Array;
  stirK: Float32Array;
  gust: Float32Array;
  gust2: Float32Array;
}
/** What present() lays on screen. */
export interface PresentU {
  aspect: number;
  /** M n1: a story-map still (QA frame): only Home's light keeps its heart and bloom. */
  stillL?: number;
  /** P2 morning: seconds into Home's once-a-session morning (>= 9: none, at rest). */
  morn?: number;
  windows: PresentWindow[];
  life: LifeTable | null;
  horizon: { id: string; k: number; view: Float32Array } | null;
  hzK: number;
  /** The ambient clock, s. */
  time: number;
  /** The reading veils: rects (canvas uv), strengths, feathers, and the shared feather. */
  veil: Float32Array;
  veilS: Float32Array;
  veilF: Float32Array;
  veilR: number;
  /** The pointer's wake: its trail, its box and its radius. */
  trail: Float32Array;
  wakeBox: Float32Array;
  wakeR: number;
  sweep: Float32Array;
  sweepSeed: number;
  /** M enriched (silk veil): the text keep-out's right edge, screen uv x (0 = none). */
  sweepKeep?: number;
  /** Final round (silk veil = mist dissolve): copy this frame after drawing it (a long jump before its splice). */
  grab?: boolean;
  /** Final round: how much of the grabbed frame still shows over this one (a long jump after its splice), 1 -> 0. */
  hold?: number;
  stage: StageU | null;
  /** N1: the windows into the painting on screen (null: none). */
  glimpse?: PresentGlimpse | null;
  /** M step 3b: a pixel outside every painted rect is written as paper at once (below 1200 px with the windows on). */
  paperOut?: boolean;
  /** 4b living veils (shaders.ts PRESENT: uLive, uLive2). */
  live: Float32Array;
  live2: Float32Array;
  /** M step 3 (elements.ts air): the scroll's air: [on, speed, drift, envelope], [plum lean, ribbon bow, strength, 0],
   *  [light swell, warmth, 0, 0], the petals aloft (3 x 2 vec4). null = none (the approved scroll). */
  air?: { a: Float32Array; b: Float32Array; c: Float32Array; petals: Float32Array; petalsB: Float32Array } | null;
  /** CSS px per buffer px, the pan in CSS px, the grain's strength and its texel. */
  px: number;
  panPx: number;
  grain: number;
  grainPx: number;
}

/** QA: the bytes a renderer holds, per view and for the figure layers. */
export interface RendererMemory {
  total: number;
  views: Record<string, { w: number; h: number; bytes: number }>;
  figures: number;
}

/** The painter behind the engine: gl.ts createGL() or canvas2d.ts createCanvas2D(). */
export interface Renderer {
  mode: 'webgl' | 'canvas2d';
  /** A software rasteriser (SwiftShader, llvmpipe...): the engine paints less there. */
  software: boolean;
  rendererName: string;
  maxTexture?: number;
  readonly ready: boolean;
  /** WebGL, 4b: an ImageBitmap uploads premultiplied here (else the worker sends premultiplied bytes). */
  readonly bitmaps?: boolean;
  /** Resize the drawing buffer. */
  resize(w: number, h: number): void;
  /** Make sure view `id` has a w x h buffer (alpha: a 4b depth layer over transparent paper). True when (re)made. */
  view(id: string, w: number, h: number, alpha?: boolean): boolean;
  dropView(id: string): void;
  /** (optional: a painter without it holds every view) */
  hasView?(id: string): boolean;
  /** M step 3b: a small RGBA8 copy of a painted view (bottom row first), read at idle; null when it has none. */
  readSmall?(id: string, pw: number, ph: number): Uint8Array | null;
  memory(): RendererMemory;
  /** Upload view `id`'s ridge rows (ridges.ts buildRidges, `samples` columns). */
  ridges(id: string, data: Float32Array, samples: number): void;
  /** Upload a figure layer, or free it (null). False when it cannot be shown here. */
  figure(id: string, img: FigureImage | null): boolean;
  hasFigure(id: string): boolean;
  /** WebGL: 0 when the GPU has finished the last presented frame, else how long (ms) it has been at it. */
  busy?(): number;
  /** WebGL: wait until the GPU has finished everything drawn so far. */
  settle?(): void;
  /** Paint view `id`. Canvas2D returns false while a full-quality painting is still being built behind a draft. */
  scene(id: string, U: SceneU): boolean | void;
  present(U: PresentU): void;
  destroy(): void;
}
