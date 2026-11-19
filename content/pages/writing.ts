import type { PageWords } from './types';

/**
 * Writing (/writing/) and a note's page. The pieces themselves: content/writing/*.mdx.
 */
export const writing = {
  meta: {
    title: 'Qijin (Jack) Xu · Writing',
    description:
      'Notes by Qijin (Jack) Xu on building AI systems that work outside the demo: AI agents, RAG, and the production systems around them.',
  },
  title: 'Writing',
  intro: 'Notes on building AI systems that work outside the demo.',

  /** Writing's index opens a note out: the action under its description, and the label over the note's own
   *  comparison, which the reader can turn aspect by aspect. New words, for Jack's approval (NEW-WORDS.md). */
  read: 'Read the note',
  from: 'From the note',

  /** At the end of every note: the link back to Home. */
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
