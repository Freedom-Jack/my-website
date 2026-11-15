/**
 * The words of Work's two craft islands, the search and "Under the hood" (src/features/craft). Kept apart from
 * content/pages/work.ts so the islands' client chunk carries these words only, not all of Work's copy.
 */
export const workCraft = {
  /**
   * "Search these pages" (the vanguard round, A2, A5, A11, A15, A16): a label, a box and one status line. The index
   * (BM25 over section-sized passages of content/, src/features/craft) loads on the first focus; nothing typed leaves
   * the browser (an e2e test records every request). Hidden without JavaScript.
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

  /** "Under the hood": three folds; each <summary> holds only its title and its size. Each fold's tie to a production
   *  claim, its case and its long words are content/craft/hood.ts, fetched with the fold (A8, ruling R10). */
  hood: {
    title: 'Under the hood',
    open: 'about {kb} KB of data, loaded when opened',
    loading: 'Loading…',
    failed: 'It did not load. Close and open it again.',
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
