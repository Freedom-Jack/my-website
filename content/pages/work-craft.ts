/**
 * The words of Work's two craft islands, the search and "Under the hood" (src/features/craft). Kept apart from
 * content/pages/work.ts so the islands' client chunk carries these words only, not all of Work's copy.
 */
export const workCraft = {
  /**
   * "Search these pages": a label, a box and one status line. The index (BM25 over section-sized passages of
   * content/, src/features/craft) loads on the first focus; nothing typed leaves the browser (an e2e test records
   * every request). Hidden without JavaScript.
   */
  search: {
    label: 'Search these pages',
    placeholder: 'lineage, 99.9%, EBNF, hockey',
    submit: 'Search',
    /** before the first focus: the size measured at build, said before it is fetched */
    idle: 'The index, about {kb} KB of data, loads when you click into the box.',
    loading: 'Loading the index…',
    failed: 'The index did not load. Try again.',
    /** the measured half (PerformanceObserver) · the tested half (tests/e2e/craft.spec.ts) */
    ready: '{n} passages · index {sha} · downloaded {kb} KB from this site · nothing you type is sent anywhere',
    count: '{n} close matches',
    one: '1 close match',
    none: 'No close match in these pages.',
    hint: 'Down arrow moves into the results, Enter opens one, Escape clears.',
    show: 'show the place',
    hide: 'hide the place',
    matched: 'matched',
    stillAlt: 'The painting at {place}',
  },

  /** "Under the hood": four real things that run in the visitor's browser, laid open on Work: the search, its own
   *  test, a grammar holding a model's output, and the record of where all of it came from. Each piece's data (and
   *  its long words, content/craft/hood.ts) is fetched as the reader reaches it, never before. */
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
    caseLink: 'the case',
  },
};
