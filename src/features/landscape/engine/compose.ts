// compose.ts — where the mountains stand along the one continuous handscroll.
//
// World x is measured in "stretches": stretch k spans [k, k + 1], which is exactly one desktop
// viewport wide. Every stretch has its own composition (a host peak, guest peaks, near crags and
// empty paper where the text sits), written as Gaussian "massifs" on the five ridge planes.
// Massifs of neighbouring stretches overlap at the seams, so the envelope (and the ridges built
// on it) is one continuous function of world x: panning between stretches unrolls the scroll.
// Each stretch is also a scene ("source to sea": peak, river, lake, shore, crossing, lone peak), one per page
// (round 5: the road, a stretch with no page between the river and the lake, is gone).
// SCENES adds what is not a mountain: the brush technique (contour and texture strokes, ink) and water
// in front of the far shore, as smooth windows along world x, so every seam is crossed through water
// or mist, never a cut.
//
// Nothing here touches the DOM or WebGL; ridges.ts samples it for both renderers and for stripSVG().

export const LAYERS = 5; // ridge planes, far (0) -> near (4)

/** The three distances (PRESETS). */
export type Distance = 'level' | 'high' | 'deep';
/** A viewport's width class (widthClass). */
export type WidthClass = 'wide' | 'tablet' | 'phone' | 'short';
/** A window's kind: the page's strip, or its closing. */
export type WindowKind = 'strip' | 'closing';
/** A massif's role in its composition ('echo': the crossing's far view of the home peak, see STRETCHES[5]). */
export type Role = 'far' | 'guest' | 'host' | 'near' | 'fg' | 'echo';
type Weighted = Exclude<Role, 'echo'>;
type Band = [number, number];

// Massif: [plane, x within the stretch (0..1 = one desktop viewport), half-width, gain, role]
// Roles let the distance presets re-balance a composition: the host peak grows in 'high',
// far ranges and guests multiply in 'deep', and so on.
type Massif = [plane: number, x: number, w: number, gain: number, role: Role];
const STRETCHES: Massif[][] = [
  // 0 · home: the hero study's composition. The upper left stays open for the name.
  [
    [0, 0.22, 0.24, 0.5, 'far'], [0, 0.62, 0.30, 0.7, 'far'],
    [1, 0.04, 0.15, 0.55, 'guest'], [1, 0.50, 0.18, 0.45, 'guest'], [1, 0.97, 0.20, 0.8, 'guest'],
    [2, 0.66, 0.10, 0.8, 'host'], [2, 0.77, 0.09, 1.0, 'host'], [2, 0.40, 0.12, 0.2, 'guest'],
    [3, 0.91, 0.12, 1.0, 'near'], [3, 1.02, 0.10, 0.55, 'near'], [3, 0.60, 0.07, 0.15, 'near'],
    [4, 0.02, 0.22, 0.95, 'fg'], [4, 0.26, 0.12, 0.35, 'fg'], [4, 1.02, 0.06, 0.4, 'fg'],
  ],
  // Round 5: one world. Every page paints the scroll with ONE composition (level, presence 1: places.ts), so a place
  // looks the same from every page and the far range is one line from end to end; what made each place itself (Work's
  // 'deep' valley, the reading pages' lower, paler presence, the 404's 'high' peak) now lives here, in its own massifs,
  // its water and its technique. One river runs the whole length (SCENES[k].water): it comes out from behind his
  // mountain's near peaks, runs past the town, opens into the still lake, narrows again at the foot of the terraces and
  // opens into the crossing; the 404's lone peak stands beyond it, off the map. Neighbours meet over the water: a spur at
  // each seam (the near crags), the far range running on above.
  // 1 · river: the market town at the rainbow bridge on the river's far bank (sets/market.ts), the hills behind it out
  // of the mist, lower than the home peak (4b: the hill behind the east end of the town is a broad, rounded hill, u .77;
  // as a narrow cone it read as a spire, a pagoda's, beside the reading column: DESIGN §4.6). At its east end a low
  // headland where the river turns and opens into the lake.
  [
    [0, 0.30, 0.26, 0.30, 'far'], [0, 0.80, 0.24, 0.36, 'far'],
    [1, 0.42, 0.10, 0.48, 'guest'], [1, 0.70, 0.14, 0.36, 'guest'], [1, 0.97, 0.09, 0.52, 'guest'],
    // (round 5, the town in the scroll: one low ridge behind the town, its hills broad and rounded (guests: no host's
    // sharp summit), none narrower than about three times its visible height: the one at u .675 stood alone as a spire)
    [2, 0.47, 0.066, 0.36, 'guest'], [2, 0.585, 0.10, 0.36, 'guest'], [2, 0.68, 0.12, 0.38, 'guest'],
    [2, 0.775, 0.16, 0.3, 'guest'], [2, 0.875, 0.08, 0.36, 'guest'],
    // (round 5) at the east one broad, low headland where the river turns and opens into the lake (u 1.04; two narrow
    // crags there read as stray triangles in the mist). (No massif at the west seam: anything there adds to his
    // mountain's near crag at u 1.02; the near bank's land is the town's own, sets/market.ts.)
    [3, 1.04, 0.12, 0.3, 'near'],
  ],
  // 2 · lake: a still lake. A low far shore (the lake's peak on the right, long pale ranges behind) stands on the
  // waterline; the near and middle distance are open water. Work's spur is the headland at its left; the terraces'
  // foreground hill closes it at its right, where the river leaves it.
  [
    [0, 0.18, 0.30, 0.28, 'far'], [0, 0.68, 0.30, 0.40, 'far'],
    [1, 0.07, 0.09, 0.34, 'guest'], [1, 0.46, 0.14, 0.21, 'guest'], [1, 0.97, 0.10, 0.28, 'guest'],
    [2, 0.76, 0.07, 0.48, 'host'], [2, 0.845, 0.05, 0.2, 'host'], [2, 0.665, 0.045, 0.09, 'host'],
  ],
  // 3 · terraced fields (Résumé): low, rounded hills on the river's far bank, terraced down to the water, years of
  // steady work in rows like a record (SCENES[3].tech.terr draws the terraces, round smooths the crests); no crag stands
  // above them. On the near bank, lower terraced hills; a long, low far range behind.
  [
    [0, 0.30, 0.36, 0.26, 'far'], [0, 0.84, 0.30, 0.30, 'far'],
    [1, 0.22, 0.17, 0.30, 'guest'], [1, 0.60, 0.15, 0.36, 'guest'], [1, 0.98, 0.14, 0.30, 'guest'],
    [2, 0.44, 0.14, 0.46, 'host'], [2, 0.70, 0.13, 0.58, 'host'], [2, 0.93, 0.11, 0.38, 'host'],
    [3, 0.56, 0.12, 0.22, 'near'], [3, 0.84, 0.11, 0.26, 'near'],
    [4, 0.06, 0.16, 0.4, 'fg'],
  ],
  // 4 · crossing: open water in the near and middle distance. On the far shore, low pale ranges and,
  // on the right (clear of Contact's address), the home peak seen from across the water: an 'echo' row draws
  // stretch 0's host plane itself, sampled around its main summit (the crowned mass, the notch, the second
  // peak), at a fraction of its size on a far plane, so it takes the pale, soft ink of distance (ridges.ts, echo()).
  // [plane, x of the main summit, scale, gain, 'echo']
  [
    [0, 0.26, 0.34, 0.30, 'far'], [0, 0.86, 0.28, 0.34, 'far'],
    [1, 0.16, 0.09, 0.26, 'guest'], [1, 0.36, 0.11, 0.30, 'guest'], [1, 0.97, 0.07, 0.24, 'guest'],
    [1, 0.84, 0.5, 1.0, 'echo'],
  ],
  // 5 · a single peak standing alone in the mist beyond the water (the 404): one tall, narrow host and nothing beside it
  // but a far, pale range low in the mist; no guest and no near crag (they made it read as another range)
  [
    [0, 0.44, 0.40, 0.20, 'far'],
    [2, 0.80, 0.10, 0.7, 'host'], [2, 0.69, 0.05, 0.16, 'host'],
    [4, 0.06, 0.12, 0.26, 'fg'],
  ],
];
// Before the scroll's first stretch and after its last there is only a far, pale range in the mist (the scroll begins
// and ends in mist), never a wrap-around to the other end's mountains: a phone's wide album leaf of Home looks a
// little to the left of u 0 and the 404's past u 6.
const QUIET: Massif[] = [[0, 0.40, 0.42, 0.30, 'far'], [1, 0.70, 0.22, 0.20, 'guest']];
// 'deep' frames every stretch with a near flank on the left, so the eye travels down a valley
// into the mist towards the host.
const FLANK: Massif[] = [[3, 0.03, 0.07, 0.25, 'near'], [4, -0.02, 0.12, 0.5, 'fg'], [2, 0.12, 0.10, 0.3, 'guest']];
export const STRETCH_COUNT = STRETCHES.length;
const HOST_X = STRETCHES.map((s) => {
  let best = s[0];
  for (const m of s) {
    if (m[4] === 'echo') return m[1];   // the crossing frames its echo of the home peak
    if (m[4] === 'host' && m[3] >= (best[4] === 'host' ? best[3] : -1)) best = m;
  }
  return best[1];
});
const tableFor = (k: number) => (k < 0 || k >= STRETCH_COUNT ? QUIET : STRETCHES[k]);

