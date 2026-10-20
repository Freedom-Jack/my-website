/**
 * Small typographic rules applied to every string from content/, so the content files stay plain to edit:
 * a number keeps its unit on its line ("200 ms", "2 TB", "12 months"), and "≥" keeps its number.
 * Plus the computed career length (COPY: "five years counts full-time work from Aug 2021; compute it").
 */

const NBSP = '\u00A0';
const UNITS = ['ms', 'TB', 'GB', 'FPS', 'fps', 'months', 'days', 'minutes', 'hours', 'years'];
const UNIT_RE = new RegExp(`(\\d)\\s(${UNITS.join('|')})\\b`, 'g');

/** A short hyphenated compound ("top-five", "T-SQL", "CNN-LSTM") never breaks at its hyphen (both parts ≤ 8). */
export const COMPOUND = /(?<![\w-])([A-Za-z0-9]{1,8}-[A-Za-z0-9]{1,8})(?![\w-])/g;

export function typeset(text: string): string {
  return text.replace(UNIT_RE, `$1${NBSP}$2`).replace(/([≥≤~])\s(?=\d)/g, `$1${NBSP}`);
}

/** Full-time work began here (CGI, Aug 2021). */
export const CAREER_START = '2021-08';
const WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
];

/** Whole years of full-time work at `today` (built pages compute it at build time). */
export function careerYears(today: Date = new Date()): number {
  const [y, m] = CAREER_START.split('-').map(Number) as [number, number];
  const months = (today.getUTCFullYear() - y) * 12 + (today.getUTCMonth() + 1 - m);
  return Math.max(0, Math.floor(months / 12));
}

/**
 * Replace the content tokens: {{years}} → "five" (in prose), {{years+}} → "5+" (in figures and the résumé).
 */
export function fillTokens(text: string, today: Date = new Date()): string {
  const n = careerYears(today);
  return text.replaceAll('{{years}}', WORDS[n] ?? String(n)).replaceAll('{{years+}}', `${n}+`);
}
