/**
 * The landscape engine's public contract (engine/index.ts, mountLandscape's JSDoc is the long form).
 * Everything else on the site talks to the painting only through mountLandscape() and this handle.
 */
import type { Distance } from './places';

export type Palette = 'ink' | 'misted' | 'rich';
export type Mode = 'webgl' | 'canvas2d' | 'static';

/** The page's elements the painting reads: its windows, keep-outs, veils and wake regions. */
export interface LandscapeTargets {
  /** [data-landscape="strip"]: window 1, the page's own scene at its strip framing. */
  strip: Element | null;
  /** [data-landscape="closing"]: window 2, the page's own place once more (long pages only). */
  closing: Element | null;
  /** [data-landscape="keepout"]: text the painting keeps clear of colour and figures. */
  keepout: Iterable<Element>;
  /** (elements.ts glimpses) [data-landscape="glimpse"]: the windows into the painting at a page's major section
   *  breaks (below 1200 px), in page order, and a short page's closing box ([data-glimpse="end"]). */
  glimpse?: Iterable<Element>;
  /** [data-veil]: paper mist behind text. */
  veil: Iterable<Element>;
  /** [data-wake]: where the pointer may part the mist. */
  wake: Iterable<Element>;
  /** 0..1: the desktop ink horizon's presence. */
  horizon: number;
  /** 'living': the page's scene is its ground (every page on the map under the unroll; Home and Work without it). */
  ground: 'living' | '';
  /** (the vanguard round) the page opens inside its place: its hero framed closer and further along it (compose.ts
   *  `inside`); a number is the page's own stretch-local u (A2's sub-anchors). */
  inside?: boolean | number;
}

/**
 * THE PLATES (round 6; features/landscape/plates). On wide screens the stage's depth layers are no longer laid on
 * one fixed canvas on every scroll frame: the engine develops each of them once, at the hero pose, into a canvas of
 * the page's own (a plate), and the page moves the plates itself with a scroll timeline, so a scroll runs no script
 * and draws nothing. The sink is the page's side of that: it owns the plates' canvases and lays them out.
 * A plate's kind: 1 the far layer (the sky, the light and the far ranges; opaque), 2 the middle (the place), 3 the
 * near (the near crags and their figures), 4 the sea of mist over their feet, 5 what is pinned to the frame while
 * the stage travels under it (Home's plum bough), 6 the paper itself with its grain (one tile of it: the page's
 * veils, the paper kept behind the words, are cut from it), 7 the haze deck between the far and the middle layers and
 * 8 the cloud bank the camera rises through (the camera's travel only), 9 Home's silk ribbon (over the far layer,
 * behind the peaks: it turns, so it has a small plate of its own and the far plate stays as it was developed).
 */
export type PlateKind = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
/** A box on the screen at the page's top, CSS px: left, top, width, height. */
export type PlateBox = [left: number, top: number, width: number, height: number];
export interface PlateGeometry {
  /** The screen (CSS px), and how far the layers are painted past its right edge (the unroll's travel). */
  width: number;
  height: number;
  ext: number;
  /** Each plate's box (a kind with no box holds nothing). */
  boxes: Partial<Record<PlateKind, PlateBox>>;
  /** The place the plates show (the page's stretch). */
  stretch: number;
  /** The scroll's motion: the unroll (the plates travel west, linearly with the page) or the camera's travel. */
  motion: 'unroll' | 'camera';
  /** The unroll: how far west the plates travel over the whole page (CSS px). */
  travel: number;
  /** The camera's travel: the stage's pose at samples of the page's scroll (the engine's own choreography, read off
   *  for every sample: the lift, the place's sideways step, the stairs, the descent), which the page turns into each
   *  plate's keyframes. */
  camera: PlateFrame[] | null;
  /** The standing curtain's edge (CSS px from the screen's left edge; -1: none): left of it the middle and near
   *  plates are in mist. */
  curtain: number;
  /** The place's light on the screen at the page's top (CSS px: x, y, radius), or null. */
  light: [x: number, y: number, r: number] | null;
  /** Reduced motion or "Still the landscape": the plates hold the hero pose. */
  still: boolean;
}
/** The camera's travel at one sample of the page's scroll: where each plate stands from the hero pose (CSS px). */
export interface PlateFrame {
  /** The scroll's progress over the whole page, 0..1. */
  p: number;
  /** The far, middle and near layers: [x right, y down]. */
  layers: [[number, number], [number, number], [number, number]];
  /** The sea of mist: y down. */
  sea: number;
  /** The haze deck: [y down from where it was developed, strength 0..1]. */
  haze: [number, number];
  /** The cloud bank: [y down from where it was developed, strength 0..1]. */
  cloud: [number, number];
  /** The curtain (a place with an anchor): [its edge, CSS px from the screen's left; strength 0..1]. */
  curtain: [number, number];
}
export interface PlateSink {
  /** The canvas of a plate (the engine sizes its buffer and draws into it). */
  canvas(kind: PlateKind): HTMLCanvasElement | null;
  /** The plates' geometry changed: lay them out and set their motion. */
  layout(g: PlateGeometry): void;
  /** The plates show (the engine's own canvas rests), or the engine's canvas does (a page change, a narrow window). */
  show(on: boolean): void;
  /** A plate has been developed whole (the paper tile: the page takes it as an image). */
  developed?(kind: PlateKind): void;
}

