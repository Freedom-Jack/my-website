// compose.ts — where the mountains stand along the one continuous handscroll.
//
// World x is measured in "stretches": stretch k spans [k, k + 1], which is exactly one desktop
// viewport wide. Every stretch has its own composition (a host peak, guest peaks, near crags and
// empty paper where the text sits), written as Gaussian "massifs" on the five ridge planes.
// Massifs of neighbouring stretches overlap at the seams, so the envelope (and the ridges built
// on it) is one continuous function of world x: panning between stretches unrolls the scroll.
// Each stretch is also a scene ("source to sea": peak, river, path, lake, shore, crossing, lone peak).
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
  // 1 · river: the market town at the rainbow bridge (round 4a). A river runs across the middle distance (the
  // scene's water, with a near bank); the town stands on its far bank (figures.ts) and the hills rise behind it
  // out of the mist, lower than the home peak, so town, bridge and hills fit one strip (fixer: a little lower again,
  // so their summits sit inside the wide strip instead of running into its top). A crag at the seam: the
  // road leaves the town past it, toward the fields. (4b: the hill behind the east end of the town is a broad, rounded
  // hill, u .77; as a narrow cone it read as a spire, a pagoda's, beside the reading column: DESIGN §4.6.)
  [
    [0, 0.30, 0.26, 0.30, 'far'], [0, 0.80, 0.24, 0.34, 'far'],
    [1, 0.42, 0.10, 0.48, 'guest'], [1, 0.97, 0.09, 0.52, 'guest'],
    [2, 0.47, 0.06, 0.40, 'host'], [2, 0.585, 0.055, 0.52, 'host'], [2, 0.675, 0.05, 0.64, 'host'],
    [2, 0.775, 0.115, 0.42, 'host'], [2, 0.875, 0.05, 0.44, 'host'],
    [3, 1.03, 0.07, 0.62, 'near'],
    [4, 1.06, 0.06, 0.4, 'fg'],
  ],
  // 2 · a tall, narrow host far right; twin pale guests in the middle distance
  [
    [0, 0.46, 0.30, 0.6, 'far'], [0, 0.96, 0.20, 0.45, 'far'],
    [1, 0.30, 0.12, 0.35, 'guest'], [1, 0.60, 0.09, 0.7, 'guest'], [1, 0.68, 0.07, 0.55, 'guest'],
    [2, 0.83, 0.065, 1.0, 'host'], [2, 0.91, 0.06, 0.65, 'host'], [2, 0.72, 0.07, 0.4, 'host'],
    [3, 0.76, 0.07, 0.85, 'near'], [3, 0.98, 0.08, 0.6, 'near'],
    [4, 0.12, 0.18, 0.7, 'fg'], [4, 0.58, 0.10, 0.28, 'fg'],
  ],
  // 3 · lake: a still lake. A low far shore (gentle hills on the right, long pale ranges behind) stands
  // on the waterline; the near and middle distance are open water. The near crag of stretch 2 is the
  // headland at its left; stretch 4's foreground crag is the shore at its right.
  [
    [0, 0.18, 0.30, 0.34, 'far'], [0, 0.68, 0.30, 0.48, 'far'],
    [1, 0.07, 0.09, 0.42, 'guest'], [1, 0.46, 0.14, 0.26, 'guest'], [1, 0.97, 0.10, 0.35, 'guest'],
    [2, 0.76, 0.07, 0.52, 'host'], [2, 0.84, 0.055, 0.34, 'host'], [2, 0.66, 0.05, 0.18, 'host'],
  ],
  // 4 · terraced fields (Résumé, fixer 10 Oct): low, rounded hills stepping down to the shore in bands, years of steady
  // work in rows like a record; no crag stands above them (SCENES[4].tech.terr draws the terraces, round smooths
  // the crests). A long, low far range behind.
  [
    [0, 0.30, 0.36, 0.26, 'far'], [0, 0.84, 0.30, 0.30, 'far'],
    [1, 0.22, 0.17, 0.30, 'guest'], [1, 0.60, 0.15, 0.36, 'guest'], [1, 0.98, 0.14, 0.30, 'guest'],
    [2, 0.44, 0.14, 0.50, 'host'], [2, 0.70, 0.13, 0.62, 'host'], [2, 0.93, 0.11, 0.46, 'host'],
    [3, 0.56, 0.12, 0.62, 'near'], [3, 0.84, 0.11, 0.68, 'near'],
    [4, 0.06, 0.16, 0.5, 'fg'],
  ],
  // 5 · crossing: open water in the near and middle distance. On the far shore, low pale ranges and,
  // on the right (clear of Contact's address), the home peak seen from across the water: an 'echo' row draws
  // stretch 0's host plane itself, sampled around its main summit (the crowned mass, the notch, the second
  // peak), at a fraction of its size on a far plane, so it takes the pale, soft ink of distance (ridges.ts, echo()).
  // [plane, x of the main summit, scale, gain, 'echo']
  [
    [0, 0.26, 0.34, 0.30, 'far'], [0, 0.86, 0.28, 0.34, 'far'],
    [1, 0.16, 0.09, 0.26, 'guest'], [1, 0.36, 0.11, 0.30, 'guest'], [1, 0.97, 0.07, 0.24, 'guest'],
    [1, 0.84, 0.5, 1.0, 'echo'],
  ],
  // 6 · a single peak standing alone in the mist (the 404): one host and nothing beside it but a far, pale range
  // low in the mist; no guest and no near crag (they made it read as another range)
  [
    [0, 0.44, 0.40, 0.26, 'far'],
    [2, 0.78, 0.15, 0.64, 'host'], [2, 0.66, 0.07, 0.24, 'host'],
    [4, 0.06, 0.12, 0.35, 'fg'],
  ],
];
// Before the scroll's first stretch and after its last there is only a far, pale range in the mist (the scroll begins
// and ends in mist), never a wrap-around to the other end's mountains: a phone's wide album leaf of Home looks a
// little to the left of u 0 and the 404's past u 7.
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
// fallback; the lake stays the palest scene through its page presence and its boneless wash.) Every
// field is a smooth window along world x (SEAM feather), so a pan between scenes never cuts. Only
// stretches 0..6 exist here (no wrap-around), so the home view never meets water.
//
// Round 4a adds, per scene: `page` (the page's own composition, SPEC-R4A §10.0: distance, presence), `frame`
// (how its strip and closing windows look at it, per width class: see framingAt), and on the river a near bank
// (`near`, the waterline of the near shore: land below it) and `shore: 0` (its far planes keep their own misty
// feet above the town instead of standing on the water). `figures` (figures.ts) are the scene's figure layer.
//
// frame: focus [u, y] is the scene's one focus (stretch-local u, scene height in viewport heights at presence 1);
//   keepU, the leftmost figurative point the keep-out rule keeps >= KEEP_GAP px right of the text (default: the focus).
//   wide   { top, minLeft? }      the scene's right edge at the window's right, `top` = scene height at the box's
//                                 top edge; the keep-out rule may move it left (focus >= keepoutRight + 180 px)
//   tablet / phone { scale, fx, fy }  `scale` CSS px per stretch; the focus at (fx, fy) of the box
//   short (optional)               sideways phones (else the phone's): a sliver of a strip needs a wider view
//   closing                        the page's own place once more (DESIGN 11.B), never the road to the next one:
//     wide { scale, band, right, hug?, keepU? }   a small version of the opening, framed as a band (bandFrame) with the
//                                 view's right edge at stretch-local `right` (hug: its keepU KEEP_GAP right of the text
//                                 instead, when the text overlaps it); `scale` is the nominal scale its figure layer is
//                                 drawn at (the band fits within 0.8-1.15 of it)
//     tablet / phone / short (optional)    overrides of that class's strip framing; without one, the closing frames
//                                 the place exactly as the class's opening does, in the closing's own box (sideways
//                                 phones never borrow the phone's)
//     twin { wide, tablet, phone }  a different view of the same place, for a short page whose closing shares a
//                                 screen with its strip (framingAt's box.twin): never the same picture twice, and never
//                                 the strip's figures or landmark again (Writing: the lake's west end; Contact: the
//                                 crossing's west, its low far shore over open water). A view may be a `span` [u0, u1]
//                                 (spanFrame) instead of a scale: the box right of the text holds exactly that much of
//                                 the stretch at any width (with `band` for its height)
//     keepU (each)                the leftmost figurative point the keep-out keeps clear (default: frame.keepU)

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
  /** Scene height at the box's top edge. */
  top: number;
  band?: Band;
  /** A document's low strip: its band and scale (at 1440), and where its focus sits down the box. */
  docBand?: Band;
  docScale?: number;
  docFy?: number;
  right?: number;
  slack?: number;
}
/** How the windows look at a scene, per width class (see the table above). */
export interface Frame {
  /** The scene's one focus: [stretch-local u, scene height]. */
  focus: [number, number];
  keepU?: number;
  wide: WideFrame;
  tablet: View;
  phone: View;
  short?: View;
  closing?: Partial<Record<WidthClass, ClosingView>> & { twin?: Partial<Record<WidthClass, ClosingView>> };
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
  /** The page's own composition: [distance, presence]. */
  page: [Distance, number];
  tech?: Tech;
  water?: Water;
  frame: Frame;
  /** Its figure set's name (sets/index.ts). */
  figures?: string;
}

