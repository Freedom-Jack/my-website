// renderer.ts — the contract between the engine (index.ts) and its two painters, gl.ts (WebGL2) and canvas2d.ts
// (the fallback): what each frame hands them. Types only (nothing here exists at run time).
//
//   A *view* is one painting with its own buffer: a window (the page's strip, its closing, a window into the painting),
//   the desktop horizon band, or one of the living ground's three depth layers. scene() paints a view; present() lays
//   the views on screen.

import type { LayerParams, LifeOut } from './figures';

/** A figure layer for figure(): premultiplied RGBA bytes (top row first), or an image of it (with its sprites). */
export interface FigureImage {
  width: number;
  height: number;
  data?: Uint8ClampedArray;
  bitmap?: ImageBitmap | OffscreenCanvas | HTMLCanvasElement;
  /** Small life: the layer's moving things, as one sprite atlas (gl.ts uploads it as `${id}#0`). */
  sprites?: { width: number; height: number; bitmap: ImageBitmap }[];
}
/** A drawn figure layer, as the figure source hands it back (figure-source.ts, figures.worker.ts). */
export interface FigureResult extends FigureImage {
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
  figA: FigureSlot | null;
  figB: FigureSlot | null;
  /** The bloom's clock (shader seconds; 9 = settled). */
  arrive: number;
  /** The horizon band's per-plane sink, foot, ink and squash, and its strength. */
  hz: Float32Array;
  hzK: number;
  /** The horizon band's painting (Canvas2D sinks it by hzShift view heights). */
  horizon?: boolean;
  hzShift?: number;
  /** Depth layers: [first plane, last plane, 1 = over transparent paper, 0], and the crop [x0, width] (view uv). */
  planes?: Float32Array;
  crop?: Float32Array;
  /** Paint into the lower (0) or upper (1) half of the view's buffer (a window's two depth layers). */
  half?: number;
}

/** A window as present() lays it: its view at its live box. */
export interface PresentWindow {
  id: string;
  /** Canvas uv, y up: [x0, y0, x1, y1]. */
  rect: Float32Array;
  view: Float32Array;
  /** [top feather, bottom feather (of the box's height), the wake allowed, alpha]. */
  feather: Float32Array;
  keep: Float32Array | null;
  /** How far its painting has sunk inside its box (0..1 of its height). */
  sink: number;
  /** The front depth layer's view (index.ts PART; the window's own view is then its back), or null. */
  near?: string | null;
  /** [on, the back's sink, 0, the front's sideways drift (box widths)]. */
  part?: Float32Array | null;
}
/** The windows into the painting on screen (elements.ts glimpses), below 1200 px (index.ts glimpseU), at most
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
   *  < -0.5 none), 1 = a sideways phone's slim window (else minus the left side's melt, CSS px), at a short page's end
   *  1 = a soft end (else the bottom ramp's extra CSS px)]; the view's world mapping (as a window's view). */
  c: Float32Array;
  d: Float32Array;
  m: Float32Array;
}
/** The living ground's three depth layers and the sea of mist over their feet (index.ts stageU). */
export interface StageU {
  ids: string[];
  /** Per layer [slide x, sink, alpha, unused] (canvas fractions). */
  offsets: Float32Array;
  view: Float32Array;
  k: Float32Array;
  sea: Float32Array;
  /** Per layer its crop, canvas uv. */
  rects: Float32Array;
  /** [unused, the inner place's layers' soft foot (crop fraction), unused, a seed] and [the footer's top (uv y, up),
   *  its feather (uv), on 0/1, unused]. */
  air?: Float32Array;
  foot?: Float32Array;
  /** The inner places' grade on the stage: [hero box y0, y1 (uv, up, at the page's top), keep-out x, ramp]. */
  grade?: Float32Array;
}
/** Small life on show (index.ts lifeU): a small table the present shader works out once per pixel. */
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
  /** The ferry's ring sets on the water (elements.ts contactLife): 4 x [uv x, y, age s (< 0 none), 4 + seed (2 x kind +
   *  seed: only kind 2, the ferry's drops, is sent)]; and [strength, 0, the stage's ridge columns per screen width, 0]. */
  stir: Float32Array;
  stirK: Float32Array;
}
/** What present() lays on screen. */
export interface PresentU {
  aspect: number;
  windows: PresentWindow[];
  life: LifeTable | null;
  horizon: { id: string; k: number; view: Float32Array } | null;
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
  stage: StageU | null;
  /** The windows into the painting on screen (null: none). */
  glimpse?: PresentGlimpse | null;
  /** A pixel outside every painted rect is written as paper at once (below 1200 px with the windows on). */
  paperOut?: boolean;
  /** The living veils (shaders.ts PRESENT: uLive, uLive2). */
  live: Float32Array;
  live2: Float32Array;
  /** CSS px per buffer px, the pan in CSS px, the grain's strength and its texel. */
  px: number;
  panPx: number;
  grain: number;
  grainPx: number;
}

/** The bytes a renderer holds, per view and for the figure layers (the figure layers' memory gate, index.ts). */
export interface RendererMemory {
  total: number;
  views: Record<string, { w: number; h: number; bytes: number }>;
  figures: number;
}

/** The painter behind the engine: gl.ts createGL() or canvas2d.ts createCanvas2D(). */
export interface Renderer {
  /** A software rasteriser (SwiftShader, llvmpipe...): the engine paints less there. */
  software: boolean;
  /** The painter can paint: WebGL, once every program has linked (poll) and after a lost context is restored. */
  readonly ready: boolean;
  /** WebGL: advance the build (the programs link on the driver's threads: gl.ts poll). True once `ready`. The
   *  engine polls it from a timer until then (index.ts whenReady); a painter without it is ready at once. */
  poll?(): boolean;
  /** WebGL: an ImageBitmap uploads premultiplied here (else the worker sends premultiplied bytes). */
  readonly bitmaps?: boolean;
  /** Resize the drawing buffer. */
  resize(w: number, h: number): void;
  /** Make sure view `id` has a w x h buffer. True when (re)made. */
  view(id: string, w: number, h: number): boolean;
  dropView(id: string): void;
  /** (optional: a painter without it holds every view) */
  hasView?(id: string): boolean;
  memory(): RendererMemory;
  /** Upload view `id`'s ridge rows (ridges.ts buildRidges, `samples` columns). */
  ridges(id: string, data: Float32Array, samples: number): void;
  /** Upload a figure layer, or free it (null). False when it cannot be shown here. */
  figure(id: string, img: FigureImage | null): boolean;
  hasFigure(id: string): boolean;
  /** WebGL: 0 when the GPU has finished the last presented frame, else how long (ms) it has been at it. */
  busy?(): number;
  /** Paint view `id`. False while it is not painted yet: WebGL while the programs link, Canvas2D while a full-quality
   *  painting is still being built behind a draft. */
  scene(id: string, U: SceneU): boolean | void;
  present(U: PresentU): void;
  /** THE PLATES (WebGL only): paint one depth layer of the stage (1 far, 2 middle, 3 near, 4 the sea of mist, 5 what is pinned
   *  to the frame, 6 the paper with its grain), or a part of it, into the drawing
   *  buffer's lower-left w x h corner, with the screen pass's uniforms; `uv` its window in canvas uv (x0, y0, width,
   *  height), `ox, oy` its pixel origin in its plate. Returns the canvas to copy from. */
  plate?(U: PresentU, kind: 1 | 2 | 3 | 4 | 5 | 6, uv: readonly [number, number, number, number], w: number, h: number, ox: number, oy: number): HTMLCanvasElement | null;
  destroy(): void;
}
