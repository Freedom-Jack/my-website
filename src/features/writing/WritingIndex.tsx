import { hood } from '@content/craft/hood';
import { workCraft } from '@content/pages/work-craft';
import { writing } from '@content/pages/writing';
import { Inscription } from '@/components/page/Inscription';
import { PageMain } from '@/components/page/PageMain';
import { Arrow } from '@/components/ui/Arrow';
import { Cover } from '@/components/ui/Cover';
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

      {/* the newest note, featured: a wide leaf that opens on the lake */}
      {newest ? (
        <section className={`row ${styles.featured}`} aria-labelledby={`note-${newest.slug}`}>
          <article className={`leaf leaf--link ${styles.feature}`}>
            <Cover scene="writing" x={78} zoom={150} ratio="auto" className={styles.featureCover} />
            <div className={`leaf__body ${styles.featureBody}`}>
              <Dates note={newest} />
              <h2 className={`brush ${styles.featureTitle}`} id={`note-${newest.slug}`}>
                <InlineLink href={newest.href} className="leaf__to">
                  {newest.title}
                </InlineLink>
              </h2>
              <p className="say soft">{newest.description}</p>
              <p className="leaf__foot">
                <span className="leaf__go" aria-hidden="true">
                  {writing.read}
                  <Arrow />
                </span>
              </p>
            </div>
          </article>
          <p className={styles.feed}>
            <InlineLink href="/writing/feed.xml" className="btn btn--ghost">
              {writing.feed.link}
            </InlineLink>
          </p>
        </section>
      ) : null}

      {/* from the note: its own comparison, turned aspect by aspect */}
      {newest && table && table.head.length >= 3 ? (
        <Compare id={newest.slug} label={writing.from} head={table.head} rows={table.rows} />
      ) : null}

      {/* the notes before it: one leaf each */}
      {older.length ? (
        <div className={`row sec ${styles.olderSec}`}>
          <ol className={styles.grid} role="list">
            {older.map((n, k) => (
              <li className="leaf leaf--link reveal" key={n.slug}>
                <Cover scene="writing" x={[30, 55, 92][k % 3]!} zoom={260} />
                <div className="leaf__body">
                  <Dates note={n} />
                  <h2 className="leaf__title">
                    <InlineLink href={n.href} className="leaf__to">
                      {n.title}
                    </InlineLink>
                  </h2>
                  <p className="small soft">{n.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {/* under the hood: three worked pieces, each running on the page of the case it is tied to (they run in the
          reader's browser: without JavaScript their sections are not on the case pages, so they are not listed) */}
      <section className="row sec" aria-labelledby="hood-title" data-js-only="">
        <header className="sec-head">
          <h2 className="sec-head__title" id="hood-title">
            {workCraft.hood.title}
          </h2>
        </header>
        <ol className={styles.grid} role="list">
          {PIECES.map((key, k) => {
            const piece = hood[key];
            const held = cases.find((c) => c.slug === piece.case);
            if (!held) throw new Error(`content/craft/hood.ts: ${key} names a case that does not exist`);
            return (
              <li className="leaf leaf--link reveal" key={key}>
                <Cover scene="case" x={[18, 52, 86][k % 3]!} zoom={260} />
                <div className="leaf__body">
                  <h3 className="leaf__title">
                    <InlineLink href={`${held.href}#hood-${key}`} className="leaf__to">
                      {workCraft.hood[key].title}
                    </InlineLink>
                  </h3>
                  <p className="small soft">
                    <Inline text={piece.tie} />
                  </p>
                  <p className="leaf__foot">
                    <span className="chip">{held.title}</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </PageMain>
  );
}