export const SCENES: Scene[] = [
  // Narrow framings (fixer, 10 Oct): every strip shows its mountains whole. A `band` [y0, y1] puts the scene's highest
  // summits (the far range included) just under the top feather and its ground above the bottom one (bandFrame).
  { name: 'peak', page: ['level', 1],
    frame: {
      focus: [0.79, 0.2], keepU: 0.72,
      wide: { top: 0.655 },
      // tablet and phone: the whole mountain (summits 0.58) with the hut and the traveller (0.2) on a wider album leaf;
      // on phones the figures are drawn larger (figures.ts `big`), so the traveller stays >= 12 CSS px tall. The view
      // ends at u 1.06, before the river town; it may begin a little left of u 0, where the scroll opens in mist.
      tablet: { scale: 620, band: [0.195, 0.588], fbIn: 0, u: 0.76, fx: 0.62, uMax: 1.14 },
      phone: { scale: 270, band: [0.195, 0.588], fbIn: 0, u: 0.76, fx: 0.6, uMax: 1.06 },
      // sideways phones: an 80 px sliver holds the summits above their mist (the figures cannot read at that size)
      short: { scale: 600, band: [0.44, 0.588], u: 0.72, fx: 0.62, uMax: 1.06 },
      // closing: the whole mountain with the hut and the traveller, ending before the river town (the wide one only off
      // the living ground, which ends on the opening itself); on phones the summits sit lower in the taller box, so the
      // near crags at the scroll's left end stay in its bottom feather
      closing: { wide: { scale: 600, band: [0.19, 0.6], fbIn: 0, right: 1.06 }, phone: { slack: 1 } },
    },
    figures: 'home' },
  { name: 'river', page: ['deep', 0.8], tech: { at: [0.06, 0.98], bone: 1.0, ink: 1.5 },
    water: { at: [0.04, 1.0], y: 0.32, near: 0.235, strokes: 0.5, refl: 0.12, banks: 0, shore: 0,
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
    frame: {
      focus: [0.565, 0.272], keepU: 0.482,
      wide: { top: 0.565 },
      tablet: { scale: 1440, fx: 0.55, fy: 0.64 },
      // 4b: a band, so the whole town (its highest roofs and trees, 0.373) and the bridge's crown stand under the top
      // feather and its near foot (0.207) sits over the bottom one, the bridge left of centre, at 320-639 px. The
      // nominal scale (the layer's) is 1300 so the short strips (110-135 px) may look from as far as 1040 and still
      // hold the bridge's feet; a 390 x 844 phone frames it at about 1240 either way.
      phone: { scale: 1300, band: [0.205, 0.375], fx: 0.42 },
      short: { scale: 1000, fx: 0.42, fy: 0.5 },
      // closing: the bridge with the town behind it (the wide one only off the living ground)
      closing: { wide: { scale: 1100, band: [0.17, 0.42], right: 1.02 } },
    },
    figures: 'market' },
  { name: 'path', page: ['high', 0.8],
    frame: { focus: [0.83, 0.3], wide: { top: 0.66 }, tablet: { scale: 1440, fx: 0.6, fy: 0.62 }, phone: { scale: 1224, fx: 0.55, fy: 0.62 }, closing: { wide: { scale: 900, band: [0.1, 0.45], right: 1 } } } },
  // Writing: a still lake. Its strips hold the low far shore and its whole reflection: the waterline across the middle
  // of the band, the mirror below it (water.mirror: a still, whole reflection, few strokes). Ink only.
  { name: 'lake', page: ['level', 0.6], tech: { at: [-0.10, 1.02], bone: 0.1, ink: 1.0 }, water: { at: [-0.17, 0.98], y: 0.35, strokes: 0.25, refl: 1, banks: 1, mirror: 1 },
    frame: {
      focus: [0.74, 0.3],
      wide: { top: 0.56, band: [0.14, 0.43], docBand: [0.12, 0.4], docScale: 1300, right: 1.1 },
      tablet: { scale: 760, band: [0.14, 0.43], u: 0.66, fx: 0.5 },
      phone: { scale: 560, band: [0.14, 0.43], u: 0.7, fx: 0.5 },
      short: { scale: 520, band: [0.26, 0.43], u: 0.7, fx: 0.5, uMin: 0.03 },
      // closing: the lake with the pavilion (the Note). On Writing, whose closing shares the first screen with its strip
      // (any page of this place where they share a screen), the other end of the lake: looking west down the still water to the
      // long pale ranges and their faint reflection (at phone size with the headland at its left), the pavilion out of
      // frame (its layer starts at u 0.78). (Final review r1, item 1: the pavilion's corner close repeated the strip's
      // pine-over-pavilion on the same screen, the clip-art repetition DESIGN 4.6 bans; the story map carries it.)
      closing: {
        wide: { scale: 1060, band: [0.14, 0.4], right: 1.1 },
        phone: { u: 0.74 },   // (the closing's box is taller than the Note's strip: the pavilion kept clear of the right edge)
        twin: {
          // (spans, as Contact's: a fixed scale reached west to the road's peak, u 2.83, on wide screens and cut the
          // strip's own lake peak, u ~0.75, at the right edge on tablets; final review r2, the art verifier's fix)
          wide: { span: [0.0, 0.6], band: [0.22, 0.42] },
          tablet: { span: [0.0, 0.58], band: [0.24, 0.42] },
          phone: { scale: 460, band: [0.22, 0.42], u: 0.3, fx: 0.5, uMax: 0.62, keepU: 0.3 },
        },
      },
    } },
  // Résumé: terraced fields, low and banded (tech.terr), in pale malachite; a document's low strip, so it looks from a
  // little further away to hold whole hills.
  { name: 'shore', page: ['level', 0.5], tech: { at: [0.02, 0.98], bone: 0.5, ink: 1.15, terr: 1 },
    frame: {
      focus: [0.7, 0.2],
      wide: { top: 0.43, docBand: [0.11, 0.37], docScale: 1300, right: 1.08 },
      tablet: { scale: 760, band: [0.11, 0.37], u: 0.66, fx: 0.5 },
      // (final review r1, item 15: phones look closer, at the right hill's terraces, the farmhouse and the path, so the
      // rows of fields read at 390 and the low doc strip is not taken for Home's misted green-blue range; at 480 the two
      // hills sat small in the left half, and newcomers sorting the six strips confused the two)
      phone: { scale: 760, band: [0.12, 0.31], u: 0.7, fx: 0.48 },
      short: { scale: 520, band: [0.22, 0.37], u: 0.66, fx: 0.5, uMin: 0.02 },
      // closing: both terraced hills with the farmhouse on the right one's shoulder
      closing: { wide: { scale: 1000, band: [0.085, 0.36], right: 0.9, hug: true, keepU: 0.36 } },
    } },
  // Contact: the crossing, mostly water: the far shore (the echo of his mountain at the right) high in the band, the
  // open water below it in pale indigo with long ripples.
  { name: 'crossing', page: ['level', 0.9], tech: { at: [-0.02, 0.98], bone: 0.22, ink: 1.0, inkPortrait: 1.1 }, water: { at: [-0.06, 0.96], y: 0.36, strokes: 1, refl: 0.75, banks: 0.8 },
    frame: {
      focus: [0.78, 0.38],
      wide: { top: 0.58, band: [0.12, 0.485], slack: 0 },
      tablet: { scale: 660, band: [0.12, 0.485], u: 0.62, fx: 0.5, uMin: 0.0, uMax: 1.1 },
      phone: { scale: 560, band: [0.12, 0.485], u: 0.7, fx: 0.55 },
      short: { scale: 420, band: [0.32, 0.485], u: 0.66, fx: 0.5, uMin: 0.0 },
      // closing: the ferry at the jetty under the far mountain. Contact's closing shares the first screen with its strip,
      // so it looks the other way, west along the crossing: the far shore's long low ranges over the open water and its
      // long ripples, the part of the place the wide strip keeps under its title's mist. His mountain's echo (u 0.59-1.09)
      // and the ferry's layer (from u 0.5) stay out of it at every width (a span: its scale follows the width), so
      // nothing on the screen is shown twice. (Final review r1, item 1: the jetty close repeated the ferry, ferryman and
      // jetty; r2, item 1: the far shore's close then repeated the echo's double-peaked silhouette straight under the
      // strip's at 1512-1920 and on tablets. Left of u -0.13 the Résumé's terraced hills come in: the spans stop short.)
      closing: {
        wide: { scale: 920, band: [0.15, 0.485], right: 1.04, keepU: 0.6 },
        twin: {
          wide: { span: [-0.08, 0.49], band: [0.26, 0.46] },     // (right of the text: under it the keep-out's mist)
          tablet: { span: [-0.12, 0.49], band: [0.22, 0.46] },
          phone: { span: [-0.1, 0.49], band: [0.22, 0.46] },
        },
      },
    } },
  // The 404: one peak alone (the high distance: a tall host over a low far range), mist all round it.
  // 4b: on wide screens and tablets the summit (0.585) sits just under the top feather, so the path's climb (0.23-0.46,
  // its lower legs) comes up out of the bottom feather into view; wide, the view ends a little past the scroll's end in
  // mist, which moves the climb left, clear of the "Draft art" note's guard at the lower right.
  { name: 'lone-peak', page: ['high', 1],
    frame: {
      focus: [0.78, 0.4],
      wide: { top: 0.66, band: [0.2, 0.595], slack: 0, right: 1.05 },
      tablet: { scale: 530, band: [0.16, 0.595], u: 0.78, fx: 0.55, uMin: 0.05 },
      phone: { scale: 450, band: [0.16, 0.63], u: 0.78, fx: 0.5 },
      short: { scale: 340, band: [0.42, 0.63], u: 0.78, fx: 0.55, uMin: 0.05 },
      // (the 404 has no closing; a pan through this stretch still frames one)
      closing: { wide: { scale: 640, band: [0.16, 0.63], right: 1.04 } },
    } },
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
  let ws = 0, wy = 0, wsum = 0, bone = 1, ink = 1, strokes = 0, refl = 0, banks = 0, ny = 0, nsum = 0, shore = 0, terr = 0, mirror = 0;
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
      const t = win(u, k + sc.water.at[0], k + sc.water.at[1]);
      if (t <= 0) continue;
      ws = Math.max(ws, t);
      wy += sc.water.y * t; wsum += t;
      strokes += sc.water.strokes * t;
      refl += sc.water.refl * t;
      banks += (sc.water.banks || 0) * t;
      shore += (sc.water.shore ?? 1) * t;
      mirror += (sc.water.mirror || 0) * t;
      if (sc.water.near !== undefined) { ny += sc.water.near * t; nsum += t; }
    }
  }
  const tf = (y: number) => y * P.hsc - P.drop + P.wlift;
  out[0] = ws;
  out[1] = wsum > 0 ? tf(wy / wsum) : -1;
  out[2] = bone; out[3] = ink; out[4] = strokes; out[5] = refl; out[6] = banks;
  // the near bank (a river): land below this waterline; -1 = the water runs on to the bottom of the view
  out[7] = nsum > 0 ? tf(ny / nsum) : -1;
  // does the far shore stand on the water (lake, crossing: 1), or keep its own misty feet (the river: 0)?
  out[8] = wsum > 0 ? Math.min(1, shore / wsum) : 1;
  // terraces (the shore's fields: banded slopes, rounded crests) and a still mirror (the lake: its reflection whole)
  out[9] = Math.min(1, terr);
  out[10] = Math.min(1, mirror);
  return out;
}
/** Floats per column from sceneField(): water, waterline, bone, ink, strokes, refl, banks, near bank, shore, terraces,
 *  mirror. */
