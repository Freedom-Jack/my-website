import type { ReactNode } from 'react';
import { site } from '@content/site';
import { writing } from '@content/pages/writing';
import { Colophon } from '@/components/page/Colophon';
import { PageMain } from '@/components/page/PageMain';
import { Strip } from '@/components/page/Strip';
import { longDate } from '@/lib/dates';
import { InlineLink } from '@/lib/inline';
import { breadcrumbLd } from '@/lib/jsonld';
import { blogPostingLd } from './jsonld';
import { NoteEffects } from './NoteEffects';
import type { Note } from './notes';
import styles from './article.module.css';

/** A quotation with its source (in MDX: <Quote cite="https://…">, its paragraphs, </Quote>): no box, no italics. */
function Quote({ cite, children }: { cite?: string; children: ReactNode }) {
  return <blockquote cite={cite}>{children}</blockquote>;
}

/**
 * One note (/writing/<slug>/): the lake's hero with the title and the byline (the article's own header, the same
 * hero as every subpage), the note in the reading column, and at its end the colophon (the seal and the author
 * line) and the way home. It ends on the lake once more. Words: content/writing/<slug>.mdx and content/pages/writing.ts.
 */
export function NotePage({ note }: { note: Note }) {
  const { meta, Body } = note;
  return (
    <PageMain
      page="article"
      className={styles.page}
      ld={[
        blogPostingLd(meta),
        breadcrumbLd([
          { name: writing.title, path: '/writing/' },
          { name: meta.title, path: meta.href },
        ]),
      ]}
    >
      <div className={styles['read-progress']} aria-hidden="true" />
      <article className="note" aria-labelledby="note-title">
        <Strip variant="sub" labelledBy="note-title">
          <h1 className="page-title" id="note-title">
            {meta.title}
          </h1>
          <p className={`small ${styles.note__byline}`}>
            <span className="nowrap">
              <InlineLink href="/">{site.name}</InlineLink> · {meta.kind} ·{' '}
              <time dateTime={meta.published}>{longDate(meta.published)}</time>
            </span>
            {meta.modified && meta.modifiedNote ? (
              <span className={styles.note__fixed}>
                <span className={styles.note__sep}> · </span>
                <span className="nowrap">
                  {meta.modifiedNote} <time dateTime={meta.modified}>{longDate(meta.modified)}</time>
                </span>
              </span>
            ) : null}
          </p>
        </Strip>
        <div className={styles.prose} data-veil="">
          <Body
            components={{
              Quote,
              ul: (props: { children?: ReactNode }) => <ul className={styles.note__list} role="list" {...props} />,
            }}
          />
        </div>
        <footer className={styles.note__end} data-veil="">
          <Colophon />
          <p className="more">
            <InlineLink href={writing.note.more.href}>{writing.note.more.label}</InlineLink>
          </p>
        </footer>
      </article>
      <NoteEffects />
    </PageMain>
  );
}
