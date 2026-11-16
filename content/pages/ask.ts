/**
 * "Ask the painting" (Home; src/features/ask): every word the line and its trace show.
 * NEW WORDS, written for Jack in his voice (round 6): all of them wait for his approval; they are listed in
 * NEW-WORDS.md at the repo's root. The answers themselves are never written here or by the model: an answer is a
 * line of the site's own approved words, shown word for word.
 * In the trace's lines, {braces} are filled with the run's real numbers.
 */
export const ask = {
  label: 'Ask the painting',
  placeholder: 'snow at dusk, the lanterns lit',
  go: 'Ask',
  /** under the line, before anything is asked */
  hint: 'Describe a scene, or ask about my work. A small language model runs in your own browser: about 38 MB from this site, the first time. Nothing you type is sent anywhere.',
  tryLabel: 'Try',
  tries: ['snow at dusk, the lanterns lit', 'What did you build for insurers?', 'a moonlit night'],

  trace: {
    loading: 'Fetching the model from this site: {got} of {total} MB',
    loaded: 'The model: {total} MB, now in your browser',
    read: 'Your words: {n} tokens',
    embed: 'Turned into {dim} numbers in {ms} ms',
    routeScene: 'Read as a scene ({scene} to {question})',
    routeQuestion: 'Read as a question ({question} to {scene})',
    scene: 'In it: {found}',
    sceneNone: 'Nothing in it that I can paint yet',
    guard: 'A private matter: nothing searched',
    search: 'Closest of {n} lines of this site: {score}',
    travel: 'The painting travels to {place}',
  },

  result: {
    scene: 'Repainted: {labels}.',
    sceneBack: 'Back to your own hour',
    sceneUnknown: 'I can paint the hour, the weather and the lamps. Try “snow at dusk”, or “a moonlit night”.',
    answerNote: 'My own words, found by the model, not written by it.',
    from: 'From',
    back: 'Bring the painting back',
    private: 'I keep that off this site. Ask me about the work instead.',
    unknown: 'Nothing in my words is close enough ({score}, under {floor}), and I would rather not guess.',
    unknownMore: 'The work pages hold the detail; or write to me.',
    error: 'The model could not run in this browser. The search on the Work page needs no model.',
  },
};
