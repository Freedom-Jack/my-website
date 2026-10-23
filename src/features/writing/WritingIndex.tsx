import { writing } from '@content/pages/writing';
import { PageMain } from '@/components/page/PageMain';
import { Strip } from '@/components/page/Strip';
import { longDate } from '@/lib/dates';
import { Inline, InlineLink } from '@/lib/inline';
import { allNotes } from './notes';
import styles from './writing.module.css';

/**
 * Writing (/writing/): the lake's strip with the title and intro in its mist; then one dated list, newest on top
 * (kind and date in small print, the title as the row's link, its description). No filters, pages or empty states:
 * a new piece is one more file (CONTENT.md). It ends on the lake's closing scene, then the story map.
 */
export async function WritingIndex() {
  const notes = await allNotes();
  return (
    <PageMain page="writing" className={styles.page} glimpseEnd>
      <Strip variant="sub" labelledBy="writing-title">
        <h1 className="page-title" id="writing-title">
          {writing.title}
        </h1>
        <p className="lead">
          <Inline text={writing.intro} />
        </p>
      </Strip>
      <section className={`sec ${styles.list}`} data-veil="">
        <ul className="rows" role="list">
          {notes.map((n) => (
            <li className="row ink-row" key={n.slug}>
              <p className="row__meta small">
                {n.kind} · <time dateTime={n.published}>{longDate(n.published)}</time>
              </p>
              <h2 className="row__title">
                <InlineLink href={n.href}>{n.title}</InlineLink>
              </h2>
              <p className="row__line">{n.description}</p>
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
