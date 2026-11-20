import { hood } from '@content/craft/hood';
import { workCraft } from '@content/pages/work-craft';
import { Inline } from '@/lib/inline';
import { Piece, type PieceKind } from './client/Piece';
import styles from './craft.module.css';

/**
 * "Under the hood" on a case's page: one real thing that runs in the visitor's own browser, tied to that case.
 *   Constrain the output       (the agent's page) a grammar holding a model's output: a case record written one
 *                              token at a time, the tokens the grammar forbids struck through;
 *   How good is the search?    (the assistant's page) the site search's own test, run again in front of the reader,
 *                              a mark per question;
 *   Where the words came from  (the data operations' page) the record of how all of it was made from the site's
 *                              words, drawn.
 * The piece's title (in the brush) and its tie to the case's claim (beside it) are in the page's HTML; its module
 * and its JSON load as the reader reaches it (client/Piece), under a hairline.
 */
export function Hood({ kind, size }: { kind: PieceKind; size: number }) {
  const h = workCraft.hood;
  return (
    <section className={`row sec ${styles.hood}`} id={`hood-${kind}`} aria-labelledby={`hood-${kind}-title`}>
      <div className="sec__rail">
        <p className="label">{h.title}</p>
      </div>
      <div className={`sec__body ${styles.hoodBody}`}>
        <h2 className={`h-brush ${styles.title}`} id={`hood-${kind}-title`}>
          {h[kind].title}
        </h2>
        <p className={`say ${styles.tie}`}>
          <Inline text={hood[kind].tie} />
        </p>
        <Piece kind={kind} size={size} />
      </div>
    </section>
  );
}