// Scenes: what each stretch is a picture OF, beyond where its mountains stand. A scene can change the
// brush technique (bone: contour and texture strokes, 1 = full, 0 = boneless wash; ink: strength) and lay
// water in front of the far shore (planes 0-2): `at` is the stretch-local span, `y` the waterline (level
// distance, presence 1), `strokes` the long low strokes on it, `refl` the far shore's reflection, `banks`
// the flat strips of land along the waterline. (The water scenes' technique ink is 1: over open water the
// shader itself paints the far shore fuller and flatter, so it reads at the same density as the Canvas2D
// fallback; the lake stays the palest scene through its technique's ink and its boneless wash.) Every
// field is a smooth window along world x (SEAM feather), so a pan between scenes never cuts. Only
// stretches 0..5 exist here (no wrap-around), so the home view never meets water.
//
// Round 4a added, per scene: `page` (the page's own composition, SPEC-R4A §10.0: distance, presence; round 5: WORLD for
// every place), `frame` (how its strip and closing windows look at it: see framingAt), and on the river a near bank
// (`near`, the waterline of the near shore: land below it) and `shore: 0` (its far planes keep their own misty feet
// above the town instead of standing on the water). `figures` (figures.ts) are the scene's figure layer.
//
// Round 5, one world (DESIGN §12 "Round 5"): every page paints the scroll with one composition, the river runs through
// every place (its waters meet at each seam and add up to one; the near bank blends over a wider seam, so the river
// opens and narrows gradually), `amp` gives a place its own relief, and every window but Home's frames its place by
// the one hero rule (HERO): the shared horizon (the river's waterline) at one height in the box, one scale per width
// class, the place's focus at one place across. So a place only names its focus here:
//   frame: focus [u, y]   the scene's one focus (stretch-local u, scene height); keepU, the leftmost figurative point
//                         the keep-out rule keeps >= KEEP_GAP px right of the text (default: the focus); twinU, where a
//                         short page's twin closing looks (another part of the place, closer: HERO.twin)
// Home keeps its own hero (the taller one, with the name): `wide { right }` (its view's right edge; its vertical
// placement is the hero rule's), its album leaves `tablet / phone / short` (band framings: bandFrame) and its closings:
//   tablet / phone { scale, band, fbIn, u, fx, uMin, uMax }   a band of the scene (bandFrame)
//   closing { wide { scale, band, right, hug?, keepU? }, phone ... }   a small version of the opening, framed as a band
//     with the view's right edge at stretch-local `right` (the living ground ends on the opening itself on wide screens)

/** How a window of one width class looks at a scene (frame.tablet / phone / short): see framingAt and bandFrame. */
export interface View {
  /** CSS px per stretch (the nominal scale its figure layer is drawn at). */
  scale: number;
  /** [y0, y1]: the band's ground and summits (scene heights), framed between the window's feathers. */
  band?: Band;
  /** How far into the bottom feather the band's ground may sit (default 0.5). */
  fbIn?: number;
  /** The view's anchor (stretch-local u), placed at fx of the width (default: the focus at 0.5). */
  u?: number;
  fx?: number;
  /** Without a band: the focus at (fx, fy) of the box. */
  fy?: number;
  /** Where the width allows, the view stays inside [uMin, uMax] (stretch-local). */
  uMin?: number;
  uMax?: number;
  /** Where a tall box leaves room, how far the band sits from its summits' line toward its ground's (default 0.5). */
  slack?: number;
}
/** A closing's or a twin's view: a class's view, overridden; or a span (spanFrame) or a band at its right edge. */
export interface ClosingView extends Partial<View> {
  /** The view's right edge at stretch-local `right` (a wide closing). */
  right?: number;
  /** A span [u0, u1] (stretch-local) held right of the text at any width (spanFrame). */
  span?: Band;
  /** The point (fx, fy) frames the scene height `y` (default: the focus's). */
  y?: number;
  /** The leftmost figurative point the keep-out keeps clear (default: frame.keepU). */
  keepU?: number;
  /** Its keepU exactly KEEP_GAP right of the text, when the text overlaps it. */
  hug?: boolean;
}
interface WideFrame {
  /** Home: its view's right edge at stretch-local `right` (default 1); its vertical placement is the hero rule's. */
  right?: number;
}
/** How the windows look at a scene (see the table above). Round 5: every place but Home takes the one hero rule (HERO),
 *  so it gives only its focus (and where its twin closing looks); Home keeps its own hero, with the name, per class. */
