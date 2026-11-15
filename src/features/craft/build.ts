import 'server-only';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { evalSet } from '@content/craft/eval';
import { hood } from '@content/craft/hood';
import { type Bigram, scores, trainBigram } from './bigram';
import { type BPE, encode, trainBPE } from './bpe';
import { plain } from '@/lib/markup';
import { buildCorpus, type Chunk, type Corpus, frontMatter } from './corpus';
import { compile, fieldOf, grammarText, mask, record, type State, stepToken } from './grammar';
import { buildIndex, closeHits, search } from './text';

/**
 * Everything the craft on Work needs, computed once per build from content/ (the routes under src/app/craft/ serve the
 * pieces as static JSON; the unit test runs the same function). Nothing is fetched from anywhere: the corpus is the
 * site's own words, the vocabulary and the scores are learned from them, and every artefact carries the build's commit
 * and the corpus hash so the lineage can be traced. The replay fold and the dense gate are cut this round (A4, A7).
 */

export interface EvalRow {
  q: string;
  /** every passage holding the gold phrase (the résumé repeats some case sentences); any of them counts */
  golds: string[];
  /** the top three close matches, as the page would show them */
  top: string[];
  /** 1-based rank of the first gold passage in the top three, or 0 */
  rank: number;
  /** the first result's source (page · section), or '' when nothing is a close match */
  first: string;
}

export interface Opening {
  /** the case whose record the fold walks, and its link */
  title: string;
  href: string;
  /** the record's tokens, and the step where the fold opens (the tokens before it are already written) */
  tokens: number[];
  at: number;
}

export interface Craft {
  meta: { built: string; commit: string; corpusHash: string; passages: number; files: number };
  corpus: Corpus;
  mask: { roles: string[]; grammar: string; bpe: BPE; bigram: Bigram; opening: Opening } | null;
  eval: {
    n: number;
    rows: EvalRow[];
    recall: { at1: number; at3: number };
    misses: string[];
  };
  lineage: Lineage;
  /** the gzip sizes of the folds' JSON, as the page says them before a click (bytes) */
  sizes: Record<'corpus' | 'mask' | 'lineage' | 'eval', number>;
}

export interface Lineage {
  /** OpenLineage's shape: one run of one job, its inputs (the content files) and outputs */
  job: { namespace: string; name: string; runId: string };
  nodes: Array<{ id: string; kind: 'file' | 'dataset' | 'fold'; label: string; hash?: string; bytes?: number }>;
  edges: Array<[from: string, to: string, verb: keyof typeof hood.lineage.edges]>;
}

const MERGES = 256;

function commit(): string {
  const env = process.env.VERCEL_GIT_COMMIT_SHA;
  if (env) return env.slice(0, 7);
  try {
    return (
      execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim() || 'local'
    );
  } catch {
    return 'local';
  }
}

const gz = (v: unknown) => gzipSync(JSON.stringify(v)).length;

/** A passage as the browser receives it (the build-only parts left out). */
export function publicChunk(c: Corpus['chunks'][number]): Chunk {
  const { parts, ...rest } = c;
  void parts;
  return rest;
}

/**
 * The step the mask fold opens on (A6): the first step of a real case record where the highest-scored token in the
 * whole vocabulary is blocked and two or more legal tokens keep a meaningful share (10 % or more of the legal mass),
 * preferring the role and status fields, where the grammar branches. None: the fold is cut.
 */
function findOpening(
  records: Array<{ text: string; title: string; href: string }>,
  roles: string[],
  bpe: BPE,
  bigram: Bigram,
): Opening | null {
  const g = compile(roles);
  let fallback: Opening | null = null;
  for (const r of records) {
    const tokens = encode(r.text, bpe);
    let s: State | null = g.start;
    for (let i = 1; i < tokens.length && s; i += 1) {
      s = stepToken(g, s, bpe.vocab[tokens[i - 1]!]!);
      if (!s) break;
      const logp = scores(bigram, tokens[i - 1]!);
      const m = mask(g, s, bpe.vocab);
      let top = 0;
      for (let t = 1; t < logp.length; t += 1) if (logp[t]! > logp[top]!) top = t;
      if (m[top]) continue;
      let sum = 0;
      for (let t = 0; t < logp.length; t += 1) if (m[t]) sum += Math.exp(logp[t]!);
      let strong = 0;
      for (let t = 0; t < logp.length; t += 1) if (m[t] && Math.exp(logp[t]!) / sum >= 0.1) strong += 1;
      if (strong < 2) continue;
      const o = { title: r.title, href: r.href, tokens, at: i };
      const f = fieldOf(g, s);
      if (f === 'role' || f === 'status') return o;
      fallback ??= o;
    }
  }
  return fallback;
}

let memo: Craft | null = null;

