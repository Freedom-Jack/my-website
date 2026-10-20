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
  /** 'living': the page's scene is its ground (Home, Work). */
  ground: 'living' | '';
}

export interface MountOptions extends Partial<LandscapeTargets> {
  stretch?: number;
  distance?: Distance;
  presence?: number;
  palette?: Palette;
  still?: boolean;
  arrival?: 'bloom' | 'none';
  ambient?: boolean;
  quality?: 'auto' | number;
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
  panTo(stretch: number, o?: PanOptions): Promise<void>;
  sweep(o?: { dir?: 1 | -1; duration?: number }): Promise<void>;
  prepare(stretch: number, o?: { distance?: Distance; presence?: number }): Promise<void>;
  rebind(o: Partial<LandscapeTargets>): void;
  setStill(on: boolean): void;
  refresh(): void;
  pause(): void;
  resume(): void;
  destroy(): void;
  stats(): LandscapeStats;
}

export interface EngineModule {
  mountLandscape(canvas: HTMLCanvasElement, opts?: MountOptions): LandscapeHandle;
}
