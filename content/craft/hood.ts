/**
 * The long words of Work's "Under the hood" folds and the search's honesty notes. They never sit in Work's HTML (the
 * attack's A8: the page's HTML stays under 30 KB gzipped): the build puts each fold's words into that fold's JSON
 * (src/app/craft/*), fetched only when the fold is opened. Every sentence in Jack's voice is DRAFT until he rewords it.
 * Each fold opens with its tie and its case (moved out of Work's HTML, ruling R10). Tokens in {braces} are filled by the page with measured or computed values.
 */
export const hood = {
  lineage: {
    /** the fold's first line: its tie to a production claim, then the link to that case (content/work/data-operations.mdx) */
    tie: 'DRAFT · At CGI I built a lineage tool that documents where data came from; this is that record for the words of this site.',
    case: 'data-operations',
    /** the one plain line after the tie */
    result:
      'DRAFT · {files} content files fed {passages} passages; the search, the vocabulary and the eval were all built from them at {commit}.',
    list: 'The record',
    drawing: 'The same record, drawn',
    from: 'from',
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
    /** the fold's first line: its tie to a production claim, then the link to that case (content/work/proprietary-language-agent.mdx) */
    tie: 'DRAFT · The agent for a proprietary language keeps every output inside an EBNF grammar; this is that constraint on a case record, one token at a time.',
    case: 'proprietary-language-agent',
    result:
      'DRAFT · At this step the highest-scored token, {top}, is blocked; of {v} tokens {n} are legal, and {a} and {b} lead.',
    what: 'DRAFT · The vocabulary is real (byte-pair tokens learned from these pages at build); the scores are counts of which token follows which in these pages, not a neural model. The mask is the part that carries over: it lets through only what keeps the record valid.',
    record: 'The record so far',
    state: 'Inside',
    strip: 'The five highest-scored tokens at this step, and the five best legal ones',
    columns: { rank: 'Rank', token: 'Token', share: 'Share', mask: 'Mask', id: 'Id' },
    legal: 'legal',
    blocked: 'blocked',
    next: 'Take the best legal token',
    again: 'Start again',
    done: 'The record is complete and valid against the grammar.',
    grammar: 'The grammar',
    of: 'of',
  },
  eval: {
    /** the fold's first line: its tie to a production claim, then the link to that case (content/work/rag-assistant.mdx) */
    tie: 'DRAFT · The insurance assistant answered from retrieved passages, so retrieval had to be measured; this is the same measure for the search above.',
    case: 'rag-assistant',
    result: 'DRAFT · On {n} questions the search returns the right passage first {at1} and in the top three {at3}.',
    author:
      'DRAFT · The questions were written by the site’s author, not Jack; Jack’s own held-out set replaces them. Nothing in the search was tuned on them: BM25’s defaults, a stop list and a score floor fixed beforehand.',
    columns: { q: 'Question', rank: 'Right passage at', top: 'First result' },
    misses: 'Misses (the right passage not in the top three)',
    none: 'none',
    notFound: 'not in the top three',
    n: 'n',
  },
} as const;
