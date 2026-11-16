/**
 * The site's words as "Ask the painting" reads them: every verbatim unit of the corpus (features/craft/corpus.ts:
 * one paragraph, row, step or list item of content/), in the corpus's order, as a line; and which lines may stand
 * as an answer. Shared by the page (brain.ts) and the index build (tools/build-ask.ts), so both count the same
 * lines in the same order. No imports: Node runs this file as it is.
 */
export interface AskChunk {
  id: string;
  text: string;
  page: string;
  section: string;
  href: string;
  stretch: number;
  u: number | null;
  place: string;
  units: Array<{ end: number; section: number; anchor?: string; title?: true }>;
}

export interface Line {
  /** its place in the corpus's order (the index's vectors are filed by it) */
  n: number;
  chunk: AskChunk;
  /** the unit, word for word */
  text: string;
  /** the one heading it stands under ("About me", "Note: RAG", "Experience: …") */
  section: string;
  anchor?: string;
  /** whether it may be shown as an answer (a heading, a lead-in or a pointer line may not) */
  answers: boolean;
}

/** The corpus's passages cut back into their units. */
export function linesOf(chunks: AskChunk[]): Line[] {
  const out: Line[] = [];
  for (const chunk of chunks) {
    const sections = chunk.section.split(' · ');
    let at = 0;
    for (const u of chunk.units) {
      const text = chunk.text.slice(at, u.end);
      at = u.end + 1;
      const section = sections[u.section] ?? '';
      out.push({
        n: out.length,
        chunk,
        text,
        section,
        ...(u.anchor ? { anchor: u.anchor } : {}),
        // not an answer: a heading over other lines; a line that only leads into the next ("…components:"); the
        // notes on where a case's evidence is, and the line that points at the public pieces
        answers: !u.title && !/[,:]$/.test(text) && section !== 'Evidence' && section !== 'In the open',
      });
    }
  }
  return out;
}

/** A line's sentences (a long line is answered with its closest one). */
export const sentences = (text: string) =>
  text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9“"(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);

/** A sentence that points back at the one before it (it opens on a pronoun, or speaks of "them", "they", "those"). */
export const LEANS = /^(It|They|This|That|These|Those)\b|\b(them|they|those|these)\b/;

/** What the model reads for a line: the page and the heading the line stands under, then the line. */
export const headed = (l: Line) => `${l.chunk.page}. ${l.section}. ${l.text}`;

/** The things a skills line or a stack line names, one by one ("SQL (T-SQL, PostgreSQL)" is three). */
export function listed(l: Line): string[] {
  if (l.section !== 'Skills' && l.section !== 'Stack') return [];
  return l.text
    .split(/,|\(|\)/)
    .flatMap((s) => {
      const parts = s.split('/');
      return parts.every((p) => p.trim().length > 3) ? parts : [s];
    })
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}
/** The questions a named thing is filed under (never shown; see questions.ts). */
export const listedQuestions = (thing: string) => [`Do you know ${thing}?`, `Have you used ${thing}?`];
