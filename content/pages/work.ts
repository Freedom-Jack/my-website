import type { PageWords } from './types';

/**
 * Work (/work/): the thesis and the honesty line, the six projects as one list in two scales (the two newest with
 * room, the other four as a ruled set), How I build with its drawing, and the public repositories. The six projects
 * come from content/work/*.mdx (one file per case, each its own page); this file holds the index's own words. The How
 * I build drawing is content/work/diagrams/how-i-build.{wide,tall}.svg.
 */
export const work = {
  meta: {
    title: 'Qijin (Jack) Xu · Work',
    description:
      'Six projects by Qijin (Jack) Xu: a RAG assistant serving 50,000+ users, LLM agents, a fraud model, and data platforms, each with its outcome and stack.',
  },
  title: 'Work',
  intro:
    'Most of what I build runs inside client systems, so the code is private. Each project has its own page: what it was, what I did, and what changed. Where a public page exists, it’s linked.',

  index: {
    /** The line under the page's title, in the painting's sky; it names the list of projects. */
    title: 'Six projects, newest first',
    /** An entry with no public evidence, where its links would stand. */
    noEvidence: 'Client work, no public page',
    /** The way from one of the two large entries to its page. */
    more: 'The case',
  },

  build: {
    title: 'How I build',
    statement: 'A model is only as good as the system around it.',
    line: 'For {{years}} years I’ve built those systems: the data underneath, the retrieval in the middle, and the agents and guardrails on top.',
    diagram: {
      name: 'how-i-build',
      caption: 'The generic shape, simplified. No client detail.',
      steps: [
        'Sources feed ETL/ELT pipelines.',
        'Lineage records where each piece of data came from and how it moved (OpenLineage).',
        'The prepared data is indexed for search (FAISS or Pinecone).',
        'A request reaches the agent workflow (LangGraph), which decides the next step.',
        'Retrieval finds the relevant context in the index.',
        'The workflow calls vLLM-served models with that context.',
        'Guardrails: PII filtering keeps personal information out, and EBNF grammars keep every output well-formed.',
        'The answer, document or extracted rule goes back to whoever asked.',
      ],
    },
  },

  /** Under every brush diagram (Work and the two cases that have one): its text equivalent, behind this fold. */
  diagram: { steps: 'Read as steps' },

  open: {
    title: 'In the open',
    intro: 'These are the public pieces.',
    /** "{first}–{last}" are the rows' years; after 2020 the fold becomes "Earlier work, …". */
    early: 'Early work',
    earlier: 'Earlier work',
    demo: 'Live demo',
    all: { label: 'All repositories on GitHub →', href: 'https://github.com/Freedom-Jack' },
  },

  /** On a case page: the way back to the index. */
  back: { label: 'All six projects →', href: '/work/' },
} satisfies PageWords & Record<string, unknown>;
