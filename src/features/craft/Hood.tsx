import { workCraft } from '@content/pages/work-craft';
import type { Craft } from './build';
import { Piece, type PieceKind } from './client/Piece';
import { Search } from './client/Search';
import styles from './craft.module.css';

/**
 * "Under the hood" on Work (round 7: Work's moment, out of the folds and into the page). Four real things that run
 * in the visitor's own browser, laid open across the frame:
 *   Constrain the output   a grammar holding a model's output: a case record written one token at a time, the tokens
 *                          the grammar forbids struck through (it writes itself once it is on screen);
 *   How good is the search?  the search's own test, run again in front of the reader, a mark per question;
 *   Search these pages     the search itself (BM25 over the site's own passages; nothing typed leaves the browser);
 *   Where the words came from  the record of how all of it was made from the site's words, drawn.
 * Each piece's title is in the page's HTML; its module, its JSON (with its tie to a production claim, its case and
 * its long words) load as the reader reaches it (client/Piece), so Work's HTML stays small. The mask piece is cut by
 * the build when no opening step exists (build.ts findOpening).
 */
export function Hood({ craft }: { craft: Pick<Craft, 'sizes' | 'mask'> }) {
  const h = workCraft.hood;
  const piece = (k: PieceKind, cls: string) => (
    <article className={`${styles.piece} ${cls}`} id={`hood-${k}`} aria-labelledby={`hood-${k}-title`} data-veil="">
      <h3 className="h-ink h-ink--s" id={`hood-${k}-title`}>
        {h[k].title}
      </h3>
      <Piece kind={k} size={craft.sizes[k]} />
    </article>
  );
  return (
    <section className={`part ${styles.hood}`} id="hood" aria-labelledby="hood-title">
      <div className={styles.hoodHead} data-veil="">
        <h2 className="h-ink" id="hood-title">
          {h.title}
        </h2>
      </div>
      <div className={`spread ${styles.pieces}`}>
        {craft.mask ? piece('mask', styles.pieceMask!) : null}
        {piece('eval', styles.pieceEval!)}
        {/* no heading of its own: the search's <form role="search"> names itself with its label (hidden without JS) */}
        <div className={`${styles.piece} ${styles.pieceSearch}`} id="hood-search" data-veil="">
          <Search size={craft.sizes.corpus} />
        </div>
        {piece('lineage', styles.pieceLineage!)}
      </div>
    </section>
  );
}
