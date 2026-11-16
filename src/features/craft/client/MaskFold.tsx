'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Bigram } from '../bigram';
import { scores } from '../bigram';
import type { BPE } from '../bpe';
import { compile, fieldOf, type Grammar, isDone, mask, type State, stepToken } from '../grammar';
import type { Opening } from '../build';
import { fill } from './fill';
import { useSeen } from './Piece';
import styles from '../craft.module.css';

interface Data {
  roles: string[];
  grammar: string;
  bpe: BPE;
  bigram: Bigram;
  opening: Opening;
  words: typeof import('@content/craft/hood').hood.mask;
}

const dec = new TextDecoder('utf-8', { fatal: false });
/** A token as the page shows it: in quotes, a space as "␣"; a lone byte of a longer character as "byte e2". */
function show(bytes: number[]): string {
  const s = dec.decode(new Uint8Array(bytes));
  if (s.includes('�')) return `byte ${bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ')}`;
  return `“${s.replace(/ /g, '␣')}”`;
}

/** Where the record stands after `toks`: the grammar's state, what is legal next, and the candidates to show. */
function read(g: Grammar, vocab: number[][], bigram: Bigram, toks: number[]) {
  let s: State | null = g.start;
  for (const t of toks) s = s && stepToken(g, s, vocab[t]!);
  if (!s) return null;
  const m = mask(g, s, vocab);
  const done = isDone(g, s) && !m.some(Boolean);
  const logp = scores(bigram, toks[toks.length - 1]!);
  let sum = 0;
  for (let t = 0; t < vocab.length; t += 1) if (m[t]) sum += Math.exp(logp[t]!);
  const order = [...logp.keys()].sort((a, b) => logp[b]! - logp[a]!);
  const legal = order.filter((t) => m[t]);
  const share = (t: number) => (m[t] ? Math.exp(logp[t]!) / sum : 0);
  // the strip: the five best tokens overall and the five best legal ones, in score order
  const top = [...new Set([...order.slice(0, 5), ...legal.slice(0, 5)])].sort((a, b) => logp[b]! - logp[a]!);
  return { s, done, m, top, legal, share, n: legal.length };
}

/**
 * "Constrain the output" (the attack's A6; round 7: Work's moment, laid open on the page): a real case record written
 * one token at a time over a vocabulary learned from these pages. It opens on the step the build found where the
 * grammar strikes the highest-scored token and leaves two or more real choices. Once it is on screen the record writes
 * itself, a token every 0.8 s: at each step the candidates stand in score order, the ones the grammar forbids struck
 * through with a brush, each legal one with its share as a stroke that long; the best legal token joins the record.
 * The reader can pause it, take a step by hand, or start again. Reduced motion and Still: nothing runs by itself.
 */
const STEP_MS = 800;

export function MaskFold({ data }: { data: Data }) {
  const w = data.words;
  const g = useMemo(() => compile(data.roles), [data.roles]);
  const vocab = data.bpe.vocab;
  const prefix = useMemo(() => data.opening.tokens.slice(0, data.opening.at), [data.opening]);
  const [toks, setToks] = useState<number[]>(prefix);
  const [run, setRun] = useState<'auto' | 'paused'>('auto');
  const [ref, seen] = useSeen<HTMLDivElement>(0.5);

  const view = useMemo(() => read(g, vocab, data.bigram, toks), [g, toks, vocab, data.bigram]);
  const step = useCallback(
    () =>
      setToks((prev) => {
        const v = read(g, vocab, data.bigram, prev);
        return v && !v.done && v.legal.length ? [...prev, v.legal[0]!] : prev;
      }),
    [g, vocab, data.bigram],
  );

  // the record writes itself while it is on screen (never under reduced motion or Still)
  const done = !!view?.done;
  useEffect(() => {
    if (!seen || run !== 'auto' || done) return;
    const quiet =
      matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('is-still');
    if (quiet) return;
    const id = setInterval(step, STEP_MS);
    return () => clearInterval(id);
  }, [seen, run, done, step]);

  if (!view) return null;
  const bytes = (ts: number[]) => dec.decode(new Uint8Array(ts.flatMap((t) => vocab[t]!)));
  const grown = toks.length > prefix.length;
  const before = bytes(grown ? toks.slice(0, -1) : toks);
  const last = grown ? bytes(toks.slice(-1)) : '';
  const blockedTop = !view.m[view.top[0]!];
  const pctOf = (t: number) => `${Math.round(view.share(t) * 100)}%`;
  const best = view.legal[0];
  const widest = best === undefined ? 1 : Math.max(0.0001, view.share(best));

  return (
    <div className={styles.maskView} ref={ref}>
      <p className={styles.record}>
        <span className="tag">{w.record}</span>
        <code>
          {before}
          {last ? (
            <span className={styles.fresh} key={toks.length}>
              {last}
            </span>
          ) : null}
          {view.done ? null : <span className={styles.caret} aria-hidden="true" />}
        </code>
      </p>
      <p className="mono">
        {w.state} {fieldOf(g, view.s)} · {view.n} {w.of} {vocab.length} {w.legal}
      </p>
      {view.done ? (
        <p className={styles.result}>{w.done}</p>
      ) : (
        <ol className={styles.tokens} aria-label={w.strip}>
          {view.top.map((t) => (
            <li key={t} data-blocked={view.m[t] ? undefined : ''} data-best={t === best ? '' : undefined}>
              <span className={styles.tok}>{show(vocab[t]!)}</span>
              <span className={styles.share} aria-hidden="true">
                <i style={{ inlineSize: `${view.m[t] ? Math.max(6, Math.round((view.share(t) / widest) * 100)) : 0}%` }} />
              </span>
              <span className={styles.tokNote}>{view.m[t] ? pctOf(t) : w.blocked}</span>
            </li>
          ))}
        </ol>
      )}
      {!view.done && blockedTop && view.legal.length >= 2 ? (
        <p className={styles.result}>
          {fill(w.result, {
            top: show(vocab[view.top[0]!]!),
            v: vocab.length,
            n: view.n,
            a: `${show(vocab[view.legal[0]!]!)} (${pctOf(view.legal[0]!)})`,
            b: `${show(vocab[view.legal[1]!]!)} (${pctOf(view.legal[1]!)})`,
          })}
        </p>
      ) : null}
      <p className={styles.actions}>
        {!view.done ? (
          <button type="button" className="action action--button" onClick={() => setRun(run === 'auto' ? 'paused' : 'auto')}>
            {run === 'auto' ? w.pause : w.resume}
          </button>
        ) : null}
        {!view.done && view.legal.length ? (
          <button
            type="button"
            className="action action--button"
            onClick={() => {
              setRun('paused');
              step();
            }}
          >
            {w.next}
          </button>
        ) : null}
        {grown ? (
          <button
            type="button"
            className="action action--button"
            onClick={() => {
              setToks(prefix);
              setRun('auto');
            }}
          >
            {w.again}
          </button>
        ) : null}
      </p>
      <p className="small">{w.what}</p>
      <details className={styles.inner}>
        <summary>{w.grammar}</summary>
        <pre className={styles.grammar}>{data.grammar}</pre>
      </details>
    </div>
  );
}
