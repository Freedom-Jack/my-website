/**
 * The long words of Work's "Under the hood" pieces. They never sit in Work's HTML, which stays under 30 KB gzipped:
 * the build puts each piece's words into that piece's JSON (src/app/craft/*), fetched as the reader reaches it. Each
 * piece opens with its tie and its case. Every sentence in Jack's voice is DRAFT until he rewords it. Tokens in
 * {braces} are filled by the page with measured or computed values.
 */
export const hood = {
  lineage: {
    /** the piece's first line: its tie to a production claim, then the link to that case (content/work/data-operations.mdx) */
    tie: 'At CGI I built a lineage tool that documents where data came from; this is that record for the words of this site.',
    case: 'data-operations',
    /** the one plain line after the tie */
    result:
      '{files} content files fed {passages} passages; the search, the vocabulary and the eval were all built from them at {commit}.',
    /** the fold that holds the list, under the drawing */
    listFold: 'Read the record as a list',
    drawing: 'The same record, drawn',
    edges: {
      joined: 'run together from',
      indexed: 'built from',
      learned: 'learned from',
      counted: 'counted over',
      resolved: 'resolved against',
      scored: 'scored with',
      shown: 'shown from',
    },
  },
  mask: {
    /** the piece's first line: its tie to a production claim, then the link to that case (content/work/proprietary-language-agent.mdx) */
    tie: 'The agent for a proprietary language keeps every output inside an EBNF grammar; this is that constraint on a case record, one token at a time.',
    case: 'proprietary-language-agent',
    result:
      'At this step the highest-scored token, {top}, is blocked; of {v} tokens {n} are legal, and {a} and {b} lead.',
    what: 'The vocabulary is real (byte-pair tokens learned from these pages at build); the scores are counts of which token follows which in these pages, not a neural model. The mask is the part that carries over: it lets through only what keeps the record valid.',
    record: 'The record so far',
    state: 'Inside',
    strip: 'The five highest-scored tokens at this step, and the five best legal ones',
    legal: 'legal',
    blocked: 'blocked',
    next: 'Take the best legal token',
    again: 'Start again',
    /** the record writes itself, one token at a time, once it is on screen; these stop and resume it */
    pause: 'Pause',
    resume: 'Go on',
    done: 'The record is complete and valid against the grammar.',
    grammar: 'The grammar',
    of: 'of',
  },
  eval: {
    /** the piece's first line: its tie to a production claim, then the link to that case (content/work/rag-assistant.mdx) */
    tie: 'The insurance assistant answered from retrieved passages, so retrieval had to be measured; this is the same measure for the search above.',
    case: 'rag-assistant',
    result: 'On {n} questions the search returns the right passage first {at1} and in the top three {at3}.',
    author:
      'The questions were written by the site’s author, not Jack; Jack’s own held-out set replaces them. Nothing in the search was tuned on them: BM25’s defaults, a stop list and a score floor fixed beforehand.',
    columns: { q: 'Question', rank: 'Right passage at', top: 'First result' },
    misses: 'Misses (the right passage not in the top three)',
    /** the fold that holds every question and its result, under the dots */
    every: 'Every question and its result',
    /** over the dots while the questions are being run, here, in the reader's browser */
    running: 'Running the {n} questions in your browser…',
    ran: 'Run just now, in your browser: {n} questions in {ms} ms.',
    dots: 'The questions, one mark each',
    first: 'right passage first',
    third: 'in the top three',
    miss: 'missed',
    none: 'none',
    notFound: 'not in the top three',
    n: 'n',
  },
} as const;
