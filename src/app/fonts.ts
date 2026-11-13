import { Familjen_Grotesk, Sofia_Sans_Extra_Condensed } from 'next/font/google';

// Two web faces, self-hosted by next/font at build time (no request to Google from the visitor), about 35 KB in all
// (the budget: at most two files and 45 KB before the LCP):
//   the name face, Sofia Sans Extra Condensed 900 (~16 KB): the name, the page titles, the figures;
//   the reading face, Familjen Grotesk, one variable Latin file for every weight 400–700 (~19 KB): everything read or
//   pressed. Facts (dates, figures, labels) are set in the system mono stack (tokens.css --font-code), 0 KB.
// Their family names go first in tokens.css's stacks (fontFaces, below), ahead of the hand-measured,
// metric-matched local fallbacks. The seal's one glyph is an outline in components/ui/Seal: no CJK font is loaded at all.

/** Body, UI and headings: variable (wght 400–700), one static Latin subset. */
export const bodyFace = Familjen_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  adjustFontFallback: false,
});

/** The name, the page titles and the figures (Sofia Sans Extra Condensed 900). */
export const nameFace = Sofia_Sans_Extra_Condensed({
  subsets: ['latin'],
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
  '--font-name-face': first(nameFace.style.fontFamily),
} as Record<string, string>;
