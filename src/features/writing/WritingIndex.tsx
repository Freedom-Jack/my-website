import { writing } from '@content/pages/writing';
import { PageMain } from '@/components/page/PageMain';
import { Strip } from '@/components/page/Strip';
import { TextAction } from '@/components/ui/TextAction';
import { longDate } from '@/lib/dates';
import { Inline, InlineLink } from '@/lib/inline';
import { Compare } from './Compare';
import { allNotes, noteTable } from './notes';
import styles from './writing.module.css';

/**
 * Writing (/writing/). The first screen is the live site's: the lake's strip with the title and intro in its mist.
 *
 * Below it (round 7) each note is opened out on the lake: its kind and dates in mono, its title large in the name
 * face (the row's link), its description and the way in; and, where the note holds a comparison, that comparison
 * itself, turned aspect by aspect (Compare: the note's own words). Then the feed. No filters, pages or empty states:
 * a new piece is one more file (CONTENT.md). It ends downstream (the Résumé).
 */
export async function WritingIndex() {
  const notes = await allNotes();
  return (
    <PageMain page="writing" className={styles.page} glimpseEnd>
      <Strip variant="sub" labelledBy="writing-title" still="writing">
        <h1 className="page-title" id="writing-title">
          {writing.title}
        </h1>
        <p className="lead">
          <Inline text={writing.intro} />
        </p>
      </Strip>
      {notes.map((n) => {
        const table = noteTable(n.slug);
        return (
          <section className={`part ${styles.leaf}`} key={n.slug} aria-labelledby={`note-${n.slug}`}>
            <div className={`${styles.leaf__main} ink-row`} data-veil="">
              <p className="mono">
                {n.kind} · <time dateTime={n.published}>{longDate(n.published)}</time>
                {n.modified && n.modifiedNote ? (
                  <>
                    {' · '}
                    {n.modifiedNote} <time dateTime={n.modified}>{longDate(n.modified)}</time>
                  </>
                ) : null}
              </p>
              <h2 className={styles.leaf__title} id={`note-${n.slug}`}>
                <InlineLink href={n.href}>{n.title}</InlineLink>
              </h2>
              <p className={styles.leaf__line}>{n.description}</p>
              <p className={styles.leaf__read}>
                <TextAction href={n.href} arrow>
                  {writing.read}
                </TextAction>
              </p>
            </div>
            {table && table.head.length >= 3 ? (
              <Compare label={writing.from} head={table.head} rows={table.rows} />
            ) : null}
          </section>
        );
      })}
      <p className={`more ${styles.feed}`} data-veil="">
        <InlineLink href="/writing/feed.xml">{writing.feed.link}</InlineLink>
      </p>
    </PageMain>
  );
}
