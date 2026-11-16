/**
 * "Ask the painting" (Home; src/features/ask): every word the section and its trace show.
 * NEW WORDS, written for Jack in his voice (round 6; re-cut in round 7, when the half that repainted the painting
 * by hour and weather went and the line moved from the first screen into the body): all of them wait for his
 * approval and are listed in NEW-WORDS.md at the repo's root. The answers themselves are never written here or by
 * the model: an answer is a line of the site's own approved words, shown word for word.
 * In the trace's lines, {braces} are filled with the run's real numbers.
 */
export const ask = {
  /** the section's title */
  label: 'Ask the painting',
  /** the mono label over the title */
  tag: 'A language model, in your browser',
  placeholder: 'What did you build for insurers?',
  go: 'Ask',
  /** beside the line, before anything is asked */
  hint: 'Ask about my work. A small language model runs in your own browser: about 38 MB from this site, the first time. It answers only with my own lines, and nothing you type is sent anywhere.',
  tryLabel: 'Try',
  tries: ['What did you build for insurers?', 'What are you working on right now?', 'Where did you study?'],

  trace: {
    /** over the steps */
    title: 'What the model did',
    loading: 'Fetching the model from this site: {got} of {total} MB',
    loaded: 'The model: {total} MB, now in your browser',
    read: 'Your words: {n} tokens',
    embed: 'Turned into {dim} numbers in {ms} ms',
    guard: 'A private matter: nothing searched',
    search: 'Measured against {n} lines of this site',
    travel: 'The painting travels to {place}',
  },

  result: {
    answerNote: 'My own words, found by the model, not written by it.',
    from: 'From',
    back: 'Bring the painting back',
    private: 'I keep that off this site. Ask me about the work instead.',
    unknown: 'Nothing in my words is close enough ({score}, under {floor}), and I would rather not guess.',
    unknownMore: 'The work pages hold the detail; or write to me.',
    error: 'The model could not run in this browser. The search on the Work page needs no model.',
  },
};
