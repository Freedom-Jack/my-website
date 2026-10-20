// figures.ts — the figure layers: what in the painting is not a mountain (SPEC-R4A §12.5). DOM-free Canvas2D
// brushwork, seeded and deterministic, drawn once per (stretch, scale, palette, resolution) on an OffscreenCanvas
// in a module worker (figures.worker.ts), or on the main thread in idle chunks of <= 8 ms where that is missing.
// The layer covers a world rectangle (figureMeta); the scene shader paints it *into* the painting at its plane,
// with a bleed halo (its mip levels), the plane's mist over its feet, grain on top and the drifting mist passing
// over it, so it is never pasted on.
//
// This file is the brush kit and the plumbing. The scenes live in sets/, one module per figure set (one stretch
// each), listed in sets/index.ts; adding or changing a set never touches this file:
//   sets/home.ts      stretch 0  Home: the traveller, the hut, the path, the ledge
//   sets/market.ts    stretch 1  Work: the river market at the rainbow bridge
//   sets/pavilion.ts  stretch 3  Writing and the Note: the pavilion by the still lake
//   sets/terraces.ts  stretch 4  Résumé: the terraced fields and the farmhouse
//   sets/ferry.ts     stretch 5  Contact: the ferry at the jetty
//   sets/path.ts      stretch 6  404: the path into mist
// How to add a set and test one alone: README "Figure sets and small life"; the lessons behind these rules:
// _notes/r4b/RECORD.md section 3.
//
// ---- THE SET API -----------------------------------------------------------------------------------------------
// A set module exports two things:
//
//   export const meta = { rect: [u0, u1, y0, y1], plane, phase };   // or null: no layer on this stretch (a stub)
//   export function* draw(env) { ... }                               // a plain function works too (no chunks)
//
//   meta.rect   the world rectangle the layer covers: u in stretches, absolute (stretch 1 runs 1.0 .. 2.0), y in
//               scene heights (viewport heights at presence 1; 0 at the bottom, y up). The scene shader melts both
//               ends over 13 % of the width: keep what matters inside 13-87 %. The layer's pixels are
//               (u1 - u0) * scale * dpr by (y1 - y0) * scale / HS * dpr, at most 4096 a side.
//   meta.plane  the ridge plane it is painted with, 0 (far) .. 4 (near); one plane per layer.
//   meta.phase  0: after that plane's ink, before its mist band (the band softens the feet);
//               1: after the plane's mist band and the water (only plane 2 has water in front of it).
//
//   draw(env) paints the set on env.ctx in world px and may `yield` between elements (a few ms each at most), so
//   the main-thread fallback can paint it in idle chunks. env:
//     ctx          the 2d context, already transformed to world px; lineCap and lineJoin 'round'
//     P            the composition the layer is painted into (the showing page's data-distance / data-presence,
//                  desktop aspect; the Note's lake is lower than Writing's): planeTop(l, u, P) is a ridge plane's
//                  crest, sceneField(u, P, out) the scene's waterlines and banks (use it at the water)
//     ink          { C, rgba, strength, colourK }: the palette's colours (C.ink, C.tile, C.mal ...) and rgba(c, a);
//                  strength 0 (ink), 1 (misted), 1.25 (rich). Never write raw colours: 'ink' must turn them grey.
//     k            device px per world px (scale / REF_PX * dpr)
//     scale, dpr, palette, stretch      what the layer is drawn for (scale = CSS px per stretch)
//     cls          the width class whose windows show it ('wide' | 'tablet' | 'phone' | 'short'; null in the lab), so a
//                  set may cull what that class never sees; P and scale are already that window's own
//     rect, plane, phase                this set's meta (copies)
//     life         [] : the life anchors (THE LIFE API, below)
//     softOK       false: soft washes never use ctx.filter (on many canvases that blurs a canvas-sized layer)
//   World px: REF_PX (1440) per stretch and VH_PX (900) per scene height: wx = u * 1440, wy = (1 - y) * 900, y down.
//   Phone scales are small (Home's is 270 CSS px per stretch): draw figures larger there, as home.ts does with
//   big = Math.max(1, 0.7 * REF_PX / env.scale), so a person stays >= 12 CSS px tall.
//   Randomness: never Math.random, never one stream shared by the whole set. Each element takes its own stream:
//   const own = streams(SEED, PINS); own('house', row, i) (stream, streamAt, streams below), so adding or removing
//   a draw in one element never re-rolls another. PINS keeps the elements that existed in 4a on their 4a draws.
//   Module rules: import the kit from '../figures' (and nothing from index.ts). figures.ts never imports the sets
//   (the engine and its worker register them: registerSets), so the kit's constants exist when a set's top level runs.
//   To change a shared brush for one set, copy it into the set file and change the copy; bring improvements back here
//   in a separate, reviewed step.
//
// ---- THE LIFE API (anchors; the present pass animates them: index.ts lifeU, shaders.ts lifePrep) ---------------
// The layer never moves. A set marks where small life belongs while it draws (no drawing, no randomness):
//   env.life.push({ kind, x, y, w, h, plane, params })     or     anchor(env, kind, { x, y, w, h }, params)
//   kind     'smoke' | 'willow' | 'boat' | 'shimmer' | 'walker'
//   x, y, w, h   the box the motion may use, in world px (the layer's authoring units): top-left corner, y down.
//            It may reach past the layer's rect (smoke rises into the sky).
//   plane    the ridge plane it belongs to (default: the set's plane)
//   params   per kind, positions in world px:
//     smoke    { src: [x, y] }                         where the plume leaves (a roof, a fire); the box rises above it
//     willow   { foot: [x, y], s, sway }               the tree's foot and size; the box covers its strands
//     boat     { L, dir: 1 | -1, speed, range: [x0, x1], sprite, bob }   a hull; speed in world px per second. With
//              sprite: true the worker cuts its box out of the WebGL layer as a sprite that drifts (so the box must
//              hold all of the boat and nothing else); Canvas2D, which never moves, keeps it painted in. Else: moored.
//              bob: { amp, period } (world px, s): a moored boat drawn with ownSprite (below) rises and falls with the
//              water instead of drifting
//     shimmer  { waterline: [[x, y], ...] }            open water below that line; boats and bridges stay still
//     walker   { path: [[x, y], ...], home: [x, y], speed }   one slow figure walking a path (Work's bridge deck):
//              drawn with ownSprite at `home`, its feet; it walks the path at `speed` world px per second, comes into
//              view out of the mist at the path's start and goes into it at the end (DESIGN §11.E answer 9)
//   ownSprite(env, kind, box, params, paint): a moving thing that cannot be cut out of the layer because something
//   lies behind it (a walker on a bridge, a ferry at its jetty). paint(env) draws it in world px. In the WebGL 'gpu'
//   output the worker paints it on a canvas of its own (box: a generous hint of where it is drawn; the sprite is
//   cropped to its ink), never into the layer; everywhere else (Canvas2D, the bytes path, the idle fallback) it is
//   painted into the layer at once, standing still. The anchor's params get sprite: 'own'.
// drawFigures / paintSteps return the anchors checked and copied (params as plain JSON), each with
// uv: [u0, v0, u1, v1], its box in layer texture fractions (v from the top; outside 0..1 past the rect). (A sprite's
// anchor also gets, from the worker, cut: its sprite's box in layer uv, atlas: [u0, u1, v1] its place in the layer's one
// sprite atlas, spx: its size in texels.) In scene
// units: u = rect[0] + uv_u * (rect[1] - rect[0]), y = rect[3] - uv_v * (rect[3] - rect[2]). The worker posts them
// with the layer ({ ..., life }). Life stops for reduced motion, Still, idle and Canvas2D, and is calmer on phones.
//
// Kitsch guards: Song forms only; no red lanterns, pagodas, dragons or gold; no text on signs. Colour (palette.ts):
// light colour over ink: grey tile, timber brown on wood (small areas, never a pale wash), pale indigo clothes,
// white robes, willows in misted malachite. Under 'ink', everything is drawn in ink greys.
//
// Structure studied (not copied) from LingDong Huang's {Shan, Shui}* (MIT, 2018); the brush kit and the scenes grew
// out of the round-4 research sketch (_notes/r4/prototypes/sketch/).

import { resolve, spec, sceneField, SCENE_FIELDS, REF_PX, HS, LAYERS, type Resolved, type WidthClass } from './compose';
import { planeTop } from './ridges';
import { PALETTES, paletteName, type PaletteName } from './palette';

// what a set needs from the composition, re-exported so a set imports from one place
export { sceneField, SCENE_FIELDS, REF_PX, HS, planeTop };
export const VH_PX = REF_PX / HS;   // 900 world px per viewport height

// ---------------------------------------------------------------- the types of the set API and the life API
/** A point in world px (x right, y down). */
export type Pt = [x: number, y: number];
/** A colour, 0..255 sRGB. */
export type RGB = [r: number, g: number, b: number];
/** A box in world px: top-left corner, y down. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** A seeded random stream: R() -> [0, 1). */
export type Rng = () => number;
/** A set's streams (streams()): own('house', row, i) is that element's own stream. */
export type Streams = (...keys: (string | number)[]) => Rng;
/** The 2d context a layer is drawn on: an OffscreenCanvas's (the worker) or a canvas's (the idle fallback). */
export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** A set's meta (THE SET API): the world rectangle [u0, u1, y0, y1] its layer covers, its plane and phase. */
export interface FigureMeta {
  rect: [u0: number, u1: number, y0: number, y1: number];
  plane: number;
  phase: 0 | 1;
}
/** A set's draw(env): it may yield between elements (a few ms each), or be a plain function. */
export type DrawSet = (env: Env) => Generator<unknown, void, unknown> | void;
/** A figure set's module (sets/*.ts): export const meta (or null: a stub) and export function* draw. */
export interface SetModule {
  meta: FigureMeta | null;
  draw?: DrawSet;
}
/** One entry of sets/index.ts SETS. */
export interface SetEntry {
  stretch: number;
  name: string;
  module: SetModule;
}

