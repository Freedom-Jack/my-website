/**
 * THE PLATES, the page's side (the engine's side is engine/index.ts "THE PLATES").
 *
 * On wide screens the engine develops each depth layer of the stage once, at the hero pose, into a canvas here (a
 * plate), and this module lays the plates out and gives each one its motion as a scroll timeline, so the browser's
 * compositor moves them: a scroll runs no script and draws nothing, and the painting cannot slip against the words.
 *
 *   .plates                        no box of its own (display: contents); its two leaves are fixed to the screen and
 *                                  shown while html[data-plates="on"] (the engine's canvas rests)
 *     .plates__back                what lies behind the place
 *       canvas[data-plate="1"]     the far layer: the sky, the light, the far ranges (opaque, with the paper's grain)
 *       canvas[data-plate="10"]    its top as it stands under the header's paper band (the sky easing out of the
 *                                  paper): over the far plate at the page's top, let go as the header scrolls away
 *     .plates__fore                the place and everything in front of it
 *       .plates__front             two plain boxes at the leaf's origin (they clip nothing)
 *         .plates__in
 *           canvas[data-plate="2"] the middle layer: the place
 *           canvas[data-plate="3"] the near layer: the near crags and their figures
 *       canvas[data-plate="4"]     the sea of mist over their feet
 *       canvas[data-plate="5"]     what is pinned to the frame while the stage travels under it (Writing's willow): it
 *                                  leaves with the first screen, at the page's own rate
 *
 * The motion: the unroll moves every plate but the pinned one west, linearly with the page's scroll, by `travel` px
 * over the whole page. Where the browser has no scroll timelines (Firefox), a scroll listener sets the same
 * animations' clocks. Reduced motion and "Still the landscape": the plates hold the hero pose.
 *
 * What may stand here (measured on a 120 Hz 3456 x 2234 display): plain layers, each moved by a transform, and plain
 * rectangular clips cost the compositor nothing while the page scrolls (0 % GPU); one CSS mask or blend mode over
 * moving layers makes it composite the whole page itself, 15 to 25 % GPU on every scroll frame. So: no mask, filter
 * or blend mode on .plates or anything in it, and no opacity on a box that holds plates (a single plate's own opacity
 * is a plain layer's: the band's plate is let in and out by it).
 */
import type { PlateGeometry, PlateKind, PlateSink } from '../types';

const KINDS: PlateKind[] = [1, 10, 2, 3, 4, 5];
/** One period of the paper's grain, CSS px (the engine's: 512 grain texels of 1 CSS px, at most 2 device px each). */
const tileSize = () => 512 * Math.min(1, 2 / Math.max(1, devicePixelRatio || 1));

type ScrollTimelineCtor = new (o: { source: Element; axis: 'block' | 'inline' }) => AnimationTimeline;

export interface PlateStage extends PlateSink {
  destroy(): void;
}

/** A keyframe of a layer's motion: the scroll's progress over the page, where it stands (px) and how strong it is. */
type Key = [p: number, x: number, y: number, opacity?: number];

/** Each plate's keyframes for a geometry. */
function motionOf(g: PlateGeometry, kind: PlateKind): Key[] {
  if (kind === 10) {
    // the far layer's top under the header's band: it travels with the far plate, and is let go as the band scrolls
    // away with the header (whole at the page's top, gone after `band` px of the page's scroll; under reduced
    // motion and Still too, where the far plate holds its pose: the band still leaves with the header)
    const moving = g.still ? [] : motionOf(g, 1);
    const far: Key[] =
      moving.length > 1
        ? moving
        : [
            [0, 0, 0],
            [1, 0, 0],
          ];
    const p1 = Math.min(1, g.band / Math.max(1, g.maxY));
    const at = (p: number): Key => {
      let i = 1;
      while (i < far.length - 1 && far[i]![0] < p) i += 1;
      const [a, b] = [far[i - 1]!, far[i]!];
      const f = b[0] > a[0] ? Math.min(1, Math.max(0, (p - a[0]) / (b[0] - a[0]))) : 0;
      return [p, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, Math.max(0, 1 - p / p1)];
    };
    const ps = [...new Set([...far.map((k) => k[0]), p1])].sort((a, b) => a - b);
    return ps.map(at);
  }
  if (kind === 5) {
    // what is pinned to the frame (Writing's willow, the near framing bough of the first screen) leaves with the first
    // screen, at the page's own rate, as the header above it does: nothing stays pinned to the screen in front of the
    // painting once the page scrolls. Under reduced motion and Still too: the page still scrolls.
    const b = g.boxes[5];
    const out = b ? b[1] + b[3] + 24 : 0;
    if (!(out > 0) || !(g.maxY > 0)) return [[0, 0, 0]];
    const p1 = Math.min(1, out / g.maxY);
    return [
      [0, 0, 0],
      [p1, 0, -p1 * g.maxY],
      [1, 0, -p1 * g.maxY],
    ];
  }
  if (g.still) return [[0, 0, 0]];
  return [
    [0, 0, 0],
    [1, -g.travel, 0],
  ];
}

export function createPlateStage(root: HTMLElement): PlateStage {
  const html = document.documentElement;
  const canvases = new Map<PlateKind, HTMLCanvasElement>();
  for (const k of KINDS) {
    const c = root.querySelector<HTMLCanvasElement>(`canvas[data-plate="${k}"]`);
    if (c) canvases.set(k, c);
  }
  // the paper tile (kind 6): developed off the page, then the page's own image (the veils are cut from it)
  const tile = document.createElement('canvas');
  let tileUrl = '';
  const anims = new Map<PlateKind, Animation>();
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

  /** Give a plate its motion along the page's scroll (transform, and opacity where the keys carry one). */
  function setMotion(id: PlateKind, el: HTMLElement, keys: Key[]) {
    anims.get(id)?.cancel();
    anims.delete(id);
    if (keys.length < 2) return;
    const fade = keys.some((k) => k[3] !== undefined);
    const kf = keys.map(([offset, x, y, o]) => ({
      offset: Math.min(1, Math.max(0, offset)),
      transform: `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`,
      ...(fade ? { opacity: String(Math.min(1, Math.max(0, o ?? 1))) } : {}),
    }));
    try {
      const a = timeline
        ? el.animate(kf, { timeline, fill: 'both', easing: 'linear' } as KeyframeAnimationOptions)
        : el.animate(kf, { duration: SPAN, fill: 'both', easing: 'linear' });
      if (!timeline) a.pause();
      anims.set(id, a);
    } catch {
      /* no Web Animations: the layer holds the hero pose */
    }
  }

  return {
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
        setMotion(k, c, motionOf(g, k));
      }
      if (!timeline) onScroll();
    },
    show(on) {
      if (dead) return;
      if (on) html.setAttribute('data-plates', 'on');
      else html.removeAttribute('data-plates');
    },
    destroy() {
      dead = true;
      for (const a of anims.values()) a.cancel();
      anims.clear();
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
