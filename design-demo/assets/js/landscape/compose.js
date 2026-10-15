// compose.js — where the mountains stand along the one continuous handscroll.
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
// Nothing here touches the DOM or WebGL; ridges.js samples it for both renderers and for stripSVG().

export const LAYERS = 5; // ridge planes, far (0) -> near (4)

// Massif: [plane, x within the stretch (0..1 = one desktop viewport), half-width, gain, role]
// Roles let the distance presets re-balance a composition: the host peak grows in 'high',
// far ranges and guests multiply in 'deep', and so on.
const STRETCHES = [
  // 0 · home: the hero study's composition. The upper left stays open for the name.
  [
    [0, 0.22, 0.24, 0.5, 'far'], [0, 0.62, 0.30, 0.7, 'far'],
    [1, 0.04, 0.15, 0.55, 'guest'], [1, 0.50, 0.18, 0.45, 'guest'], [1, 0.97, 0.20, 0.8, 'guest'],
    [2, 0.66, 0.10, 0.8, 'host'], [2, 0.77, 0.09, 1.0, 'host'], [2, 0.40, 0.12, 0.2, 'guest'],
    [3, 0.91, 0.12, 1.0, 'near'], [3, 1.02, 0.10, 0.55, 'near'], [3, 0.60, 0.07, 0.15, 'near'],
    [4, 0.02, 0.22, 0.95, 'fg'], [4, 0.26, 0.12, 0.35, 'fg'], [4, 1.02, 0.06, 0.4, 'fg'],
  ],
  // 1 · river: the market town at the rainbow bridge (round 4a). A river runs across the middle distance (the
  // scene's water, with a near bank); the town stands on its far bank (figures.js) and the hills rise behind it
  // out of the mist, lower than the home peak, so town, bridge and hills fit one strip (fixer: a little lower again,
  // so their summits sit inside the wide strip instead of running into its top). A crag at the seam: the
  // road leaves the town past it, toward the fields.
  [
    [0, 0.30, 0.26, 0.30, 'far'], [0, 0.80, 0.24, 0.34, 'far'],
    [1, 0.42, 0.10, 0.48, 'guest'], [1, 0.97, 0.09, 0.52, 'guest'],
    [2, 0.47, 0.06, 0.40, 'host'], [2, 0.585, 0.055, 0.52, 'host'], [2, 0.675, 0.05, 0.64, 'host'],
    [2, 0.765, 0.055, 0.56, 'host'], [2, 0.875, 0.05, 0.44, 'host'],
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
  // peak), at a fraction of its size on a far plane, so it takes the pale, soft ink of distance (ridges.js, echo()).
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
const QUIET = [[0, 0.40, 0.42, 0.30, 'far'], [1, 0.70, 0.22, 0.20, 'guest']];
// 'deep' frames every stretch with a near flank on the left, so the eye travels down a valley
// into the mist towards the host.
const FLANK = [[3, 0.03, 0.07, 0.25, 'near'], [4, -0.02, 0.12, 0.5, 'fg'], [2, 0.12, 0.10, 0.3, 'guest']];
export const STRETCH_COUNT = STRETCHES.length;
const HOST_X = STRETCHES.map((s) => {
  let best = s[0];
  for (const m of s) {
    if (m[4] === 'echo') return m[1];   // the crossing frames its echo of the home peak
    if (m[4] === 'host' && m[3] >= (best[4] === 'host' ? best[3] : -1)) best = m;
  }
  return best[1];
});
const tableFor = (k) => (k < 0 || k >= STRETCH_COUNT ? QUIET : STRETCHES[k]);

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
// feet above the town instead of standing on the water). `figures` (figures.js) are the scene's figure layer.
//
// frame: focus [u, y] is the scene's one focus (stretch-local u, scene height in viewport heights at presence 1);
//   keepU, the leftmost figurative point the keep-out rule keeps >= KEEP_GAP px right of the text (default: the focus).
//   wide   { top, minLeft? }      the scene's right edge at the window's right, `top` = scene height at the box's
//                                 top edge; the keep-out rule may move it left (focus >= keepoutRight + 180 px)
//   tablet / phone { scale, fx, fy }  `scale` CSS px per stretch; the focus at (fx, fy) of the box
//   short (optional)               sideways phones (else the phone's): a sliver of a strip needs a wider view
//   closing { u, y, fx, fy, scale? }  the road toward the next place: point (u, y) at (fx, fy) of the box
export const SCENES = [
  // Narrow framings (fixer, 10 Oct): every strip shows its mountains whole. A `band` [y0, y1] puts the scene's highest
  // summits (the far range included) just under the top feather and its ground above the bottom one (bandFrame);
  // a `cband` does the same for the closing; `cscale` keeps a closing's own scale where its strip's changed.
  { name: 'peak', page: ['level', 1],
    frame: {
      focus: [0.79, 0.2], keepU: 0.72,
      wide: { top: 0.655 },
      // tablet and phone: the whole mountain (summits 0.58) with the hut and the traveller (0.2) on a wider album leaf;
      // on phones the figures are drawn larger (figures.js `big`), so the traveller stays >= 12 CSS px tall. The view
      // ends at u 1.06, before the river town; it may begin a little left of u 0, where the scroll opens in mist.
      tablet: { scale: 620, band: [0.195, 0.588], fbIn: 0, u: 0.76, fx: 0.62, uMax: 1.14, cband: [0.16, 0.6], cu: 1.0, cfx: 0.5 },
      phone: { scale: 270, band: [0.195, 0.588], fbIn: 0, u: 0.76, fx: 0.6, uMax: 1.06, cband: [0.16, 0.6], cu: 1.0, cfx: 0.5 },
      // sideways phones: an 80 px sliver holds the summits above their mist (the figures cannot read at that size)
      short: { scale: 600, band: [0.44, 0.588], u: 0.72, fx: 0.62, uMax: 1.06 },
      closing: { u: 1.02, y: 0.22, fx: 0.62, fy: 0.94 },
    },
    figures: 'home' },
  { name: 'river', page: ['deep', 0.8], tech: { at: [0.06, 0.98], bone: 1.0, ink: 1.5 },
    water: { at: [0.04, 1.0], y: 0.32, near: 0.235, strokes: 0.5, refl: 0.12, banks: 0, shore: 0 },
    frame: {
      focus: [0.565, 0.272], keepU: 0.482,
      wide: { top: 0.565 },
      tablet: { scale: 1440, fx: 0.55, fy: 0.64 },
      phone: { scale: 1440, fx: 0.42, fy: 0.42 },
      short: { scale: 1000, fx: 0.42, fy: 0.5 },
      closing: { u: 0.93, y: 0.29, fx: 0.62, fy: 0.55 },
    },
    figures: 'market' },
  { name: 'path', page: ['high', 0.8],
    frame: { focus: [0.83, 0.3], wide: { top: 0.66 }, tablet: { scale: 1440, fx: 0.6, fy: 0.62 }, phone: { scale: 1224, fx: 0.55, fy: 0.62 }, closing: { u: 0.95, y: 0.2, fx: 0.62, fy: 0.6 } } },
  // Writing: a still lake. Its strips hold the low far shore and its whole reflection: the waterline across the middle
  // of the band, the mirror below it (water.mirror: a still, whole reflection, few strokes). Ink only.
  { name: 'lake', page: ['level', 0.6], tech: { at: [-0.10, 1.02], bone: 0.1, ink: 1.0 }, water: { at: [-0.17, 0.98], y: 0.35, strokes: 0.25, refl: 1, banks: 1, mirror: 1 },
    frame: {
      focus: [0.74, 0.3],
      wide: { top: 0.56, band: [0.14, 0.43], docBand: [0.12, 0.4], docScale: 1300, right: 1.1 },
      tablet: { scale: 760, band: [0.14, 0.43], u: 0.66, fx: 0.5, cscale: 1440 },
      phone: { scale: 560, band: [0.14, 0.43], u: 0.7, fx: 0.5, cscale: 1224 },
      short: { scale: 520, band: [0.26, 0.43], u: 0.7, fx: 0.5, uMin: 0.03, cscale: 1224 },
      closing: { u: 0.9, y: 0.3, fx: 0.62, fy: 0.55 },
    } },
  // Résumé: terraced fields, low and banded (tech.terr), in pale malachite; a document's low strip, so it looks from a
  // little further away to hold whole hills.
  { name: 'shore', page: ['level', 0.5], tech: { at: [0.02, 0.98], bone: 0.5, ink: 1.15, terr: 1 },
    frame: {
      focus: [0.7, 0.2],
      wide: { top: 0.43, docBand: [0.11, 0.37], docScale: 1300, right: 1.08 },
      tablet: { scale: 760, band: [0.11, 0.37], u: 0.66, fx: 0.5, cscale: 1440 },
      phone: { scale: 480, band: [0.11, 0.37], u: 0.68, fx: 0.5, cscale: 760 },
      short: { scale: 520, band: [0.22, 0.37], u: 0.66, fx: 0.5, uMin: 0.02, cscale: 760 },
      closing: { u: 0.95, y: 0.2, fx: 0.62, fy: 0.6 },
    } },
  // Contact: the crossing, mostly water: the far shore (the echo of his mountain at the right) high in the band, the
  // open water below it in pale indigo with long ripples.
  { name: 'crossing', page: ['level', 0.9], tech: { at: [-0.02, 0.98], bone: 0.22, ink: 1.0, inkPortrait: 1.1 }, water: { at: [-0.06, 0.96], y: 0.36, strokes: 1, refl: 0.75, banks: 0.8 },
    frame: {
      focus: [0.78, 0.38],
      wide: { top: 0.58, band: [0.12, 0.485], slack: 0 },
      tablet: { scale: 660, band: [0.12, 0.485], u: 0.62, fx: 0.5, uMin: 0.0, uMax: 1.1, cscale: 1440 },
      phone: { scale: 560, band: [0.12, 0.485], u: 0.7, fx: 0.55, cscale: 1224 },
      short: { scale: 420, band: [0.32, 0.485], u: 0.66, fx: 0.5, uMin: 0.0, cscale: 1224 },
      closing: { u: 0.84, y: 0.38, fx: 0.66, fy: 0.58 },
    } },
  // The 404: one peak alone (the high distance: a tall host over a low far range), mist all round it.
  { name: 'lone-peak', page: ['high', 1],
    frame: {
      focus: [0.78, 0.4],
      wide: { top: 0.66, band: [0.2, 0.63], slack: 0 },
      tablet: { scale: 530, band: [0.16, 0.63], u: 0.78, fx: 0.55, uMin: 0.05, cscale: 1440 },
      phone: { scale: 450, band: [0.16, 0.63], u: 0.78, fx: 0.5, cscale: 1224 },
      short: { scale: 340, band: [0.42, 0.63], u: 0.78, fx: 0.55, uMin: 0.05, cscale: 1224 },
      closing: { u: 0.9, y: 0.25, fx: 0.62, fy: 0.6 },
    } },
];
const SEAM = 0.09;
const win = (u, a, b) => smooth(a - SEAM, a + SEAM, u) * (1 - smooth(b - SEAM, b + SEAM, u));

/** Scene name at a stretch (rounded). */
export function sceneName(stretch) {
  const k = Math.round(Number(stretch) || 0);
  return SCENES[((k % STRETCH_COUNT) + STRETCH_COUNT) % STRETCH_COUNT].name;
}

/**
 * Scene fields at world x `u` for a resolved composition P: water strength (0..1), waterline (viewport
 * heights from the bottom, already through P's presence and portrait transform), bone, ink, strokes, refl.
 * `out` is reused: [water, waterY, bone, ink, strokes, refl, banks].
 */
export function sceneField(u, P, out = new Float32Array(SCENE_FIELDS)) {
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
  const tf = (y) => y * P.hsc - P.drop + P.wlift;
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
const PRESETS = {
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
export const DISTANCES = Object.keys(PRESETS);

// Portrait: the narrow window misses every near massif, so the phone's first screen would lose the
// dark, textured foreground that gives the desktop hero its depth. The nearest plane becomes one low
// crest along the bottom edge instead: summits ~92-95% down the screen, below the copy, gone with the
// first scroll like every near plane. (Plane 4, so it keeps the crease texture and dry-brush contour.)
const PORTRAIT_NEAR = { base: -0.02, amp: 0.09, floor: 0.3, foot: -0.13, fade: 0.11 };
// its massifs, per stretch, placed in screen fractions of that stretch's portrait view (so they stand
// where the camera rests, yet stay anchored to the world while it pans): a craggy mass under the copy
// column, a lower crag on the far side, a low saddle between. [x across the view, half-width, gain]
const PORTRAIT_CRAGS = [[0.2, 0.21, 0.95], [0.9, 0.09, 0.62]];

/** A composition spec that can be blended during pans: distance weights + presence. */
export function spec(distance = 'level', presence = 1) {
  const w = { level: 0, high: 0, deep: 0 };
  w[PRESETS[distance] ? distance : 'level'] = 1;
  return { w, presence: clamp01(Number.isFinite(+presence) ? +presence : 1) };
}
export function blendSpec(a, b, t) {
  const w = {};
  for (const k of DISTANCES) w[k] = a.w[k] + (b.w[k] - a.w[k]) * t;
  return { w, presence: a.presence + (b.presence - a.presence) * t };
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/**
 * How the viewport maps onto the world. `hs` = viewport heights per stretch unit (so peaks keep
 * sane proportions on any aspect); `wvis` = how many stretch units are visible.
 */
export function framing(aspect) {
  const hs = aspect >= 1.15 ? Math.min(aspect, 1.9) : 0.92 + 0.23 * smooth(0.45, 1.15, aspect);
  return { hs, wvis: aspect / hs, portrait: smooth(1.05, 0.62, aspect) };
}

/** Left edge of the view (world units) for a fractional stretch position. */
// Where the view of stretch j starts (offset within the stretch, world units).
function viewOffset(j, wvis) {
  if (wvis >= 1) return -(wvis - 1) * 0.5; // wider than a stretch: centre it
  // narrower (portrait): keep the host peak at ~62% across, but stay inside the stretch
  const hx = HOST_X[((j % STRETCH_COUNT) + STRETCH_COUNT) % STRETCH_COUNT];
  return Math.min(1 - wvis, Math.max(0, hx - wvis * 0.62));
}

export function cameraLeft(stretch, wvis) {
  const k = Math.floor(stretch);
  const f = stretch - k;
  const off = (j) => viewOffset(j, wvis);
  const a = off(k), b = off(k + 1);
  const e = f * f * (3 - 2 * f);
  return stretch + a + (b - a) * e;
}

/**
 * Resolve a spec into per-plane numbers for this aspect. Presence lowers and pales the whole
 * range (reading pages); portrait screens lift the horizon so a pale host rises behind the copy.
 */
export function resolve(s, aspect) {
  const { portrait: pf } = framing(aspect);
  const P = { base: [], amp: [], foot: [], fade: [], ink: [], floor: [], role: { far: 0, guest: 0, host: 0, near: 0, fg: 0 }, hostW: 0, flank: 0, near: 0, wvis: 1 };
  let tw = 0;
  for (const k of DISTANCES) tw += s.w[k];
  tw = tw || 1;
  for (const k of DISTANCES) {
    const wt = s.w[k] / tw;
    if (!wt) continue;
    const pr = PRESETS[k];
    for (const f of ['base', 'amp', 'foot', 'fade', 'ink', 'floor']) {
      for (let l = 0; l < LAYERS; l++) P[f][l] = (P[f][l] || 0) + pr[f][l] * wt;
    }
    for (const r in P.role) P.role[r] += pr.role[r] * wt;
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
    for (const f of ['base', 'amp', 'floor', 'foot', 'fade']) P[f][LAYERS - 1] += (PORTRAIT_NEAR[f] - P[f][LAYERS - 1]) * nf;
  }
  P.near = nf;
  P.hsc = hsc;
  P.drop = drop;
  P.wlift = 0.05 * pf;                    // the waterline rises with the far planes on portrait
  P.wvis = framing(aspect).wvis;
  P.presence = p;
  P.portrait = pf;
  return P;
}

/**
 * Massifs that can touch the world window [u0, u1], flattened per plane:
 * out[l] = [centre, leftHalfWidth, rightHalfWidth, gain, isHost, ...]; out.echo = [plane, centre, scale, gain, ...]
 */
export function massifs(u0, u1, P) {
  const out = Array.from({ length: LAYERS }, () => []);
  out.echo = [];   // [plane, centre, scale, gain, ...] of the echo rows
  for (let k = Math.floor(u0) - 1; k <= Math.floor(u1) + 1; k++) {
    let rows = P.flank > 0.01 ? tableFor(k).concat(FLANK.map((m) => [...m.slice(0, 3), m[3] * P.flank, m[4]])) : tableFor(k);
    if (P.near > 0.01 && P.wvis < 1 && k >= 0 && k < STRETCH_COUNT && !SCENES[k].water) {   // open water keeps no near crag
      const o = viewOffset(k, P.wvis);
      rows = rows.concat(PORTRAIT_CRAGS.map(([x, w, g]) => [LAYERS - 1, o + x * P.wvis, w * P.wvis, g * P.near, 'near']));
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
function skewHash(i) {
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
export const FEATHER = { narrow: [24, 26], tablet: [30, 36], wide: [40, 56] };
/** The feathers of a width class. */
export const featherOf = (cls) => (cls === 'phone' || cls === 'short' ? FEATHER.narrow : cls === 'tablet' ? FEATHER.tablet : FEATHER.wide);
/** Figure geometry is authored at this many CSS px per stretch (so 900 CSS px per viewport height). */
export const REF_PX = 1440;
/** The text block's right edge to the scene's focus, at least (CSS px). */
export const KEEP_GAP = 180;

const clampK = (k) => Math.min(STRETCH_COUNT - 1, Math.max(0, k));

/** The width class of a viewport (SPEC-R4A §2.4): 'wide' >= 1200, 'short' < 500 tall, 'tablet' >= 640, else 'phone'. */
export function widthClass(w, h) {
  if (w >= 1200) return 'wide';
  if (h > 0 && h < 500) return 'short';
  return w >= 640 ? 'tablet' : 'phone';
}

/** A stretch's own page composition (distance, presence), as its page sets it. */
export function pageSpec(stretch) {
  const [distance, presence] = SCENES[clampK(Math.round(Number(stretch) || 0))].page;
  return { distance, presence };
}

/**
 * Where a window onto stretch `stretch` looks (DOM-free; the lab and QA call it too).
 * @param {number} stretch
 * @param {'wide'|'tablet'|'phone'|'short'} cls
 * @param {{width:number, height:number, keepoutRight?:number|null, doc?:boolean}} box  the window's CSS box;
 *   keepoutRight = the text block's right edge inside it (CSS px from the box's left), when the text overlaps the box
 *   (wide screens); doc = a document's low strip (strip--doc), framed on the band around the scene's focus
 * @param {'strip'|'closing'} kind
 * @returns {{worldLeft:number, worldTop:number, scale:number, focus:[number, number]}}  world x (stretches) at the
 *   box's left edge, scene height (viewport heights) at its top edge, CSS px per stretch, the focus in box px.
 */
export function framingAt(stretch, cls = 'wide', box = {}, kind = 'strip') {
  const k = clampK(Math.round(Number(stretch) || 0));
  const F = SCENES[k].frame;
  const width = Math.max(1, +box.width || 1440);
  const height = Math.max(1, +box.height || 360);
  const kr = box.keepoutRight === null || box.keepoutRight === undefined || !Number.isFinite(+box.keepoutRight) ? null : +box.keepoutRight;
  const closing = kind === 'closing';
  const c = F.closing;
  const T = (cls === 'short' ? F.short || F.phone : F[cls]) || F.tablet;
  let scale, left, top, fu, fy;
  if (cls === 'wide') {
    // one stretch is the box's width (today's scale), up to 1700 px on very wide screens; a document's low strip may
    // look from further away (wide.docScale, at 1440), so its band holds whole hills
    scale = Math.min(width, 1700) * (box.doc && !closing && F.wide.docScale ? F.wide.docScale / 1440 : 1);
    if (closing) { fu = c.u; fy = c.y; left = k + c.u - c.fx * (width / scale); top = c.y + c.fy * height * HS / scale; }
    else {
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
    }
  } else if (closing ? T.cband : T.band) {
    // a band of the scene (strip: band; closing: cband), see bandFrame()
    ({ scale, left, top, fu } = bandFrame(k, closing ? { band: T.cband, u: T.cu, fx: T.cfx, uMin: T.cuMin, uMax: T.cuMax, scale: T.scale, slack: T.cslack }
      : T, cls, width, height, !!box.doc, closing ? c.u : F.focus[0]));
    fy = closing ? c.y : F.focus[1];
  } else {
    scale = closing ? (c.scale ?? T.cscale ?? T.scale) : T.scale;
    const P = closing ? [c.u, c.y, c.fx, c.fy] : [F.focus[0], F.focus[1], T.fx, T.fy];
    fu = P[0]; fy = P[1];
    left = k + P[0] - P[2] * (width / scale);
    top = P[1] + P[3] * height * HS / scale;
  }
  // the keep-out rule: the scene's leftmost figurative point (frame.keepU, else the focus; the closing: its focus)
  // stands at least KEEP_GAP px right of the text, never past the box's right edge
  let focusX = (k + fu - left) * scale;
  const ku = closing ? fu : (F.keepU ?? fu);
  const keepX = (k + ku - left) * scale;
  if (kr !== null && kr > 0 && keepX < kr + KEEP_GAP) {
    const shift = Math.min(kr + KEEP_GAP - keepX, Math.max(0, width - 24 - focusX));
    left -= shift / scale;
    focusX += shift;
  }
  return { worldLeft: left, worldTop: top, scale, focus: [focusX, (top - fy) * scale / HS] };
}

/**
 * A band of the scene in a window (round 4a, fixer 10 Oct): the band's summits [y0, y1] (scene heights) sit just under
 * the window's top feather, never cut by it (a strip shows whole mountains and lets only the mist dissolve into the
 * paper), and its ground (Home's traveller) above the bottom feather when the box is tall enough; else the summits
 * win. The scale fits the band to the box within 0.8-1.15 of the class's nominal scale T.scale (the figure layers are
 * drawn at the nominal one). Horizontally: T.u at T.fx of the width, kept inside [T.uMin, T.uMax] (stretch-local)
 * where the width allows.
 */
function bandFrame(k, T, cls, width, height, doc, u) {
  const [y0, y1] = T.band;
  const dk = doc ? 0.5 : 1;
  const [ft, fb] = featherOf(cls).map((v) => v * dk);
  const fbIn = T.fbIn ?? 0.5;   // how far into the bottom feather the ground may sit (0: Home's traveller stays clear of it)
  const fit = (Math.max(8, height - ft - fb * (1 - fbIn)) * HS) / Math.max(0.02, y1 - y0);
  const scale = Math.min(T.scale * 1.15, Math.max(T.scale * 0.8, fit));
  const unit = HS / scale;
  const topA = y1 + ft * unit, topB = y0 + (height - fb * (1 - fbIn)) * unit;
  const top = topB > topA ? topA + (topB - topA) * (T.slack ?? 0.5) : topA;
  const fu = T.u ?? u;
  const vw = width / scale;
  let left = k + fu - (T.fx ?? 0.5) * vw;
  if (T.uMax !== undefined && left + vw > k + T.uMax) left = k + T.uMax - vw;
  if (T.uMin !== undefined && left < k + T.uMin) left = k + T.uMin;
  return { scale, left, top, fu };
}

/**
 * The framing of a window while the camera is at a fractional stretch (a pan): every field moves smoothly from
 * one stretch's framing to the next, the way cameraLeft() blends the round-3 views.
 */
export function framingBlend(s, cls, box, kind) {
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
