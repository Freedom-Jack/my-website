// figures.ts — the figure layers: what in the painting is not a mountain. DOM-free Canvas2D
// brushwork, seeded and deterministic, drawn once per (stretch, scale, palette, resolution) on an OffscreenCanvas
// in a module worker (figures.worker.ts), or on the main thread in idle chunks of <= 8 ms where that is missing.
// The layer covers a world rectangle (figureMeta); the scene shader paints it into the painting at its plane,
// with a bleed halo (its mip levels), the plane's mist over its feet, grain on top and the drifting mist passing
// over it, so it is never pasted on.
//
// This file is the brush kit and the plumbing. The scenes live in sets/, one module per figure set (one stretch
// each), listed in sets/index.ts; adding or changing a set never touches this file:
//   sets/home.ts      stretch 0  Home: the traveller, the hut, the path, the ledge
//   sets/market.ts    stretch 1  Work: the river market at the rainbow bridge
//   sets/pavilion.ts  stretch 2  Writing and the Note: the pavilion by the still lake
//   sets/terraces.ts  stretch 3  Résumé: the terraced fields and the farmhouse
//   sets/ferry.ts     stretch 4  Contact: the ferry at the jetty
//   sets/path.ts      stretch 5  404: the path into mist
// How to add a set: sets/index.ts, and the API below.
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
//                  desktop aspect): planeTop(l, u, P) is a ridge plane's crest, sceneField(u, P, out) the scene's
//                  waterlines and banks (use it at the water)
//     ink          { C, rgba }: the palette's colours (C.ink, C.tile, C.mal ...) and rgba(c, a)
//     k            device px per world px (scale / REF_PX * dpr)
//     scale        what the layer is drawn for (CSS px per stretch)
//     rect, plane  this set's meta (copies)
//     life         [] : the life anchors (THE LIFE API, below)
//   World px: REF_PX (1440) per stretch and VH_PX (900) per scene height: wx = u * 1440, wy = (1 - y) * 900, y down.
//   Phone scales are small (Home's is 360 CSS px per stretch): draw figures larger there, as home.ts does with
//   big = Math.max(1, 0.7 * REF_PX / env.scale), so a person stays >= 12 CSS px tall.
//   Randomness: never Math.random, never one stream shared by the whole set. Each element takes its own stream:
//   const own = streams(SEED); own('house', row, i) (stream, streams below), so adding or removing a draw in one
//   element never re-rolls another.
//   Module rules: import the kit from '../figures' (and nothing from index.ts). figures.ts never imports the sets
//   (figures.worker.ts and figure-source.ts register them: registerSets), so the kit's constants exist when a set's
//   top level runs.
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
//     shimmer  { rings, drops }                        the open water in its box (the shader finds the water from the
//              ridge rows); boats and bridges stay still
//     walker   { path: [[x, y], ...], home: [x, y], speed }   one slow figure walking a path (Work's bridge deck):
//              drawn with ownSprite at `home`, its feet; it walks the path at `speed` world px per second, comes into
//              view out of the mist at the path's start and goes into it at the end
//   ownSprite(env, kind, box, params, paint): a moving thing that cannot be cut out of the layer because something
//   lies behind it (a walker on a bridge, a ferry at its jetty). paint(env) draws it in world px. In the WebGL 'gpu'
//   output the worker paints it on a canvas of its own (box: a generous hint of where it is drawn; the sprite is
//   cropped to its ink), never into the layer; everywhere else (Canvas2D, the bytes path, the idle fallback) it is
//   painted into the layer at once, standing still. The anchor's params get sprite: 'own'.
// drawFigures / paintSteps return the anchors checked and copied (params as plain JSON), each with
// uv: [u0, v0, u1, v1], its box in layer texture fractions (v from the top; outside 0..1 past the rect). (A sprite's
// anchor also gets, from the worker, cut: its sprite's box in layer uv, atlas: [u0, u1, v1] its place in the layer's
// one sprite atlas, spx: its size in texels.) In scene units: u = rect[0] + uv_u * (rect[1] - rect[0]),
// y = rect[3] - uv_v * (rect[3] - rect[2]). The worker posts them with the layer ({ ..., life }). Life stops for
// reduced motion, Still, idle and Canvas2D, and is calmer on phones.
//
// Kitsch guards: Song forms only; no red lanterns, pagodas, dragons or gold; no text on signs. Colour (palette.ts):
// light colour over ink: grey tile, timber brown on wood (small areas, never a pale wash), pale indigo clothes,
// white robes, willows in misted malachite.
//
// Structure studied (not copied) from LingDong Huang's {Shan, Shui}* (MIT, 2018).

