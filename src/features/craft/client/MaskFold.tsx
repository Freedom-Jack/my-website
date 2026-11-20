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

/**
 * Where the record stands after `toks`: the grammar's state, what is legal next, and the candidates to show (`own`
 * is the record's own next token: always among them).
 */
function read(g: Grammar, vocab: number[][], bigram: Bigram, toks: number[], own?: number) {
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
  // the strip: the five best tokens overall, the five best legal ones and the record's own, in score order
  const top = [...new Set([...order.slice(0, 5), ...legal.slice(0, 5), ...(own === undefined ? [] : [own])])].sort(
    (a, b) => logp[b]! - logp[a]!,
  );
  return { s, done, m, top, legal, share, n: legal.length };
}

/**
 * "Constrain the output": a real case record written one token at a time over a vocabulary learned from these pages.
 * It opens on the step the build found where the grammar strikes the highest-scored token and leaves two or more real
 * choices. The record stands at the left in the record's voice, with what the grammar's state is and what is said of
 * this step; at the right the candidates stand in score order: the ones the grammar forbids struck through, each
 * legal one with its share as a stroke that long, the record's own next token in full ink. That token is the one that
 * joins the record: the scores are counts of pairs, and left to them the record would end valid and untrue (a wrong
 * status, a figure of noise), so the page writes the case's own record and shows what the grammar allowed at each
 * step. It steps under the reader's hand: one token at a press, or "Go on" to let it write (a token every 0.8 s while
 * it is on screen) and "Pause" to stop it; "Start again" goes back to the opening. Under reduced motion and Still it
 * only ever steps by hand.
 */
const STEP_MS = 800;

const quiet = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('is-still');

export function MaskFold({ data }: { data: Data }) {
  const w = data.words;
  const g = useMemo(() => compile(data.roles), [data.roles]);
  const vocab = data.bpe.vocab;
  const prefix = useMemo(() => data.opening.tokens.slice(0, data.opening.at), [data.opening]);
  const [toks, setToks] = useState<number[]>(prefix);
  const [run, setRun] = useState<'auto' | 'paused'>('paused');
  const [ref, seen] = useSeen<HTMLDivElement>(0.5);

  // the record's own tokens: the one after `toks` is the one that joins
  const own = data.opening.tokens;
  const next = own[toks.length];
  const view = useMemo(() => read(g, vocab, data.bigram, toks, next), [g, toks, vocab, data.bigram, next]);
  const step = useCallback(
    () => setToks((prev) => (prev.length < own.length ? [...prev, own[prev.length]!] : prev)),
    [own],
  );

  // once the reader has said "Go on", the record writes itself while it is on screen
  const done = !!view?.done || next === undefined;
  useEffect(() => {
    if (!seen || run !== 'auto' || done) return;
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
  const ended = view.done || next === undefined;

  return (
    <div className={styles.mask} ref={ref}>
      <div className={styles.maskRecord}>
        <p className="label">{w.record}</p>
        <p className={styles.record}>
          <code>
            {before}
            {last ? (
              <span className={styles.fresh} key={toks.length}>
                {last}
              </span>
            ) : null}
            {ended ? null : <span className={styles.caret} aria-hidden="true" />}
          </code>
        </p>
        {ended ? null : (
          <p className="rec">
            {w.state} {fieldOf(g, view.s)} · {view.n} {w.of} {vocab.length} {w.legal}
          </p>
        )}
        <p className={`small ${styles.said}`} aria-live="polite">
          {ended
            ? w.done
            : blockedTop && view.legal.length >= 2
              ? fill(w.result, {
                  top: show(vocab[view.top[0]!]!),
                  v: vocab.length,
                  n: view.n,
                  a: `${show(vocab[view.legal[0]!]!)} (${pctOf(view.legal[0]!)})`,
                  b: `${show(vocab[view.legal[1]!]!)} (${pctOf(view.legal[1]!)})`,
                })
              : null}
        </p>
        <p className={styles.actions}>
          {!ended ? (
            <button
              type="button"
              className={styles.act}
              onClick={() => {
                setRun('paused');
                step();
              }}
            >
              {w.next}
            </button>
          ) : null}
          {!ended ? (
            <button
              type="button"
              className={styles.act}
              onClick={() => {
                // under reduced motion and Still nothing runs by itself: "Go on" is one step
                if (run === 'auto') setRun('paused');
                else if (quiet()) step();
                else setRun('auto');
              }}
            >
              {run === 'auto' ? w.pause : w.resume}
            </button>
          ) : null}
          {grown ? (
            <button
              type="button"
              className={styles.act}
              onClick={() => {
                setToks(prefix);
                setRun('paused');
              }}
            >
              {w.again}
            </button>
          ) : null}
        </p>
      </div>
      <div className={styles.maskTokens}>
        <p className="rec" id="mask-strip">
          {w.strip}
        </p>
        {ended ? null : (
          <ol className={styles.tokens} aria-labelledby="mask-strip">
            {view.top.map((t) => (
              <li key={t} data-blocked={view.m[t] ? undefined : ''} data-own={t === next ? '' : undefined}>
                <span className={styles.tok}>{show(vocab[t]!)}</span>
                <span className={styles.share} aria-hidden="true">
                  <i style={{ transform: `scaleX(${view.m[t] ? Math.max(0.03, view.share(t) / widest) : 0})` }} />
                </span>
                <span className={styles.tokNote}>
                  {view.m[t] ? pctOf(t) : w.blocked}
                  {t === next ? <span className="visually-hidden"> ({w.own})</span> : null}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <p className={`small soft ${styles.what}`}>{w.what}</p>
      <details className={`${styles.fold} ${styles.maskGrammar}`}>
        <summary>
          <span>{w.grammar}</span>
        </summary>
        <pre className={styles.grammar}>{data.grammar}</pre>
      </details>
    </div>
  );
}
