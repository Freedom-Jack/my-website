import { Commissioner, Sofia_Sans_Condensed, Sofia_Sans_Extra_Condensed } from 'next/font/google';

// The three web faces, self-hosted by next/font at build time (no request to Google from the visitor).
// Their family names go first in tokens.css's stacks (fontFaces, below), ahead of the hand-measured,
// metric-matched local fallbacks.
// The seal's one glyph is an outline in components/ui/Seal: no CJK font is loaded at all.

/** Body, headings and UI: variable, with the FLAR flare axis (a hint of brush in the terminals). */
export const bodyFace = Commissioner({
  subsets: ['latin', 'latin-ext'],
  axes: ['FLAR'],
  display: 'swap',
  adjustFontFallback: false,
});

/** Page titles (Sofia Sans Condensed ~780). */
export const displayFace = Sofia_Sans_Condensed({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  adjustFontFallback: false,
});

/** The name and figures (Sofia Sans Extra Condensed 900). */
export const nameFace = Sofia_Sans_Extra_Condensed({
  subsets: ['latin', 'latin-ext'],
  weight: '900',
  display: 'swap',
  adjustFontFallback: false,
});

/**
 * The faces' own family names only, as --font-*-face on <html>. next/font's own variables also list a generated
 * Arial-based fallback (it adds one even with adjustFontFallback off), which would stand in before the
 * hand-measured fallbacks of tokens.css, and draw glyphs no subset carries (the "→" of "All writing →") in Arial.
 */
const first = (family: string) => family.split(',')[0]!.trim();
export const fontFaces = {
  '--font-body-face': first(bodyFace.style.fontFamily),
  '--font-display-face': first(displayFace.style.fontFamily),
  '--font-name-face': first(nameFace.style.fontFamily),
} as Record<string, string>;
