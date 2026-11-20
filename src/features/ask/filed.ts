/**
 * Step 0, a filed question: every line of the site that answers something is filed under the questions it answers
 * (questions.ts; the things a skills or a stack line names, "Do you know X?"), exactly as the index build files them
 * (tools/build-ask.ts). A visitor's words that are one of those questions, letter for letter once the case, the
 * spaces and the final punctuation are set aside, are answered with that line at once: no model, nothing measured.
 */
import { listed, listedQuestions, sentences, type Line } from './lines';
import { QUESTIONS } from './questions';

/** A question as it is filed: lower case, single spaces, plain apostrophes, no final punctuation. */
export const filedKey = (q: string) =>
  q
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\s.?!…]+$/, '');

export interface Filing {
  l: Line;
  /** the sentence inside the line the question is filed under (-1: the whole line) */
  at: number;
}

export function fileQuestions(lines: Line[]): Map<string, Filing> {
  const answers = lines.filter((l) => l.answers);
  const out = new Map<string, Filing>();
  const file = (l: Line, at: number, qs: string[]) => {
    for (const q of qs) if (!out.has(filedKey(q))) out.set(filedKey(q), { l, at });
  };
  for (const [opens, qs] of QUESTIONS) {
    const whole = answers.filter((l) => l.text.startsWith(opens));
    const inside = answers.flatMap((l) =>
      sentences(l.text).flatMap((s, j) => (j > 0 && s.startsWith(opens) ? [{ l, j }] : [])),
    );
    // (the words changed under this filing: it is left out here, and the index build fails until it is read again)
    if (whole.length + inside.length !== 1) continue;
    if (whole[0]) file(whole[0], -1, qs);
    else file(inside[0]!.l, inside[0]!.j, qs);
  }
  const seen = new Set<string>();
  for (const section of ['Skills', 'Stack'])
    for (const l of answers.filter((x) => x.section === section))
      for (const thing of listed(l)) {
        if (seen.has(thing.toLowerCase())) continue;
        seen.add(thing.toLowerCase());
        file(l, -1, listedQuestions(thing));
      }
  return out;
}
