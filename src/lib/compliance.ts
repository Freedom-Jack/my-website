/**
 * The hard rules as patterns (DESIGN.md §2), shared by the content checks, the GitHub rules, the PDF gate and
 * tools/compliance.ts. No phone number anywhere; no street address; no PMP; never the old résumé PDF; the only
 * Chinese character on the site is the seal's (and the seal is an outline, so no CJK text at all ships).
 */

/** A phone number: North American 3-3-4 groups, an international +number, ten digits in a row, or a tel: link. */
export const PHONE =
  /(?<![\w.#/-])(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]{0,2}\d{3}[\s.-]\d{4}(?![\w-])|(?<![\d\w])\+\d{1,3}[\s.-]?\(?\d{1,4}\)?(?:[\s.-]?\d{2,4}){2,4}(?!\d)|(?<![\d\w/#.-])\d{10}(?![\d\w])|\btel:/i;

/**
 * In code, numbers are constants, not contacts (2147483647, 4294967296): only formatted numbers and tel: links count
 * there; the bare ten-digit form is checked in text.
 */
export const PHONE_IN_CODE =
  /(?<![\w.#/-])(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]{1,2}\d{3}[\s.-]\d{4}(?![\w-])|(?<![\d\w])\+\d{1,3}[\s.-]?\(?\d{1,4}\)?(?:[\s.-]?\d{2,4}){2,4}(?!\d)|\btel:/i;

/** CJK blocks, built from code points so this file itself holds no such character. */
const CJK_RANGES: Array<[number, number]> = [
  [0x2e80, 0x2fdf],
  [0x3000, 0x303f],
  [0x3040, 0x30ff],
  [0x3100, 0x312f],
  [0x3190, 0x31ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xa960, 0xa97f],
  [0xac00, 0xd7af],
  [0xf900, 0xfaff],
  [0xfe30, 0xfe4f],
  [0xff00, 0xffef],
  [0x20000, 0x3ffff],
];
export const CJK = new RegExp(
  `[${CJK_RANGES.map(([a, b]) => `\\u{${a.toString(16)}}-\\u{${b.toString(16)}}`).join('')}]`,
  'u',
);

/** PMP (dropped everywhere, DESIGN §2), as a word. */
export const PMP = /\bPMP\b|Project Management Professional/;

/** The old résumé file (it carries a phone number): never linked, never shipped. */
export const OLD_PDF = /QijinXu_Resume\.pdf/i;

/** A street address: a house number followed by a street word. The site gives the city only. */
export const STREET =
  /\b\d{1,5}\s+(?:[A-Z][a-z]+\s){1,3}(?:Street|St\.|Avenue|Ave\.?|Road|Rd\.|Boulevard|Blvd\.?|Drive|Dr\.|Crescent|Cres\.?|Court|Ct\.|Lane|Way|Place)\b/;

export interface Finding {
  rule: 'phone' | 'cjk' | 'pmp' | 'old-pdf' | 'street';
  match: string;
}

/** Every hard-rule breach in a text (empty: clean). */
export function findBreaches(text: string, { allowOldPdfRedirect = false, code = false } = {}): Finding[] {
  const out: Finding[] = [];
  const add = (rule: Finding['rule'], re: RegExp) => {
    const m = text.match(re);
    if (m) out.push({ rule, match: m[0] });
  };
  add('phone', code ? PHONE_IN_CODE : PHONE);
  add('cjk', CJK);
  add('pmp', PMP);
  if (!allowOldPdfRedirect) add('old-pdf', OLD_PDF);
  add('street', STREET);
  return out;
}
