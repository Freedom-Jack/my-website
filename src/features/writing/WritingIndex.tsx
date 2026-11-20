import { hood } from '@content/craft/hood';
import { workCraft } from '@content/pages/work-craft';
import { writing } from '@content/pages/writing';
import { Inscription } from '@/components/page/Inscription';
import { PageMain } from '@/components/page/PageMain';
import { Arrow } from '@/components/ui/Arrow';
import { Go } from '@/components/ui/Go';
import { allCases } from '@/features/work/cases';
import { longDate } from '@/lib/dates';
import { Inline, InlineLink } from '@/lib/inline';
import { Compare } from './Compare';
import { allNotes, noteTable, type NoteMeta } from './notes';
import styles from './writing.module.css';

/** The worked pieces, in the order a reader meets the ideas: the constraint, its measure, the record. */
const PIECES = ['mask', 'eval', 'lineage'] as const;

/** A note's kind and dates, in the record's voice. */
function Dates({ note }: { note: NoteMeta }) {
  return (
    <p className="rec">
      <span className="nowrap">
        {note.kind} · <time dateTime={note.published}>{longDate(note.published)}</time>
      </span>
      {note.modified && note.modifiedNote ? (
        <>
          {' · '}
          <span className="nowrap">
            {note.modifiedNote} <time dateTime={note.modified}>{longDate(note.modified)}</time>
          </span>
        </>
      ) : null}
    </p>
  );
}

/**
 * Writing (/writing/): the lake pavilion, where he thinks.
 *
 * The title is inscribed in the lake's sky. Under the mist the newest note stands open, not listed: its date in the
 * record's voice, its title large in the brush, its description as the opening and the way in. Then, from that note,
 * its own comparison, which the reader turns aspect by aspect (Compare). Then the three worked pieces that run in
 * the reader's browser on their case pages, as a ruled set: each one's title, its tie to a production claim and the
 * case that holds it. Last, the feed, in the record's voice. Older notes, once there are any, are a ruled list
 * between the comparison and the pieces. Words: content/pages/writing.ts, content/writing/*.mdx,
 * content/craft/hood.ts and content/pages/work-craft.ts.
 */
export async function WritingIndex() {
  const [notes, cases] = await Promise.all([allNotes(), allCases()]);
  const [newest, ...older] = notes;
  const table = newest ? noteTable(newest.slug) : null;
  return (
    <PageMain page="writing">
      <Inscription>
        <h1 className="title" id="writing-title">
          {writing.title}
        </h1>
        <p className="title__under">
          <Inline text={writing.intro} />
        </p>
      </Inscription>

      {/* the newest note, open */}
      {newest ? (
        <section className={`row sec sec--first ${styles.first}`} aria-labelledby={`note-${newest.slug}`}>
          <div className={styles.noteHead}>
            <Dates note={newest} />
            <h2 className={`brush ${styles.noteTitle}`} id={`note-${newest.slug}`}>
              <InlineLink href={newest.href}>{newest.title}</InlineLink>
            </h2>
          </div>
          <div className={styles.noteOpen}>
            <p className="lead">{newest.description}</p>
            <p>
              <Go href={newest.href}>{writing.read}</Go>
            </p>
          </div>
        </section>
      ) : null}

      {/* from the note: its own comparison, turned aspect by aspect */}
      {newest && table && table.head.length >= 3 ? (
        <Compare id={newest.slug} label={writing.from} head={table.head} rows={table.rows} />
      ) : null}

      {/* the notes before it */}
      {older.length ? (
        <div className="row sec">
          <ol className={`sec__body ${styles.pieces}`} role="list">
            {older.map((n) => (
              <li className={styles.piece} key={n.slug}>
                <h2 className={`brush ${styles.pieceTitle}`}>
                  <InlineLink href={n.href}>
                    {n.title}
                    <Arrow />
                  </InlineLink>
                </h2>
                <p className="small soft">{n.description}</p>
                <Dates note={n} />
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {/* under the hood: three worked pieces, each running on the page of the case it is tied to (they run in the
          reader's browser: without JavaScript their sections are not on the case pages, so they are not listed) */}
      <section className="row sec" aria-labelledby="hood-title">
        <div className={`sec__rail ${styles.piecesRail}`} data-js-only="">
          <h2 className="label" id="hood-title">
            {workCraft.hood.title}
          </h2>
        </div>
        <div className="sec__body">
          <ol className={styles.pieces} role="list" data-js-only="">
            {PIECES.map((key) => {
              const piece = hood[key];
              const held = cases.find((c) => c.slug === piece.case);
              if (!held) throw new Error(`content/craft/hood.ts: ${key} names a case that does not exist`);
              return (
                <li className={styles.piece} key={key}>
                  <h3 className={`brush ${styles.pieceTitle}`}>
                    <InlineLink href={`${held.href}#hood-${key}`}>
                      {workCraft.hood[key].title}
                      <Arrow />
                    </InlineLink>
                  </h3>
                  <p className="small soft">
                    <Inline text={piece.tie} />
                  </p>
                  <p className="rec">{held.title}</p>
                </li>
              );
            })}
          </ol>
          <p className={`rec ${styles.feed}`}>
            <InlineLink href="/writing/feed.xml">{writing.feed.link}</InlineLink>
          </p>
        </div>
      </section>
    </PageMain>
  );
}
