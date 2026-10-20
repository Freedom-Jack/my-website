// palette.ts — the painting's pigments and how strongly each scene takes them (SPEC-R4A §12.3).
// DOM-free. Engine-only: these colours never become CSS tokens, text or UI colours.
//
// Two registers, as in the paintings themselves:
//   mountains  misted blue-green ("A Thousand Li of Rivers and Mountains", 1113): azurite toward the crests,
//              malachite on the lower slopes, graded by height above each plane's foot; far planes take the
//              misted values, near planes approach the deep ones; the mist always lies over the colour.
//   figures    light colour over ink (the Qingming scroll's manner): grey tile, timber brown on wood, pale
//              indigo clothes, white robes, willows in misted malachite. No red, yellow, gold or beige.
// Strength 0 is ink only (round 3's painting, unchanged). Pans interpolate strength between scenes.

/** Mineral pigments, 0..255 sRGB: [deep, misted]. */
export const PIGMENTS = Object.freeze({
  azurite: Object.freeze({ deep: [44, 92, 138], misted: [127, 159, 184] }),      // #2C5C8A / #7F9FB8
  malachite: Object.freeze({ deep: [58, 128, 106], misted: [141, 181, 164] }),   // #3A806A / #8DB5A4
  timber: Object.freeze({ deep: [107, 84, 68], misted: [143, 128, 120] }),       // #6B5444 / #8F8078 (small areas only)
  inkGrey: Object.freeze({ deep: [42, 48, 52], misted: [42, 48, 52] }),          // #2A3034 tile roofs, outlines
  indigo: Object.freeze({ deep: [62, 86, 100], misted: [62, 86, 100] }),         // #3E5664 far ranges, water, clothes
});

/**
 * Strength per scene (stretch 0..5: peak, river, lake, shore, crossing, lone-peak), per palette.
 * `figures`: how much colour the figure layers take (0 = ink greys only).
 */
export const PALETTES = Object.freeze({
  ink: Object.freeze({ scenes: Object.freeze([0, 0, 0, 0, 0, 0]), figures: 0 }),
  // (fixer, 10 Oct: the Résumé's malachite and Contact's indigo at .25 / .20 did not read at all under their mist; the
  // terraces and the crossing's water now carry them at .55 / .50, so every place has its own colour)
  // (round 5: the lake keeps a breath of the blue-green and the lone peak a trace, so the colour runs along the whole
  // scroll and only fades, never stops)
  misted: Object.freeze({ scenes: Object.freeze([0.85, 0.70, 0.36, 0.70, 0.75, 0.32]), figures: 1 }),   // A: the young palette, re-indexed to the six places
  rich: Object.freeze({ scenes: Object.freeze([0.75, 0.60, 0.22, 0.75, 0.70, 0.12]), figures: 1.25 }),
});

export const PALETTE_NAMES = Object.freeze(Object.keys(PALETTES));
export const DEFAULT_PALETTE = 'misted';
/** A palette's name: 'ink' (round 3's painting), 'misted' (the site's) or 'rich'. */
export type PaletteName = keyof typeof PALETTES;

/** A palette name, or the default when it is not one. */
export function paletteName(p: unknown): PaletteName {
  return Object.prototype.hasOwnProperty.call(PALETTES, p as PropertyKey) ? (p as PaletteName) : DEFAULT_PALETTE;
}

/**
 * How each scene leans: which pigment leads (0 = azurite-led, 1 = malachite-led) and how much the water
 * takes indigo instead (the crossing). Index = stretch.
 */
export const LEAN = Object.freeze([
  { mal: 0.42, water: 0 },     // peak (Home): azurite-led
  { mal: 0.55, water: 0 },     // river (Work): blue-green hills
  { mal: 0.5, water: 0 },      // lake: a breath of colour
  { mal: 0.82, water: 0 },     // shore (Résumé): pale malachite on the terraces
  { mal: 0.3, water: 1 },      // crossing (Contact): indigo water
  { mal: 0.5, water: 0 },      // lone peak: ink only
]);

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const SEAM = 0.34;   // round 5: wide, so the colour shifts gradually along the scroll (never a band's edge at a seam)

/**
 * Pigment strength and lean at world x `u` (stretches), smoothly windowed across the seams, so a pan
 * between scenes blends their colour. `out` = [strength, malachite lean, water indigo].
 */
export function pigmentAt(u: number, palette: string = DEFAULT_PALETTE, out: number[] = [0, 0, 0]): number[] {
  const table = PALETTES[paletteName(palette)].scenes;
  const n = table.length;
  let s = 0, m = 0, w = 0, sum = 0;
  for (let k = Math.max(0, Math.floor(u) - 1); k <= Math.min(n - 1, Math.floor(u) + 1); k++) {
    const t = smooth(k - SEAM, k + SEAM, u) * (1 - smooth(k + 1 - SEAM, k + 1 + SEAM, u));
    if (t <= 0) continue;
    s += table[k] * t; m += LEAN[k].mal * t; w += LEAN[k].water * t; sum += t;
  }
  // (neighbouring windows sum to 1 inside the scroll; dividing keeps its two ends at full strength)
  out[0] = sum > 0 ? s / sum : 0;
  out[1] = sum > 0 ? m / sum : 0.5;
  out[2] = sum > 0 ? w / sum : 0;
  return out;
}

/**
 * A r2: the one colour story, locked (every place carries it; the sets and shaders.ts COLORS draw from these values).
 * Washes: ice and celadon. ONE accent pair: the jade/cyan of the light and the peach-pink of the plum blossom (Home
 * only). ONE foliage green for every leaf (the willow; trees take it misted). Ink: brown-black for near limbs.
 */
export const STORY = Object.freeze({
  skyTop: '#B8D9F0',       // the ice-blue sky high in a window (shaders.ts SKY_T)
  light: '#FBFEFF',        // the light's core and the mist (never darker than #E1ECF1)
  celadon: '#8BCECC',      // the misted jade wash (MA_M)
  jade: '#1C7D82',         // the deep jade (MA_D); the UI's #134A47 / #0F3D36 are its ink
  glow: '#BFE9F2',         // the cyan-white halo round every place's light
  blossom: '#F4A8B8',      // the one warm accent: peach-pink, with white plum #FFFCFD
  foliage: '#9DC77A',      // the one foliage green, near; misted far #BFD9B0
  limbInk: '#2B2C2D',      // INK_N moved ~15 % toward umber: near branches and boughs
});
