/**
 * What is shown for a line that answers, word for word (shared by the filed questions and the model's reading): the
 * sentence the question was filed under, or the line; with the sentence before it when it leans on it; and, for a
 * short line that is one of a list, the short lines beside it. Nothing here writes a word.
 */
import { LEANS, sentences, type Line } from './lines';

export interface Said {
  /** the line (or the one sentence of it) that answers, word for word */
  said: string;
  /** the short lines that stand beside it on the page (a list's other items), before and after */
  before: string[];
  after: string[];
  /** "Page · Section" */
  source: string;
  href: string;
  stretch: number;
  u: number | null;
  /** the place's name in the painting ("the river town") */
  place: string;
}

/** A line this short is shown with the short lines beside it (a list's other items); a line this long is answered
 *  with its closest sentence where the reader can tell which that is (the model's reading). */
const SHORT = 110;
export const LONG = 360;

export const where = (l: Line) => `${l.chunk.page} · ${l.section}`;
export const hrefOf = (l: Line) => (l.anchor ? `${l.chunk.href}#${l.anchor}` : l.chunk.href);

/** @param at  the sentence of the line that answers (-1: the whole line) */
export function shape(lines: Line[], l: Line, at: number): Said {
  const ss = sentences(l.text);
  let said = at < 0 ? l.text : (ss[at] ?? l.text);
  const prev = at > 0 ? ss[at - 1] : undefined;
  if (prev && LEANS.test(said) && prev.length + said.length < LONG) said = `${prev} ${said}`;
  // a list's item stands with the items beside it: a run of three or more short lines under one heading
  // (a degree and its honours, a diagram's steps), the nearest first, while they fit
  const before: string[] = [],
    after: string[] = [];
  const beside = (x: Line | undefined): x is Line =>
    !!x && x.answers && x.chunk.page === l.chunk.page && x.section === l.section && x.text.length < SHORT;
  if (at < 0 && l.text.length < SHORT) {
    let up = l.n,
      down = l.n;
    while (beside(lines[up - 1])) up -= 1;
    while (beside(lines[down + 1])) down += 1;
    if (down - up >= 2) {
      let room = LONG - l.text.length;
      for (let d = 1; d <= 3 && before.length + after.length < 3; d++)
        for (const n of [l.n + d, l.n - d]) {
          const x = lines[n];
          if (n < up || n > down || !x || x.text.length > room || before.length + after.length >= 3) continue;
          // (only lines that touch what is already shown: a list is never shown with a gap)
          if (n > l.n ? after.length !== d - 1 : before.length !== d - 1) continue;
          room -= x.text.length;
          if (n > l.n) after.push(x.text);
          else before.unshift(x.text);
        }
    }
  }
  return {
    said,
    before,
    after,
    source: where(l),
    href: hrefOf(l),
    stretch: l.chunk.stretch,
    u: l.chunk.u,
    place: l.chunk.place,
  };
}
