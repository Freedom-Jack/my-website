'use client';

import type { EvalRow } from '../build';
import { fill, pct } from './fill';
import styles from '../craft.module.css';

interface Data {
  n: number;
  rows: EvalRow[];
  recall: { at1: number; at3: number };
  misses: string[];
  words: typeof import('@content/craft/hood').hood.eval;
}

/** The eval fold (the attack's A4): n, who wrote the questions, recall@1 and @3, every question and every miss. */
export function EvalFold({ data }: { data: Data }) {
  const w = data.words;
  return (
    <div className={styles.foldBody}>
      <p className={styles.result}>
        {fill(w.result, { n: data.n, at1: pct(data.recall.at1), at3: pct(data.recall.at3) })}
      </p>
      <p className="small">{w.author}</p>
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
    </div>
  );
}