import { resolve, spec, sceneField, SCENE_FIELDS, REF_PX, HS, LAYERS, type Resolved } from './compose';
import { planeTop } from './ridges';
import { PALETTES, paletteName } from './palette';

// what a set needs from the composition, re-exported so a set imports from one place
export { sceneField, SCENE_FIELDS, REF_PX, planeTop };
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

/** A set's meta (THE SET API): the world rectangle [u0, u1, y0, y1] its layer covers, its plane and phase
 *  (figure-meta.ts, where the main thread keeps every set's). */
export type { FigureMeta } from './figure-meta';
import { METAS, type FigureMeta } from './figure-meta';
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
  /** 'gpu': an ImageBitmap with its sprites cut apart (WebGL where a bitmap uploads premultiplied: gl.ts bitmaps);
   *  'bytes': premultiplied RGBA (WebGL elsewhere); 'bitmap': the layer as drawn (Canvas2D). */
  out?: 'gpu' | 'bytes' | 'bitmap';
  /** Drawn for a window into the painting (index.ts GLIMPSE), a still view: its sprites are painted in, never
   *  cut apart (the window's present has no life pass). */
  inlay?: boolean;
  /** QA builds only: the engine's element overrides, the elements switched off (elements.ts qaOverrideLists), which
   *  the worker, with no window and no storage of its own, could not read. */
  qa?: { off: string[] };
}

