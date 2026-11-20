/**
 * Step 1, a search by word: BM25 over the site's passages (features/craft/text.ts, the same code the build measures
 * the search with), built here in the browser from the words the sheet has already fetched. What it finds is shown
 * as places, never as his answer: a passage's closest line, where it stands, and the words that matched.
 */
import { buildIndex, closeHits, matchedWords, search } from '@/features/craft/text';
import type { AskChunk, Line } from './lines';
import { hrefOf, where } from './shape';

export interface Place {
  id: string;
  /** "Page · Section" */
  source: string;
  href: string;
  /** the line's words around the first match, cut into runs: [words, matched] */
  snippet: [text: string, hit: boolean][];
  place: string;
  stretch: number;
  u: number | null;
}

/** A snippet's length (characters): two lines beside its place's name. */
const ROOM = 124;
/** A word as text.ts's matchedWords returns it: without the punctuation round it. */
const core = (w: string) => w.replace(/^[^\w%]+|[^\w%+]+$/g, '');

function snippetOf(text: string, matched: Set<string>): Place['snippet'] {
  const words = text.split(/\s+/);
  const first = Math.max(
    0,
    words.findIndex((w) => matched.has(core(w))),
  );
  // a short line whole; a long one from a little before its first matched word
  let from = 0,
    to = words.length;
  if (text.length > ROOM) {
    from = Math.max(0, first - 4);
    let n = 0;
    to = from;
    while (to < words.length && n + words[to]!.length <= ROOM) n += words[to++]!.length + 1;
    while (from > 0 && n + words[from - 1]!.length <= ROOM) n += words[--from]!.length + 1;
  }
  const out: Place['snippet'] = [];
  const push = (t: string, hit: boolean) => {
    const last = out[out.length - 1];
    if (last && last[1] === hit) last[0] += t;
    else out.push([t, hit]);
  };
  if (from > 0) push('… ', false);
  words.slice(from, to).forEach((w, i) => {
    const c = core(w);
    if (i) push(' ', false);
    if (c && matched.has(c)) {
      const at = w.indexOf(c);
      if (at > 0) push(w.slice(0, at), false);
      push(c, true);
      if (at + c.length < w.length) push(w.slice(at + c.length), false);
    } else push(w, false);
  });
  if (to < words.length) push(' …', false);
  return out;
}

export function makeSearch(chunks: AskChunk[], lines: Line[]) {
  const index = buildIndex(chunks);
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const of = new Map<AskChunk, Line[]>();
  for (const l of lines) of.set(l.chunk, [...(of.get(l.chunk) ?? []), l]);
  return {
    passages: chunks.length,
    /** The close matches, strongest first. */
    query(q: string, k = 3): Place[] {
      return closeHits(search(index, q, k)).flatMap((h) => {
        const c = byId.get(h.id);
        if (!c) return [];
        // the passage's line that holds the most of the matched words (the first, when two hold as many)
        let best: { l: Line; words: Set<string> } | null = null;
        for (const l of of.get(c) ?? []) {
          const words = new Set(matchedWords(l.text, h.matched));
          if (!best || words.size > best.words.size) best = { l, words };
        }
        if (!best) return [];
        return [
          {
            id: c.id,
            source: where(best.l),
            href: hrefOf(best.l),
            snippet: snippetOf(best.l.text, best.words),
            place: c.place,
            stretch: c.stretch,
            u: c.u,
          },
        ];
      });
    },
  };
}
