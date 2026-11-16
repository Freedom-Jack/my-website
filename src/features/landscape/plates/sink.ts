/**
 * THE PLATES, the page's side (round 6; the engine's side is engine/index.ts "THE PLATES").
 *
 * On wide screens the engine develops each depth layer of the stage once, at the hero pose, into a canvas here (a
 * plate), and this module lays the plates out and gives each one its motion as a scroll timeline, so the browser's
 * compositor moves them: a scroll runs no script and draws nothing, and the painting cannot slip against the words.
 *
 *   .plates                      fixed, the screen; shown while html[data-plates="on"] (the engine's canvas rests)
 *     canvas[data-plate="1"]     the far layer: the sky, the light, the far ranges (opaque, with the paper's grain)
 *     .plates__front             the standing curtain: left of it the middle and near plates are in mist (a mask)
 *       canvas[data-plate="2"]   the middle layer: the place
 *       canvas[data-plate="3"]   the near layer: the near crags and their figures
 *     canvas[data-plate="4"]     the sea of mist over their feet
 *     canvas[data-plate="5"]     what is pinned to the frame while the stage travels under it (Home's plum bough)
 *
 * The motion (PlateGeometry.motion): the unroll moves every plate west, linearly with the page's scroll, by
 * `travel` px over the whole page; the camera's travel sinks each plate at its own rate over the first screens.
 * Where the browser has no scroll timelines (Firefox), a scroll listener sets the same animations' clocks.
 * Reduced motion and "Still the landscape": the plates hold the hero pose.
 */
import type { PlateGeometry, PlateKind, PlateSink } from '../types';

const KINDS: PlateKind[] = [1, 2, 3, 4, 5];
/** One period of the paper's grain, CSS px (the engine's: 512 grain texels of 1 CSS px, at most 2 device px each). */
const tileSize = () => 512 * Math.min(1, 2 / Math.max(1, devicePixelRatio || 1));

type ScrollTimelineCtor = new (o: { source: Element; axis: 'block' | 'inline' }) => AnimationTimeline;

export interface PlateStage extends PlateSink {
  /** The geometry the plates were last laid out with (QA, and the page's own layers that follow it). */
  readonly geometry: PlateGeometry | null;
  /** Called after every layout (the mist and the veils follow the plates). */
  onLayout(f: (g: PlateGeometry) => void): () => void;
  destroy(): void;
}

/** Each plate's keyframes for a geometry: a list of [progress 0..1, x px, y px] (the scroll's progress over the page). */
function motionOf(g: PlateGeometry, kind: PlateKind): [number, number, number][] {
  if (g.still || kind === 5) return [[0, 0, 0]];
  if (g.motion === 'unroll') return [[0, 0, 0], [1, -g.travel, 0]];
  return [[0, 0, 0]];
}

export function createPlateStage(root: HTMLElement): PlateStage {
  const html = document.documentElement;
  const canvases = new Map<PlateKind, HTMLCanvasElement>();
  for (const k of KINDS) {
    const c = root.querySelector<HTMLCanvasElement>(`canvas[data-plate="${k}"]`);
    if (c) canvases.set(k, c);
  }
  const front = root.querySelector<HTMLElement>('.plates__front');
  // the paper tile (kind 6): developed off the page, then the page's own image (the veils are cut from it)
  const tile = document.createElement('canvas');
  let tileUrl = '';
  const anims = new Map<PlateKind, Animation>();
  const listeners = new Set<(g: PlateGeometry) => void>();
  let geometry: PlateGeometry | null = null;
  let dead = false;

  // the scroll's clock: the browser's own timeline, or (without one) a listener that sets the animations' time
  const STL = (window as unknown as { ScrollTimeline?: ScrollTimelineCtor }).ScrollTimeline;
  let timeline: AnimationTimeline | null = null;
  try {
    timeline = typeof STL === 'function' ? new STL({ source: html, axis: 'block' }) : null;
  } catch {
    timeline = null;
  }
  const SPAN = 1000; // ms: a hand-driven animation's length
  let raf = 0;
  const drive = () => {
    raf = 0;
    const max = Math.max(1, html.scrollHeight - innerHeight);
    const p = Math.min(1, Math.max(0, (window.scrollY || 0) / max));
    for (const a of anims.values()) a.currentTime = p * SPAN;
  };
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(drive);
  };
  if (!timeline) {
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll, { passive: true });
  }

  function setMotion(kind: PlateKind, frames: [number, number, number][]) {
    const c = canvases.get(kind);
    if (!c) return;
    anims.get(kind)?.cancel();
    anims.delete(kind);
    if (frames.length < 2) return;
    const kf = frames.map(([offset, x, y]) => ({ offset, transform: `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)` }));
    try {
      const a = timeline
        ? c.animate(kf, { timeline, fill: 'both', easing: 'linear' } as KeyframeAnimationOptions)
        : c.animate(kf, { duration: SPAN, fill: 'both', easing: 'linear' });
      if (!timeline) a.pause();
      anims.set(kind, a);
    } catch {
      /* no Web Animations: the plate holds the hero pose */
    }
  }

  return {
    get geometry() {
      return geometry;
    },
    canvas: (kind) => (kind === 6 ? tile : (canvases.get(kind) ?? null)),
    developed(kind) {
      if (kind !== 6 || dead) return;
      tile.toBlob((blob) => {
        if (!blob || dead) return;
        const old = tileUrl;
        tileUrl = URL.createObjectURL(blob);
        html.style.setProperty('--paper-tile', `url("${tileUrl}")`);
        html.style.setProperty('--paper-tile-size', `${tileSize()}px`);
        if (old) setTimeout(() => URL.revokeObjectURL(old), 2000);
      });
    },
    layout(g) {
      if (dead) return;
      geometry = g;
      root.style.setProperty('--plates-w', `${g.width}px`);
      for (const k of KINDS) {
        const c = canvases.get(k);
        if (!c) continue;
        const b = g.boxes[k];
        if (!b) {
          c.style.display = 'none';
          anims.get(k)?.cancel();
          anims.delete(k);
          continue;
        }
        c.style.display = '';
        c.style.left = `${b[0]}px`;
        c.style.top = `${b[1]}px`;
        c.style.width = `${b[2]}px`;
        c.style.height = `${b[3]}px`;
        setMotion(k, motionOf(g, k));
      }
      // the standing curtain: left of it the middle and near plates are in mist
      if (front) {
        if (g.curtain >= 0) front.style.setProperty('--curtain', `${g.curtain}px`);
        front.toggleAttribute('data-curtain', g.curtain >= 0);
      }
      root.dataset.motion = g.still ? 'still' : g.motion;
      root.dataset.stretch = String(g.stretch);
      if (!timeline) onScroll();
      for (const f of listeners) f(g);
    },
    show(on) {
      if (dead) return;
      if (on) html.setAttribute('data-plates', 'on');
      else html.removeAttribute('data-plates');
    },
    onLayout(f) {
      listeners.add(f);
      if (geometry) f(geometry);
      return () => listeners.delete(f);
    },
    destroy() {
      dead = true;
      for (const a of anims.values()) a.cancel();
      anims.clear();
      listeners.clear();
      if (raf) cancelAnimationFrame(raf);
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onScroll);
      html.removeAttribute('data-plates');
      html.style.removeProperty('--paper-tile');
      html.style.removeProperty('--paper-tile-size');
      if (tileUrl) URL.revokeObjectURL(tileUrl);
    },
  };
}