export interface Frame {
  /** The scene's one focus: [stretch-local u, scene height]. */
  focus: [number, number];
  keepU?: number;
  /** Home's own framings (its taller hero): wide (its vertical placement still follows HERO), tablet, phone, short. */
  wide?: WideFrame;
  tablet?: View;
  phone?: View;
  short?: View;
  closing?: Partial<Record<WidthClass, ClosingView>> & { twin?: Partial<Record<WidthClass, ClosingView>> };
  /** HERO places: where the twin closing (a short page's) looks instead of the focus (stretch-local u). */
  twinU?: number;
}
/** A scene's brush technique, windowed over stretch-local `at`. */
interface Tech {
  at: Band;
  bone: number;
  ink: number;
  inkPortrait?: number;
  terr?: number;
}
/** A scene's water in front of the far shore (planes 0-2), windowed over stretch-local `at`. */
interface Water {
  at: Band;
  y: number;
  near?: number;
  strokes: number;
  refl: number;
  banks?: number;
  shore?: number;
  mirror?: number;
  /** 4b: the river town's depth profile (RIVER_FRONT): from u `at`, every `step` stretches, thousandths. */
  front?: { at: number; step: number; hb: number[] };
}
export interface Scene {
  name: string;
  /** The page's own composition: [distance, presence] (round 5: WORLD for every place). */
  page: [Distance, number];
  /** The place's own relief (round 5): each plane's amplitude times this, over the place's stretch (ampAt). */
  amp?: number[];
  tech?: Tech;
  water?: Water;
  frame: Frame;
  /** Its figure set's name (sets/index.ts). */
  figures?: string;
}

/** The one composition every page paints the scroll with (round 5): its place's character lives in SCENES and STRETCHES,
 *  never in a page's own distance or presence, so a place looks the same from every page. */
export const WORLD: [Distance, number] = ['level', 1];

export const SCENES: Scene[] = [
  // Narrow framings (fixer, 10 Oct): every strip shows its mountains whole. A `band` [y0, y1] puts the scene's highest
  // summits (the far range included) just under the top feather and its ground above the bottom one (bandFrame).
  { name: 'peak', page: WORLD,
    frame: {
      focus: [0.79, 0.2], keepU: 0.72,
      wide: { right: 1 },
      // tablet and phone: the whole mountain (summits 0.58) with the hut and the traveller (0.2) on a wider album leaf;
      // on phones the figures are drawn larger (figures.ts `big`), so the traveller stays >= 12 CSS px tall. The view
      // ends at u 1.06, before the river town; it may begin a little left of u 0, where the scroll opens in mist.
      tablet: { scale: 620, band: [0.195, 0.588], fbIn: 0, u: 0.76, fx: 0.62, uMax: 1.14 },
      // (M n1, the critic: "the host peak is tiny, a thumbnail": framed tighter on the host peak and its light, so the
      // two fill about half the strip; the hut stays, the traveller sits in the bottom feather)
      phone: { scale: 360, band: [0.25, 0.62], fbIn: 0.3, u: 0.73, fx: 0.55, uMax: 1.06 },
      // sideways phones: an 80 px sliver holds the summits above their mist (the figures cannot read at that size)
      short: { scale: 600, band: [0.44, 0.588], u: 0.72, fx: 0.62, uMax: 1.06 },
      // closing: the whole mountain with the hut and the traveller, ending before the river town (the wide one only off
      // the living ground, which ends on the opening itself); on phones the summits sit lower in the taller box, so the
      // near crags at the scroll's left end stay in its bottom feather
      closing: { wide: { scale: 600, band: [0.19, 0.6], fbIn: 0, right: 1.06 }, phone: { slack: 1 } },
    },
    figures: 'home' },
  // The river (round 5: one composition, so the waterline and the near bank are given as the town has always stood on
  // them: 0.289 and 0.209, as 'deep' at 0.8 drew 0.32 and 0.235). The town stands on its far bank and the hills keep
  // their own misty feet above it (shore 0).
  { name: 'river', page: WORLD, tech: { at: [0.06, 0.98], bone: 1.0, ink: 1.5 },
    water: { at: [0.02, 1.0], y: 0.289, near: 0.209, strokes: 1.2, refl: 0.4, banks: 0, shore: 0,
      // 4b: the town's depth for its mist (shaders.ts figMist, canvas2d.ts figure()). The river's mist lies among the
      // back rows, behind the nearest things in each column: `front` is how high those reach above the far bank (scene
      // heights), every `step` stretches from u `at` (stretch-local): the front row's roofs and its trees, the landmark,
      // the masts, and over the river the bridge with the crowd on its crown. Measured from sets/market.ts drawn with
      // its rows table cut to row 1 (the top inked pixel per bin at 1440 @ 2, widened by a bin each side, + 0.002);
      // re-measure when the set's town or bridge moves. Thousandths of a scene height.
      front: { at: 0.10, step: 0.005, hb: [
        31, 31, 31, 17, 17, 17, 29, 33, 40, 40, 40, 40, 40, 46, 52, 56, 56, 56, 55, 45, 41, 47, 53, 55, 55, 55, 53, 49, 49,
        49, 49, 49, 48, 47, 53, 58, 63, 63, 63, 63, 63, 63, 63, 63, 61, 61, 61, 58, 46, 46, 51, 51, 51, 51, 51, 51, 51, 51,
        49, 48, 46, 45, 45, 45, 45, 45, 45, 41, 41, 41, 41, 41, 44, 49, 55, 56, 56, 56, 52, 45, 38, 38, 38, 43, 48, 52, 52,
        52, 51, 48, 48, 51, 54, 54, 56, 58, 58, 58, 57, 57, 57, 57, 57, 55, 55, 55, 52, 50, 48, 42, 40, 34, 29, 27, 27, 27,
        30, 37, 37, 37, 37, 37, 39, 43, 46, 46, 46, 46, 46, 46, 46, 48, 48, 48, 48, 48, 49, 54, 59, 64, 64, 64, 64, 64, 64,
        64, 64, 64, 61, 60, 59, 48, 48, 48, 48, 48, 46, 45, 45, 45, 51, 51, 51, 51, 51, 51, 51, 51, 55, 58, 58, 58, 55, 48,
        39, 39, 39, 38, 28, 17, 17, 17, 31, 31, 31] } },
    frame: { focus: [0.565, 0.272], keepU: 0.482 },
    figures: 'market' },
  // Writing: a still lake, where the river opens out (its near bank sinks out of view between the town and the lake).
  // The low far shore and its whole reflection: the waterline the river's, the mirror below it (water.mirror: a still,
  // whole reflection, few strokes). Boneless and pale (tech.ink): the quietest place on the scroll.
  { name: 'lake', page: WORLD, tech: { at: [-0.10, 1.02], bone: 0.1, ink: 0.85 }, water: { at: [0.0, 1.0], y: 0.29, strokes: 0.25, refl: 1, banks: 1, mirror: 1 },
    // (the closing shares Writing's first screen with its strip: its twin looks west down the still water, the pavilion
    // out of view)
    frame: { focus: [0.8, 0.3], twinU: 0.25 } },
  // Résumé: the river narrows again and runs along the foot of the terraced hills, which step down to its far bank
  // (tech.terr), in pale malachite; lower terraced hills on its near bank.
  { name: 'shore', page: WORLD, tech: { at: [0.02, 0.98], bone: 0.5, ink: 1.3, terr: 1 },
    water: { at: [0.0, 1.0], y: 0.29, near: 0.205, strokes: 0.35, refl: 0.5, banks: 0.4 },
    frame: { focus: [0.65, 0.3] } },
  // Contact: the crossing, where the river opens into wide water: the far shore (the echo of his mountain at the right),
  // the open water below it in pale indigo with long ripples, the ferry at the jetty on the near side.
  { name: 'crossing', page: WORLD, tech: { at: [-0.02, 0.98], bone: 0.22, ink: 0.96, inkPortrait: 1.06 }, water: { at: [0.0, 0.96], y: 0.29, strokes: 1, refl: 0.75, banks: 0.8 },
    // (the twin: west along the crossing, the far shore's long low ranges over the open water, the ferry out of view)
    frame: { focus: [0.68, 0.3], keepU: 0.6, twinU: 0.3 } },
  // The 404: one peak alone beyond the water, mist all round it (no closing: the page is off the map). Its host plane
  // stands taller than the composition's (amp: the old 'high' distance's relief), so one narrow summit rises clear.
  { name: 'lone-peak', page: WORLD, amp: [1, 1, 1.25, 1, 1],
    frame: { focus: [0.8, 0.33] } },
];
/** 4b: the river town's depth profile (the river's water.front) in world stretches, { u0, du, hb (scene heights), def }:
 *  the shader bakes it in (shaders.ts frontAt), Canvas2D reads it (canvas2d.ts figure()). `def` holds off the profile. */
