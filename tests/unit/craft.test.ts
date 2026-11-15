import { describe, expect, it } from 'vitest';
import { home } from '@content/pages/home';
import { work } from '@content/pages/work';
import { writing } from '@content/pages/writing';
import { contact } from '@content/pages/contact';
import { site } from '@content/site';
import raw from '@content/resume.json';
import { buildCraft, publicChunk } from '@/features/craft/build';
import { decodeBytes } from '@/features/craft/bpe';
import { bodyUnits, MIN_WORDS, passages } from '@/features/craft/corpus';
import { accepts, compile, isDone, mask, record, STATUSES, stepToken } from '@/features/craft/grammar';
import { buildIndex, closeHits, search } from '@/features/craft/text';
import { findBreaches } from '@/lib/compliance';
import { fillTokens } from '@/lib/typography';
import { plain } from '@/lib/markup';
import { mdxFiles } from './frontmatter';

/**
 * The craft on Work (features/craft): built from content/ only. Every passage is made of verbatim units of content
 * strings; no artefact holds a phone number, a street address, a CJK character or the old PDF; the DRAFT eval set
 * resolves; the branching grammar accepts every real case record and the mask fold has its opening step.
 */
const craft = buildCraft();
const CJK = /[⺀-鿿豈-﫿＀-￯]/;

function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(plain(fillTokens(v)).replace(/\s+/g, ' ').trim());
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
}

