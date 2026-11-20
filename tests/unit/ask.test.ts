import { describe, expect, it } from 'vitest';
import { ask } from '@content/pages/ask';
import { fileQuestions, filedKey } from '@/features/ask/filed';
import { isPrivate } from '@/features/ask/guard';
import { linesOf, type AskChunk } from '@/features/ask/lines';
import { first, type Words } from '@/features/ask/mind';
import { QUESTIONS } from '@/features/ask/questions';
import { buildCraft, publicChunk } from '@/features/craft/build';

/**
 * "Ask the painting", the steps that need no model (features/ask/mind.ts), over the site's own words as the build
 * serves them (/craft/corpus.json):
 *   step 0  a filed question is answered at once with his own line: every example the sheet and the tail offer is
 *           one, so a tap on an example never needs the 38 MB model;
 *   the guard turns a private matter away before anything is searched;
 *   step 1  anything else typed is a search by word, shown as places.
 */
const chunks = buildCraft().corpus.chunks.map(publicChunk) as unknown as AskChunk[];
const lines = linesOf(chunks);
const words: Words = { chunks, lines, bytes: 0 };
const everyLine = new Set(lines.map((l) => l.text));

describe('step 0: the examples are filed questions', () => {
  const examples = [...new Set([...ask.tries, ask.tailTry])];
  it('offers three examples, the tail’s among them', () => {
    expect(ask.tries.length).toBe(3);
    expect(ask.tries).toContain(ask.tailTry);
  });
  for (const q of examples) {
    it(`"${q}" is answered at once, with his own line and where it stands`, () => {
      const f = first(q, words);
      expect(f.kind).toBe('filed');
      if (f.kind !== 'filed') return;
      // his words, word for word: a line of the site, or one sentence of one
      expect(f.answer.said.trim()).not.toBe('');
      expect(
        [...everyLine].some((l) => l.includes(f.answer.said)),
        `"${f.answer.said.slice(0, 60)}…" is not a line of the site`,
      ).toBe(true);
      for (const beside of [...f.answer.before, ...f.answer.after]) expect(everyLine.has(beside)).toBe(true);
      // its source: "Page · Section", a link into the site, a place on the scroll
      expect(f.answer.source).toMatch(/\S · \S/);
      expect(f.answer.href).toMatch(/^\/(?:[a-z-]+\/)*(?:#[\w-]+)?$/);
      expect(f.answer.stretch).toBeGreaterThanOrEqual(0);
      expect(f.answer.stretch).toBeLessThanOrEqual(4);
      expect(f.answer.place).not.toBe('');
    });
  }
  it('reads a filed question whatever its case, spacing or final punctuation', () => {
    const q = ask.tailTry;
    for (const typed of [q.toUpperCase(), `  ${q.replace(/\s+/g, '   ')}  `, q.replace(/\?$/, ''), `${q}!!`])
      expect(first(typed, words).kind, typed).toBe('filed');
    expect(filedKey('  What’s  NEW?! ')).toBe("what's new");
  });
  it('files every question under exactly one line of the site (else the index build stops)', () => {
    const filed = fileQuestions(lines);
    const unfiled = QUESTIONS.flatMap(([, qs]) => qs).filter((q) => !filed.has(filedKey(q)));
    expect(unfiled).toEqual([]);
    // and each of them is answered by a line that may stand as an answer
    for (const f of filed.values()) expect(f.l.answers).toBe(true);
  });
});

describe('the guard, and step 1', () => {
  it('turns a private matter away before anything is searched', () => {
    for (const q of ['What is your salary?', 'How old are you?', 'What is your phone number?', 'Are you married?']) {
      expect(isPrivate(q), q).toBe(true);
      expect(first(q, words).kind, q).toBe('private');
    }
    expect(isPrivate('What did you build for insurers?')).toBe(false);
  });
  it('answers anything else typed with places, never with a line as his answer', () => {
    // (the sheet's own placeholder: not a filed question)
    const f = first(ask.placeholder, words);
    expect(f.kind).toBe('places');
    if (f.kind !== 'places') return;
    expect(f.passages).toBe(chunks.length);
    expect(f.places.length).toBeGreaterThan(0);
    expect(f.places.length).toBeLessThanOrEqual(3);
    for (const p of f.places) {
      expect(p.source).toMatch(/\S · \S/);
      expect(p.href.startsWith('/')).toBe(true);
      // the snippet is the line's own words, with the matched ones marked
      expect(p.snippet.some(([, hit]) => hit)).toBe(true);
      const shown = p.snippet
        .map(([t]) => t)
        .join('')
        .replace(/^… | …$/g, '');
      expect(
        [...everyLine].some((l) => l.includes(shown)),
        shown,
      ).toBe(true);
    }
  });
  it('finds nothing for words the site does not hold, and says so', () => {
    const f = first('piano', words);
    expect(f.kind).toBe('places');
    if (f.kind === 'places') expect(f.places).toEqual([]);
  });
});
