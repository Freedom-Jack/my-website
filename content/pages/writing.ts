import type { PageWords } from './types';

/**
 * Writing (/writing/) and a note's page (COPY.md §4). The pieces themselves: content/writing/*.mdx.
 * Writing joins the header's nav once there are three pieces (content/site.ts).
 */
export const writing = {
  meta: {
    title: 'Qijin (Jack) Xu · Writing',
    description:
      'Notes by Qijin (Jack) Xu on building AI systems that work outside the demo: AI agents, RAG, and the production systems around them.',
  },
  title: 'Writing',
  intro: 'Notes on building AI systems that work outside the demo.',

  /** At the end of every piece: the colophon (content/site.ts `bio`), then the one button. */
  note: {
    more: { label: 'More about Qijin →', href: '/' },
  },

  /** The RSS feed (/writing/feed.xml). */
  feed: {
    title: 'Qijin Xu · Writing',
    description: 'Notes on building AI systems that work outside the demo.',
    /** The quiet link under the list. */
    link: 'RSS feed',
  },
} satisfies PageWords & Record<string, unknown>;
