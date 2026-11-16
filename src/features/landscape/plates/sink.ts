/**
 * THE PLATES, the page's side (round 6; the engine's side is engine/index.ts "THE PLATES").
 *
 * On wide screens the engine develops each depth layer of the stage once, at the hero pose, into a canvas here (a
 * plate), and this module lays the plates out and gives each one its motion as a scroll timeline, so the browser's
 * compositor moves them: a scroll runs no script and draws nothing, and the painting cannot slip against the words.
 *
 *   .plates                      fixed, the screen; shown while html[data-plates="on"] (the engine's canvas rests)
 *     canvas[data-plate="1"]     the far layer: the sky, the light, the far ranges (opaque, with the paper's grain)
 *     .plates__front             the standing curtain: left of its line the middle and near plates are clipped away
 *       .plates__in
 *         canvas[data-plate="2"] the middle layer: the place
 *         canvas[data-plate="3"] the near layer: the near crags and their figures
 *     canvas[data-plate="4"]     the sea of mist over their feet
 *     .plates__wisp              ...and a band of the paper's own mist lies over that line (edges.ts): the place goes
 *                                into it as it reaches the words; the far ranges run on behind them
 *     canvas[data-plate="5"]     what is pinned to the frame while the stage travels under it (Home's plum bough)
 *
 * The motion (PlateGeometry.motion): the unroll moves every plate west, linearly with the page's scroll, by
 * `travel` px over the whole page; the camera's travel sinks each plate at its own rate over the first screens.
 * Where the browser has no scroll timelines (Firefox), a scroll listener sets the same animations' clocks.
 * Reduced motion and "Still the landscape": the plates hold the hero pose.
 *
 * What may stand here (round 6's measurement, on a 120 Hz 3456 x 2234 display): plain layers, each moved by a
 * transform, and plain rectangular clips cost the compositor nothing while the page scrolls (0 % GPU); one CSS mask
 * or blend mode over moving layers makes it composite the whole page itself, 15 to 25 % GPU on every scroll frame.
 * So: no mask, filter, blend mode or opacity on .plates or anything in it.
 */
import type { PlateGeometry, PlateKind, PlateSink } from '../types';
import { alphaCanvas, EDGE_L, WISP_W, wispAlpha } from './edges';

const KINDS: PlateKind[] = [1, 2, 3, 4, 5, 7, 8, 9];
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

/** A keyframe of a layer's motion: the scroll's progress over the page, where it stands (px) and how strong it is. */
type Key = [p: number, x: number, y: number, opacity?: number];

/** Each plate's keyframes for a geometry. */
function motionOf(g: PlateGeometry, kind: PlateKind): Key[] {
  if (g.still || kind === 5) return [[0, 0, 0]];
  if (g.motion === 'unroll')
    return [
      [0, 0, 0],
      [1, -g.travel, 0],
    ];
  const F = g.camera;
  if (!F || F.length < 2) return [[0, 0, 0]];
  // the camera's travel: the engine's own choreography, sample by sample
  if (kind === 9) return F.map((f): Key => [f.p, f.layers[0][0], f.layers[0][1]]); // (the ribbon rides the far layer)
  if (kind <= 3) return F.map((f): Key => [f.p, f.layers[kind - 1][0], f.layers[kind - 1][1]]);
  if (kind === 4) return F.map((f): Key => [f.p, f.layers[1][0], f.sea]); // (its billows ride with the middle layer)
  if (kind === 7) return F.map((f): Key => [f.p, 0, f.haze[0], f.haze[1]]);
  return F.map((f): Key => [f.p, 0, f.cloud[0], f.cloud[1]]);
}
/** The camera's curtain (a place with an anchor: Work): its line where it stands once the place has stepped, and how
 *  far from there it stands at each sample (it comes in from the west under the cloud, and clears away west again
 *  at the end: the bridge comes out of the mist). */
