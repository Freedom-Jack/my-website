/**
 * THE MOODS, by the clock (round 6): the painting keeps the visitor's own hour. Dawn, the day as it was painted,
 * dusk (the lamps come on), night (a moon, the lamps lit). The engine regrades what is painted (types.ts Mood;
 * engine/shaders.ts moodGrade): no scene is repainted and the paper stays the paper.
 *
 * No location is asked for or sent anywhere: the hour is the device's own clock, and the day's length follows the
 * calendar for a middle latitude (north, or south where the device's time zone says so), so a November evening
 * darkens earlier than a June one.
 */
import type { Mood } from './types';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const sstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** 0 before a, 1 at b, 0 after c. */
const bump = (a: number, b: number, c: number, x: number) => (x <= b ? sstep(a, b, x) : 1 - sstep(b, c, x));

const SOUTH = /^(Australia|Antarctica|Pacific\/(Auckland|Fiji|Chatham)|America\/(Sao_Paulo|Argentina|Santiago|Montevideo|Lima|La_Paz|Asuncion)|Africa\/(Johannesburg|Maputo|Harare|Windhoek|Gaborone|Lusaka))/;

/** Sunrise and sunset by the device's clock (hours), for a middle latitude: about 7:40 and 16:45 at midwinter,
 *  5:40 and 20:55 at midsummer. */
export function sunHours(date: Date, timeZone = ''): { rise: number; set: number } {
  const start = new Date(date.getFullYear(), 0, 0).getTime();
  const day = (date.getTime() - start) / 86400000;
  let k = Math.cos(((day - 172) / 365.25) * 2 * Math.PI); // 1 at the June solstice, -1 at December's
  if (SOUTH.test(timeZone)) k = -k;
  return { rise: 6.65 - 1.0 * k, set: 18.85 + 2.1 * k };
}

/** The mood at a moment of the device's clock. */
export function moodAt(date: Date, timeZone = ''): Mood {
  const h = date.getHours() + date.getMinutes() / 60;
  const { rise, set } = sunHours(date, timeZone);
  const dawn = bump(rise - 1.1, rise - 0.05, rise + 1.0, h);
  const dusk = bump(set - 1.2, set - 0.1, set + 0.9, h);
  // night: from a little after sunset to a little before sunrise (the clock wraps at midnight)
  const night = h >= 12 ? sstep(set + 0.35, set + 1.25, h) : 1 - sstep(rise - 1.2, rise - 0.3, h);
  const lamps = h >= 12 ? sstep(set - 0.5, set + 0.2, h) : 1 - sstep(rise - 0.6, rise + 0.1, h);
  const r = (v: number) => Math.round(v * 100) / 100;
  return { dawn: r(dawn * (1 - night)), dusk: r(dusk * (1 - night * 0.85)), night: r(night), lamps: r(lamps) };
}

/** The moods a visitor (or the preview's panel) may name. */
export const MOODS: Record<string, Mood> = {
  day: {},
  dawn: { dawn: 1 },
  dusk: { dusk: 1, lamps: 0.8 },
  night: { night: 1, lamps: 1 },
  snow: { snow: 1 },
  rain: { rain: 1 },
  'snow at dusk': { snow: 0.85, dusk: 0.8, lamps: 1 },
  'snow at night': { snow: 0.7, night: 1, lamps: 1 },
};
