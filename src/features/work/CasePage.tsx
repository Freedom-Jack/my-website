import { work } from '@content/pages/work';
import { Colophon } from '@/components/page/Colophon';
import { PageMain } from '@/components/page/PageMain';
import { Strip } from '@/components/page/Strip';
import { Diagram } from '@/components/ui/Diagram';
import { MarginNote } from '@/components/ui/MarginNote';
import { Inline, InlineLink } from '@/lib/inline';
import { breadcrumbLd } from '@/lib/jsonld';
import { plain } from '@/lib/markup';
import type { Case } from './cases';
import { caseLd } from './jsonld';
import styles from './work.module.css';

/**
 * One Work case, on its own page (/work/<slug>/; DESIGN §11.E answer 2). The market's strip with the case's title
 * and its meta line in the mist; then its figure and summary, its brush diagram (the flagships; on phones it folds
 * behind "Read as steps"), and its labelled body (Context · What I did · Outcome · Evidence · Stack) with the
 * glossary notes in the margin rail; then the colophon (whose work this is, for a reader who arrived from a search
 * result), and the way back to the index. It ends on the town once more. Words: content/work/<slug>.mdx.
 */
export function CasePage({ c }: { c: Case }) {
  const { meta, Body } = c;
  const long = meta.org.length > 12; // a long organisation takes its own line on phones
  return (
    <PageMain
      page="case"
      className={styles.page}
      ld={[
        caseLd(meta),
        breadcrumbLd([
          { name: work.title, path: '/work/' },
          { name: plain(meta.title), path: meta.href },
        ]),
      ]}
    >
      <Strip variant="sub" labelledBy="case-title">
        <h1 className="page-title" id="case-title">
          <Inline text={meta.title} />
        </h1>
        <p className={`case__meta small${long ? ` ${styles.metaStack}` : ''}`}>
          <span className="case__org">{meta.org}</span>
          <span className="case__sep"> · </span>
          <span className="nowrap">
            {meta.years} · {meta.role}
          </span>
        </p>
      </Strip>

      <article className={`sec case case--flagship has-rail ${styles.case}`} aria-labelledby="case-title" data-veil="">
        <p className="case__fig">
          <b className="fig">
            {meta.figure.lead ? <span className="fig__lead">{meta.figure.lead} </span> : null}
            {meta.figure.value}
          </b>{' '}
          <span className="small">{meta.figure.note}</span>
        </p>
        <p className="case__summary">
          <Inline text={meta.summary} />
        </p>
        {meta.diagram ? (
          <Diagram name={meta.diagram.name} caption={meta.diagram.caption} steps={meta.diagram.steps} fold />
        ) : null}
        <Body components={{ Note: MarginNote }} />
        <footer className={styles.case__end}>
          <Colophon />
        </footer>
        <p className="more">
          <InlineLink href={work.back.href}>{work.back.label}</InlineLink>
        </p>
      </article>
    </PageMain>
  );
}