/** What a layer is drawn for (the engine's request to the worker or the idle fallback). */
export interface LayerParams {
  stretch: number;
  /** CSS px per stretch. */
  scale: number;
  /** Device px per CSS px. */
  dpr: number;
  palette: string;
  distance?: string;
  presence?: number;
  cls?: WidthClass | null;
  /** A r2: a story-map still (the QA frame hook): the sets leave out their near framing elements and moving life. */
  still?: boolean;
  /** 'gpu': an ImageBitmap with its sprites cut apart (WebGL, 4b); 'bytes': premultiplied RGBA (WebGL, 4a);
   *  'bitmap': the layer as drawn (Canvas2D). */
  out?: 'gpu' | 'bytes' | 'bitmap';
  /** M step 3b: drawn for a window into the painting (index.ts GLIMPSE), a still view: its sprites are painted in, never
   *  cut apart (the window's present has no life pass), and the sets leave out what hangs from the strip's top edge. */
  inlay?: boolean;
}

/** The palette's inks (inks()): its colours, rgba() and its strength. */
export interface Inks {
  C: Record<InkName, RGB>;
  rgba: (c: RGB, a: number) => string;
  strength: number;
  colourK: number;
}
/** What draw(env) gets (THE SET API). */
export interface Env {
  ctx: Ctx2D;
  P: Resolved;
  ink: Inks;
  k: number;
  scale: number;
  dpr: number;
  palette: PaletteName;
  stretch: number;
  rect: FigureMeta['rect'];
  plane: number;
  phase: number;
  life: LifeAnchor[];
  softOK: boolean;
  cls: WidthClass | null;
  /** A r2: drawn for a story-map still: no near framing elements, no moving life (LayerParams.still). */
  still: boolean;
  /** M step 3b: drawn for a window into the painting (LayerParams.inlay): no element that hangs from the strip's edge. */
  inlay: boolean;
  /** The set's own sprites (ownSprite), when the worker paints them apart; null: painted into the layer. */
  sprites: { a: LifeAnchor; paint: (env: Env) => void; box: Box }[] | null;
}
/** A set's own sprite, handed to the worker to paint apart (drawFigures `own`). */
export interface OwnSprite {
  /** The index of its anchor among the layer's life anchors. */
  i: number;
  paint: (env: Env) => void;
  box: Box;
  /** Layer px = world px x k + (ox, oy). */
  k: number;
  ox: number;
  oy: number;
  env: Env;
}

/** THE LIFE API: the kinds of small life. */
export type LifeKind = 'smoke' | 'willow' | 'boat' | 'shimmer' | 'walker';
/** A life anchor's params, per kind (positions in world px; see THE LIFE API). */
export interface LifeParams {
  /** smoke: where the plume leaves. */
  src?: Pt;
  /** willow: the tree's foot, its size and sway. */
  foot?: Pt;
  s?: number;
  sway?: number;
  /** boat: its length, direction, speed (world px per second), range [x0, x1]; sprite: true (cut out) or 'own'. */
  L?: number;
  dir?: number;
  speed?: number;
  range?: [number, number];
  sprite?: boolean | 'own';
  /** a moored boat drawn with ownSprite: its rise and fall (world px, s). */
  bob?: { amp: number; period?: number };
  /** shimmer: open water below this line. */
  waterline?: Pt[];
  /** walker: its path, its home (its feet, where it is drawn) and speed. */
  path?: Pt[];
  home?: Pt;
  /** d5 f1, smoke's box as falling petals instead: how many, their size (world px) and speed. */
  petals?: { n: number; size: number; speed?: number };
  /** d5 f1, a walker that is a bird: its wings beat as it glides (the present pass squashes it in time). */
  bird?: boolean;
  /** d5 f1, shimmer: expanding ripple rings on the water too. */
  rings?: number;
  /** M n1, a sprite that swings slowly about its root (the plum: ~0.5 deg at ~0.08 Hz; the present pass turns it). */
  swing?: boolean;
  /** P3 (elements.ts waterfall), smoke's box as a falling stream instead: its x, its lip's and its foot's y, its
   *  half-width (world px); the present pass slides lights down what the layer painted white there. */
  fall?: { x: number; y0: number; y1: number; hw: number };
  /** P3 (elements.ts plumGust), the plum sprite: its main limb (world px), where the pointer touches the bough. */
  limb?: Pt[];
  /** P3 (elements.ts contactLife), a sprite that bends from its foot in a breeze (a clump of rushes). */
  bend?: boolean;
  /** P3 (elements.ts contactLife), shimmer: points (world px) where a ring set falls now and then by itself (a pole,
   *  a bow). */
  drops?: Pt[];
}
/** A life anchor as a set marks it (anchor, ownSprite). */
export interface LifeAnchor extends Box {
  kind: LifeKind;
  plane: number;
  params: LifeParams;
}
/** A life anchor as the layer carries it (lifeOut): checked, with its box in layer texture fractions (uv: [u0, v0, u1,
 *  v1], v from the top); a sprite's also with its place in the sprite atlas (the worker's buildSprites). */
export interface LifeOut extends LifeAnchor {
  uv: [number, number, number, number];
  cut?: [number, number, number, number];
  sprite?: number;
  atlas?: [number, number, number];
  spx?: [number, number];
}

// ---------------------------------------------------------------- the sets (sets/index.ts)
// Registered by the entry points (index.ts on the main thread, figures.worker.ts in the worker): this module never
// imports the sets, so the sets (which import its brush kit) and it form no import cycle. (In the demo they imported
// each other; a production Turbopack build of a module worker over that cycle never finishes.)
let SET_LIST: SetEntry[] = [];
let registry: Map<number, { stretch: number; name: string; meta: FigureMeta | null; draw: DrawSet | undefined }> | null = null;
/** The figure sets, [{ stretch, name, module }] (sets/index.ts SETS). */
export function registerSets(list: SetEntry[]) {
  SET_LIST = Array.isArray(list) ? list : [];
  registry = null;
}
function sets() {
  if (registry) return registry;
  registry = new Map();
  for (const { stretch, name, module: mod } of SET_LIST) {
    if (!Number.isInteger(stretch) || registry.has(stretch)) { console.warn(`figures: set "${name}" has a bad or taken stretch (${stretch}); skipped`); continue; }
    let meta = mod?.meta ?? null;
    const draw = mod?.draw;
    if (meta && !validMeta(meta)) { console.warn(`figures: set "${name}" has an invalid meta; drawn as a stub`, meta); meta = null; }
    if (meta && typeof draw !== 'function') { console.warn(`figures: set "${name}" has no draw(); drawn as a stub`); meta = null; }
    registry.set(stretch, { stretch, name, meta, draw });
  }
  return registry;
}
function validMeta(m: FigureMeta) {
  const r = m.rect;
  return Array.isArray(r) && r.length === 4 && r.every(Number.isFinite) && r[1] > r[0] && r[3] > r[2]
    && Number.isInteger(m.plane) && m.plane >= 0 && m.plane < LAYERS && (m.phase === 0 || m.phase === 1);
}
const setAt = (stretch: number) => sets().get(Math.round(Number(stretch))) || null;

/** The figure layer of a stretch: { rect: [u0, u1, y0, y1], plane, phase } or null (no figures there). */
export function figureMeta(stretch: number): FigureMeta | null {
  const m = setAt(stretch)?.meta;
  return m ? { rect: m.rect.slice() as FigureMeta['rect'], plane: m.plane, phase: m.phase } : null;
}

/** Every registered set, stubs included: [{ stretch, name, meta | null }] (the lab and QA list them). */
export function figureSets(): { stretch: number; name: string; meta: FigureMeta | null }[] {
  return [...sets().values()].sort((a, b) => a.stretch - b.stretch).map(({ stretch, name }) => ({ stretch, name, meta: figureMeta(stretch) }));
}

/** Pixel size of a layer drawn at `scale` CSS px per stretch and `dpr` device px per CSS px. */
export function layerSize(stretch: number, scale: number, dpr: number): { width: number; height: number } {
  const m = setAt(stretch)?.meta;
  if (!m) return { width: 0, height: 0 };
  const [u0, u1, y0, y1] = m.rect;
  return {
    width: Math.max(2, Math.min(4096, Math.round((u1 - u0) * scale * dpr))),
    height: Math.max(2, Math.min(4096, Math.round((y1 - y0) * (scale / HS) * dpr))),
  };
}

/**
 * Draw a layer at once (worker). Returns its life anchors (THE LIFE API). `own`: an array that receives the set's own
 * sprites (ownSprite) instead of painting them into the layer, { i (the anchor's index), paint, box, k, ox, oy, env }
 * (paint({ ...env, ctx }) draws one on another canvas set to world px); leave it out and they are painted in.
 */
export function drawFigures(ctx: Ctx2D, p: LayerParams, own: OwnSprite[] | null = null): LifeOut[] {
  const steps = paintSteps(ctx, p, own);
  let r: IteratorResult<unknown, LifeOut[]>;
  do r = steps.next(); while (!r.done);
  return (r.value as LifeOut[]) || [];
}

/**
 * The layer's painting as steps (a generator), so the main-thread fallback can paint it in idle chunks. Its return
 * value (when done) is the layer's life anchors.
 * @param ctx  sized to layerSize()
 * @param own  see drawFigures
 */
export function* paintSteps(ctx: Ctx2D, p: LayerParams, own: OwnSprite[] | null = null): Generator<unknown, LifeOut[], unknown> {
  const set = setAt(p.stretch);
  const m = set?.meta;
  if (!m) return [];
  const k = (p.scale / REF_PX) * p.dpr;
  const [u0, , , y1] = m.rect;
  const ox = -u0 * REF_PX * k, oy = -(1 - y1) * VH_PX * k;   // layer px = world px x k + (ox, oy)
  ctx.setTransform(k, 0, 0, k, ox, oy);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const P = resolve(spec(p.distance || 'level', p.presence ?? 1), 1.6);
  const env: Env = {
    ctx, P, ink: inks(p.palette), k, scale: p.scale, dpr: p.dpr, palette: paletteName(p.palette), stretch: set.stretch,
    rect: m.rect.slice() as FigureMeta['rect'], plane: m.plane, phase: m.phase, life: [], softOK: false, cls: p.cls || null,
    sprites: own ? [] : null, still: !!p.still, inlay: !!p.inlay,
  };
  // (a set with a meta always has a draw: sets() turns one without into a stub)
  const run = set.draw!(env);
  if (run && typeof run.next === 'function') yield* run;
  const at = new Map<LifeAnchor, number>();
  const life = lifeOut(env.life, m, set.name, at);
  if (own) for (const sp of env.sprites!) if (at.has(sp.a)) own.push({ i: at.get(sp.a)!, paint: sp.paint, box: sp.box, k, ox, oy, env });
  return life;
}

