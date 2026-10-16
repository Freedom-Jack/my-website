import type { ReactNode } from 'react';
import { site } from '@content/site';
import { writing } from '@content/pages/writing';
import { PageMain } from '@/components/page/PageMain';
import { Strip } from '@/components/page/Strip';
import { InkButton } from '@/components/ui/InkButton';
import { SEAL_GLYPH, SEAL_STONE } from '@/components/ui/Seal';
import { longDate } from '@/lib/dates';
import { InlineLink } from '@/lib/inline';
import { blogPostingLd } from './jsonld';
import { NoteEffects } from './NoteEffects';
import type { Note } from './notes';
import styles from './article.module.css';

/** A quotation with its source (in MDX: <Quote cite="https://…">, its paragraphs, </Quote>): no box, no italics. */
function Quote({ cite, children }: { cite?: string; children: ReactNode }) {
  return <blockquote cite={cite}>{children}</blockquote>;
}

/**
 * One note (/writing/<slug>/): the lake's low doc strip (art only), then the title and the byline on paper, the
 * note in the reading column, and at its end the author's seal, the author line and the one ink button. It ends
 * on the lake once more. Words: content/writing/<slug>.mdx and content/pages/writing.ts.
 */
export function NotePage({ note }: { note: Note }) {
  const { meta, Body } = note;
  return (
    <PageMain page="article" className={styles.page} ld={[blogPostingLd(meta)]}>
      <div className={styles['read-progress']} aria-hidden="true" />
      <Strip variant="doc" />
      <article className="note" aria-labelledby="note-title">
        <header className={styles.note__head} data-veil="0.9">
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
        </header>
        <div className={styles.prose} data-veil="">
          <Body
            components={{
              Quote,
              ul: (props: { children?: ReactNode }) => <ul className={styles.note__list} role="list" {...props} />,
            }}
          />
        </div>
        <footer className={styles.note__end} data-veil="">
          <div className={styles.colophon}>
            <svg className={styles.colophon__seal} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
              <defs>
                <mask id="colophon-carve" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
                  <rect width="64" height="64" fill="#fff" />
                  <path className="seal__glyph" d={SEAL_GLYPH} />
                </mask>
              </defs>
              <g filter="url(#seal-stone)">
                <path className="seal__stone" mask="url(#colophon-carve)" d={SEAL_STONE} />
              </g>
            </svg>
            <p className={styles.colophon__line}>{writing.note.author}</p>
          </div>
          <p className={`actions ${styles.note__actions}`}>
            <InkButton href={writing.note.more.href} arrow>
              {writing.note.more.label}
            </InkButton>
          </p>
        </footer>
      </article>
      <NoteEffects />
    </PageMain>
  );
}