describe('the corpus (features/craft/corpus)', () => {
  const pool = [
    ...strings([home, work, writing, contact, site.bio, raw]),
    ...raw.skills.map((s) => s.keywords.join(', ')),
    ...[...mdxFiles('content/work'), ...mdxFiles('content/writing')].flatMap((f) => strings(f.data)),
    ...[...mdxFiles('content/work'), ...mdxFiles('content/writing')].map((f) =>
      f.body
        .replace(/<time[^>]*>([^<]*)<\/time>/g, '$1')
        .replace(/<[^>]+>/g, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1')
        .replace(/\s+/g, ' '),
    ),
  ];
  it('is section-sized passages, each made of verbatim units of content/', () => {
    expect(craft.corpus.chunks.length).toBeGreaterThan(30);
    for (const c of craft.corpus.chunks) {
      expect(c.text).toBe(c.parts.join(' '));
      for (const part of c.parts) {
        // a Now line is "Label: text"; a case's figure is "value note" (two fields): each piece is a content string
        const pieces = [
          /^[A-Za-z-]+: /.test(part) && c.section.includes('Now') ? part.replace(/^[A-Za-z-]+: /, '') : part,
        ];
        for (const p of pieces) {
          const needle = c.section.includes('The figure') && p === part ? p.replace(/^.*?\d[^ ]* /, '') : p;
          expect(
            pool.some((s) => s.includes(needle)),
            `${c.id}: "${needle.slice(0, 60)}…" is not verbatim content`,
          ).toBe(true);
        }
      }
    }
  });
  it('never makes a passage of one short sentence (A4), and the lineage prints the real word range', () => {
    const lengths = craft.corpus.chunks.map((c) => c.text.split(/\s+/).filter(Boolean).length);
    for (const [i, n] of lengths.entries())
      expect(n, `${craft.corpus.chunks[i]!.id} has ${n} words`).toBeGreaterThanOrEqual(MIN_WORDS / 2);
    expect(craft.corpus.chunks.some((c) => c.href === '/writing/')).toBe(false);
    const label = craft.lineage.nodes.find((x) => x.id === 'passages')!.label;
    expect(label).toBe(`${lengths.length} passages (${Math.min(...lengths)} to ${Math.max(...lengths)} words)`);
    expect(passages([{ section: 'A', text: 'One two.', file: 'f', u: null }]).length).toBe(1);
  });
  it('gives every passage a stable id, a page, a place, a position and its file hash', () => {
    const ids = craft.corpus.chunks.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of craft.corpus.chunks) {
      expect(c.href.startsWith('/')).toBe(true);
      expect(c.stretch).toBeGreaterThanOrEqual(0);
      expect(c.stretch).toBeLessThanOrEqual(4);
      expect(c.place).not.toBe('');
      if (c.u !== null) expect(c.u).toBeGreaterThan(0);
      expect(c.hash).toMatch(/^[0-9a-f]{8}$/);
      expect('parts' in publicChunk(c)).toBe(false);
    }
    // the six cases stand at six different quays of the town
    const caseU = new Set(craft.corpus.chunks.filter((c) => /^\/work\/.+\//.test(c.href)).map((c) => c.u));
    expect(caseU.size).toBe(6);
  });
  it('reads MDX bodies as units under their headings', () => {
    const units = bodyUnits('## Context\n\nOne.\n\n<Note term="RAG">Retrieval.</Note>\n\n## Stack\n\nA, B');
    expect(units.map((u) => [u.section, u.text])).toEqual([
      ['Context', 'One.'],
      ['Note: RAG', 'Retrieval.'],
      ['Stack', 'A, B'],
    ]);
  });
});

describe('the hard rules over every craft artefact', () => {
  const parts: Record<string, unknown> = {
    corpus: craft.corpus,
    mask: craft.mask,
    eval: craft.eval,
    lineage: craft.lineage,
  };
  for (const [name, v] of Object.entries(parts))
    it(`${name}: no phone, street address, PMP, CJK or old PDF; no ten-digit run`, () => {
      const json = JSON.stringify(v);
      expect(findBreaches(json)).toEqual([]);
      expect(json).not.toMatch(/\d{10}/);
      expect(json).not.toMatch(/\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/);
      expect(json).not.toMatch(CJK);
    });
  it('no token the mask fold can display is a CJK character', () => {
    for (const t of craft.mask!.bpe.vocab) {
      const s = decodeBytes(t);
      expect(s).not.toMatch(CJK);
      expect(findBreaches(s)).toEqual([]);
    }
  });
});

describe('the DRAFT eval set and the search', () => {
  it('resolves every gold phrase, prints n and reports recall with every miss', () => {
    expect(craft.eval.n).toBe(20);
    expect(craft.eval.recall.at3).toBeGreaterThanOrEqual(craft.eval.recall.at1);
    expect(craft.eval.misses.length).toBe(craft.eval.rows.filter((r) => r.rank === 0).length);
    for (const r of craft.eval.rows) expect(r.golds.length).toBeGreaterThan(0);
  });
  it('searches as the page will, with an honest floor', () => {
    const index = buildIndex(craft.corpus.chunks);
    const hits = closeHits(search(index, 'lineage tool', 6));
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.matched).toContain('lineage');
    expect(closeHits(search(index, 'the work', 6))).toEqual([]);
    expect(closeHits(search(index, 'piano', 6))).toEqual([]);
  });
});

describe('the branching grammar (features/craft/grammar) and the mask', () => {
  const bytes = (s: string) => [...new TextEncoder().encode(s)];
  const roles = craft.mask!.roles;
  const g = compile(roles);
  it('accepts every real case record and rejects broken ones', () => {
    const r = record({ title: 'A', years: '2025 – present', role: roles[0]!, outcome: 'Projected. In progress.' });
    expect(r).toContain('"status": "in progress"');
    expect(accepts(g, bytes(r))).toBe(true);
    expect(
      accepts(g, bytes(record({ title: 'A', years: '2020 – 2021', role: roles[0]!, outcome: 'x', figure: '9%' }))),
    ).toBe(true);
    expect(accepts(g, bytes(r.replace(roles[0]!, 'Astronaut')))).toBe(false);
    expect(accepts(g, bytes(r.replace('2025', '25')))).toBe(false);
    expect(accepts(g, bytes(r.replace('in progress', 'done')))).toBe(false);
    expect(STATUSES.length).toBe(3);
  });
  it('opens on a step where the mask strikes the top token and leaves two or more real choices', () => {
    const o = craft.mask!.opening;
    const { bpe } = craft.mask!;
    let s = g.start;
    for (const t of o.tokens.slice(0, o.at)) s = stepToken(g, s, bpe.vocab[t]!)!;
    expect(isDone(g, s)).toBe(false);
    const m = mask(g, s, bpe.vocab);
    expect(m.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(2);
  });
});