// ---------------------------------------------------------------- life anchors
export const LIFE_KINDS = ['smoke', 'willow', 'boat', 'shimmer', 'walker'];

/** Mark a box for small life (THE LIFE API): anchor(env, 'smoke', { x, y, w, h }, { src: [x, y] }). */
export function anchor(env: Env, kind: LifeKind, box: Box, params: LifeParams = {}, plane: number = env.plane): LifeAnchor {
  const a: LifeAnchor = { kind, x: box.x, y: box.y, w: box.w, h: box.h, plane, params };
  env.life.push(a);
  return a;
}

/**
 * A moving thing drawn on its own (THE LIFE API, ownSprite): paint(env) draws it in world px. `box` is a generous
 * hint of where it is drawn (world px); the sprite is cropped to its ink. Painted into the layer, still, wherever the
 * layer does not move its sprites.
 */
export function ownSprite(env: Env, kind: LifeKind, box: Box, params: LifeParams, paint: (env: Env) => void): LifeAnchor {
  const a = anchor(env, kind, box, { ...params, sprite: 'own' });
  if (env.sprites) env.sprites.push({ a, paint, box: { x: box.x, y: box.y, w: box.w, h: box.h } });
  else paint(env);
  return a;
}

/** The box around some polylines, { x, y, w, h } in world px, grown by `pad` on every side. */
export function bounds(lists: Pt[][], pad = 0): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const pts of lists) for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (!(x1 >= x0)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
}

// checked, plain-JSON copies (they cross to the main thread), each with its box in layer texture fractions (`at`, when
// given, maps each kept anchor to its index in the copy)
function lifeOut(list: LifeAnchor[], m: FigureMeta, name: string, at: Map<LifeAnchor, number> | null = null): LifeOut[] {
  const [u0, u1, y0, y1] = m.rect;
  const X0 = u0 * REF_PX, Y0 = (1 - y1) * VH_PX, W = (u1 - u0) * REF_PX, H = (y1 - y0) * VH_PX;
  const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
  const out: LifeOut[] = [];
  for (const a of list) {
    const ok = a && LIFE_KINDS.includes(a.kind) && [a.x, a.y, a.w, a.h].every(Number.isFinite) && a.w > 0 && a.h > 0;
    if (!ok) { console.warn(`figures: set "${name}" pushed a bad life anchor; dropped`, a); continue; }
    let params: LifeParams = {};
    try { params = JSON.parse(JSON.stringify(a.params ?? {}, (_key, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v))) ?? {}; } catch { /* keep {} */ }
    at?.set(a, out.length);
    out.push({
      kind: a.kind, x: r4(a.x), y: r4(a.y), w: r4(a.w), h: r4(a.h),
      plane: Number.isInteger(a.plane) ? a.plane : m.plane, params,
      uv: [r4((a.x - X0) / W), r4((a.y - Y0) / H), r4((a.x + a.w - X0) / W), r4((a.y + a.h - Y0) / H)],
    });
  }
  return out;
}

