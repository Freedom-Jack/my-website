import type { CSSProperties } from 'react';
import { Inline } from '@/lib/inline';
import styles from './writing.module.css';

/**
 * A note's comparison, turned aspect by aspect: the aspects' names down the left rail in the record's voice (the
 * one being read in full ink), and the two things compared side by side for that aspect, each headed in the brush,
 * one hairline between them. The words are the note's own (features/writing/notes noteTable).
 *
 * No script: each aspect is a radio and its label, and the styles show the one that is picked, so the arrow keys
 * turn the aspects as they move through any group of radios. With JavaScript off (and on paper) every aspect is
 * shown, as a plain ruled table (writing.module.css: the turner's rules sit under html.js).
 */
export function Compare({
  id,
  label,
  head,
  rows,
}: {
  /** unique on the page: the radios' group and the label's id */
  id: string;
  label: string;
  head: string[];
  rows: string[][];
}) {
  return (
    <section
      className={`row sec ${styles.turn}`}
      aria-labelledby={`${id}-from`}
      style={{ '--n': rows.length } as CSSProperties}
    >
      <h2 className={`label ${styles.turnLabel}`} id={`${id}-from`}>
        {label}
      </h2>
      {rows.map((r, i) => (
        <div className={styles.turnRow} key={r[0]} style={{ '--i': i } as CSSProperties}>
          <input
            className={styles.turnPick}
            type="radio"
            name={`${id}-aspect`}
            id={`${id}-aspect-${i}`}
            defaultChecked={i === 0}
          />
          <label className={styles.turnName} htmlFor={`${id}-aspect-${i}`}>
            <span>{r[0]}</span>
          </label>
          <dl className={styles.turnPair}>
            {[1, 2].map((c) => (
              <div className={styles.turnSide} key={c}>
                <dt>{head[c]}</dt>
                <dd>
                  <Inline text={r[c] ?? ''} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </section>
  );
}
