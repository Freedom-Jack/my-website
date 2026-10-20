/**
 * The seal: a carved cinnabar stone with his surname cut into it, like a painter's seal. The glyph is the one
 * Chinese character on the site (DESIGN.md §2; pre-approved). Decorative: always aria-hidden.
 *
 * The glyph is an outline, not text, so no CJK font is ever loaded: Noto Serif SC Black at 44 px, centred on
 * x 32.3 with its baseline at y 48.2 of the 64-unit stone (the demo's <text> placement), extracted once with
 * opentype.js from Google Fonts' subset of that one glyph (SIL Open Font License 1.1).
 */
export const SEAL_GLYPH =
  'M25.17 33.77L24.82 32.54L35.2 32.54L35.2 26.86L29.75 26.86L29.48 25.98Q27.06 27.61 24.6 28.8L24.34 28.4Q26.14 26.68 27.86 24.46Q29.57 22.24 31.02 19.82Q32.48 17.4 33.47 15.07Q34.46 12.74 34.81 10.8L43.17 12.78Q43.08 13.18 42.66 13.4Q42.24 13.62 41.23 13.75Q42.51 15.77 44.71 17.31Q46.91 18.85 49.39 19.91Q51.88 20.96 53.99 21.54L53.99 22.11Q52.1 22.72 50.96 24.46Q49.81 26.2 49.59 28.14Q48.54 27.34 47.57 26.38Q47.26 26.86 46.42 26.86L41.54 26.86L41.54 32.54L44.66 32.54L47.57 28.75L48.1 29.15Q48.62 29.59 49.44 30.25Q50.25 30.91 51.15 31.66Q52.06 32.4 52.8 33.06Q52.63 33.77 51.57 33.77L41.54 33.77L41.54 45.65Q41.54 47.58 41.03 48.99Q40.53 50.4 38.92 51.26Q37.32 52.12 34.02 52.34Q33.97 50.97 33.8 49.98Q33.62 48.99 33.14 48.38Q32.7 47.76 31.97 47.3Q31.24 46.84 29.57 46.53L29.57 46L30.19 46.04Q30.8 46.09 31.66 46.13Q32.52 46.18 33.29 46.22Q34.06 46.26 34.41 46.26Q34.9 46.26 35.05 46.04Q35.2 45.82 35.2 45.52L35.2 38.78Q35.16 38.78 35.16 38.83Q34.81 39.05 34.02 39.09Q32.96 40.85 31.42 42.72Q29.88 44.59 27.97 46.26Q26.05 47.94 23.76 49.12L23.41 48.73Q24.64 46.84 25.59 44.46Q26.54 42.08 27.17 39.69Q27.81 37.29 28.08 35.35L35.2 38.12L35.2 33.77L25.17 33.77ZM20.33 18.98L27.68 22.99Q27.55 23.3 27.17 23.49Q26.8 23.69 25.96 23.65Q24.34 25.67 22.14 27.96Q21.92 28.18 21.7 28.4L24.12 29.28Q23.94 29.9 22.75 30.16L22.75 50.22Q22.75 50.49 22.05 50.99Q21.34 51.5 20.2 51.92Q19.06 52.34 17.74 52.34L16.59 52.34L16.59 32.93Q14.17 34.87 11.53 36.41L11.14 36.01Q12.59 34.16 13.97 31.94Q15.36 29.72 16.57 27.41Q17.78 25.1 18.75 22.92Q19.72 20.74 20.33 18.98ZM40.7 14.19Q39.3 17.18 36.7 19.95Q34.1 22.72 30.94 24.97Q30.5 25.32 30.01 25.63L39.78 25.63L42.55 22.2L43.43 22.86Q44.31 23.52 45.5 24.4Q45.9 24.7 46.25 25.01Q46.03 24.75 45.81 24.44Q44.05 22.28 42.73 19.67Q41.41 17.05 40.7 14.19ZM19.54 10.54L26.76 14.45Q26.62 14.76 26.27 14.94Q25.92 15.11 25.08 15.07Q23.54 16.48 21.39 18.08Q19.23 19.69 16.79 21.18Q14.35 22.68 11.84 23.82L11.49 23.43Q13.07 21.58 14.63 19.23Q16.2 16.87 17.49 14.56Q18.79 12.25 19.54 10.54ZM42.16 36.54L42.55 36.32Q46.34 37.29 48.56 38.78Q50.78 40.28 51.7 41.91Q52.63 43.54 52.56 44.97Q52.5 46.4 51.68 47.32Q50.87 48.24 49.57 48.33Q48.27 48.42 46.82 47.32Q46.47 45.43 45.72 43.54Q44.97 41.64 44.05 39.84Q43.12 38.04 42.16 36.54Z';

/** The stone's hand-cut outline. */
export const SEAL_STONE =
  'M5.2 4.6 58.9 3.8q1.5.1 1.4 1.8l-.7 53.1q-.1 1.6-1.7 1.5L5.6 59.4q-1.5-.1-1.4-1.8L3.9 6.1q0-1.4 1.3-1.5Z';

/**
 * @param id    unique per page: the carving mask's id ("seal-carve" in the header, "seal-carve-sign" for the signature)
 * @param sign  the About-me signature's smaller, static seal (never stamped)
 */
export function Seal({ id, sign = false }: { id: string; sign?: boolean }) {
  return (
    <span className={sign ? 'seal seal--sign' : 'seal'} aria-hidden="true">
      <svg className="seal__mark" viewBox="0 0 64 64" focusable="false">
        <defs>
          <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
            <rect width="64" height="64" fill="#fff" />
            <path className="seal__glyph" d={SEAL_GLYPH} />
          </mask>
        </defs>
        <g filter="url(#seal-stone)">
          <path className="seal__stone" mask={`url(#${id})`} d={SEAL_STONE} />
        </g>
      </svg>
    </span>
  );
}
