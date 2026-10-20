import type { PageWords } from './types';

/**
 * Writing (/writing/) and a note's page (COPY.md §4). The pieces themselves: content/writing/*.mdx.
 * Writing joins the header's nav once there are three pieces (content/site.ts).
 */
export const writing = {
  meta: {
    title: 'Qijin (Jack) Xu · Writing',
    description: 'Notes by Qijin (Jack) Xu on AI agents and the production AI systems around them.',
  },
  title: 'Writing',
  /** Still for Jack to confirm (COPY §10.13): "I write when…" is not his own words yet. */
  intro:
    'Notes on building AI systems that work outside the demo. I write when I’ve learned something worth passing on.',

  note: {
    /** The author line at the end of every piece, beside the seal (third person). */
    author:
      'Qijin Xu is a Lead AI/ML Architect at CGI’s AI Center of Excellence in Toronto. He designs and ships production AI: LLM agents, RAG systems and data platforms.',
    more: { label: 'More about Qijin', href: '/' },
  },

  /** The RSS feed (/writing/feed.xml). */
  feed: { title: 'Qijin Xu · Writing', description: 'Notes on AI agents and the production AI systems around them.' },
} satisfies PageWords & Record<string, unknown>;
