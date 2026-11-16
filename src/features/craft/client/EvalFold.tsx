'use client';

import { useEffect, useState } from 'react';
import type { EvalRow } from '../build';
import { fill, pct } from './fill';
import { useSeen } from './Piece';
import styles from '../craft.module.css';

interface Data {
  n: number;
  rows: EvalRow[];
  recall: { at1: number; at3: number };
  misses: string[];
  words: typeof import('@content/craft/hood').hood.eval;
}

/**
 * "How good is the search?" (the attack's A4; round 7: laid open, and run again in front of the reader). The build
 * scored the search on its twenty questions; once this piece is on screen the reader's own browser runs the same
 * twenty questions against the same index (the search's runtime and /craft/corpus.json, as the search box loads
 * them) and each question's mark is inked as its result comes: a full dot where the right passage came first, a
 * ring with a core where it came second or third, an empty ring for a miss. The line under the marks says the
 * question a mark stands for (the pointer or the keyboard picks one). n, who wrote the questions, recall@1 and @3,
 * and every question with its result stay one fold away. If the run cannot load, the build's own results stand.
 */
export function EvalFold({ data }: { data: Data }) {
  const w = data.words;
  const [ref, seen] = useSeen<HTMLDivElement>(0.4);
  // each question's rank as run here (undefined: not yet run); the build's, where no run is possible
  const [ranks, setRanks] = useState<(number | undefined)[]>(() => data.rows.map(() => undefined));
  const [ms, setMs] = useState<number | null>(null);
  const [state, setState] = useState<'waiting' | 'running' | 'ran' | 'build'>('waiting');
  const [pick, setPick] = useState<number | null>(null);

  useEffect(() => {
    if (!seen || state !== 'waiting') return;
    let dead = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    setState('running');
    void (async () => {
      try {
        const [mod, corpus] = await Promise.all([
          import('./searchRuntime'),
          fetch('/craft/corpus.json').then((r) => {
            if (!r.ok) throw new Error(String(r.status));
            return r.json() as Promise<Parameters<typeof import('./searchRuntime').makeSearch>[0]>;
          }),
        ]);
        if (dead) return;
        const t0 = performance.now();
        const rt = mod.makeSearch(corpus);
        const out = data.rows.map((r) => {
          const top = rt
            .query(r.q, 8)
            .slice(0, 3)
            .map((h) => h.id);
          return top.findIndex((id) => r.golds.includes(id)) + 1;
        });
        const took = performance.now() - t0;
        // the marks are inked one after another (the run itself took a few milliseconds)
        const quiet = matchMedia('(prefers-reduced-motion: reduce)').matches;
        out.forEach((rank, i) =>
          timers.push(
            setTimeout(
              () => {
                if (dead) return;
                setRanks((prev) => prev.map((p, j) => (j === i ? rank : p)));
                if (i === out.length - 1) {
                  setMs(Math.max(1, Math.round(took)));
                  setState('ran');
                }
              },
              quiet ? 0 : 140 + i * 70,
            ),
          ),
        );
      } catch {
        if (dead) return;
        setRanks(data.rows.map((r) => r.rank));
        setState('build');
      }
    })();
    return () => {
      dead = true;
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when first seen
  }, [seen]);

  const all = ranks.every((r) => r !== undefined);
  const at1 = all ? ranks.filter((r) => r === 1).length / data.n : data.recall.at1;
  const at3 = all ? ranks.filter((r) => (r ?? 0) > 0).length / data.n : data.recall.at3;
  const word = (rank: number | undefined) =>
    rank === undefined ? '…' : rank === 1 ? w.first : rank > 0 ? w.third : w.miss;
  const shown = pick !== null ? data.rows[pick] : null;

  return (
    <div className={styles.evalView} ref={ref}>
      <p className={styles.result}>{fill(w.result, { n: data.n, at1: pct(at1), at3: pct(at3) })}</p>
      <ol className={styles.dots} aria-label={w.dots} onMouseLeave={() => setPick(null)}>
        {data.rows.map((r, i) => (
          <li key={r.q}>
            <button
              type="button"
              className={styles.dot}
              data-rank={ranks[i] === undefined ? 'wait' : ranks[i] === 1 ? '1' : ranks[i]! > 0 ? '3' : '0'}
              aria-label={`${r.q} ${word(ranks[i])}`}
              aria-pressed={pick === i}
              onMouseEnter={() => setPick(i)}
              onFocus={() => setPick(i)}
              onClick={() => setPick(i)}
            />
          </li>
        ))}
      </ol>
      <p className={styles.dotLine} aria-live="polite">
        {shown ? (
          <>
            <span>{shown.q}</span> <span className="mono">{word(ranks[pick!])}</span>
          </>
        ) : (
          <span className="mono">
            {state === 'ran' && ms !== null
              ? fill(w.ran, { n: data.n, ms })
              : state === 'running'
                ? fill(w.running, { n: data.n })
                : ' '}
          </span>
        )}
      </p>
      <p className="small">{w.author}</p>
      <details className={styles.inner}>
        <summary>{w.every}</summary>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{w.columns.q}</th>
                <th scope="col">{w.columns.rank}</th>
                <th scope="col" className={styles.wideOnly}>
                  {w.columns.top}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.q} data-miss={r.rank === 0 ? '' : undefined}>
                  <th scope="row">{r.q}</th>
                  <td className={styles.num}>{r.rank || w.notFound}</td>
                  <td className={styles.wideOnly}>{r.first}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">
                  {w.n} = {data.n}
                </th>
                <td className={styles.num}>
                  @1 {pct(data.recall.at1)} · @3 {pct(data.recall.at3)}
                </td>
                <td className={styles.wideOnly} />
              </tr>
            </tfoot>
          </table>
        </div>
        <h4 className={styles.subhead}>{w.misses}</h4>
        {data.misses.length ? (
          <ul className={styles.plainList}>
            {data.misses.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        ) : (
          <p>{w.none}</p>
        )}
      </details>
    </div>
  );
}