export interface MountOptions extends Partial<LandscapeTargets> {
  /** THE PLATES: where the stage goes on wide screens (absent: the engine lays it on its own canvas, as before). */
  plates?: PlateSink | null;
  stretch?: number;
  distance?: Distance;
  presence?: number;
  palette?: Palette;
  still?: boolean;
  arrival?: 'bloom' | 'none';
  /** 'complete': the first frame waits for the page's own figure layer and, on the living ground, its three depth
   *  layers, so the strip's still (components/page/Strip) hands over to a finished painting; 'now' (default): the
   *  first scene is presented as soon as it is painted and the figures fade in when they come. */
  firstFrame?: 'complete' | 'now';
  ambient?: boolean;
  quality?: 'auto' | number;
}

/**
 * THE MOODS (round 6): the painting at another hour and in other weather, each 0..1 (absent: 0). The scenes are not
 * repainted: the mood is a grade of what is painted (engine/shaders.ts moodGrade), so the paper stays the paper.
 */
export interface Mood {
  dusk?: number;
  night?: number;
  dawn?: number;
  snow?: number;
  rain?: number;
  /** The lamps lit (the hut's room, a window, a boat's lantern). */
  lamps?: number;
}

export interface PanOptions {
  duration?: number;
  distance?: Distance;
  presence?: number;
  ease?: 'whip' | 'cubic-out';
  cloud?: boolean;
}

/** stats(): counters and state, read by the QA probes' settle check (never by the site itself). */
export interface LandscapeStats {
  mode: Mode;
  stretch?: number;
  pending?: boolean;
  software?: boolean;
  quality?: number;
  [key: string]: unknown;
}

export interface LandscapeHandle {
  readonly mode: Mode;
  /** The camera travels to `stretch`, which may be fractional: a position within a place (the vanguard round, A2:
   *  compose.ts `cameraFor(k, u)` gives the one that brings world x k + u to the hero's focus column; the search pans
   *  there and back). Under the unroll a pan starts from where the page's slide left the painting. */
  panTo(stretch: number, o?: PanOptions): Promise<void>;
  sweep(o?: { dir?: 1 | -1; duration?: number }): Promise<void>;
  prepare(stretch: number, o?: { distance?: Distance; presence?: number }): Promise<void>;
  rebind(o: Partial<LandscapeTargets>): void;
  setStill(on: boolean): void;
  /** THE MOODS: take the painting to another hour or weather, over `ms` (0: at once). */
  setMood?(mood: Mood, ms?: number): void;
  refresh(): void;
  pause(): void;
  resume(): void;
  destroy(): void;
  stats(): LandscapeStats;
}

export interface EngineModule {
  mountLandscape(canvas: HTMLCanvasElement, opts?: MountOptions): LandscapeHandle;
}