export const RIVER_FRONT = (() => {
  const k = SCENES.findIndex((s) => s.water?.front);
  const f = k < 0 ? null : SCENES[k].water!.front;
  return { u0: f ? k + f.at : 0, du: f ? f.step : 1, hb: f ? f.hb.map((v) => v / 1000) : [0.031, 0.031], def: 0.031 };
})();
const SEAM = 0.09;
const win = (u: number, a: number, b: number) => smooth(a - SEAM, a + SEAM, u) * (1 - smooth(b - SEAM, b + SEAM, u));
const SEAM_N = 0.26;   // the near bank's seam (round 5)

/** A place's own relief at world x `u` for plane `l` (round 5, Scene.amp): the amplitude multiplier, windowed over its
 *  stretch. One composition for the whole scroll, yet the 404's lone peak stands as tall as the 'high' distance drew it. */
export function ampAt(u: number, l: number): number {
  let a = 1;
  for (let k = Math.max(0, Math.floor(u) - 1); k <= Math.min(STRETCH_COUNT - 1, Math.floor(u) + 1); k++) {
    const m = SCENES[k].amp;
    if (m && m[l] !== 1) a += (m[l] - 1) * win(u, k, k + 1);
  }
  return a;
}
const winN = (u: number, a: number, b: number) => smooth(a - SEAM_N, a + SEAM_N, u) * (1 - smooth(b - SEAM_N, b + SEAM_N, u));

/** Scene name at a stretch (rounded). */
export function sceneName(stretch: number): string {
  const k = Math.round(Number(stretch) || 0);
  return SCENES[((k % STRETCH_COUNT) + STRETCH_COUNT) % STRETCH_COUNT].name;
}

/**
 * Scene fields at world x `u` for a resolved composition P: water strength (0..1), waterline (viewport
 * heights from the bottom, already through P's presence and portrait transform), bone, ink, strokes, refl.
 * `out` is reused: [water, waterY, bone, ink, strokes, refl, banks].
 */
export function sceneField(u: number, P: Resolved, out: Float32Array = new Float32Array(SCENE_FIELDS)): Float32Array {
  let ws = 0, wy = 0, wsum = 0, bone = 1, ink = 1, strokes = 0, refl = 0, banks = 0, ny = 0, nsum = 0, shore = 0, terr = 0, mirror = 0, river = 0;
  for (let k = Math.max(0, Math.floor(u) - 1); k <= Math.min(STRETCH_COUNT - 1, Math.floor(u) + 1); k++) {
    const sc = SCENES[k];
    if (sc.tech) {
      const t = win(u, k + sc.tech.at[0], k + sc.tech.at[1]);
      bone += (sc.tech.bone - 1) * t;
      // a phone's narrow window holds the far shore behind Contact's stacked lines: there the crossing
      // keeps a little more ink (inkPortrait), so the water and the echo still read (lead, round 3)
      const sink = sc.tech.inkPortrait === undefined ? sc.tech.ink : sc.tech.ink + (sc.tech.inkPortrait - sc.tech.ink) * (P.portrait || 0);
      ink += (sink - 1) * t;
      terr += (sc.tech.terr || 0) * t;
    }
    if (sc.water) {
      // the near bank: a river's own; open water has none, so where a river opens into it the bank sinks out of view
      // (round 5: one river; blended over a wider seam than the water's, so the river widens and narrows gradually)
      const tn = winN(u, k + sc.water.at[0], k + sc.water.at[1]);
      if (tn > 0) {
        if (sc.water.near !== undefined) { ny += sc.water.near * tn; river += tn; } else ny += NEAR_OPEN * tn;
        nsum += tn;
      }
      const t = win(u, k + sc.water.at[0], k + sc.water.at[1]);
      if (t <= 0) continue;
      ws += t;   // (round 5) neighbouring waters meet at their seam and add up to one: the river never breaks there
      wy += sc.water.y * t; wsum += t;
      strokes += sc.water.strokes * t;
      refl += sc.water.refl * t;
      banks += (sc.water.banks || 0) * t;
      shore += (sc.water.shore ?? 1) * t;
      mirror += (sc.water.mirror || 0) * t;
    }
  }
  const tf = (y: number) => y * P.hsc - P.drop + P.wlift;
  out[0] = Math.min(1, ws);
  out[1] = wsum > 0 ? tf(wy / wsum) : -1;
  out[2] = bone; out[3] = ink; out[4] = strokes; out[5] = refl; out[6] = banks;
  // the near bank (a river): land below this waterline; -1 = the water runs on to the bottom of the view
  out[7] = nsum > 0 && ny / nsum > NEAR_OPEN + 1e-4 ? tf(ny / nsum) : -1;
  // does the far shore stand on the water (lake, crossing: 1), or keep its own misty feet (the river: 0)?
  out[8] = wsum > 0 ? Math.min(1, shore / wsum) : 1;
  // terraces (the shore's fields: banded slopes, rounded crests) and a still mirror (the lake: its reflection whole)
  out[9] = Math.min(1, terr);
  out[10] = Math.min(1, mirror);
  // open water (round 5): water with no near bank in front of it, where a near plane is only a headland melting into
  // it; over a river the near bank is land, and the near hills stand on it whole
  out[11] = nsum > 0 ? ws * (1 - Math.min(1, river / nsum)) : 0;
  return out;
}
/** Floats per column from sceneField(): water, waterline, bone, ink, strokes, refl, banks, near bank, shore, terraces,
 *  mirror, open water. */