export const SCENE_FIELDS = 11;


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
 *   box (wide screens); doc = a document's low strip (strip--doc), framed on the band around the scene's focus;
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
  // (wide: its own branches below never read T)
  const T = ((cls === 'short' ? F.short || F.phone : F[cls]) || F.tablet) as View;
  let scale: number, left: number, top: number, fu: number, fy: number, nominal: number, ku: number | undefined, spanned = false;
  if (kind === 'closing') {
    // the page's own place once more: a span (spanFrame), a band (bandFrame) or a point at (fx, fy), from the closing's
    // own data
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
  } else if (cls === 'wide') {
    // one stretch is the box's width (today's scale), up to 1700 px on very wide screens; a document's low strip may
    // look from further away (wide.docScale, at 1440), so its band holds whole hills
    scale = nominal = Math.min(width, 1700) * (box.doc && F.wide.docScale ? F.wide.docScale / 1440 : 1);
    fu = F.focus[0]; fy = F.focus[1]; left = k + (F.wide.right ?? 1) - width / scale;
    // a document's low strip (Résumé, the Note) frames the band around the focus, not the tall strip's sky
    top = box.doc ? F.focus[1] + (F.wide.docFy ?? 0.62) * height * HS / scale : F.wide.top;
    // a band (as on narrow screens): its summits just under the top feather, the rest of the box below them
    const B = box.doc ? F.wide.docBand : F.wide.band;
    if (B) {
      const dk = box.doc ? 0.5 : 1;
      const unit = HS / scale, ft = FEATHER.wide[0] * dk, fb = FEATHER.wide[1] * dk;
      const topA = B[1] + ft * unit, topB = B[0] + (height - fb * 0.5) * unit;
      top = topB > topA ? topA + (topB - topA) * (F.wide.slack ?? 0.5) : topA;
    }
  } else if (T.band) {
    // a band of the scene, see bandFrame()
    ({ scale, left, top, fu } = bandFrame(k, T, cls, width, height, !!box.doc, F.focus[0]));
    fy = F.focus[1];
    nominal = T.scale;
  } else {
    scale = nominal = T.scale;
    fu = F.focus[0]; fy = F.focus[1];
    left = k + fu - T.fx! * (width / scale);
    top = fy + T.fy! * height * HS / scale;
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