/** The palette's inks (inks()): its colours and rgba(). */
export interface Inks {
  C: Record<InkName, RGB>;
  rgba: (c: RGB, a: number) => string;
}
/** What draw(env) gets (THE SET API). */
export interface Env {
  ctx: Ctx2D;
  P: Resolved;
  ink: Inks;
  k: number;
  scale: number;
  rect: FigureMeta['rect'];
  plane: number;
  life: LifeAnchor[];
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
  /** Marks an anchor that is no life (index.ts lifeU skips it): Home's hut keeps one, so that its later anchors keep
   *  their phase seeds. */
  lamp?: Pt;
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
  /** walker: its path, its home (its feet, where it is drawn) and speed. */
  path?: Pt[];
  home?: Pt;
  /** Shimmer: expanding ripple rings on the water too. */
  rings?: number;
  /** A sprite pinned to the frame: the stage's slide does not carry it (Writing's willow, the near framing element
   *  whose root lies past the frame's edge on the layer's eastern reach, which the slide would otherwise bring into
   *  view as a cut end; index.ts lifeU). Windows (phones) ignore it. */
  pinned?: boolean;
  /** (elements.ts waterfall) Smoke's box as a falling stream instead: its x, its lip's and its foot's y, its
   *  half-width (world px); the present pass slides lights down what the layer painted white there. */
  fall?: { x: number; y0: number; y1: number; hw: number };
  /** (elements.ts contactLife) A sprite that bends from its foot in a breeze (a clump of rushes). */
  bend?: boolean;
  /** (elements.ts contactLife) Shimmer: points (world px) where a ring set falls now and then by itself (a pole,
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
// Registered by the entry points (figure-source.ts's idle fallback on the main thread, figures.worker.ts in the
// worker): this module never imports the sets, so the sets (which import its brush kit) and it form no import cycle (a
// production Turbopack build of a module worker over such a cycle never finishes).
let SET_LIST: SetEntry[] = [];
let registry: Map<number, { name: string; meta: FigureMeta | null; draw: DrawSet | undefined }> | null = null;
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
    registry.set(stretch, { name, meta, draw });
  }
  return registry;
}
function validMeta(m: FigureMeta) {
  const r = m.rect;
  return Array.isArray(r) && r.length === 4 && r.every(Number.isFinite) && r[1] > r[0] && r[3] > r[2]
    && Number.isInteger(m.plane) && m.plane >= 0 && m.plane < LAYERS && (m.phase === 0 || m.phase === 1);
}
const setAt = (stretch: number) => sets().get(Math.round(Number(stretch))) || null;

// (figureMeta reads the metas' own table, figure-meta.ts, the part of the sets the main thread keeps: the engine's
// chunk carries no drawing code; the registry above is the worker's, and the idle fallback's once it has loaded)
export { figureMeta } from './figure-meta';

/** Pixel size of a layer drawn at `scale` CSS px per stretch and `dpr` device px per CSS px. */
export function layerSize(stretch: number, scale: number, dpr: number): { width: number; height: number } {
  const m = METAS[Math.round(Number(stretch))];
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
    ctx, P, ink: inks(p.palette), k, scale: p.scale, rect: m.rect.slice() as FigureMeta['rect'], plane: m.plane, life: [],
    sprites: own ? [] : null,
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
const LIFE_KINDS = ['smoke', 'willow', 'boat', 'shimmer', 'walker'];

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
function hash2(x: number, y: number, s: number): number {
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
function stream(seed: number, ...keys: (string | number)[]): Rng {
  let h = seed >>> 0;
  for (const key of keys) {
    if (typeof key === 'string') for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
    else h = Math.imul(h ^ (key | 0), 2246822519);
    h ^= h >>> 15; h = Math.imul(h, 2654435761); h ^= h >>> 13;
  }
  return rng(h >>> 0);
}
/** A set's streams: const own = streams(SEED); then own('house', row, i) is that element's stream,
 *  stream(SEED, 'house', row, i). */
export function streams(seed: number): Streams {
  return (...keys) => stream(seed, ...keys);
}
export function clamp01(x: number): number { return Math.min(1, Math.max(0, x)); }
export function smooth(a: number, b: number, x: number): number { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
export function mix(a: number, b: number, t: number): number { return a + (b - a) * t; }
export function mix3(A: RGB, B: RGB, t: number): RGB { return [mix(A[0], B[0], t), mix(A[1], B[1], t), mix(A[2], B[2], t)]; }

// ---------------------------------------------------------------- inks and light colour (palette-aware)
// Every colour is cool or neutral; timber brown only ever at mid-to-dark values on small areas (never a pale wash,
// which would read as beige).
const BASE: Record<InkName, RGB> = {
  ink: [20, 24, 27], ink2: [42, 48, 52], wall: [236, 238, 235], white: [246, 247, 244], paper: [239, 241, 238], mist: [233, 237, 236],
  tile: [56, 78, 98], timber: [76, 96, 128], timberM: [140, 168, 200], indigo: [44, 78, 104], indigoP: [150, 180, 204],
  mal: [139, 200, 196], malD: [36, 128, 132], earth: [120, 128, 134],
  // navy ink for near accents, and a near-white for highlights
  navy: [27, 40, 60], light: [251, 254, 255],
};
/** The inks' names (Inks.C). */
export type InkName = 'ink' | 'ink2' | 'wall' | 'white' | 'paper' | 'mist' | 'tile' | 'timber' | 'timberM' | 'indigo' | 'indigoP' | 'mal' | 'malD' | 'earth' | 'navy' | 'light';
function inks(palette: string): Inks {
  const strength = PALETTES[paletteName(palette)].figures;   // 1 (misted)
  const grey = (c: RGB): RGB => { const l = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; return [l - 2, l, l + 2]; };
  const tone = (c: RGB) => mix3(grey(c), c, 0.85 + 0.15 * strength);
  const C = {} as Record<InkName, RGB>;
  for (const k in BASE) C[k as InkName] = tone(BASE[k as InkName]);
  const rgba = (c: RGB, a: number) => `rgba(${Math.round(Math.min(255, Math.max(0, c[0])))},${Math.round(Math.min(255, Math.max(0, c[1])))},${Math.round(Math.min(255, Math.max(0, c[2])))},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
  return { C, rgba };
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
/** A soft wash (ink wicking into wet paper): a few stacked, offset fills. */
export function softWash(env: Env, pts: Pt[], col: string, r: number, o: WashOptions = {}): void {
  const { ctx } = env;
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
// ---------------------------------------------------------------- trees
/** A tree in dots (an ink cluster of short dabs on a crooked trunk). (x, y) = the foot. */
export function dotTree(env: Env, x: number, y: number, s: number, R: Rng, o: { green?: boolean; clusters?: number } = {}): void {
  const { ctx, ink } = env;
  const { C, rgba } = ink;
  const H = 20 * s;
  const lean = (R() - 0.5) * 5 * s;
  stroke(ctx, [[x, y + 0.5], [x + lean * 0.4 + (R() - 0.5) * 2 * s, y - H * 0.5], [x + lean, y - H * 0.85]], { w: 1.7 * s, col: rgba(C.ink, 0.85), tin: 0, tout: 0.7, wob: 0.5, seed: x });
  const leaf = o.green ? mix3(C.ink, C.malD, 0.35) : C.ink;
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
export function ellipse(cx: number, cy: number, rx: number, ry: number, n: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  return pts;
}

// ---------------------------------------------------------------- buildings (Song oblique projection)
export const D: Pt = [0.72, -0.48];    // one unit of depth on screen: the view shows fronts, tops and right-hand sides

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
