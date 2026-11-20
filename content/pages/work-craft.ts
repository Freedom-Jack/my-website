/**
 * The words of "Under the hood" (src/features/craft): the three live pieces on their case pages. Kept apart from
 * content/pages/work.ts so the pieces' client chunk carries these words only, not all of Work's copy.
 */
export const workCraft = {
  /** "Under the hood": real things that run in the visitor's browser, each on the page of the case it is tied to
   *  (the grammar on the agent's, the search's own test on the assistant's, the lineage record on the data
   *  operations'). A piece's title and its tie (content/craft/hood.ts) are in the page; its data and its long words
   *  are fetched as the reader reaches it, never before. */
  hood: {
    title: 'Under the hood',
    /** before a piece has been reached: the size of its data, measured at build */
    open: 'about {kb} KB of data, fetched as you reach it',
    loading: 'Loading…',
    failed: 'It did not load. Reload the page to try again.',
    lineage: {
      title: 'Where the words came from',
    },
    mask: {
      title: 'Constrain the output',
    },
    eval: {
      title: 'How good is the search?',
    },
  },
};
