'use client';

import { useMemo, useState } from 'react';
import type { Bigram } from '../bigram';
import { scores } from '../bigram';
import type { BPE } from '../bpe';
import { compile, fieldOf, isDone, mask, type State, stepToken } from '../grammar';
import type { Opening } from '../build';
import { fill } from './fill';
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
 * "Constrain the output" (the attack's A6): a real case record written one token at a time over a vocabulary learned
 * from these pages. It opens on the step the build found where the mask strikes the highest-scored token and leaves two
 * or more real choices; "Take the best legal token" goes on to the end of the record.
 */
export function MaskFold({ data }: { data: Data }) {
  const w = data.words;
  const g = useMemo(() => compile(data.roles), [data.roles]);
  const vocab = data.bpe.vocab;
  const prefix = data.opening.tokens.slice(0, data.opening.at);
  const [toks, setToks] = useState<number[]>(prefix);

  const view = useMemo(() => {
    let s: State | null = g.start;
    for (const t of toks) s = s && stepToken(g, s, vocab[t]!);
    if (!s) return null;
    const done = isDone(g, s) && !mask(g, s, vocab).some(Boolean);
    const logp = scores(data.bigram, toks[toks.length - 1]!);
    const m = mask(g, s, vocab);
    let sum = 0;
    for (let t = 0; t < vocab.length; t += 1) if (m[t]) sum += Math.exp(logp[t]!);
    const order = [...logp.keys()].sort((a, b) => logp[b]! - logp[a]!);
    const legal = order.filter((t) => m[t]);
    const share = (t: number) => (m[t] ? Math.exp(logp[t]!) / sum : 0);
    // the strip: the five best tokens overall and the five best legal ones, in score order
    const top = [...new Set([...order.slice(0, 5), ...legal.slice(0, 5)])].sort((a, b) => logp[b]! - logp[a]!);
    return { s, done, m, top, legal, share, n: legal.length };
  }, [g, toks, vocab, data.bigram]);

  if (!view) return null;
  const text = dec.decode(new Uint8Array(toks.flatMap((t) => vocab[t]!)));
  const blockedTop = !view.m[view.top[0]!];
  const pctOf = (t: number) => `${Math.round(view.share(t) * 100)}%`;

  return (
    <div className={styles.foldBody}>
      {blockedTop && view.legal.length >= 2 ? (
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
      <p className={styles.record}>
        <span className="small">{w.record}</span>
        <code>{text}</code>
      </p>
      <p className="small">
        {w.state} {fieldOf(g, view.s)} · {view.n} {w.of} {vocab.length} {w.legal}
      </p>
      {view.done ? (
        <p className={styles.result}>{w.done}</p>
      ) : (
        <>
          <ol className={styles.strip} aria-label={w.strip}>
            {view.top.map((t) => (
              <li key={t} data-blocked={view.m[t] ? undefined : ''}>
                <span className={styles.tok}>{show(vocab[t]!)}</span>
                <span className={styles.tokNote}>{view.m[t] ? pctOf(t) : w.blocked}</span>
              </li>
            ))}
          </ol>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className="visually-hidden">{w.strip}</caption>
              <thead>
                <tr>
                  <th scope="col">{w.columns.rank}</th>
                  <th scope="col">{w.columns.token}</th>
                  <th scope="col">{w.columns.share}</th>
                  <th scope="col">{w.columns.mask}</th>
                  <th scope="col" className={styles.idCol}>
                    {w.columns.id}
                  </th>
                </tr>
              </thead>
              <tbody>
                {view.top.map((t, i) => (
                  <tr key={t} data-blocked={view.m[t] ? undefined : ''}>
                    <td className={styles.num}>{i + 1}</td>
                    <th scope="row" className={styles.tok}>
                      {show(vocab[t]!)}
                    </th>
                    <td className={styles.num}>{view.m[t] ? pctOf(t) : '–'}</td>
                    <td>{view.m[t] ? w.legal : w.blocked}</td>
                    <td className={`${styles.num} ${styles.idCol}`}>{t}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className={styles.actions}>
        {!view.done && view.legal.length ? (
          <button type="button" className="action action--button" onClick={() => setToks([...toks, view.legal[0]!])}>
            {w.next}
          </button>
        ) : null}
        {toks.length > prefix.length ? (
          <button type="button" className="action action--button" onClick={() => setToks(prefix)}>
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
