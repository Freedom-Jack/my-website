import localFont from 'next/font/local';

/**
 * Two voices, two files, about 52 KB, served from this site (src/app/fonts, SIL Open Font License 1.1: see
 * src/app/fonts/NOTICE.md), each trimmed to the characters the site sets:
 *   the ink     Shippori Mincho B1, weight 500: the Latin of a Ming-style book face, its corners softened as ink
 *               bleeds into paper. Headings, a page's opening sentence, figures;
 *   the text    Hanken Grotesk, one variable file (400 to 700): everything read or pressed, and the small labels.
 * Both are preloaded (the first screen sets both). Each comes with a metric-matched local fallback (next/font), so
 * the swap moves nothing. What is inscribed in the painting is not type at all: it is drawn
 * (components/page/Inscription).
 */
const ink = localFont({
  src: './fonts/shippori-mincho-b1-500.woff2',
  weight: '500',
  style: 'normal',
  display: 'swap',
  variable: '--font-ink-face',
  adjustFontFallback: 'Times New Roman',
  fallback: ['Iowan Old Style', 'Palatino', 'Georgia', 'serif'],
});

const text = localFont({
  src: './fonts/hanken-grotesk.woff2',
  weight: '400 700',
  display: 'swap',
  variable: '--font-text-face',
  adjustFontFallback: 'Arial',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
});

/** The two faces' variables, as classes for <html>. */
export const fontClasses = `${ink.variable} ${text.variable}`;