export const SCENE_FIELDS = 12;
/** Where open water's near bank would be: under any view's bottom (scene heights). */
const NEAR_OPEN = -0.15;


// "Three distances". Per plane: base and amplitude of the ridge (viewport heights from the
// bottom), where its foot dissolves into mist (foot, fade) and how strong its ink is.
// `role` multiplies massif gains, `floor` is the envelope every plane keeps between massifs.
interface Preset {
  base: number[];
  amp: number[];
  foot: number[];
  fade: number[];
  ink: number[];
  floor: number[];
  role: Record<Weighted, number>;
  hostW: number;
  flank: number;
}
const PRESETS: Record<Distance, Preset> = {
  // level distance: wide, low horizon, lots of sky (the hero study)
  level: {
    base: [0.36, 0.29, 0.18, 0.05, -0.02], amp: [0.22, 0.27, 0.40, 0.52, 0.34],
    foot: [0.27, 0.19, 0.11, 0.02, -0.07], fade: [0.15, 0.14, 0.15, 0.16, 0.14],
    ink: [0.42, 0.62, 0.82, 0.95, 1.0], floor: [0.35, 0.15, 0.06, 0.02, 0.0],
    role: { far: 1, guest: 1, host: 1, near: 1, fg: 1 }, hostW: 1, flank: 0,
  },
  // high distance: looking up at a tall host peak; the near ground drops away
  high: {
    base: [0.30, 0.25, 0.12, 0.02, -0.05], amp: [0.20, 0.27, 0.66, 0.55, 0.30],
    foot: [0.23, 0.16, 0.06, -0.01, -0.09], fade: [0.15, 0.15, 0.20, 0.16, 0.14],
    ink: [0.38, 0.56, 0.86, 0.95, 1.0], floor: [0.30, 0.12, 0.04, 0.02, 0.0],
    role: { far: 0.75, guest: 0.85, host: 1.12, near: 1.05, fg: 0.85 }, hostW: 0.85, flank: 0,
  },
  // deep distance: looking down a valley; many planes stacked into the mist
  deep: {
    base: [0.45, 0.36, 0.24, 0.08, -0.03], amp: [0.17, 0.22, 0.32, 0.42, 0.34],
    foot: [0.40, 0.30, 0.19, 0.05, -0.06], fade: [0.13, 0.12, 0.13, 0.15, 0.14],
    ink: [0.46, 0.64, 0.82, 0.94, 1.0], floor: [0.30, 0.12, 0.05, 0.02, 0.0],
    role: { far: 1.15, guest: 1.25, host: 0.95, near: 0.95, fg: 1.1 }, hostW: 1.1, flank: 1,
  },
};
export const DISTANCES = Object.keys(PRESETS) as Distance[];

// Portrait: the narrow window misses every near massif, so the phone's first screen would lose the
// dark, textured foreground that gives the desktop hero its depth. The nearest plane becomes one low
// crest along the bottom edge instead: summits ~92-95% down the screen, below the copy, gone with the
// first scroll like every near plane. (Plane 4, so it keeps the crease texture and dry-brush contour.)
const PORTRAIT_NEAR = { base: -0.02, amp: 0.09, floor: 0.3, foot: -0.13, fade: 0.11 };
// its massifs, per stretch, placed in screen fractions of that stretch's portrait view (so they stand
// where the camera rests, yet stay anchored to the world while it pans): a craggy mass under the copy
// column, a lower crag on the far side, a low saddle between. [x across the view, half-width, gain]
const PORTRAIT_CRAGS: [x: number, w: number, gain: number][] = [[0.2, 0.21, 0.95], [0.9, 0.09, 0.62]];

/** A composition: each distance's weight (they sum to 1; a pan blends them) and the presence, 0..1. */
export interface Spec {
  w: Record<Distance, number>;
  presence: number;
}
/** A spec resolved for an aspect (resolve): per-plane numbers, already through the presence and portrait. */
export interface Resolved extends Omit<Preset, 'base' | 'amp' | 'foot' | 'fade' | 'ink' | 'floor'> {
  base: number[];
  amp: number[];
  foot: number[];
  fade: number[];
  ink: number[];
  floor: number[];
  /** The portrait near crest's strength (0 on desktops). */
  near: number;
  wvis: number;
  /** Presence: the height multiplier, the drop and the waterline's lift. */
  hsc: number;
  drop: number;
  wlift: number;
  presence: number;
  portrait: number;
}

