import { casePage } from '@content/pages/case';
import { work } from '@content/pages/work';
import { PageMain } from '@/components/page/PageMain';
import { Strip } from '@/components/page/Strip';
import { Diagram } from '@/components/ui/Diagram';
import { MarginNote } from '@/components/ui/MarginNote';
import { splitFigure } from '@/lib/figure';
import { Inline, InlineLink } from '@/lib/inline';
import { breadcrumbLd } from '@/lib/jsonld';
import { plain } from '@/lib/markup';
import type { Case } from './cases';
import { caseLd } from './jsonld';
import styles from './work.module.css';

/**
 * One Work case, on its own page (/work/<slug>/; DESIGN §11.E answer 2), opening inside the town. The market's strip
 * with the case's title (the long title size) and its meta line in the mist; then the case's spine: its figure as a
 * poster numeral with its measure on one line and where the figure comes from (A1: a `projected` figure is never a
 * numeral, it stays in prose), the summary, the NDA line where there is no public evidence, its brush diagram (the
 * flagships; on phones it folds behind "Read as steps"), and its labelled body (Problem · My part · Outcome and
 * status · Evidence · Stack; a missing part is left out) with the glossary notes in the margin rail; then "All six
 * projects →", the ending downstream (Writing) and the town once more. The seal signs the site once, at the tail.
 * Words: content/work/<slug>.mdx.
 */
export function CasePage({ c }: { c: Case }) {
  const { meta, Body } = c;
  const long = meta.org.length > 12; // a long organisation takes its own line on phones
  const fig = splitFigure(meta.figure);
  const basis = meta.figure.basis === 'internal' ? casePage.basis.internal : null;
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
      <Strip variant="sub" labelledBy="case-title" still="case">
        <h1 className="page-title page-title--long" id="case-title">
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
        {meta.figure.basis === 'projected' ? (
          // a projection is said in words, never set as a numeral (A1)
          <p className={`case__summary ${styles.projected}`}>
            {meta.figure.lead ? `${meta.figure.lead} ` : null}
            {meta.figure.value} {meta.figure.note}
          </p>
        ) : (
          <p className={`case__fig ${styles.fig}`}>
            {fig.lead ? <span className="fig__lead">{fig.lead}</span> : null}
            <b className="fig">{fig.value}</b> <span className="case__measure">{meta.figure.note}</span>
            {basis ? (
              // a real space and separator (not CSS content), kept with the mark so it never ends a line
              <>
                {' '}
                <span className={`mono small nowrap ${styles.basis}`}>· {basis}</span>
              </>
            ) : null}
          </p>
        )}
        <p className="case__summary">
          <Inline text={meta.summary} />
        </p>
        {meta.evidence.length ? null : <p className={`small ${styles.nda}`}>{casePage.nda}</p>}
        {meta.diagram ? (
          <Diagram name={meta.diagram.name} caption={meta.diagram.caption} steps={meta.diagram.steps} fold />
        ) : null}
        <Body components={{ Note: MarginNote }} />
        <p className="more">
          <InlineLink href={work.back.href}>{work.back.label}</InlineLink>
        </p>
      </article>
    </PageMain>
  );
}
