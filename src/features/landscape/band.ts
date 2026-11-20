/**
 * THE BAND: how the painting meets the page.
 *
 * The painting is one fixed band across the top of every page, in front of the words (styles/band.css). At a page's
 * top it stands at full size, the page's title inscribed in its sky; as the page is read it stands back (it settles
 * to `zoom` of its size over the first `run` of the scroll) and unrolls west with the rest of the scroll, and the
 * words rise under it and dissolve in the mist at its foot. Nothing is painted behind the words.
 *
 * Shared by the engine (the stage is painted 1 / zoom wider so the settled band is full), the page's styles (the root
 * layout sets these as custom properties) and the tools that cut the band's stills.
 */
export const BAND = {
  /** The settled band's size against the hero's, at 1200 px and up (the stage and its stills). */
  zoom: 0.64,
  /** The strip's box at the page's top, the engine's anchor: its height over the window's width (600 px at 1440)... */
  ratio: 600 / 1440,
  /** ...and its most, of the small viewport's height. */
  maxVh: 0.62,
  /** THE UNROLL: a page's travel is this share of the way from its hero to the next place's (engine/index.ts UNROLL)... */
  share: 0.6,
  /** ...and Contact's, with no next place: this much open water (stretches). */
  reach: 0.35,
  /** The window at which the stills are cut (CSS px): the wide class's stage, one stretch across. */
  ref: [1440, 900] as const,
} as const;
