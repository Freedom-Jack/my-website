import type { PageWords } from './types';

/**
 * Work (/work/): a concise index (Jack, DESIGN §11.E answer 2: "keep it concise and have dedicated pages for the
 * rest"). The six projects come from content/work/*.mdx (one file per case, each its own page); this file holds
 * the index's own words (COPY.md §3). The How I build drawing is content/work/diagrams/how-i-build.{wide,tall}.svg.
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
    title: 'Six projects, newest first',
    columns: { years: 'Years', project: 'Project', outcome: 'Outcome' },
    /** A row with no public evidence (its links sit under the outcome): screen readers hear this. */
    noEvidence: 'Client work, no public page',
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

  open: {
    title: 'In the open',
    intro: 'These are the public pieces.',
    featured: 'Featured',
    recent: 'Recent',
    /** "{first}–{last}" are the rows' years; after 2020 the heading becomes "Earlier work, …". */
    early: 'Early work',
    earlier: 'Earlier work',
    earlyCaption: 'Early public repositories',
    columns: { year: 'Year', repository: 'Repository', what: 'What it is' },
    updated: 'Updated',
    demo: 'Live demo',
    all: { label: 'All repositories on GitHub →', href: 'https://github.com/Freedom-Jack' },
  },

  /** On a case page: the way back to the index (COPY §1.3's words). */
  back: { label: 'All six projects →', href: '/work/' },
} satisfies PageWords & Record<string, unknown>;
