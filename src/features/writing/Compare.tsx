'use client';

import { useState } from 'react';
import { Inline } from '@/lib/inline';
import styles from './writing.module.css';

/**
 * A note's comparison, turned aspect by aspect (round 7; Writing's moment): the table's first column as a short
 * list of aspects, and the two things compared side by side for the aspect that is picked, set at reading size. The
 * pointer, a tap or the keyboard picks an aspect; the words are the note's own (features/writing/notes noteTable).
 * Without JavaScript the first aspect stands and the note itself holds the whole table.
 */
export function Compare({ label, head, rows }: { label: string; head: string[]; rows: string[][] }) {
  const [at, setAt] = useState(0);
  const row = rows[at] ?? rows[0]!;
  return (
    <div className={styles.compare} data-veil="">
      <p className="tag">{label}</p>
      <div className={styles.compare__body}>
        <ul className={styles.aspects} role="list" aria-label={head[0]}>
          {rows.map((r, i) => (
            <li key={r[0]}>
              <button
                type="button"
                aria-pressed={i === at}
                onClick={() => setAt(i)}
                onMouseEnter={() => setAt(i)}
                onFocus={() => setAt(i)}
              >
                {r[0]}
              </button>
            </li>
          ))}
        </ul>
        <div className={styles.sides} aria-live="polite">
          {[1, 2].map((c) => (
            <div className={styles.side} key={c}>
              <h3 className="h-ink h-ink--s">{head[c]}</h3>
              <p key={`${at}-${c}`} className={styles.cell}>
                <Inline text={row[c] ?? ''} />
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
