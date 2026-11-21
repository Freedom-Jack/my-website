import { askDoor } from './ask-door';

/**
 * "Ask the painting" (every page; src/features/ask): every word the door, the tail's line, the sheet and its trace
 * show (the door's own two words are in ask-door.ts, so the header carries only those). An answer is never written
 * here, by the builder or by a model: it is a line of the site's own approved words, shown word for word.
 *
 * The instrument answers in three honest steps, and the trace names the one that answered:
 *   0  a filed question (an example, or the same words typed): his line at once, no model;
 *   1  anything else typed: a search by word over these pages, shown as places, never as his answer;
 *   2  a closer reading, only when the visitor asks for it: a sentence-embedding model in their own browser (once
 *      it is there, a typed question is read by it straight away: its cost is already paid).
 *
 * Words marked NEW WORDS (for Jack) were written by the builder in his voice and wait for his approval; the rest
 * are the earlier section's words (themselves still listed in NEW-WORDS.md). In the trace's lines, {braces} are
 * filled with the run's real numbers.
 */
export const ask = {
  /** label ("Ask the painting": the sheet's label) and door ("Ask") */
  ...askDoor,
  go: 'Ask',
  /** NEW WORDS (for Jack) */
  close: 'Close',
  /**
   * NEW WORDS (for Jack): the note beside the line before anything is asked. (It was: "Ask about my work. A small
   * language model runs in your own browser: about 38 MB from this site, the first time. It answers only with my
   * own lines, and nothing you type is sent anywhere." The model is now the second step, named where it is offered.)
   */
  hint: 'Ask about my work. An answer is always one of my own lines from these pages, and nothing you type is sent anywhere.',
  tryLabel: 'Try',
  /**
   * The examples: each is a filed question (src/features/ask/questions.ts), so it is answered at once, with no
   * model. NEW WORDS (for Jack): the first (it was "What did you build for insurers?", which is not filed).
   */
  tries: ['Have you built a chatbot?', 'What are you working on right now?', 'Where did you study?'],

  trace: {
    /** NEW WORDS (for Jack): over the steps (it was "What the model did": two of the three steps use no model) */
    title: 'How it was found',
    /** NEW WORDS (for Jack): the site's words have arrived (the lines, and the size as it came over the wire) */
    words: 'These pages: {n} lines, {kb} KB',
    /** NEW WORDS (for Jack): step 0 */
    filed: 'A filed question: no model needed',
    /** NEW WORDS (for Jack): step 1 */
    lexical: 'Searched by word, no model: {n} passages in {ms} ms',
    /** step 1's count (the Work search's words) */
    count: '{n} close matches',
    one: '1 close match',
    none: 'No close match',
    /** step 2. NEW WORDS (for Jack): "a sentence-embedding model" where it said "the model" */
    loading: 'Fetching a sentence-embedding model from this site: {got} of {total} MB',
    loaded: 'A sentence-embedding model: {total} MB, now in your browser',
    read: 'Your words: {n} tokens',
    embed: 'Turned into {dim} numbers in {ms} ms',
    guard: 'A private matter: nothing searched',
    search: 'Measured against {n} lines of this site',
    /** NEW WORDS (for Jack): the closest line's score against the floor */
    closest: 'The closest scored {score}; the floor is {floor}',
    travel: 'The painting travels to {place}',
  },

  result: {
    /** step 2's answer */
    answerNote: 'My own words, found by the model, not written by it.',
    /** NEW WORDS (for Jack): step 0's answer */
    filedNote: 'My own words. This question was filed under them ahead of time.',
    from: 'From',
    private: 'I keep that off this site. Ask me about the work instead.',
    unknown: 'Nothing in my words is close enough ({score}, under {floor}), and I would rather not guess.',
    /** (its two links are new; the words are not) */
    unknownMore: '[The work pages](/work/) hold the detail; or [write to me](/contact/).',
    /** NEW WORDS (for Jack): over the links under an honest no */
    nearest: 'The nearest places',
    /** NEW WORDS (for Jack): over step 1's passages */
    places: 'Where your words appear',
    /** step 1 found nothing (the Work search's words) */
    none: 'No close match in these pages.',
    /** NEW WORDS (for Jack): the offer of step 2, and its cost */
    closer: 'Read closer',
    closerCost:
      'These are places, not an answer. For one, a small model reads your question in your own browser: about 38 MB from this site, the first time.',
    /** NEW WORDS (for Jack): (it pointed at the Work page's search, which is now this line's first step) */
    error: 'The model could not run in this browser. The places above need no model.',
    /** NEW WORDS (for Jack): the site's words did not arrive */
    failed: 'These pages did not load. Try again.',
  },
};
