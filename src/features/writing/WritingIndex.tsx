import { writing } from '@content/pages/writing';
import { PageMain } from '@/components/page/PageMain';
import { Strip } from '@/components/page/Strip';
import { longDate } from '@/lib/dates';
import { Inline, InlineLink } from '@/lib/inline';
import { allNotes } from './notes';
import styles from './writing.module.css';

/**
 * Writing (/writing/): the lake's strip with the title and intro in its mist; then one dated list of ledger rows,
 * newest on top (kind and date in mono, the title as the row's link, its description), built for three. No filters,
 * pages or empty states: a new piece is one more file (CONTENT.md). It ends downstream (the Résumé), then on the
 * lake's closing scene and the tail.
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
      <section className={`sec ${styles.list}`} data-veil="">
        <ul className="ledger ledger--dated" role="list">
          {notes.map((n) => (
            <li className="ledger__row ink-row" key={n.slug}>
              <p className="ledger__meta mono">
                {n.kind} · <time dateTime={n.published}>{longDate(n.published)}</time>
                {n.modified && n.modifiedNote ? (
                  <>
                    {' · '}
                    {n.modifiedNote} <time dateTime={n.modified}>{longDate(n.modified)}</time>
                  </>
                ) : null}
              </p>
              <h2 className="ledger__title">
                <InlineLink href={n.href}>{n.title}</InlineLink>
              </h2>
              <p className="ledger__line">{n.description}</p>
            </li>
          ))}
        </ul>
        <p className="more">
          <InlineLink href="/writing/feed.xml">{writing.feed.link}</InlineLink>
        </p>
      </section>
    </PageMain>
  );
}
