import type { Chunk } from '../corpus';
import { buildIndex, closeHits, matchedWords, search } from '../text';

/**
 * The search by word as the eval's run on a case page uses it (client/EvalFold), loaded with /craft/corpus.json when
 * that piece is reached: the index is built here, in the browser, and every query is scored here. A result is a
 * passage, verbatim, with its source and its place. ("Ask the painting" has its own, features/ask/search.ts, over
 * the same text.ts: the search box that stood on Work is gone.)
 */
export interface Result {
  id: string;
  text: string;
  /** the passage's own address: its page and section anchor */
  href: string;
  source: string;
  place: string;
  /** the matched words as they appear in the passage */
  matched: string[];
  /** the score against the top result's, 0..1 (drawn as a hairline length on wide screens; never a raw number) */
  rel: number;
  stretch: number;
  u: number | null;
}

interface Meta {
  built: string;
  commit: string;
  corpusHash: string;
  passages: number;
  files: number;
}

export function makeSearch(data: { meta: Meta; chunks: Chunk[] }) {
  const index = buildIndex(data.chunks);
  const byId = new Map(data.chunks.map((c) => [c.id, c]));
  return {
    meta: data.meta,
    query(q: string, k = 6): Result[] {
      const hits = closeHits(search(index, q, k));
      const top = hits[0]?.score ?? 1;
      return hits.flatMap((h) => {
        const c = byId.get(h.id);
        if (!c) return [];
        return [
          {
            id: c.id,
            text: c.text,
            href: c.anchor ? `${c.href}#${c.anchor}` : c.href,
            source: `${c.page} · ${c.section.split(' · ')[0]}`,
            place: c.place,
            matched: matchedWords(c.text, h.matched),
            rel: h.score / top,
            stretch: c.stretch,
            u: c.u,
          },
        ];
      });
    },
  };
}
export type SearchRuntime = ReturnType<typeof makeSearch>;
