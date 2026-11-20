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
 * "How good is the search?": the build scored the search on its twenty questions; once this piece is on screen the
 * reader's own browser runs the same twenty questions against the same index (the search's runtime and
 * /craft/corpus.json, as the site's search loads them) and each question's mark is inked as its result comes: a full
 * dot where the right passage came first, a ring with a core where it came second or third, an empty ring for a miss
 * (the three are named under the marks, in the piece's own words). The line under them says the question a mark
 * stands for (the pointer or the keyboard picks one), or how the run went. The line above the marks gives n and
 * recall@1 and @3 (the reader's own run once it has finished, else the build's); who wrote the questions is said in
 * the margin beside them; every question with its result stays one fold away. If the run cannot load, the build's
 * own results stand.
 */
export function EvalFold({ data }: { data: Data }) {
  const w = data.words;
  const [ref, seen] = useSeen<HTMLDivElement>(0.4, true);
  // each question's rank as run here (undefined: not yet run); the build's, where no run is possible
  const [ranks, setRanks] = useState<(number | undefined)[]>(() => data.rows.map(() => undefined));
  const [ms, setMs] = useState<number | null>(null);
  const [state, setState] = useState<'waiting' | 'ran' | 'build'>('waiting');
  const [pick, setPick] = useState<number | null>(null);

  useEffect(() => {
    if (!seen || state !== 'waiting') return;
    let dead = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
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
        const quiet =
          matchMedia('(prefers-reduced-motion: reduce)').matches ||
          document.documentElement.classList.contains('is-still');
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
  /** A rank as its mark: not yet run, first, in the top three, missed. */
  const mark = (rank: number | undefined) => (rank === undefined ? 'wait' : rank === 1 ? '1' : rank > 0 ? '3' : '0');
  const shown = pick !== null ? data.rows[pick] : null;

  return (
    <div className={styles.evalView} ref={ref}>
      <div className={styles.evalMain}>
        <p className={styles.result}>{fill(w.result, { n: data.n, at1: pct(at1), at3: pct(at3) })}</p>
        <ol className={styles.dots} aria-label={w.dots} onMouseLeave={() => setPick(null)}>
          {data.rows.map((r, i) => (
            <li key={r.q}>
              <button
                type="button"
                className={styles.dot}
                data-rank={mark(ranks[i])}
                aria-label={`${r.q} ${word(ranks[i])}`}
                aria-pressed={pick === i}
                onMouseEnter={() => setPick(i)}
                onFocus={() => setPick(i)}
                onClick={() => setPick(i)}
              />
            </li>
          ))}
        </ol>
        <p className={`rec ${styles.legend}`} aria-hidden="true">
          {([1, 2, 0] as const).map((rank) => (
            <span key={rank}>
              <i data-rank={mark(rank)} />
              {word(rank)}
            </span>
          ))}
        </p>
        <p className={styles.dotLine} aria-live="polite">
          {shown ? (
            <>
              <span>{shown.q}</span>
              <span className="rec">{word(ranks[pick!])}</span>
            </>
          ) : (
            <span className="rec">
              {state === 'ran' && ms !== null
                ? fill(w.ran, { n: data.n, ms })
                : seen && state === 'waiting'
                  ? fill(w.running, { n: data.n })
                  : '\u00a0'}
            </span>
          )}
        </p>
      </div>
      <p className={styles.author}>{w.author}</p>
      <details className={`${styles.fold} ${styles.evalFold}`}>
        <summary>
          <span>{w.every}</span>
        </summary>
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
        <h3 className={styles.subhead}>{w.misses}</h3>
        {data.misses.length ? (
          <ul className={styles.plainList}>
            {data.misses.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        ) : (
          <p className={styles.plainList}>{w.none}</p>
        )}
      </details>
    </div>
  );
}