/** A composition spec that can be blended during pans: distance weights + presence. */
export function spec(distance: string = 'level', presence: number = 1): Spec {
  const w = { level: 0, high: 0, deep: 0 };
  w[PRESETS[distance as Distance] ? (distance as Distance) : 'level'] = 1;
  return { w, presence: clamp01(Number.isFinite(+presence) ? +presence : 1) };
}
export function blendSpec(a: Spec, b: Spec, t: number): Spec {
  const w = {} as Record<Distance, number>;
  for (const k of DISTANCES) w[k] = a.w[k] + (b.w[k] - a.w[k]) * t;
  return { w, presence: a.presence + (b.presence - a.presence) * t };
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/**
 * How the viewport maps onto the world. `hs` = viewport heights per stretch unit (so peaks keep
 * sane proportions on any aspect); `wvis` = how many stretch units are visible.
 */
export function framing(aspect: number): { hs: number; wvis: number; portrait: number } {
  const hs = aspect >= 1.15 ? Math.min(aspect, 1.9) : 0.92 + 0.23 * smooth(0.45, 1.15, aspect);
  return { hs, wvis: aspect / hs, portrait: smooth(1.05, 0.62, aspect) };
}

/** Left edge of the view (world units) for a fractional stretch position. */
// Where the view of stretch j starts (offset within the stretch, world units).
function viewOffset(j: number, wvis: number) {
  if (wvis >= 1) return -(wvis - 1) * 0.5; // wider than a stretch: centre it
  // narrower (portrait): keep the host peak at ~62% across, but stay inside the stretch
  const hx = HOST_X[((j % STRETCH_COUNT) + STRETCH_COUNT) % STRETCH_COUNT];
  return Math.min(1 - wvis, Math.max(0, hx - wvis * 0.62));
}

export function cameraLeft(stretch: number, wvis: number): number {
  const k = Math.floor(stretch);
  const f = stretch - k;
  const off = (j: number) => viewOffset(j, wvis);
  const a = off(k), b = off(k + 1);
  const e = f * f * (3 - 2 * f);
  return stretch + a + (b - a) * e;
}

/**
 * Resolve a spec into per-plane numbers for this aspect. Presence lowers and pales the whole
 * range (reading pages); portrait screens lift the horizon so a pale host rises behind the copy.
 */
export function resolve(s: Spec, aspect: number): Resolved {
  const { portrait: pf } = framing(aspect);
  // (the presence fields are set at the end)
  const P: Omit<Resolved, 'hsc' | 'drop' | 'wlift' | 'presence' | 'portrait'> & Partial<Resolved> = { base: [], amp: [], foot: [], fade: [], ink: [], floor: [], role: { far: 0, guest: 0, host: 0, near: 0, fg: 0 }, hostW: 0, flank: 0, near: 0, wvis: 1 };
  let tw = 0;
  for (const k of DISTANCES) tw += s.w[k];
  tw = tw || 1;
  for (const k of DISTANCES) {
    const wt = s.w[k] / tw;
    if (!wt) continue;
    const pr = PRESETS[k];
    for (const f of ['base', 'amp', 'foot', 'fade', 'ink', 'floor'] as const) {
      for (let l = 0; l < LAYERS; l++) P[f][l] = (P[f][l] || 0) + pr[f][l] * wt;
    }
    for (const r in P.role) P.role[r as Weighted] += pr.role[r as Weighted] * wt;
    P.hostW += pr.hostW * wt;
    P.flank += pr.flank * wt;
  }
  const p = s.presence;
  const hsc = 0.7 + 0.3 * p;            // presence 0.55 -> 0.835x the height
  const drop = (1 - p) * 0.06;          // ...and a little lower
  const inkK = 0.6 + 0.4 * p;           // ...and paler
  // portrait: raise the far planes so a pale range fills the lower half behind the copy; the
  // host stays below the stacked name (summits ~55-60% up the screen)
  const lift = [0.10, 0.08, 0.02, 0.0, 0.0];
  const hw = s.w.high / tw;               // 'high' needs the most taming on a phone
  const ampP = [1, 1, 0.9 - 0.34 * hw, 0.85, 0.9];
  for (let l = 0; l < LAYERS; l++) {
    const pl = lift[l] * pf;
    P.base[l] = P.base[l] * hsc - drop + pl;
    P.amp[l] *= hsc * (1 + (ampP[l] - 1) * pf);
    P.foot[l] = P.foot[l] * hsc - drop + pl;
    P.ink[l] *= inkK * (l < 3 ? 1 - 0.1 * pf : 1);
  }
  // the portrait near crest: aspect < 0.8 only (desktop framing is untouched), and only where the
  // landscape is at full presence (home, contact, 404), never under reading pages
  const nf = smooth(0.8, 0.7, aspect) * smooth(0.75, 0.95, p);
  if (nf > 0) {
    for (const f of ['base', 'amp', 'floor', 'foot', 'fade'] as const) P[f][LAYERS - 1] += (PORTRAIT_NEAR[f] - P[f][LAYERS - 1]) * nf;
  }
  P.near = nf;
  P.hsc = hsc;
  P.drop = drop;
  P.wlift = 0.05 * pf;                    // the waterline rises with the far planes on portrait
  P.wvis = framing(aspect).wvis;
  P.presence = p;
  P.portrait = pf;
  return P as Resolved;
}

/**
 * Massifs that can touch the world window [u0, u1], flattened per plane:
 * out[l] = [centre, leftHalfWidth, rightHalfWidth, gain, isHost, ...]; out.echo = [plane, centre, scale, gain, ...]
 */
export type Massifs = number[][] & { echo: number[] };
export function massifs(u0: number, u1: number, P: Resolved): Massifs {
  const out = Array.from({ length: LAYERS }, (): number[] => []) as Massifs;
  out.echo = [];   // [plane, centre, scale, gain, ...] of the echo rows
  for (let k = Math.floor(u0) - 1; k <= Math.floor(u1) + 1; k++) {
    let rows = P.flank > 0.01 ? tableFor(k).concat(FLANK.map((m) => [...m.slice(0, 3), m[3] * P.flank, m[4]] as Massif)) : tableFor(k);
    if (P.near > 0.01 && P.wvis < 1 && k >= 0 && k < STRETCH_COUNT && !SCENES[k].water) {   // open water keeps no near crag
      const o = viewOffset(k, P.wvis);
      rows = rows.concat(PORTRAIT_CRAGS.map(([x, w, g]): Massif => [LAYERS - 1, o + x * P.wvis, w * P.wvis, g * P.near, 'near']));
    }
    rows.forEach(([l, x, w, g, role], j) => {
      if (role === 'echo') { out.echo.push(l, k + x, w, g); return; }
      const host = role === 'host';
      const ww = w * (host ? P.hostW : 1);
      const c = k + x;
      if (c + ww * 4 < u0 || c - ww * 4 > u1) return;
      // mountains are never symmetric: one flank long, the other a cliff
      const skew = (skewHash(k * 31 + j) - 0.5) * 0.7;
      out[l].push(c, ww * (1 + skew), ww * (1 - skew), g * P.role[role], host ? 1 : 0);
    });
  }
  return out;
}
export const MASSIF_STRIDE = 5;
function skewHash(i: number) {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}


// ---------------------------------------------------------------- windows (round 4a, SPEC-R4A §7, §12.4)
// A window (the page's strip, its closing) is a box on the page that the painting shows through. Inside a window
// the scene keeps natural proportions (HS viewport heights per stretch, a 1440 x 900 view's) at its own scale,
// and always uses the desktop composition (no portrait transforms): a phone sees a crop of the same painting.

/** Viewport heights per stretch inside a window. */
export const HS = 1.6;
/** A window's painted feathers, CSS px [top, bottom]: out of the paper at its top, back into it at its bottom (phones
 *  and sideways phones: narrow; tablets: their own, a 220 px band; wide screens: wide). A document's strip has half
 *  of each. */
export const FEATHER: Record<'narrow' | 'tablet' | 'wide', [top: number, bottom: number]> = { narrow: [24, 26], tablet: [30, 36], wide: [40, 56] };
/** The feathers of a width class. */
export const featherOf = (cls: WidthClass) => (cls === 'phone' || cls === 'short' ? FEATHER.narrow : cls === 'tablet' ? FEATHER.tablet : FEATHER.wide);
/** Figure geometry is authored at this many CSS px per stretch (so 900 CSS px per viewport height). */
export const REF_PX = 1440;
/** The text block's right edge to the scene's focus, at least (CSS px). */
export const KEEP_GAP = 180;

const clampK = (k: number) => Math.min(STRETCH_COUNT - 1, Math.max(0, k));

/** The width class of a viewport (SPEC-R4A §2.4): 'wide' >= 1200, 'short' < 500 tall, 'tablet' >= 640, else 'phone'. */
export function widthClass(w: number, h: number): WidthClass {
  if (w >= 1200) return 'wide';
  if (h > 0 && h < 500) return 'short';
  return w >= 640 ? 'tablet' : 'phone';
}

/** A stretch's own page composition (distance, presence), as its page sets it. */
export function pageSpec(stretch: number): { distance: Distance; presence: number } {
  const [distance, presence] = SCENES[clampK(Math.round(Number(stretch) || 0))].page;
  return { distance, presence };
}

/** A window's CSS box, for framingAt (see there). */
export interface FramingBox {
  width?: number;
  height?: number;
  keepoutRight?: number | null;
  doc?: boolean;
  twin?: boolean;
}
/** Where a window looks: world x (stretches) at its left edge, scene height at its top, CSS px per stretch, the focus
 *  in box px. */
export interface Framing {
  worldLeft: number;
  worldTop: number;
  scale: number;
  focus: [number, number];
}

/**
 * Where a window onto stretch `stretch` looks (DOM-free; the lab and QA call it too).
 * @param {number} stretch
 * @param {'wide'|'tablet'|'phone'|'short'} cls
 * @param {{width:number, height:number, keepoutRight?:number|null, doc?:boolean, twin?:boolean}} box  the window's CSS
 *   box; keepoutRight = the text block's right edge inside it (CSS px from the box's left), when the text overlaps the
 *   box (wide screens); doc = a document's low strip (strip--doc; unused since round 5: every inner page has the one hero);
 *   twin = (a closing) the page's strip and its closing share a screen (a short page), so the closing frames a
 *   different view of the place (frame.closing.twin) instead of a small version of the opening
 * @param {'strip'|'closing'} kind  the closing shows the page's own place once more (DESIGN 11.B), never the next one
 * @returns {{worldLeft:number, worldTop:number, scale:number, focus:[number, number], nominal:number}}  world x
 *   (stretches) at the box's left edge, scene height (viewport heights) at its top edge, CSS px per stretch, the focus
 *   in box px, and the nominal scale (CSS px per stretch) this window's figure layer is drawn at.
 */
export function framingAt(stretch: number, cls: WidthClass = 'wide', box: FramingBox = {}, kind: WindowKind = 'strip'): Framing & { nominal: number } {
  const k = clampK(Math.round(Number(stretch) || 0));
  const F = SCENES[k].frame;
  const width = Math.max(1, +box.width! || 1440);   // (no width: NaN, then the default)
  const height = Math.max(1, +box.height! || 360);
  const kr = box.keepoutRight === null || box.keepoutRight === undefined || !Number.isFinite(+box.keepoutRight) ? null : +box.keepoutRight;
  // Home keeps its own hero (F.wide and the class views); every other place takes the one hero rule (HERO)
  const own = !!F.wide;
  // (Home's narrow views; the others never read T)
  const T = ((cls === 'short' ? F.short || F.phone : F[cls]) || F.tablet) as View;
  // the shared horizon: the river's waterline, HERO.at down the box, at this scale
  const heroTop = (sc: number) => HERO.horizon + HERO.at * height * HS / sc;
  let scale: number, left: number, top: number, fu: number, fy: number, nominal: number, ku: number | undefined, spanned = false;
  if (kind === 'closing' && !own) {
    // the place once more, a little further away, its focus in the middle (nothing stands over a closing); a short page's
    // twin, on the same screen as its strip, looks closer at another part of the place (its own u), so the strip's
    // landmark and figures are never shown twice (DESIGN 4.6)
    const twin = !!box.twin && F.twinU !== undefined;
    scale = nominal = heroScale(cls, width) * (twin ? HERO.twin : HERO.closing);
    fu = twin ? F.twinU! : F.focus[0];
    fy = F.focus[1];
    left = k + fu - 0.5 * width / scale;
    top = heroTop(scale);
    ku = twin ? fu : undefined;
  } else if (kind === 'closing') {
    // Home's: the page's own place once more: a span (spanFrame), a band (bandFrame) or a point at (fx, fy), from the
    // closing's own data
    const C = closingOf(F, cls, T, !!box.twin);
    if (C.span) { ({ scale, left, top, fu } = spanFrame(k, C, cls, width, height, kr)); spanned = true; }
    else if (C.band) ({ scale, left, top, fu } = bandFrame(k, C, cls, width, height, false, F.focus[0]));
    else {
      scale = C.scale!;
      fu = C.u ?? F.focus[0];
      left = k + fu - C.fx! * (width / scale);
      top = (C.y ?? F.focus[1]) + C.fy! * height * HS / scale;
    }
    fy = C.y ?? F.focus[1];
    nominal = C.scale ?? scale;
    ku = C.keepU ?? F.keepU ?? fu;
    // hug: the place stands right beside the text (its keepU exactly KEEP_GAP right of it) whatever the width, so a wide
    // screen shows more of the place's own open water and mist rather than the neighbour beyond the text
    if (C.hug && !spanned && kr !== null && kr > 0) left = k + ku - (kr + KEEP_GAP) / scale;
  } else if (own && cls !== 'wide') {
    // Home's album leaf on narrow screens: a band of its scene (bandFrame), or a point at (fx, fy)
    if (T.band) ({ scale, left, top, fu } = bandFrame(k, T, cls, width, height, false, F.focus[0]));
    else {
      scale = T.scale;
      fu = F.focus[0];
      left = k + fu - T.fx! * (width / scale);
      top = F.focus[1] + T.fy! * height * HS / scale;
    }
    fy = F.focus[1];
    nominal = T.scale;
  } else {
    // the hero rule: one stretch is the box's width on wide screens (to 1700 px), a fixed scale below; the horizon HERO.at
    // down the box; the focus HERO.fx across (Home: its view's right edge at u 1, its mountain at the right)
    scale = nominal = heroScale(cls, width);
    fu = F.focus[0]; fy = F.focus[1];
    top = heroTop(scale);
    left = own ? k + (F.wide!.right ?? 1) - width / scale : k + fu - HERO.fx[cls] * width / scale;
  }
  // the keep-out rule: the scene's leftmost figurative point (frame.keepU, else the focus; a closing may name its own)
  // stands at least KEEP_GAP px right of the text, never past the box's right edge (a span is already placed beside the
  // text, and holds no figure: it never moves)
  ku ??= F.keepU ?? fu;
  let focusX = (k + fu - left) * scale;
  const keepX = (k + ku - left) * scale;
  if (!spanned && kr !== null && kr > 0 && keepX < kr + KEEP_GAP) {
    const shift = Math.min(kr + KEEP_GAP - keepX, Math.max(0, width - 24 - focusX));
    left -= shift / scale;
    focusX += shift;
  }
  return { worldLeft: left, worldTop: top, scale, focus: [focusX, (top - fy) * scale / HS], nominal };
}

/**
 * Round 5, one hero system (DESIGN §12 "Round 5"): every page's opening frames its place the same way, so from page to
 * page the scenes line up as the titles do. The river's waterline, the scroll's one horizon (`horizon`, scene heights),
 * sits `at` down the box; one stretch is the box's width on wide screens (to 1700 px) and a fixed `scale` below (CSS px
 * per stretch); the place's focus stands `fx` across the box (the keep-out rule may move it right of the text). Home's
 * taller hero keeps its own placement across (its mountain at the right, the name in its sky) and its album leaf on
 * narrow screens, but its horizon follows the same rule on wide ones. The closings follow it too, `closing` times the
 * scale (a little further away), the focus in the middle; a short page's twin closing (on its strip's screen) looks
 * closer, `twin` times the scale, at another part of the place (Frame.twinU).
 */
export const HERO: {
  horizon: number;
  at: number;
  fx: Record<WidthClass, number>;
  scale: Record<Exclude<WidthClass, 'wide'>, number>;
  closing: number;
  twin: number;
} = {
  horizon: 0.289,
  at: 0.66,
  fx: { wide: 0.694, tablet: 0.6, phone: 0.56, short: 0.6 },
  scale: { tablet: 1000, phone: 820, short: 560 },
  closing: 0.8,
  twin: 1.6,
};
/** The hero rule's scale for a width class and a box width: CSS px per stretch. */
export function heroScale(cls: WidthClass, width: number): number {
  return cls === 'wide' ? Math.min(width, 1700) : HERO.scale[cls];
}
/** The scale a window's figure layer is drawn at for stretch k (the strip's): Home's own view on narrow screens, else
 *  the hero rule's. */
export function layerScaleAt(k: number, cls: WidthClass, width: number): number {
  const F = SCENES[clampK(Math.round(k))].frame;
  if (F.wide && cls !== 'wide') return ((cls === 'short' ? F.short || F.phone : F[cls]) || F.tablet)!.scale;
  return heroScale(cls, width);
}

// The closing's framing for a width class (DESIGN 11.B): a short page's twin (a different view of the place, when the
// strip and the closing share a screen), else the class's own closing (wide: authored; narrower: the opening's own
// framing, under any overrides), so the page ends on its own place, never on the next one.
const CLOSING_WIDE: ClosingView = { scale: 900, band: [0.12, 0.5], right: 1 };
function closingOf(F: Frame, cls: WidthClass, T: View, twin: boolean): ClosingView {
  const c: NonNullable<Frame['closing']> = F.closing || {};
  const tw = twin && c.twin ? c.twin[cls] : undefined;
  if (tw) return tw;
  const own = c[cls];
  if (cls === 'wide') return own || CLOSING_WIDE;
  return own ? { ...T, ...own } : T;
}

/**
 * A band of the scene in a window (round 4a, fixer 10 Oct): the band's summits [y0, y1] (scene heights) sit just under
 * the window's top feather, never cut by it (a strip shows whole mountains and lets only the mist dissolve into the
 * paper), and its ground (Home's traveller) above the bottom feather when the box is tall enough; else the summits
 * win. The scale fits the band to the box within 0.8-1.15 of the class's nominal scale T.scale (the figure layers are
 * drawn at the nominal one). Horizontally: T.u at T.fx of the width (or the view's right edge at T.right), kept inside
 * [T.uMin, T.uMax] (stretch-local) where the width allows.
 */
function bandFrame(k: number, T: ClosingView, cls: WidthClass, width: number, height: number, doc: boolean, u: number) {
  const [y0, y1] = T.band!;
  const dk = doc ? 0.5 : 1;
  const [ft, fb] = featherOf(cls).map((v) => v * dk);
  const fbIn = T.fbIn ?? 0.5;   // how far into the bottom feather the ground may sit (0: Home's traveller stays clear of it)
  const fit = (Math.max(8, height - ft - fb * (1 - fbIn)) * HS) / Math.max(0.02, y1 - y0);
  const scale = Math.min(T.scale! * 1.15, Math.max(T.scale! * 0.8, fit));
  const top = bandTop(T, cls, height, scale, dk);
  const fu = T.u ?? u;
  const vw = width / scale;
  // (a wide closing anchors the view's right edge at T.right instead: the place stays at the right whatever the width)
  let left = T.right !== undefined ? k + T.right - vw : k + fu - (T.fx ?? 0.5) * vw;
  if (T.uMax !== undefined && left + vw > k + T.uMax) left = k + T.uMax - vw;
  if (T.uMin !== undefined && left < k + T.uMin) left = k + T.uMin;
  return { scale, left, top, fu };
}

/** The top (scene height at the box's top edge) that puts a band's summits (band[1]) just under the top feather, and
 *  its ground (band[0]) above the bottom one when the box is tall enough at this scale (else the summits win). */
function bandTop(T: ClosingView, cls: WidthClass, height: number, scale: number, dk = 1) {
  const [y0, y1] = T.band!;
  const [ft, fb] = featherOf(cls).map((v) => v * dk);
  const fbIn = T.fbIn ?? 0.5;
  const unit = HS / scale;
  const topA = y1 + ft * unit, topB = y0 + (height - fb * (1 - fbIn)) * unit;
  return topB > topA ? topA + (topB - topA) * (T.slack ?? 0.5) : topA;
}

/**
 * A span of the place (final review r2, item 1; a twin closing): the part of the box right of the text (its keep-out
 * edge `kr`, where the text overlaps the box on wide screens; else the whole box) holds exactly stretch-local
 * T.span [u0, u1], so the scale follows the width: no width, from a 320 phone to an ultrawide, shows past the span
 * (into a neighbour's scene, a figure layer, or the strip's landmark). Vertically the band's summits (T.band[1]) sit
 * just under the top feather (bandTop). Left of `kr` the keep-out's mist covers whatever lies beyond u0.
 */
function spanFrame(k: number, T: ClosingView, cls: WidthClass, width: number, height: number, kr: number | null) {
  const [u0, u1] = T.span!;
  const x0 = kr !== null && kr > 0 ? Math.min(kr, width * 0.6) : 0;   // (a text over most of the box: its right 40 %)
  const scale = (width - x0) / Math.max(0.05, u1 - u0);
  return { scale, left: k + u1 - width / scale, top: bandTop(T, cls, height, scale), fu: T.u ?? (u0 + u1) / 2 };
}

/**
 * The framing of a window while the camera is at a fractional stretch (a pan): every field moves smoothly from
 * one stretch's framing to the next, the way cameraLeft() blends the round-3 views.
 */
export function framingBlend(s: number, cls: WidthClass, box: FramingBox, kind: WindowKind): Framing {
  const k = clampK(Math.floor(s));
  const f = Math.min(1, Math.max(0, s - k));
  const A = framingAt(k, cls, box, kind);
  if (f <= 1e-6 || k + 1 >= STRETCH_COUNT) return { ...A, worldLeft: A.worldLeft + (s - k) };
  const B = framingAt(k + 1, cls, box, kind);
  const e = f * f * (3 - 2 * f);
  const offA = A.worldLeft - k, offB = B.worldLeft - (k + 1);
  return {
    worldLeft: s + offA + (offB - offA) * e,
    worldTop: A.worldTop + (B.worldTop - A.worldTop) * e,
    scale: A.scale + (B.scale - A.scale) * e,
    focus: [A.focus[0] + (B.focus[0] - A.focus[0]) * e, A.focus[1] + (B.focus[1] - A.focus[1]) * e],
  };
}