function curtainOf(g: PlateGeometry): { at: number; keys: Key[] } | null {
  const F = g.camera;
  if (g.still || g.motion !== 'camera' || !F) return null;
  let at = -1;
  let best = 0;
  for (const f of F) if (f.curtain[1] > best) [best, at] = [f.curtain[1], f.curtain[0]];
  if (at < 0 || best < 0.5) return null;
  return {
    at,
    keys: F.map((f): Key => [
      f.p,
      f.curtain[1] > 0.02 ? f.curtain[0] - at : -at - 400,
      0,
      Math.min(1, f.curtain[1] * 1.3),
    ]),
  };
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
  let wispUrl = '';
  /** The curtain's wisp: a band of the paper's own tile (its grain) with the wisp's alpha, as an image for CSS. */
  function makeWisp() {
    const s = tile.width / tileSize(); // the tile's px per CSS px
    const c = document.createElement('canvas');
    c.width = Math.max(2, Math.round(WISP_W * s));
    c.height = Math.max(2, Math.round(EDGE_L * s));
    const x = c.getContext('2d');
    const pat = x?.createPattern(tile, 'repeat');
    if (!x || !pat) return;
    x.fillStyle = pat;
    x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'destination-in';
    x.imageSmoothingQuality = 'high';
    x.drawImage(alphaCanvas(Math.round(WISP_W / 2), Math.round(EDGE_L / 2), wispAlpha()), 0, 0, c.width, c.height);
    c.toBlob((blob) => {
      if (!blob || dead) return;
      const old = wispUrl;
      wispUrl = URL.createObjectURL(blob);
      html.style.setProperty('--wisp', `url("${wispUrl}")`);
      if (old) setTimeout(() => URL.revokeObjectURL(old), 2000);
    });
  }
  const anims = new Map<PlateKind | string, Animation>();
  const front = root.querySelector<HTMLElement>('.plates__front');
  const inner = root.querySelector<HTMLElement>('.plates__in');
  const wisp = root.querySelector<HTMLElement>('.plates__wisp');
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

  // depth you can feel (elements.ts depth; plates.css): where the pointer is, as two numbers on the stage; each
  // plate's own depth and the easing are CSS, the move is the compositor's
  let praf = 0;
  let px = 0;
  let py = 0;
  const setDepth = () => {
    praf = 0;
    root.style.setProperty('--px', px.toFixed(3));
    root.style.setProperty('--py', py.toFixed(3));
  };
  const onPointer = (e: PointerEvent) => {
    if (e.pointerType === 'touch' || !html.classList.contains('el-depth') || html.getAttribute('data-plates') !== 'on')
      return;
    px = Math.min(1, Math.max(-1, (e.clientX / Math.max(1, innerWidth)) * 2 - 1));
    py = Math.min(1, Math.max(-1, (e.clientY / Math.max(1, innerHeight)) * 2 - 1));
    if (!praf) praf = requestAnimationFrame(setDepth);
  };
  const onLeave = () => {
    px = py = 0;
    if (!praf) praf = requestAnimationFrame(setDepth);
  };
  addEventListener('pointermove', onPointer, { passive: true });
  html.addEventListener('pointerleave', onLeave);

  /** Give an element its motion along the page's scroll (transform, and opacity where the keys carry one). */
  function setMotion(id: PlateKind | string, el: HTMLElement | undefined | null, keys: Key[], flip = false) {
    anims.get(id)?.cancel();
    anims.delete(id);
    if (!el || keys.length < 2) return;
    const fade = keys.some((k) => k[3] !== undefined);
    const kf = keys.map(([offset, x, y, o]) => ({
      offset: Math.min(1, Math.max(0, offset)),
      transform: `translate3d(${((flip ? -1 : 1) * x).toFixed(2)}px, ${((flip ? -1 : 1) * y).toFixed(2)}px, 0)`,
      ...(fade && !flip ? { opacity: String(Math.min(1, Math.max(0, o ?? 1))) } : {}),
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
    get geometry() {
      return geometry;
    },
    canvas: (kind) => (kind === 6 ? tile : (canvases.get(kind) ?? null)),
    developed(kind) {
      if (kind !== 6 || dead) return;
      makeWisp();
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
        setMotion(k, c, motionOf(g, k));
      }
      // the curtain: left of its line the middle and near plates are in mist. The unroll's stands; the camera's (a
      // place with an anchor) comes in from the west and clears away again: its clip and its wisp move together, and
      // the plates inside the clip move back by as much, so only the line travels
      const cam = curtainOf(g);
      const at = cam ? cam.at : g.curtain;
      if (at >= 0) root.style.setProperty('--curtain', `${at}px`);
      root.toggleAttribute('data-curtain', at >= 0);
      setMotion('curtain', front, cam ? cam.keys.map((k): Key => [k[0], k[1], 0]) : []);
      setMotion('curtain-in', inner, cam ? cam.keys.map((k): Key => [k[0], k[1], 0]) : [], true);
      setMotion('wisp', wisp, cam ? cam.keys : []);
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
      removeEventListener('pointermove', onPointer);
      html.removeEventListener('pointerleave', onLeave);
      if (praf) cancelAnimationFrame(praf);
      html.removeAttribute('data-plates');
      html.style.removeProperty('--paper-tile');
      html.style.removeProperty('--paper-tile-size');
      html.style.removeProperty('--wisp');
      if (tileUrl) URL.revokeObjectURL(tileUrl);
      if (wispUrl) URL.revokeObjectURL(wispUrl);
    },
  };
}
