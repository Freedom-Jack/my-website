/**
 * The BERT uncased tokenizer the embedding model was trained with (all-MiniLM-L6-v2): lower case, accents off,
 * punctuation split off, then WordPiece over the model's own vocabulary (public/models/minilm/vocab.txt).
 * Written out here (about a hundred lines) rather than taken from a library, so the page ships only what it runs.
 * Shared by the browser's worker (ask.worker.ts) and the build's index (tools/build-ask.ts): the same ids both ways.
 */
export interface Tokenizer {
  /** The model's inputs for one text: [CLS] its pieces [SEP], at most `max` ids. */
  encode(text: string, max?: number): { ids: number[]; pieces: string[] };
}

const isPunct = (ch: string) => {
  const c = ch.codePointAt(0)!;
  if ((c >= 33 && c <= 47) || (c >= 58 && c <= 64) || (c >= 91 && c <= 96) || (c >= 123 && c <= 126)) return true;
  return /\p{P}/u.test(ch);
};

export function createTokenizer(vocabText: string): Tokenizer {
  const vocab = new Map<string, number>();
  vocabText.split('\n').forEach((line, i) => {
    const t = line.replace(/\r$/, '');
    if (t && !vocab.has(t)) vocab.set(t, i);
  });
  const id = (t: string) => vocab.get(t);
  const CLS = id('[CLS]') ?? 101;
  const SEP = id('[SEP]') ?? 102;
  const UNK = id('[UNK]') ?? 100;

  /** Lower case, accents off, control characters out, punctuation as words of their own. */
  function words(text: string): string[] {
    const out: string[] = [];
    let cur = '';
    const flush = () => {
      if (cur) out.push(cur);
      cur = '';
    };
    for (const ch of text.toLowerCase().normalize('NFD')) {
      if (/\p{Mn}/u.test(ch)) continue;
      const c = ch.codePointAt(0)!;
      if (c === 0 || c === 0xfffd || (/\p{C}/u.test(ch) && !/\s/.test(ch))) continue;
      if (/\s/.test(ch)) flush();
      else if (isPunct(ch)) {
        flush();
        out.push(ch);
      } else cur += ch;
    }
    flush();
    return out;
  }
  /** A word as the vocabulary's longest pieces, from its left ("##" marks a piece inside a word). */
  function pieces(word: string): string[] {
    if (word.length > 100) return ['[UNK]'];
    const out: string[] = [];
    let start = 0;
    while (start < word.length) {
      let end = word.length;
      let found = '';
      while (start < end) {
        const sub = (start > 0 ? '##' : '') + word.slice(start, end);
        if (vocab.has(sub)) {
          found = sub;
          break;
        }
        end--;
      }
      if (!found) return ['[UNK]'];
      out.push(found);
      start = end;
    }
    return out;
  }
  return {
    encode(text, max = 128) {
      const ps = words(text).flatMap(pieces).slice(0, max - 2);
      return { ids: [CLS, ...ps.map((p) => id(p) ?? UNK), SEP], pieces: ps };
    },
  };
}
