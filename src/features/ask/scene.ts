/**
 * What a visitor may ask the painting for: a scene. The model reads their words; this is what the words can mean.
 * Each `anchor` is one thing the painting can do (an hour, a weather, the lamps lit), named by a few plain phrases. The visitor's words (the whole line, and each part of it between commas and "and", "with") are
 * measured against every phrase with the embedding model, a spelt-out keyword counting a little too (the hybrid a
 * retrieval system runs), and an anchor is taken when it is close enough: the hour and the weather one each, the
 * rest each on its own.
 *
 * Shared by the browser (brain.ts) and the build (tools/build-ask.ts embeds the phrases into public/ask/index.json),
 * so it imports nothing.
 */
export interface Anchor {
  /** the group: one hour and one weather at most; the others each stand alone */
  group: 'hour' | 'weather' | 'lamps';
  key: string;
  /** what the trace calls it ("dusk", "snow", "the lamps lit") */
  label: string;
  /** plain phrases that mean it (embedded at build) */
  phrases: string[];
  /** words that name it outright (lower case; a match counts beside the model's score) */
  words: string[];
}

export const ANCHORS: Anchor[] = [
  {
    group: 'hour',
    key: 'dawn',
    label: 'dawn',
    phrases: ['dawn', 'sunrise', 'the first light of morning', 'early morning, the sun coming up', 'daybreak'],
    words: ['dawn', 'sunrise', 'daybreak', 'first light'],
  },
  {
    group: 'hour',
    key: 'day',
    label: 'day',
    phrases: ['midday', 'a bright clear day', 'daylight at noon', 'a sunny afternoon', 'broad daylight'],
    words: ['noon', 'midday', 'daytime', 'daylight', 'afternoon', 'sunny'],
  },
  {
    group: 'hour',
    key: 'dusk',
    label: 'dusk',
    phrases: ['dusk', 'sunset', 'twilight', 'the evening glow as the sun goes down', 'golden hour'],
    words: ['dusk', 'sunset', 'twilight', 'evening', 'sundown', 'golden hour'],
  },
  {
    group: 'hour',
    key: 'night',
    label: 'night',
    phrases: ['night', 'midnight', 'a moonlit night', 'the moon in a dark sky', 'late at night under the stars'],
    words: ['night', 'midnight', 'moon', 'moonlight', 'moonlit', 'stars'],
  },
  {
    group: 'weather',
    key: 'snow',
    label: 'snow',
    phrases: [
      'snow',
      'snow falling',
      'a winter day, everything white with snow',
      'a snowstorm',
      'frost and ice in deep winter',
    ],
    words: ['snow', 'snowing', 'snowfall', 'snowy', 'winter', 'blizzard', 'frost'],
  },
  {
    group: 'weather',
    key: 'rain',
    label: 'rain',
    phrases: ['rain', 'rain falling', 'a rainy day', 'a storm with heavy rain', 'drizzle and wet weather'],
    words: ['rain', 'raining', 'rainy', 'drizzle', 'storm', 'downpour', 'shower'],
  },
  {
    group: 'weather',
    key: 'clear',
    label: 'clear skies',
    phrases: ['clear skies', 'fine weather', 'a calm clear sky with no clouds'],
    words: ['clear', 'cloudless'],
  },
  {
    group: 'lamps',
    key: 'lamps',
    label: 'the lamps lit',
    phrases: [
      'the lanterns lit',
      'lamps glowing in the windows',
      'a lantern burning in the hut',
      'candlelight',
      'warm lights in the houses',
    ],
    words: ['lantern', 'lanterns', 'lamp', 'lamps', 'candle', 'candles', 'candlelight', 'lights'],
  },
];

/** What a scene is, set against a question: phrases of each kind (the router's own anchors). */
export const KINDS = {
  scene: [
    'a landscape at a time of day',
    'the weather and the light in a painting',
    'paint the mountains in snow at night',
    'make it rain over the river',
    'show the scene at sunset with lanterns',
  ],
  question: [
    'a question about his work and experience',
    'what has he built',
    'which projects used retrieval or agents',
    'how can I contact him',
    'what is his job and where did he study',
    'tell me about a project',
  ],
};

/** A line's parts: the whole of it, and each clause between commas, semicolons, "and", "with", "under", "in the". */
export function clauses(line: string): string[] {
  const whole = line.trim().replace(/\s+/g, ' ');
  const parts = whole
    .split(/[,;.]|\band\b|\bwith\b|\bunder\b|\bwhile\b/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
  return [...new Set([whole, ...parts])].slice(0, 6);
}

/** Does the line name this anchor outright? */
export function named(line: string, a: Anchor): boolean {
  const t = ` ${line
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')} `;
  return a.words.some((w) => t.includes(` ${w} `));
}

/** Words that open a question (the router leans on them). */
export const QUESTION_CUE =
  /\?|^\s*(who|what|which|where|when|why|how|does|do|did|is|are|was|were|can|could|has|have|tell me|show me his|list)\b/i;
