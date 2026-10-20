/** Dates as the site writes them, always from ISO strings in content/ ("2026-10", "2025-04-20"). */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parts(iso: string): [number, number, number | undefined] {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) throw new Error(`not an ISO month or date: ${iso}`);
  return [y, m, d];
}

/** "2026-10" → "October 2026" */
export function monthYear(iso: string): string {
  const [y, m] = parts(iso);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "2026-10" → "Oct 2026" (the résumé's dates) */
export function shortMonthYear(iso: string): string {
  const [y, m] = parts(iso);
  return `${SHORT[m - 1]} ${y}`;
}

/** "2025-04-20" → "April 20, 2025" */
export function longDate(iso: string): string {
  const [y, m, d] = parts(iso);
  if (!d) throw new Error(`not an ISO date: ${iso}`);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}
