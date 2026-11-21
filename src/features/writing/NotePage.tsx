import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { site } from '@content/site';
import { writing } from '@content/pages/writing';
import { Inscription } from '@/components/page/Inscription';
import { PageMain } from '@/components/page/PageMain';
import { longDate } from '@/lib/dates';
import { InlineLink } from '@/lib/inline';
import { breadcrumbLd } from '@/lib/jsonld';
import { blogPostingLd } from './jsonld';
import type { Note } from './notes';
import styles from './article.module.css';

type Kids = { children?: ReactNode };

/**
 * A quotation with its source (in MDX: <Quote cite="https://…">, its paragraphs, </Quote>): the text's voice, set
 * off by a hairline at its left; its source, named by its address and linked, in the record's voice (in the right
 * margin on wide screens).
 */
function Quote({ cite, children }: Kids & { cite?: string }) {
  const host = cite ? new URL(cite).host.replace(/^www\./, '') : '';
  return (
    <figure className={styles.quote}>
      <blockquote cite={cite}>{children}</blockquote>
      {cite ? (
        <figcaption className="rec">
          <InlineLink href={cite}>{host}</InlineLink>
        </figcaption>
      ) : null}
    </figure>
  );
}

/** A list of two or three things is set side by side, ruled apart, across the page; a longer one is a plain list. */
function List({ children, ...rest }: Kids) {
  const n = Children.toArray(children).filter(isValidElement).length;
  const side = n === 2 ? styles.pair : n === 3 ? styles.trio : null;
  return (
    <ul {...rest} role="list" className={side ? `${styles.list} ${styles.cols} ${side}` : styles.list}>
      {children}
    </ul>
  );
}

/** An item that opens on its own bold label ("**Perceive:** …") is headed by it: the label stands over the item,
 *  its colon kept for a screen reader and a copy, not drawn. */
function Item({ children, ...rest }: Kids) {
  const [first, ...others] = Children.toArray(children);
  if (isValidElement(first) && first.type === 'strong') {
    const label = (first as ReactElement<Kids>).props.children;
    const colon = typeof label === 'string' && label.endsWith(':');
    return (
      <li {...rest} className={styles.headed}>
        <strong>
          {colon ? label.slice(0, -1) : label}
          {colon ? <span className="visually-hidden">:</span> : null}
        </strong>
        {others}
      </li>
    );
  }
  return <li {...rest}>{children}</li>;
}

/**
 * One note (/writing/<slug>/), inside the lake. Its title is inscribed in the painting's sky with its kind and its
 * dates. Under the mist: his name in the left rail, the note in a reading measure (columns 3 to 9), its first
 * paragraph as the opening. What is set side by side (a short list, the comparison) takes the full width, the
 * comparison's aspects hanging in the rail; a quotation's source stands in the right margin. At its end, the way
 * back. Words: content/writing/<slug>.mdx and content/pages/writing.ts.
 */
export function NotePage({ note }: { note: Note }) {
  const { meta, Body } = note;
  return (
    <PageMain
      page="article"
      ld={[
        blogPostingLd(meta),
        breadcrumbLd([
          { name: writing.title, path: '/writing/' },
          { name: meta.title, path: meta.href },
        ]),
      ]}
    >
      <article aria-labelledby="note-title">
        <Inscription>
          <h1 className="title title--long" id="note-title">
            {meta.title}
          </h1>
          <p className="title__under">
            <span className="nowrap">
              {meta.kind} · <time dateTime={meta.published}>{longDate(meta.published)}</time>
            </span>
            {meta.modified && meta.modifiedNote ? (
              <>
                {' · '}
                <span className="nowrap">
                  {meta.modifiedNote} <time dateTime={meta.modified}>{longDate(meta.modified)}</time>
                </span>
              </>
            ) : null}
          </p>
        </Inscription>
        <div className={`row sec sec--first ${styles.prose}`}>
          <p className={`label ${styles.by}`}>{site.name}</p>
          <Body
            components={{
              Quote,
              ul: List,
              li: Item,
              h2: (props: Kids) => <h2 {...props} className="h-brush" />,
              h3: (props: Kids) => <h3 {...props} className="h-item" />,
            }}
          />
        </div>
      </article>
    </PageMain>
  );
}
