/**
 * What is inscribed in the painting: one line, in Home's sky. Jack's choice (2026-11-20): the opening of Su Shi's
 * "Ding Feng Bo" (Calming the Waves), 1082. The English beside it is this site's own translation (NEW-WORDS.md).
 * No other page carries an inscription: its sky is the painting's.
 *
 * The calligraphy itself is artwork, not text: the line is drawn once as outlines (running script, read in columns
 * from the right, the seal under the last) into public/inscriptions/<place>.svg, so no Chinese character and no CJK
 * font is ever in a page (AGENTS.md, hard rules). `pinyin` is how the line is read aloud: it is the artwork's text
 * alternative. `width` and `height` are the drawing's own size at 32 px to the character.
 */
export const inscriptions = {
  from: 'Su Shi, 1082',
  alt: 'Chinese calligraphy, with a red seal',
  lines: {
    home: {
      src: '/inscriptions/home.svg',
      width: 78.1,
      height: 278.4,
      pinyin: 'mò tīng chuān lín dǎ yè shēng, hé fáng yín xiào qiě xú xíng',
      en: ['Never mind the rain beating through the leaves.', 'Why not sing out, and walk on slowly?'],
    },
  },
} as const;

export type InscriptionId = keyof typeof inscriptions.lines;