export function buildCraft(): Craft {
  if (memo) return memo;
  const built = new Date().toISOString();
  const sha = commit();
  const corpus = buildCorpus();
  const index = buildIndex(corpus.chunks);
  const meta = {
    built,
    commit: sha,
    corpusHash: corpus.hash,
    passages: corpus.chunks.length,
    files: corpus.files.length,
  };

  // the vocabulary and the scores, learned from the words
  const texts = corpus.chunks.map((c) => c.text);
  const bpe = trainBPE(texts, MERGES);
  const bigram = trainBigram(
    texts.map((t) => encode(t, bpe)),
    bpe.vocab.length,
    12,
  );

  // the case records the grammar describes (title, years, role, status from the outcome line, figure)
  const caseChunks = corpus.chunks.filter((c) => c.href.startsWith('/work/') && c.href !== '/work/');
  const cases = [...new Set(caseChunks.map((c) => c.href))].map((href) => {
    const c = caseChunks.find((x) => x.href === href)!;
    return { href, title: c.page, file: c.file };
  });
  const fm = cases.map((c) => ({ ...c, ...caseRecordOf(c.file) }));
  const roles = [...new Set(fm.map((c) => c.role))].sort();
  const opening = findOpening(
    fm.map((c) => ({ text: record({ ...c, title: c.title }), title: c.title, href: c.href })),
    roles,
    bpe,
    bigram,
  );
  const maskOut = opening ? { roles, grammar: grammarText(roles), bpe, bigram, opening } : null;

  // the DRAFT eval set: each gold phrase resolved to its passages, then the search as the page runs it
  const rows: EvalRow[] = evalSet.map((e) => {
    const ns = (typeof e.gold === 'string' ? [e.gold] : e.gold).map((n) => n.replace(/\s+/g, ' '));
    const golds = corpus.chunks.filter((c) => ns.some((n) => c.text.includes(n))).map((c) => c.id);
    if (!golds.length) throw new Error(`eval: "${ns.join(' | ')}" matches no passage`);
    const top = closeHits(search(index, e.q, 8))
      .slice(0, 3)
      .map((h) => h.id);
    const at = top.findIndex((id) => golds.includes(id));
    const f = corpus.chunks.find((c) => c.id === top[0]);
    return { q: e.q, golds, top, rank: at + 1, first: f ? `${f.page} · ${f.section.split(' · ')[0]}` : '' };
  });
  const evalOut: Craft['eval'] = {
    n: rows.length,
    rows,
    recall: {
      at1: rows.filter((r) => r.rank === 1).length / rows.length,
      at3: rows.filter((r) => r.rank > 0).length / rows.length,
    },
    misses: rows.filter((r) => r.rank === 0).map((r) => r.q),
  };

  // the lineage of all of it (the passages' real word range, never the target: honest data)
  const lengths = corpus.chunks.map((c) => c.text.split(/\s+/).filter(Boolean).length);
  const lineage: Lineage = {
    job: { namespace: 'this site', name: 'src/features/craft/build.ts', runId: `${built.slice(0, 10)}-${sha}` },
    nodes: [
      ...corpus.files.map((f) => ({ id: f.file, kind: 'file' as const, label: f.file, hash: f.hash, bytes: f.bytes })),
      {
        id: 'passages',
        kind: 'dataset',
        label: `${corpus.chunks.length} passages (${Math.min(...lengths)} to ${Math.max(...lengths)} words)`,
        hash: corpus.hash,
      },
      { id: 'index', kind: 'dataset', label: 'the lexical index (BM25)' },
      { id: 'vocab', kind: 'dataset', label: `${bpe.vocab.length} byte-pair tokens` },
      { id: 'scores', kind: 'dataset', label: 'the bigram scores' },
      { id: 'eval', kind: 'dataset', label: `${rows.length} questions (DRAFT)` },
      { id: 'search', kind: 'fold', label: 'Search these pages' },
      { id: 'mask', kind: 'fold', label: 'Constrain the output' },
      { id: 'evalFold', kind: 'fold', label: 'How good is the search?' },
    ],
    edges: [
      ...corpus.files.map((f) => [f.file, 'passages', 'joined'] as Lineage['edges'][number]),
      ['passages', 'index', 'indexed'],
      ['passages', 'vocab', 'learned'],
      ['vocab', 'scores', 'counted'],
      ['passages', 'eval', 'resolved'],
      ['index', 'eval', 'scored'],
      ['index', 'search', 'shown'],
      ['scores', 'mask', 'shown'],
      ['eval', 'evalFold', 'shown'],
    ],
  };

  const sizes = {
    corpus: gz({ meta, chunks: corpus.chunks.map(publicChunk) }),
    mask: maskOut ? gz({ meta, ...maskOut, words: hood.mask }) : 0,
    lineage: gz({ meta, ...lineage, words: hood.lineage }),
    eval: gz({ meta, ...evalOut, words: hood.eval }),
  };
  memo = { meta, corpus, mask: maskOut, eval: evalOut, lineage, sizes };
  return memo;
}

// a case's record fields, read from its front matter
function caseRecordOf(file: string) {
  const d = frontMatter(readFileSync(path.join(/*turbopackIgnore: true*/ process.cwd(), file), 'utf8')).data as Record<
    string,
    unknown
  >;
  const fig = d.figure as { value: string };
  return { years: String(d.years), role: String(d.role), outcome: plain(String(d.outcome)), figure: plain(fig.value) };
}

/** A JSON response for the routes: static, built from content/, same-origin only. */
export function craftResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