// ---------------------------------------------------------------- noise, randomness
export function hash2(x: number, y: number, s: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function vnoise(x: number, y: number, s: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, y: number, s: number, oct = 3): number {
  let a = 0.5, t = 0, n = 0;
  for (let i = 0; i < oct; i++) { t += a * vnoise(x, y, s + i * 17); n += a; x *= 2.03; y *= 2.03; a *= 0.5; }
  return t / n;
}
/** A seeded random stream (mulberry32): R() -> [0, 1). */
export function rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/**
 * An element's own stream: stream(SEED, 'house', row, i). Keys are integers or short strings; the same keys always
 * give the same stream, and different keys never share draws, so adding or removing a draw in one element never
 * re-rolls another. To re-roll one element, change its key.
 */
export function stream(seed: number, ...keys: (string | number)[]): Rng {
  let h = seed >>> 0;
  for (const key of keys) {
    if (typeof key === 'string') for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
    else h = Math.imul(h ^ (key | 0), 2246822519);
    h ^= h >>> 15; h = Math.imul(h, 2654435761); h ^= h >>> 13;
  }
  return rng(h >>> 0);
}
/**
 * rng(seed) skipped ahead n draws: streamAt(seed, n)() is rng(seed)'s draw number n + 1. It pins an element to the
 * draws it had when its whole set shared one stream (4a), so splitting the stream kept the picture.
 */
export function streamAt(seed: number, n: number): Rng {
  return rng((seed + Math.imul(n, 0x6D2B79F5)) >>> 0);
}
/**
 * A set's streams: const own = streams(SEED, PINS); then own('house', row, i) is that element's stream. A key found in
 * `pins` (an object, 'house/3/0' -> n: the keys joined by '/') keeps the draws it had when the set shared one stream,
 * streamAt(seed, n); any other key gets stream(seed, ...keys). Delete a pin to re-roll that element.
 */
export function streams(seed: number, pins: Record<string, number> = {}): Streams {
  return (...keys) => {
    const n = pins[keys.join('/')];
    return Number.isInteger(n) ? streamAt(seed, n) : stream(seed, ...keys);
  };
}
export function clamp01(x: number): number { return Math.min(1, Math.max(0, x)); }
export function smooth(a: number, b: number, x: number): number { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
export function mix(a: number, b: number, t: number): number { return a + (b - a) * t; }
export function mix3(A: RGB, B: RGB, t: number): RGB { return [mix(A[0], B[0], t), mix(A[1], B[1], t), mix(A[2], B[2], t)]; }

// ---------------------------------------------------------------- inks and light colour (palette-aware)
// Every colour is cool or neutral; timber brown only ever at mid-to-dark values on small areas (never a pale wash,
// which would read as beige). Under 'ink' the colours become greys of the same value.
const BASE: Record<InkName, RGB> = {
  ink: [20, 24, 27], ink2: [42, 48, 52], wall: [236, 238, 235], white: [246, 247, 244], paper: [239, 241, 238], mist: [233, 237, 236],
  tile: [56, 78, 98], timber: [76, 96, 128], timberM: [140, 168, 200], indigo: [44, 78, 104], indigoP: [150, 180, 204],
  mal: [139, 200, 196], malD: [36, 128, 132], az: [156, 196, 224], earth: [120, 128, 134],
  // d5: the young palette's figure inks (navy ink for near accents, jade, the one blossom accent)
  navy: [27, 40, 60], jade: [64, 160, 160], jadeD: [24, 98, 104], blossom: [244, 190, 212], blossomD: [206, 120, 158], light: [251, 254, 255],
};
/** The inks' names (Inks.C). */
export type InkName = 'ink' | 'ink2' | 'wall' | 'white' | 'paper' | 'mist' | 'tile' | 'timber' | 'timberM' | 'indigo' | 'indigoP' | 'mal' | 'malD' | 'az' | 'earth' | 'navy' | 'jade' | 'jadeD' | 'blossom' | 'blossomD' | 'light';
export function inks(palette: string): Inks {
  const strength = PALETTES[paletteName(palette)].figures;   // 0 ink, 1 misted, 1.25 rich
  const grey = (c: RGB): RGB => { const l = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; return [l - 2, l, l + 2]; };
  const tone = (c: RGB) => (strength <= 0 ? grey(c) : strength > 1 ? mix3(grey(c), c, Math.min(1.2, strength)) : mix3(grey(c), c, 0.85 + 0.15 * strength));
  const C = {} as Record<InkName, RGB>;
  for (const k in BASE) C[k as InkName] = tone(BASE[k as InkName]);
  const rgba = (c: RGB, a: number) => `rgba(${Math.round(Math.min(255, Math.max(0, c[0])))},${Math.round(Math.min(255, Math.max(0, c[1])))},${Math.round(Math.min(255, Math.max(0, c[2])))},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
  return { C, rgba, strength, colourK: Math.min(1.25, strength) };
}

// ---------------------------------------------------------------- the brush kit
// Resample a polyline every `step` px.
export function resample(pts: Pt[], step: number): Pt[] {
  const out: Pt[] = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const L = Math.hypot(x1 - x0, y1 - y0);
    if (!L) continue;
    let t = step - acc;
    while (t <= L) { out.push([x0 + (x1 - x0) * t / L, y0 + (y1 - y0) * t / L]); t += step; }
    acc = (acc + L) % step;
  }
  const last = pts[pts.length - 1];
  const e = out[out.length - 1];
  if (out.length === 1 || Math.hypot(e[0] - last[0], e[1] - last[1]) > step * 0.3) out.push(last);
  return out;
}
/**
 * A brush stroke: a loaded start, a thinning tail, a width that breathes along it, and (dry) gaps where the brush
 * ran out. pts in world px. o: w (width), col, wob (width wobble), tin / tout (taper lengths, fractions), min (the
 * thinnest width), dry (0..1: how much it breaks up), seed.
 */
export interface StrokeOptions {
  w?: number;
  col?: string;
  wob?: number;
  tin?: number;
  tout?: number;
  min?: number;
  dry?: number;
  seed?: number;
}
export function stroke(ctx: Ctx2D, pts: Pt[], o: StrokeOptions = {}): void {
  const w = o.w ?? 1.2, col = o.col ?? 'rgba(20,24,27,0.85)', wob = o.wob ?? 0.3, seed = o.seed ?? 1;
  const tIn = o.tin ?? 0.12, tOut = o.tout ?? 0.4, minW = o.min ?? 0.28, dry = o.dry ?? 0;
  const P = resample(pts, Math.max(0.5, Math.min(1.6, w * 0.8)));
  const n = P.length;
  if (n < 2) return;
  const Lp: Pt[] = [], Rp: Pt[] = [], on: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    let tw = Math.min(1, minW + (1 - minW) * smooth(0, tIn, t)) * Math.min(1, minW + (1 - minW) * (1 - smooth(1 - tOut, 1, t)));
    tw *= 1 + wob * (vnoise(i * 0.21, seed * 1.3, 77) - 0.5) * 2;
    const hw = Math.max(0.12, w * tw * 0.5);
    const j = (vnoise(i * 0.17, seed, 79) - 0.5) * w * 0.25;   // the brush never runs on a ruler
    Lp.push([P[i][0] + nx * (hw + j), P[i][1] + ny * (hw + j)]);
    Rp.push([P[i][0] - nx * (hw - j), P[i][1] - ny * (hw - j)]);
    on.push(dry <= 0 || vnoise(i * 0.13, seed + 5.5, 81) > dry * (0.45 + 0.55 * t));
  }
  ctx.fillStyle = col;
  let s = 0;
  while (s < n - 1) {
    while (s < n - 1 && !on[s]) s++;
    let e = s;
    while (e < n - 1 && on[e + 1]) e++;
    if (e > s) {
      ctx.beginPath();
      ctx.moveTo(Lp[s][0], Lp[s][1]);
      for (let i = s + 1; i <= e; i++) ctx.lineTo(Lp[i][0], Lp[i][1]);
      for (let i = e; i >= s; i--) ctx.lineTo(Rp[i][0], Rp[i][1]);
      ctx.closePath();
      ctx.fill();
    }
    s = e + 1;
  }
}
/** Split a polyline into runs of minLen..maxLen world px with gaps of about `gap` between them. */
export function runs(pts: Pt[], R: Rng, minLen: number, maxLen: number, gap: number): Pt[][] {
  const out: Pt[][] = [];
  let cur: Pt[] = [], len = 0, want = minLen + R() * (maxLen - minLen), skip = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (skip > 0) { skip -= d; continue; }
    cur.push(pts[i - 1]);
    len += d;
    if (len >= want) {
      cur.push(pts[i]);
      if (cur.length > 1) out.push(cur);
      cur = []; len = 0; want = minLen + R() * (maxLen - minLen); skip = gap * (0.4 + R() * 1.2);
    }
  }
  if (cur.length > 1) out.push(cur);
  return out;
}
/** Dry brush: the stroke split into bristles that break up (flying white). */
export function dryBrush(ctx: Ctx2D, pts: Pt[], o: { w?: number; col?: string; bristles?: number; seed?: number; thr?: number } = {}): void {
  const w = o.w ?? 3, col = o.col ?? 'rgba(20,24,27,0.5)', nb = o.bristles ?? 5, seed = o.seed ?? 3, thr = o.thr ?? 0.42;
  const P = resample(pts, 0.7);
  const n = P.length;
  if (n < 3) return;
  ctx.strokeStyle = col;
  for (let b = 0; b < nb; b++) {
    const off = (b / Math.max(1, nb - 1) - 0.5) * w;
    ctx.lineWidth = Math.max(0.3, (w / nb) * 1.2 * (0.7 + 0.6 * hash2(b, seed, 3)));
    let on = false;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const a = P[Math.max(0, i - 1)], c = P[Math.min(n - 1, i + 1)];
      let nx = -(c[1] - a[1]), ny = c[0] - a[0];
      const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const taper = 1 - 0.55 * t;
      const x = P[i][0] + nx * off * taper, y = P[i][1] + ny * off * taper;
      const keep = vnoise(i * 0.11, b * 3.1 + seed, 55) > thr + 0.3 * t * t;
      if (keep && !on) { ctx.moveTo(x, y); on = true; } else if (keep) ctx.lineTo(x, y); else on = false;
    }
    ctx.stroke();
  }
}
/** A wash: a filled shape whose edge wanders a little, with the faint darker line where the pigment pooled. */
export interface WashOptions {
  jit?: number;
  seed?: number;
  edge?: string | null;
  edgeW?: number;
}
export function wash(ctx: Ctx2D, pts: Pt[], col: string | CanvasGradient, o: WashOptions = {}): void {
  const jit = o.jit ?? 0.35, seed = o.seed ?? 7;
  const q = jit > 0 ? pts.map(([x, y], i): Pt => [x + (hash2(i, seed, 11) - 0.5) * jit, y + (hash2(i, seed, 13) - 0.5) * jit]) : pts;
  ctx.beginPath();
  ctx.moveTo(q[0][0], q[0][1]);
  for (let i = 1; i < q.length; i++) ctx.lineTo(q[i][0], q[i][1]);
  ctx.closePath();
  ctx.fillStyle = col;
  ctx.fill();
  if (o.edge) {
    ctx.strokeStyle = o.edge;
    ctx.lineWidth = o.edgeW ?? 0.5;
    ctx.stroke();
  }
}
/** A soft wash (ink wicking into wet paper): blurred where the context can, else a few stacked, offset fills. */
export function softWash(env: Env, pts: Pt[], col: string, r: number, o: WashOptions = {}): void {
  const { ctx } = env;
  if (env.softOK && r > 0) {
    ctx.save();
    ctx.filter = `blur(${(r * env.k).toFixed(2)}px)`;
    wash(ctx, pts, col, { ...o, edge: null });
    ctx.restore();
    return;
  }
  const n = 4;
  const m = /rgba\((\d+),(\d+),(\d+),([\d.]+)\)/.exec(col);
  const a = m ? +m[4] : 1;
  const c = m ? `rgba(${m[1]},${m[2]},${m[3]},${(1 - Math.pow(1 - a, 1 / n)).toFixed(3)})` : col;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const dx = Math.cos(ang) * r * 0.5, dy = Math.sin(ang) * r * 0.5;
    wash(ctx, pts.map(([x, y]): Pt => [x + dx, y + dy]), c, { ...o, edge: null, seed: (o.seed ?? 7) + i });
  }
}
// ---------------------------------------------------------------- figures (people)
/**
 * A tiny standing figure, Song manner: a robe (a soft trapezoid), a dark head with a top-knot or a cone hat, a
 * light line at the robe's edge. (x, y) = the feet; s = scale (1 ~ 10 px tall). Never walking in 4a.
 */
export interface PersonOptions {
  lean?: number;
  wide?: boolean;
  robe?: RGB;
  flip?: boolean;
  outline?: number;
  arm?: 'up' | 'down';
  hat?: 'cone';
  pole?: boolean;
  staff?: boolean;
  punt?: boolean;
  /** A rope pulled toward this point. */
  pull?: Pt;
}
export function person(env: Env, x: number, y: number, s: number, R: Rng, o: PersonOptions = {}): void {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const lean = o.lean ?? (R() - 0.5) * 0.22;
  const h = 10 * s;
  const sx = x + Math.sin(lean) * h * 0.7, sy = y - h * 0.68;   // shoulders
  const wide = (o.wide ? 4.6 : 3.7) * s;
  const robes = [C.white, C.white, C.white, C.indigoP, C.indigoP, mix3(C.ink2, C.white, 0.55), C.white];
  const robe = o.robe || robes[Math.floor(R() * robes.length)];
  const dir = o.flip ? -1 : 1;
  const hem: Pt[] = [[x + wide * 0.5 + (R() - 0.5) * s * 0.6, y - 0.6 * s], [x - wide * 0.5 + (R() - 0.5) * s * 0.6, y - 0.6 * s]];
  const body: Pt[] = [[sx - 1.05 * s, sy + 0.2 * s], [sx + 1.1 * s, sy + 0.1 * s], hem[0], hem[1]];
  wash(ctx, body, rgba(robe, 0.96), { jit: 0.25 * s, seed: x * 7 + y });
  // the robe's edges: light, broken lines (a white robe needs them to exist at all on pale paper)
  const line = rgba(C.ink, o.outline ?? 0.62);
  stroke(ctx, [body[0], hem[1]], { w: 0.5 * s, col: line, wob: 0.4, seed: x, tin: 0.05, tout: 0.3 });
  stroke(ctx, [body[1], hem[0]], { w: 0.42 * s, col: rgba(C.ink, 0.45), wob: 0.4, seed: y, tin: 0.05, tout: 0.4 });
  // a sash
  stroke(ctx, [[sx - 0.9 * s, sy + 2.5 * s], [sx + 1.0 * s, sy + 2.3 * s]], { w: 0.45 * s, col: rgba(C.ink2, 0.45), tin: 0, tout: 0.2 });
  // feet under the hem
  stroke(ctx, [[x - 0.9 * s, y - 0.7 * s], [x - 1.1 * s, y + 0.1 * s]], { w: 0.55 * s, col: rgba(C.ink, 0.85), tin: 0, tout: 0.1 });
  stroke(ctx, [[x + 0.7 * s, y - 0.7 * s], [x + 0.95 * s, y + 0.1 * s]], { w: 0.55 * s, col: rgba(C.ink, 0.85), tin: 0, tout: 0.1 });
  // an arm: hanging, or raised (pointing, shading the eyes)
  const arm = o.arm ?? (R() < 0.3 ? 'up' : 'down');
  if (arm === 'up') stroke(ctx, [[sx + dir * 0.9 * s, sy + 0.8 * s], [sx + dir * 2.3 * s, sy - 0.9 * s]], { w: 0.55 * s, col: rgba(C.ink, 0.6) });
  else stroke(ctx, [[sx + dir * 0.95 * s, sy + 0.6 * s], [sx + dir * 1.5 * s, sy + 3.6 * s]], { w: 0.5 * s, col: rgba(C.ink, 0.5) });
  // head: a pale face under dark hair, a top-knot (or a cone hat)
  const hx = sx + Math.sin(lean) * 2.2 * s, hy = sy - 1.6 * s;
  ctx.fillStyle = rgba(mix3(C.white, C.ink2, 0.12), 0.97);
  ctx.beginPath(); ctx.arc(hx, hy, 1.05 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = rgba(C.ink, 0.92);
  ctx.beginPath(); ctx.arc(hx - dir * 0.2 * s, hy - 0.3 * s, 0.95 * s, Math.PI * 0.92, Math.PI * 2.08); ctx.fill();
  if (o.hat === 'cone') {
    const brim = 2.9 * s;
    wash(ctx, [[hx - brim, hy - 0.15 * s], [hx + brim, hy - 0.35 * s], [hx + 0.2 * s, hy - 2.2 * s]], rgba(mix3(C.white, C.ink2, 0.28), 0.97), { jit: 0.15 * s });
    stroke(ctx, [[hx - brim, hy - 0.15 * s], [hx + 0.2 * s, hy - 2.2 * s], [hx + brim, hy - 0.35 * s]], { w: 0.42 * s, col: rgba(C.ink, 0.7), tin: 0.08, tout: 0.15 });
  } else {
    ctx.beginPath(); ctx.arc(hx + dir * 0.1 * s, hy - 1.15 * s, 0.5 * s, 0, Math.PI * 2); ctx.fill();
  }
  if (o.pole) {   // a carrying pole with two loads
    const a: Pt = [sx - 5.5 * s, sy + 0.4 * s], b: Pt = [sx + 5.5 * s, sy - 0.3 * s];
    stroke(ctx, [a, b], { w: 0.5 * s, col: rgba(C.ink, 0.85), tin: 0.05, tout: 0.05 });
    for (const p of [a, b]) {
      stroke(ctx, [p, [p[0], p[1] + 3 * s]], { w: 0.28 * s, col: rgba(C.ink, 0.5), tin: 0, tout: 0 });
      wash(ctx, [[p[0] - 1.4 * s, p[1] + 3 * s], [p[0] + 1.4 * s, p[1] + 3 * s], [p[0] + 1.1 * s, p[1] + 5 * s], [p[0] - 1.1 * s, p[1] + 5 * s]], rgba(C.timber, 0.75));
    }
  }
  if (o.staff) stroke(ctx, [[sx + dir * 1.8 * s, sy - 0.6 * s], [x + dir * 2.4 * s, y + 0.2 * s]], { w: 0.45 * s, col: rgba(C.ink, 0.9), tin: 0, tout: 0.05 });
  if (o.punt) stroke(ctx, [[sx + dir * 1.5 * s, sy - 3.2 * s], [sx - dir * 6.5 * s, y + 8.5 * s]], { w: 0.5 * s, col: rgba(C.ink, 0.9), tin: 0.05, tout: 0.3 });
  if (o.pull) stroke(ctx, [[sx + dir * 0.9 * s, sy + 0.4 * s], o.pull], { w: 0.28 * s, col: rgba(C.ink, 0.55), tin: 0, tout: 0 });
}

// ---------------------------------------------------------------- trees
/** A tree in dots (an ink cluster of short dabs on a crooked trunk). (x, y) = the foot. */
export function dotTree(env: Env, x: number, y: number, s: number, R: Rng, o: { green?: boolean; clusters?: number } = {}): void {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const H = 20 * s;
  const lean = (R() - 0.5) * 5 * s;
  stroke(ctx, [[x, y + 0.5], [x + lean * 0.4 + (R() - 0.5) * 2 * s, y - H * 0.5], [x + lean, y - H * 0.85]], { w: 1.7 * s, col: rgba(C.ink, 0.85), tin: 0, tout: 0.7, wob: 0.5, seed: x });
  const leaf = o.green && ink.strength > 0 ? mix3(C.ink, C.malD, 0.35) : C.ink;
  const clusters = o.clusters ?? 4;
  for (let c = 0; c < clusters; c++) {
    const cx = x + lean * 0.8 + (R() - 0.5) * 12 * s, cy = y - H * (0.62 + R() * 0.4);
    for (let i = 0; i < 18; i++) {
      const px = cx + (R() - 0.5) * 10 * s, py = cy + (R() - 0.5) * 5.5 * s;
      const a = (R() - 0.5) * 0.6;
      stroke(ctx, [[px - 1.1 * s, py + a], [px + 1.1 * s, py - a - 0.3 * s]], { w: 1.15 * s, col: rgba(leaf, 0.3 + R() * 0.4), tin: 0.2, tout: 0.6, wob: 0.3, seed: i + c * 31 });
    }
  }
}
/** A pine: a leaning trunk and flat, layered needle masses (dark ink). */
export function pine(env: Env, x: number, y: number, s: number, R: Rng): void {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const H = 24 * s;
  const lean = (R() < 0.5 ? -1 : 1) * (2 + R() * 3) * s;
  const top: Pt = [x + lean, y - H];
  stroke(ctx, [[x, y + 0.5], [x + lean * 0.3, y - H * 0.45], top], { w: 1.6 * s, col: rgba(C.ink, 0.9), tin: 0, tout: 0.5, wob: 0.4, seed: x * 3 });
  for (let i = 0; i < 4; i++) {
    const t = 0.45 + i * 0.17;
    const bx = x + lean * t, by = y - H * t;
    const wdt = (7 - i * 1.3) * s;
    for (let j = 0; j < 9; j++) {
      const px = bx + (R() - 0.5) * wdt * 2, py = by + (R() - 0.5) * 1.6 * s;
      stroke(ctx, [[px - 1.6 * s, py + 0.5 * s], [px, py - 0.7 * s], [px + 1.6 * s, py + 0.5 * s]], { w: 0.75 * s, col: rgba(C.ink, 0.35 + R() * 0.35), tin: 0.1, tout: 0.4, seed: j + i * 11 });
    }
  }
}
/**
 * A willow, the way the scroll paints them: a thick, leaning, gnarled trunk that forks low, boughs that arch up and
 * out and then droop, and long cascades of strands in misted malachite falling from their outer halves, longest
 * where the boughs droop furthest, so the tree has the shape of a fountain, never a box. A few strands are darker.
 * (x, y) = the foot. Returns { box }: the box its trunk, boughs and strands cover (world px; a willow life anchor).
 */
export function willow(env: Env, x: number, y: number, s: number, R: Rng, o: { lean?: number; sway?: number } = {}): { box: Box } {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const lean = o.lean ?? (R() < 0.5 ? -1 : 1) * (0.15 + R() * 0.3);
  const H = 22 * s;
  // the trunk: thick at the foot, bending, forking at ~60%
  const trunk: Pt[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    trunk.push([x + lean * H * 0.6 * t * t + (vnoise(t * 3, x, 4) - 0.5) * 3.2 * s, y - H * t]);
  }
  const fork = trunk[5];
  const limbs: Pt[][] = [trunk.slice(5), [fork, [fork[0] - lean * 5 * s - 3 * s, fork[1] - H * 0.25], [fork[0] - lean * 7 * s - 6 * s, fork[1] - H * 0.42]]];
  // boughs from the top of each limb: up and out, then drooping
  const boughs: { pts: Pt[]; side: number }[] = [];
  for (const limb of limbs) {
    const top = limb[limb.length - 1];
    const nb = 3 + Math.floor(R() * 2);
    for (let b = 0; b < nb; b++) {
      const side = (b / (nb - 1) - 0.5) * 2 + (R() - 0.5) * 0.4;   // -1 .. 1
      const reach = (10 + R() * 9) * s;
      const up = (4 + R() * 5) * s * (1 - 0.5 * Math.abs(side));
      const p1: Pt = [top[0] + side * reach * 0.45, top[1] - up];
      const p2: Pt = [top[0] + side * reach, top[1] - up * 0.4 + 2.5 * s];
      boughs.push({ pts: [top, p1, p2], side });
    }
  }
  const leafC = ink.strength > 0 ? C.mal : mix3(C.ink2, C.white, 0.45);
  const leafD = ink.strength > 0 ? mix3(C.malD, C.ink, 0.35) : C.ink2;
  // a very faint mass behind the strands (the tree's shade), shaped like the fountain
  const crownX = mix(limbs[0][limbs[0].length - 1][0], limbs[1][2][0], 0.5);
  const crownY = Math.min(limbs[0][limbs[0].length - 1][1], limbs[1][2][1]);
  softWash(env, [[crownX - 15 * s, crownY + 4 * s], [crownX, crownY - 6 * s], [crownX + 15 * s, crownY + 4 * s], [crownX + 19 * s, crownY + 22 * s], [crownX - 19 * s, crownY + 22 * s]], rgba(leafC, 0.08), 4 * s);
  // the cascades
  const sway = (o.sway ?? 1) * s * 0.6;
  const strands: Pt[][] = [];
  for (const { pts: [a, m, b], side } of boughs) {
    const n = 15 + Math.floor(R() * 8);
    for (let k = 0; k < n; k++) {
      const t = 0.35 + 0.65 * Math.pow(R(), 0.7);              // mostly from the bough's outer half
      const p: Pt = t < 0.5 ? [mix(a[0], m[0], t * 2), mix(a[1], m[1], t * 2)] : [mix(m[0], b[0], t * 2 - 1), mix(m[1], b[1], t * 2 - 1)];
      const maxL = (22 + 16 * Math.abs(side)) * s;           // the drooping ends hang longest
      const len = maxL * (0.35 + 0.65 * R()) * (0.55 + 0.45 * t);
      const out = side * (0.6 + R() * 0.8) * s;               // a slight outward curve before the strand falls
      const dark = R() < 0.22;
      const strand: Pt[] = [p, [p[0] + out * 1.5, p[1] + len * 0.18], [p[0] + out * 2 + sway * 0.3, p[1] + len * 0.6], [p[0] + out * 2.1 + sway, p[1] + len]];
      strands.push(strand);
      stroke(ctx, strand, {
        w: (dark ? 0.5 : 0.68) * s, col: dark ? rgba(leafD, 0.5) : rgba(leafC, 0.36 + R() * 0.3), tin: 0.04, tout: 0.9, wob: 0.3, min: 0.1, seed: k * 7 + x,
      });
    }
  }
  for (const { pts } of boughs) stroke(ctx, pts, { w: 1.2 * s, col: rgba(C.ink, 0.72), tin: 0.02, tout: 0.85, wob: 0.45, seed: pts[2][0] });
  stroke(ctx, limbs[1], { w: 2.2 * s, col: rgba(C.ink, 0.88), tin: 0, tout: 0.6, wob: 0.4, seed: x + 1 });
  stroke(ctx, trunk, { w: 4.6 * s, col: rgba(C.ink, 0.92), tin: 0.0, tout: 0.5, wob: 0.5, seed: x });
  dryBrush(ctx, trunk.slice(0, 6).map(([a, b]): Pt => [a + 1.2 * s, b]), { w: 2.8 * s, col: rgba(mix3(C.ink, C.white, 0.35), 0.55), bristles: 3, seed: x, thr: 0.5 });
  stroke(ctx, [[x - 5 * s, y + 0.8], [x + 6 * s, y + 0.3]], { w: 1.5 * s, col: rgba(C.ink, 0.42), tin: 0.2, tout: 0.6 });   // its foot on the ground
  return { box: bounds([trunk, limbs[1], ...boughs.map((b) => b.pts), ...strands], 1.5 * s) };
}
export function ellipse(cx: number, cy: number, rx: number, ry: number, n: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  return pts;
}

// ---------------------------------------------------------------- buildings (Song oblique projection)
export const D: Pt = [0.72, -0.48];    // one unit of depth on screen: we see fronts, tops and right-hand sides
/**
 * A Song house: an open shopfront (or plain wall), timber posts, and a big hip-gable roof in grey tile with a dark
 * ridge and gently lifted eave corners. (x, y) = front-left foot; w width, h wall height. o.far: paler and simpler
 * (the back rows, half lost in mist).
 */
export interface HouseOptions {
  /** 0 front row .. 1 far back row. */
  far?: number;
  d?: number;
  rh?: number;
  ov?: number;
  wall?: number;
  shop?: boolean;
  wideShop?: boolean;
  storey?: boolean;
  thatch?: boolean;
  awning?: boolean;
}
export function house(env: Env, x: number, y: number, w: number, h: number, R: Rng, o: HouseOptions = {}): { eave: Pt[]; rL: Pt; rR: Pt } {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const far = o.far ?? 0;                     // 0 front row .. 1 far back row
  const A = 1 - 0.45 * far;                   // paleness by depth
  const d = o.d ?? w * (0.42 + R() * 0.2);
  const ox = D[0] * d, oy = D[1] * d;
  const rh = o.rh ?? h * (0.55 + R() * 0.2);  // roof height
  const ov = o.ov ?? w * (0.09 + R() * 0.04); // eave overhang
  const sk = (R() - 0.5) * 0.6;               // a slight skew: no two alike
  // reserve the paper: a near house hides what is behind it
  wash(ctx, [[x - ov, y + 0.6], [x + w, y + 0.6], [x + w + ox, y + oy + 0.6], [x + w + ov + ox, y - h + oy], [x + w * 0.84 + ox * 0.5, y - h - rh + oy * 0.5], [x + w * 0.16 + ox * 0.5, y - h - rh + oy * 0.5], [x - ov, y - h]], rgba(C.paper, A), { jit: 0.3 });
  // walls: front (lime-washed, cool), right side (in shade)
  const wallC = mix3(C.wall, C.ink2, (o.wall ?? 0) + 0.05 + R() * 0.12 + far * 0.08);
  wash(ctx, [[x + w, y], [x + w + ox, y + oy], [x + w + ox, y + oy - h], [x + w, y - h]], rgba(mix3(wallC, C.ink2, 0.24), 0.95 * A), { jit: 0.4, seed: x });
  wash(ctx, [[x, y], [x + w, y], [x + w + sk, y - h], [x + sk, y - h]], rgba(wallC, 0.97 * A), { jit: 0.4, seed: x + 1 });
  if (far < 0.8) {   // the wall's edges, drawn: a broken line, never a clean box
    stroke(ctx, [[x + sk, y - h], [x, y]], { w: 0.55, col: rgba(C.ink, 0.42 * A), tin: 0.05, tout: 0.2, dry: 0.35, seed: x + 5 });
    stroke(ctx, [[x + w + sk, y - h], [x + w, y]], { w: 0.5, col: rgba(C.ink, 0.38 * A), tin: 0.05, tout: 0.2, dry: 0.35, seed: x + 6 });
  }
  if (o.shop !== false && far < 0.6) {
    // an open shopfront: the dark interior, a counter, the goods
    const s0 = x + w * (0.1 + R() * 0.06), s1 = x + w * (o.wideShop ? 0.9 : 0.55 + R() * 0.12);
    wash(ctx, [[s0, y - h * 0.14], [s1, y - h * 0.14], [s1, y - h * 0.86], [s0, y - h * 0.86]], rgba(mix3(C.ink2, C.wall, 0.35), 0.62 * A), { jit: 0.5, seed: x + 2 });
    stroke(ctx, [[s0 - 0.6, y - h * 0.36], [s1 + 0.6, y - h * 0.38]], { w: 0.9, col: rgba(C.timber, 0.85 * A), tin: 0, tout: 0, wob: 0.2 });
    for (let i = 0; i < 4; i++) { if (R() < 0.4) continue; ctx.fillStyle = rgba(i % 2 ? C.ink2 : C.indigoP, 0.6 * A); ctx.beginPath(); ctx.arc(mix(s0, s1, 0.15 + i * 0.22), y - h * 0.44, 0.7, 0, Math.PI * 2); ctx.fill(); }
  } else if (far < 0.8 && R() < 0.6) {
    // a lattice window
    const wx = x + w * (0.25 + R() * 0.3), ww = w * 0.22;
    wash(ctx, [[wx, y - h * 0.4], [wx + ww, y - h * 0.4], [wx + ww, y - h * 0.75], [wx, y - h * 0.75]], rgba(mix3(C.ink2, C.wall, 0.5), 0.5 * A));
  }
  // posts and the sill (timber)
  if (far < 0.7) {
    const posts = Math.max(2, Math.round(w / 13) + 1);
    for (let i = 0; i < posts; i++) {
      const px = x + (w * i) / (posts - 1) + (R() - 0.5) * 0.5;
      stroke(ctx, [[px, y + 0.3], [px + sk, y - h]], { w: 0.75, col: rgba(mix3(C.timber, C.ink, 0.4), 0.75 * A), tin: 0, tout: 0.1, wob: 0.2, seed: px });
    }
    stroke(ctx, [[x + w + ox, y + oy], [x + w + ox, y + oy - h]], { w: 0.6, col: rgba(C.ink, 0.5 * A), tin: 0, tout: 0 });
  }
  stroke(ctx, [[x - 0.6, y + 0.4], [x + w + 0.5, y + 0.3], [x + w + ox, y + oy + 0.3]], { w: 0.8, col: rgba(C.ink, 0.45 * A), tin: 0.05, tout: 0.1, dry: 0.2 });
  if (o.storey && far < 0.5) {   // an upper storey: a balcony rail and a lower eave
    const my = y - h * 0.52;
    stroke(ctx, [[x - w * 0.06, my], [x + w * 1.06, my]], { w: 1.1, col: rgba(C.ink, 0.85), tin: 0.05, tout: 0.05 });
    wash(ctx, [[x - w * 0.08, my], [x + w * 1.08, my], [x + w * 1.0, my - h * 0.1], [x, my - h * 0.1]], rgba(C.tile, 0.62));
    for (let i = 0; i < 9; i++) stroke(ctx, [[x + w * (0.06 + i * 0.11), my - h * 0.13], [x + w * (0.06 + i * 0.11), my - h * 0.25]], { w: 0.4, col: rgba(C.ink, 0.5), tin: 0, tout: 0 });
  }
  // the roof: front slope, the hip on the right, the ridge with lifted ends, eaves lifted at the corners
  const ey = y - h + 0.6;
  const lift = Math.max(0.9, w * (0.03 + R() * 0.015));
  const eave: Pt[] = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const ex = x - ov + sk + (w + 2 * ov) * t;
    const sag = Math.sin(Math.PI * t) * lift * 0.45 - Math.pow(Math.abs(t * 2 - 1), 6) * lift;
    eave.push([ex, ey + sag]);
  }
  const rL: Pt = [x + w * (0.15 + R() * 0.04) + ox * 0.5 + sk, y - h - rh + oy * 0.5];
  const rR: Pt = [x + w * (0.85 - R() * 0.04) + ox * 0.5 + sk, y - h - rh + oy * 0.5];
  const eB: Pt = [x + w + ov + ox + sk, ey + oy - lift];
  const eF = eave[eave.length - 1];
  const tile = o.thatch ? mix3(C.timber, C.ink2, 0.45) : mix3(C.tile, C.white, 0.08 + R() * 0.14 + far * 0.25);
  wash(ctx, [eF, eB, rR], rgba(mix3(tile, C.ink, 0.3), 0.86 * A), { jit: 0.4, seed: x + 3 });
  wash(ctx, [...eave, rR, rL], rgba(tile, (o.thatch ? 0.72 : 0.68) * A), { jit: 0.4, seed: x + 4 });
  // tile rows down the slope near the eave (a few, broken); thatch: streaks
  if (far < 0.75) {
    ctx.save();
    ctx.beginPath(); ctx.moveTo(eave[0][0], eave[0][1]); for (const p of eave) ctx.lineTo(p[0], p[1]); ctx.lineTo(rR[0], rR[1]); ctx.lineTo(rL[0], rL[1]); ctx.closePath(); ctx.clip();
    const rows = Math.max(4, Math.round(w / 2.6));
    for (let i = 1; i < rows; i++) {
      const t = i / rows;
      const ex = x - ov + sk + (w + 2 * ov) * t;
      const tx = mix(rL[0], rR[0], t) + (R() - 0.5) * 0.6;
      if (vnoise(i * 0.7, x * 0.1, 9) < 0.32) continue;
      const len = 0.35 + 0.4 * R();
      stroke(ctx, [[ex, ey + 0.6], [mix(ex, tx, len), mix(ey, rL[1], len)]], { w: 0.42, col: rgba(C.ink, (o.thatch ? 0.28 : 0.3) * A), tin: 0, tout: 0.6 });
    }
    ctx.restore();
  }
  // the roof's lines: the eave (strong), the hip, the ridge with its lifted ends (strongest)
  stroke(ctx, eave, { w: 1.05, col: rgba(C.ink, 0.88 * A), tin: 0.06, tout: 0.08, wob: 0.3, seed: x * 0.1 });
  stroke(ctx, [eF, eB], { w: 0.75, col: rgba(C.ink, 0.8 * A), tin: 0.05, tout: 0.2 });
  stroke(ctx, [eF, rR], { w: 0.6, col: rgba(C.ink, 0.6 * A), tin: 0.05, tout: 0.1, dry: 0.15 });
  stroke(ctx, [eave[0], rL], { w: 0.55, col: rgba(C.ink, 0.5 * A), tin: 0.05, tout: 0.1, dry: 0.2 });
  stroke(ctx, [[rL[0] - 1.3, rL[1] - 1.1], [rL[0], rL[1]], [rR[0], rR[1]], [rR[0] + 1.3, rR[1] - 1.1]], { w: 1.6, col: rgba(C.ink, 0.9 * A), tin: 0.12, tout: 0.12, wob: 0.25 });
  if (o.awning && far < 0.4) {   // a cloth shade on two poles over the street
    const a0 = x + w * 0.06, a1 = x + w * 0.82, ay = y - h * 0.8, fy = y + h * 0.5, fx = -w * 0.03;
    const cl = R() < 0.5 ? C.white : C.indigoP;
    wash(ctx, [[a0, ay], [a1, ay], [a1 + fx, fy - h * 0.6], [a0 + fx, fy - h * 0.6]], rgba(cl, 0.93));
    stroke(ctx, [[a0 + fx, fy - h * 0.6], [a1 + fx, fy - h * 0.6]], { w: 0.7, col: rgba(C.ink, 0.8), tin: 0.05, tout: 0.05 });
    stroke(ctx, [[a0 + fx, fy - h * 0.6], [a0 + fx, fy]], { w: 0.55, col: rgba(C.ink, 0.8), tin: 0, tout: 0 });
    stroke(ctx, [[a1 + fx, fy - h * 0.6], [a1 + fx, fy]], { w: 0.55, col: rgba(C.ink, 0.8), tin: 0, tout: 0 });
  }
  return { eave, rL, rR };
}

/** A market parasol over a little stall. (x, y) = the pole's foot. */
export function parasol(env: Env, x: number, y: number, s: number, R: Rng): void {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const lean = (R() - 0.5) * 2 * s;
  const top: Pt = [x + lean, y - 14 * s];
  const rx = (9 + R() * 3) * s, ry = 2.8 * s;
  stroke(ctx, [[x, y], top], { w: 0.65 * s, col: rgba(C.ink, 0.85), tin: 0, tout: 0 });
  wash(ctx, [[x - 5.5 * s, y - 3.4 * s], [x + 5.5 * s, y - 3.4 * s], [x + 6.2 * s, y - 2.4 * s], [x - 4.8 * s, y - 2.4 * s]], rgba(C.timber, 0.8));
  for (let i = 0; i < 5; i++) { ctx.fillStyle = rgba(i % 2 ? C.ink2 : C.indigoP, 0.7); ctx.beginPath(); ctx.arc(x - 4 * s + i * 2 * s, y - 4 * s, 0.7 * s, 0, Math.PI * 2); ctx.fill(); }
  const cc = R() < 0.6 ? C.white : C.indigoP;
  const dome: Pt[] = [];
  for (let i = 0; i <= 16; i++) { const a = Math.PI * (1 + i / 16); dome.push([top[0] + Math.cos(a) * rx, top[1] + 1.5 * s + Math.sin(a) * ry]); }
  const rim: Pt[] = [];
  for (let i = 16; i >= 0; i--) { const a = Math.PI * (i / 16); rim.push([top[0] + Math.cos(a) * rx, top[1] + 1.5 * s + Math.sin(a) * ry * 0.35]); }
  wash(ctx, [...dome, ...rim], rgba(cc, 0.95));
  for (let i = 1; i < 8; i++) stroke(ctx, [top, dome[i * 2]], { w: 0.32 * s, col: rgba(C.ink, 0.32), tin: 0, tout: 0.2 });
  stroke(ctx, dome, { w: 0.7 * s, col: rgba(C.ink, 0.85), tin: 0.05, tout: 0.05 });
  stroke(ctx, rim, { w: 0.5 * s, col: rgba(C.ink, 0.55), tin: 0.05, tout: 0.05 });
}

/**
 * A boat lying along the river: (x, y) = the waterline at the stern (left end); L = length. Its beam runs into
 * depth, so we see the near side, the deck from above, a barrel mat cabin. o.mast: 'up' (moored), 'lowering' (it
 * comes down to the bridge: the mast tilted back on its tabernacle, the crew on the ropes), 'none'. Returns { box }:
 * hull, reflection, cabin, mast and crew (world px; a boat life anchor).
 */
export interface BoatOptions {
  s?: number;
  beam?: number;
  hull?: number;
  cabin?: boolean;
  c0?: number;
  c1?: number;
  ch?: number;
  mast?: 'up' | 'lowering' | 'none';
  mastAngle?: number;
  /** Set by boat() when the mast is lowering: the point the crew's rope is taken in at. */
  masthead?: Pt;
  /** [u along the boat (0..1), w across it (0..1), the person's options; pull: true takes in the mast's rope]. */
  crew?: [u: number, w: number, opt: Omit<PersonOptions, 'pull'> & { pull?: boolean }][];
}
export function boat(env: Env, x: number, y: number, L: number, R: Rng, o: BoatOptions = {}): { box: Box } {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const s = o.s ?? 1;
  const beam = o.beam ?? L * 0.15;
  const DB = [0.66, -0.42];
  const P = (u: number, v: number, w = 0): Pt => [x + u + DB[0] * w, y - v + DB[1] * w];   // u along, v up, w across
  const hh = o.hull ?? 4.4 * s;
  const sheer = (t: number) => hh * (1 + 0.65 * Math.pow(Math.abs(t * 2 - 1), 2.6)) + (t > 0.5 ? (t - 0.5) * hh * 0.5 : 0);
  const N = 18;
  const pinch = (t: number) => Math.pow(Math.sin(Math.PI * (0.04 + 0.92 * t)), 0.45);
  const gN: Pt[] = [], gF: Pt[] = [];
  for (let i = 0; i <= N; i++) { const t = i / N; const p = pinch(t); gN.push(P(L * t, sheer(t), beam * 0.5 * (1 - p))); gF.push(P(L * t, sheer(t), beam * 0.5 * (1 + p))); }
  // its reflection: darker smears torn by ripples
  for (let k = 0; k < 6; k++) {
    const yy = 1.4 + k * 1.5 * s;
    stroke(ctx, [[x + L * (0.06 + R() * 0.08), y + yy], [x + L * (0.5 + R() * 0.1), y + yy + 0.3], [x + L * (0.86 + R() * 0.1), y + yy]], { w: (1.6 - k * 0.2) * s, col: rgba(C.ink2, 0.16 - k * 0.022), tin: 0.25, tout: 0.5, wob: 0.7, dry: 0.3, seed: k + x });
  }
  // the deck seen from above, then the near side of the hull down to the water
  wash(ctx, [...gN, ...gF.slice().reverse()], rgba(mix3(C.timberM, C.white, 0.35), 0.95));
  const side = [...gN];
  for (let i = N; i >= 0; i--) { const t = i / N; side.push(P(L * (0.06 + 0.88 * t), 0, 0)); }
  wash(ctx, side, rgba(C.timber, 0.9), { edge: rgba(C.ink, 0.35) });
  stroke(ctx, side.slice(N + 1), { w: 0.8 * s, col: rgba(C.ink, 0.85), tin: 0.1, tout: 0.2 });
  stroke(ctx, gN, { w: 0.95 * s, col: rgba(C.ink, 0.88), tin: 0.04, tout: 0.08, wob: 0.25 });
  stroke(ctx, gF, { w: 0.5 * s, col: rgba(C.ink, 0.55), tin: 0.05, tout: 0.1 });
  stroke(ctx, gN.map((p): Pt => [p[0], p[1] + hh * 0.5]).slice(2, N - 1), { w: 0.45 * s, col: rgba(C.ink, 0.38), tin: 0.2, tout: 0.3, dry: 0.3 });
  // the barrel mat cabin (grey mats, never beige)
  if (o.cabin !== false) {
    const u0 = L * (o.c0 ?? 0.3), u1 = L * (o.c1 ?? 0.7);
    const ch = o.ch ?? 5 * s, wallH = 2.1 * s;
    const base = (u: number) => sheer(u / L);
    const arch = (u: number) => { const pts: Pt[] = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(P(u, base(u) + wallH + Math.sin(Math.PI * t) * ch, beam * (0.06 + 0.88 * t))); } return pts; };
    const A0 = arch(u0), A1 = arch(u1);
    const mat = mix3(C.tile, C.white, 0.5);
    wash(ctx, [P(u0, base(u0), beam * 0.06), P(u1, base(u1), beam * 0.06), A1[0], A0[0]], rgba(mix3(C.timber, C.ink2, 0.3), 0.92));
    wash(ctx, [...A0, ...A1.slice().reverse()], rgba(mat, 0.95));
    wash(ctx, [...A1, P(u1, base(u1), beam * 0.94), P(u1, base(u1), beam * 0.06)], rgba(mix3(mat, C.ink, 0.35), 0.95));
    const ribs = Math.max(3, Math.round((u1 - u0) / (3.2 * s)));
    for (let i = 1; i < ribs; i++) stroke(ctx, arch(mix(u0, u1, i / ribs)).slice(0, 8), { w: 0.38 * s, col: rgba(C.ink, 0.38), tin: 0.1, tout: 0.3 });
    stroke(ctx, A1, { w: 0.7 * s, col: rgba(C.ink, 0.85), tin: 0.05, tout: 0.05 });
    stroke(ctx, [A0[0], A1[0]], { w: 0.65 * s, col: rgba(C.ink, 0.8), tin: 0.05, tout: 0.1 });
    stroke(ctx, [A0[5], A1[5]], { w: 0.45 * s, col: rgba(C.ink, 0.5), tin: 0.1, tout: 0.1 });
  }
  const reach: Pt[] = [[x, y + 1.4 + 7.5 * s + 1]];   // the reflection's last smear, the masthead, the crew
  if (o.mast === 'up') {
    const m0 = P(L * 0.62, sheer(0.62), beam * 0.5);
    const m1: Pt = [m0[0] + 1.1 * s, m0[1] - L * 0.6];
    reach.push(m1);
    stroke(ctx, [m0, m1], { w: 1.0 * s, col: rgba(C.ink, 0.9), tin: 0, tout: 0.25 });
    stroke(ctx, [m1, P(L * 0.02, sheer(0) + 1, beam * 0.5)], { w: 0.3 * s, col: rgba(C.ink, 0.42), tin: 0, tout: 0 });
    stroke(ctx, [m1, P(L * 0.98, sheer(1) + 1, beam * 0.5)], { w: 0.3 * s, col: rgba(C.ink, 0.42), tin: 0, tout: 0 });
  } else if (o.mast === 'lowering') {
    // the drama of the scroll: the mast is being let down to pass under the bridge, tilted back over the stern
    const m0 = P(L * 0.58, sheer(0.58) + 1.5 * s, beam * 0.5);
    const ang = (o.mastAngle ?? 32) * Math.PI / 180;
    const ml = L * 0.5;
    const m1: Pt = [m0[0] - Math.cos(ang) * ml, m0[1] - Math.sin(ang) * ml];
    reach.push(m1);
    stroke(ctx, [m0, m1], { w: 1.2 * s, col: rgba(C.ink, 0.92), tin: 0.04, tout: 0.2 });
    stroke(ctx, [m0, P(L * 0.58, sheer(0.58), beam * 0.5)], { w: 1.4 * s, col: rgba(C.ink, 0.9), tin: 0, tout: 0 });   // the tabernacle
    // one rope from the masthead forward, taken in by the crew at the bow
    const bow = P(L * 0.86, sheer(0.86) + 6 * s, beam * 0.5);
    stroke(ctx, [m1, [mix(m1[0], bow[0], 0.5), mix(m1[1], bow[1], 0.5) + 2 * s], bow], { w: 0.32 * s, col: rgba(C.ink, 0.55), tin: 0, tout: 0 });
    o.masthead = bow;
  }
  for (const [u, w, opt] of o.crew || []) {
    const p = P(L * u, sheer(u), beam * w);
    person(env, p[0], p[1], s * 0.92, R, { ...opt, pull: opt.pull && o.masthead ? o.masthead : undefined });
    reach.push([p[0] - 7 * s, p[1] - 14 * s], [p[0] + 7 * s, p[1] + 9 * s]);   // a head and hat, a pole
  }
  return { box: bounds([gN, gF, side, reach], 1) };
}

/**
 * The rainbow bridge: a heavy woven-timber arch spanning the river into depth (from the near bank at A, `span` world
 * px along `dir` to the far bank), its deck across x (bw). We see its top, its right-hand face (bundles of timber
 * beams in a polygonal arch, beam ends crossing them), the rails, and the crowd standing on it.
 */
export interface BridgeOptions {
  /** The deck's width (world px), the ramps' length (of the span) and the face's depth. */
  bw?: number;
  ramp?: number;
  T?: number;
  /** The span's direction on screen (into depth). */
  dir?: Pt;
  people?: number;
  fs?: number;
  /** Parasols on the deck: [t along it, w across it]. */
  stalls?: [number, number][];
}
export function bridge(env: Env, A: Pt, span: number, Hb: number, R: Rng, o: BridgeOptions = {}): { deckAt: (t: number, w?: number) => Pt; base: (t: number) => Pt } {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const bw = o.bw ?? 22, ramp = o.ramp ?? 0.16, T = o.T ?? 10;
  const Db = o.dir || [0.9, -0.42];
  const N = 60;
  const base = (t: number): Pt => [A[0] + Db[0] * span * t, A[1] + Db[1] * span * t];
  // the arch: half a polygon of straight beams (the woven timber), half a round curve, so it reads both as built of
  // beams and as the rainbow it is named for
  const K = [0, 0.16, 0.36, 0.64, 0.84, 1];
  const KH = [0, 0.66, 0.97, 0.97, 0.66, 0];
  const lift = (t: number) => {
    if (t <= 0 || t >= 1) return 0;
    let poly = 0;
    for (let i = 0; i < K.length - 1; i++) if (t <= K[i + 1]) { poly = mix(KH[i], KH[i + 1], (t - K[i]) / (K[i + 1] - K[i])); break; }
    return Hb * mix(poly, Math.pow(Math.sin(Math.PI * t), 0.6), 0.5);
  };
  const deckLift = (t: number) => {
    if (t < 0) return Math.max(0, 4 + (t / ramp) * 4);
    if (t > 1) return Math.max(0, 4 - ((t - 1) / ramp) * 4);
    return Math.max(4, lift(t) + 2);
  };
  const deckAt = (t: number, w = 0): Pt => { const b = base(t); return [b[0] + w * bw, b[1] - deckLift(t)]; };
  const ts: number[] = []; for (let i = 0; i <= N; i++) ts.push(-ramp + (1 + 2 * ramp) * i / N);
  // shadow on the water under the arch, and its broken reflection
  for (let k = 0; k < 9; k++) {
    const t = 0.15 + R() * 0.7; const b = base(t);
    stroke(ctx, [[b[0] + bw * 0.1, b[1] + 3 + k * 1.2], [b[0] + bw * 1.7, b[1] + 3.3 + k * 1.2]], { w: 1.1, col: rgba(C.ink2, 0.13), tin: 0.2, tout: 0.6, dry: 0.3, seed: k });
  }
  // the far (left) face's arch, glimpsed under the deck
  const backArch: Pt[] = []; for (let i = 0; i <= N; i++) { const t = i / N; const b = base(t); backArch.push([b[0], b[1] - lift(t)]); }
  stroke(ctx, backArch.slice(3, -3), { w: 1.6, col: rgba(mix3(C.timber, C.ink, 0.5), 0.45), tin: 0.1, tout: 0.1 });
  // the deck's top surface (planks: timber, lighter)
  wash(ctx, [...ts.map((t) => deckAt(t, 0)), ...ts.slice().reverse().map((t) => deckAt(t, 1))], rgba(mix3(C.timberM, C.white, 0.25), 0.94));
  for (let i = 2; i < N - 1; i += 3) stroke(ctx, [deckAt(ts[i], 0.05), deckAt(ts[i], 0.95)], { w: 0.3, col: rgba(C.ink, 0.22), tin: 0, tout: 0 });
  // the far rail
  const farRail = ts.map((t): Pt => { const p = deckAt(t, 0); return [p[0], p[1] - 4.4]; });
  stroke(ctx, farRail, { w: 0.65, col: rgba(C.ink, 0.65), tin: 0.05, tout: 0.05 });
  for (let i = 0; i <= N; i += 2) stroke(ctx, [deckAt(ts[i], 0), farRail[i]], { w: 0.42, col: rgba(C.ink, 0.45), tin: 0, tout: 0 });
  // the crowd on the deck: thickest on the crown, some at the rail looking down at the boat; nobody walks
  const people: [number, number][] = [];
  const nP = o.people ?? 30;
  for (let i = 0; i < nP; i++) {
    let t = R(); t = 0.5 + (t - 0.5) * (0.55 + 0.7 * R());
    people.push([t * (1 + ramp) - ramp * 0.5, 0.12 + 0.76 * R()]);
  }
  people.sort((a, b) => deckAt(a[0], a[1])[1] - deckAt(b[0], b[1])[1]);
  for (const [t, w] of people) {
    const p = deckAt(t, w);
    person(env, p[0], p[1], o.fs ?? 0.82, R, { lean: (R() - 0.5) * 0.4, arm: R() < 0.4 ? 'up' : 'down', flip: R() < 0.55 });
  }
  for (const [t, w] of o.stalls ?? []) { const p = deckAt(t, w); parasol(env, p[0], p[1], 0.75, R); }
  // the visible face: bundles of timber beams in the polygonal arch, beam ends crossing them, a dark underside
  const face: Pt[] = [], faceLow: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N; const b = base(t);
    const top: Pt = [b[0] + bw, b[1] - lift(t)];
    face.push(top);
    faceLow.push([top[0], top[1] + T * (0.85 + 0.3 * Math.pow(Math.abs(t * 2 - 1), 2))]);
  }
  wash(ctx, [...face, ...faceLow.slice().reverse()], rgba(C.timber, 0.94), { edge: rgba(C.ink, 0.4) });
  for (const f of [0.3, 0.55, 0.78]) {   // the beam bundles running along the arch
    const line = face.map((p, i): Pt => [p[0], mix(p[1], faceLow[i][1], f)]);
    stroke(ctx, line.slice(1, -1), { w: 0.55, col: rgba(C.ink, 0.5), tin: 0.05, tout: 0.05, dry: 0.25, seed: f * 100 });
  }
  for (let i = 2; i < N - 1; i += 2) {   // beam ends crossing the bundles (the woven lattice)
    const a = face[i], b = faceLow[i];
    stroke(ctx, [[a[0] + 0.3, a[1] + 0.2], [b[0] - 0.2, b[1] - 0.3]], { w: 0.75, col: rgba(mix3(C.ink, C.timber, 0.25), 0.7), tin: 0, tout: 0 });
  }
  stroke(ctx, face, { w: 1.35, col: rgba(C.ink, 0.9), tin: 0.04, tout: 0.04, wob: 0.2 });
  stroke(ctx, faceLow, { w: 1.6, col: rgba(C.ink, 0.88), tin: 0.04, tout: 0.04, wob: 0.25 });
  // the near rail and its posts
  const deckN = ts.map((t) => deckAt(t, 1));
  const rail = deckN.map(([x, y]): Pt => [x, y - 4.8]);
  stroke(ctx, deckN, { w: 0.95, col: rgba(C.ink, 0.88), tin: 0.04, tout: 0.04 });
  for (let i = 0; i <= N; i += 2) stroke(ctx, [deckN[i], rail[i]], { w: 0.55, col: rgba(C.ink, 0.85), tin: 0, tout: 0 });
  stroke(ctx, rail, { w: 0.85, col: rgba(C.ink, 0.88), tin: 0.04, tout: 0.04, wob: 0.15 });
  // abutments: stone, set into the banks
  for (const t of [0, 1]) {
    const b = base(t);
    wash(ctx, [[b[0] - 5, b[1] + 1.6], [b[0] + bw + 7, b[1] + 1.6], [b[0] + bw + 5, b[1] - 6], [b[0] - 3, b[1] - 5]], rgba(mix3(C.ink2, C.white, 0.55), 0.7), { jit: 1 });
    dryBrush(ctx, [[b[0] - 7, b[1] + 1.6], [b[0] + bw + 9, b[1] + 1.9]], { w: 2.4, col: rgba(C.ink, 0.5), bristles: 4, seed: b[0] });
  }
  return { deckAt, base };
}

/** Premultiply straight RGBA in place (the GPU path filters premultiplied texels, so edges never darken). */
export function premultiply(d: Uint8ClampedArray): Uint8ClampedArray {
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a === 255) continue;
    if (a === 0) { d[i] = d[i + 1] = d[i + 2] = 0; continue; }
    d[i] = (d[i] * a + 127) / 255;
    d[i + 1] = (d[i + 1] * a + 127) / 255;
    d[i + 2] = (d[i + 2] * a + 127) / 255;
  }
  return d;
}
