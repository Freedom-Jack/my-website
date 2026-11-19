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
  // (the sides come in with a short settle only once the reader has turned an aspect: nothing fades in at first paint)
  const [turned, setTurned] = useState(false);
  const pick = (i: number) => {
    if (i !== at) setTurned(true);
    setAt(i);
  };
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
                onClick={() => pick(i)}
                onMouseEnter={() => pick(i)}
                onFocus={() => pick(i)}
              >
                {r[0]}
              </button>
            </li>
          ))}
        </ul>
        <div className={styles.sides} aria-live="polite">
          {[1, 2].map((c) => (
            <div key={c}>
              <h3 className="h-ink h-ink--s">{head[c]}</h3>
              <p key={`${at}-${c}`} className={turned ? `${styles.cell} ${styles.turned}` : styles.cell}>
                <Inline text={row[c] ?? ''} />
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
