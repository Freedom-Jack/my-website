import localFont from 'next/font/local';

/**
 * Three voices, three files, about 64 KB, served from this site (src/app/fonts, SIL Open Font License 1.1: see
 * src/app/fonts/NOTICE.md):
 *   the brush   Newsreader Italic, its display cut (optical size 72, weight 300), one static file: the name, the
 *               page titles, the figures and the few lines inscribed in the painting;
 *   the text    Geist, one variable Latin file: everything read or pressed;
 *   the record  Geist Mono 400: dates, labels, measures, what the machine reports.
 * The brush and the text are preloaded (the first screen sets both); the record is fetched when a label needs it.
 * Each face comes with a metric-matched local fallback (next/font), so the swap moves nothing.
 */
const brush = localFont({
  src: './fonts/newsreader-italic-display-300.woff2',
  weight: '300',
  style: 'italic',
  display: 'swap',
  variable: '--font-brush-face',
  adjustFontFallback: 'Times New Roman',
  fallback: ['Iowan Old Style', 'Palatino', 'Georgia', 'serif'],
});

const text = localFont({
  src: './fonts/geist.woff2',
  weight: '100 900',
  display: 'swap',
  variable: '--font-text-face',
  adjustFontFallback: 'Arial',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
});

const record = localFont({
  src: './fonts/geist-mono-400.woff2',
  weight: '400',
  display: 'swap',
  preload: false,
  variable: '--font-record-face',
  adjustFontFallback: false,
  fallback: ['ui-monospace', 'SF Mono', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
});

/** The three faces' variables, as classes for <html>. */
export const fontClasses = `${brush.variable} ${text.variable} ${record.variable}`;
