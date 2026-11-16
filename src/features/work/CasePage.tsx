import { hood } from '@content/craft/hood';
import { casePage } from '@content/pages/case';
import { work } from '@content/pages/work';
import { workCraft } from '@content/pages/work-craft';
import { PageMain } from '@/components/page/PageMain';
import { Strip } from '@/components/page/Strip';
import { Diagram } from '@/components/ui/Diagram';
import { MarginNote } from '@/components/ui/MarginNote';
import { TextAction } from '@/components/ui/TextAction';
import { buildCraft } from '@/features/craft/build';
import { Piece, type PieceKind } from '@/features/craft/client/Piece';
import { Search } from '@/features/craft/client/Search';
import craftStyles from '@/features/craft/craft.module.css';
import { splitFigure } from '@/lib/figure';
import { Inline } from '@/lib/inline';
import { breadcrumbLd } from '@/lib/jsonld';
import { plain } from '@/lib/markup';
import type { Case } from './cases';
import { caseLd } from './jsonld';
import styles from './work.module.css';

/**
 * One Work case, on its own page (/work/<slug>/; DESIGN §11.E answer 2), opening inside the town. The first screen is
 * the live site's: the market's strip with the case's title (the long title size) and its meta line in the mist.
 *
 * Below it (round 7):
 *   the case's summary set large at the left, with its figure in words, where the figure comes from and the NDA line
 *   where there is no public evidence; and at the right the page's moment: the figure itself as one large numeral
 *   INKED INTO THE PAINTING (body.css .inked: between the painting's two leaves), so that as the page scrolls it
 *   rises behind the town's roofs (a projection as an outline, never filled ink: it is not yet real);
 *   its brush diagram across the frame (the flagships; on phones it folds behind "Read as steps");
 *   its labelled body (Problem · My part · Outcome and status · Evidence · Stack; a missing part is left out) with
 *   the glossary notes in the margin rail;
 *   on the three cases a live piece of "Under the hood" is tied to (content/craft/hood.ts `case`), that piece itself,
 *   running: the grammar on the agent's page, the search and its test on the assistant's, the lineage on the data
 *   operations';
 *   then "All six projects →", the ending downstream (Writing) inked into the painting.
 * Words: content/work/<slug>.mdx.
 */
const LIVE: Record<string, PieceKind[]> = {
  [hood.mask.case]: ['mask'],
  [hood.eval.case]: ['eval'],
  [hood.lineage.case]: ['lineage'],
};

export function CasePage({ c }: { c: Case }) {
  const { meta, Body } = c;
  const long = meta.org.length > 12; // a long organisation takes its own line on phones
  const fig = splitFigure(meta.figure);
  const projected = meta.figure.basis === 'projected';
  const basis = meta.figure.basis === 'internal' ? casePage.basis.internal : null;
  const live = LIVE[meta.slug] ?? [];
  // (the pieces' sizes, said before they are reached: computed from content/ at build)
  const craft = live.length ? buildCraft() : null;
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

      {/* the summary and the figure in words at the left; the figure itself, inked into the painting, at the right */}
      <section className={`part spread ${styles.lede}`} aria-label={work.title}>
        <div className={styles.ledeText} data-veil="">
          <p className={styles.summary}>
            <Inline text={meta.summary} />
          </p>
          <p className={`case__fig ${styles.measure}`}>
            <span>
              {meta.figure.lead ? `${meta.figure.lead} ` : null}
              <b>{meta.figure.value}</b> {meta.figure.note}
            </span>
            {basis ? (
              // a real space and separator (not CSS content), kept with the mark so it never ends a line
              <>
                {' '}
                <span className={`mono small nowrap ${styles.basis}`}>· {basis}</span>
              </>
            ) : null}
          </p>
          {meta.evidence.length ? null : <p className={`small ${styles.nda}`}>{casePage.nda}</p>}
        </div>
        <p
          className={projected ? `num inked ${styles.figure} ${styles.outline}` : `num inked ${styles.figure}`}
          aria-hidden="true"
        >
          {fig.lead ? <span className="num__lead">{fig.lead}</span> : null}
          {fig.value}
        </p>
      </section>

      {meta.diagram ? (
        <section className={`part ${styles.drawing}`} data-veil="">
          <Diagram name={meta.diagram.name} caption={meta.diagram.caption} steps={meta.diagram.steps} fold />
        </section>
      ) : null}

      <article className={`part case case--flagship has-rail ${styles.case}`} aria-labelledby="case-title" data-veil="">
        <Body components={{ Note: MarginNote }} />
      </article>

      {craft
        ? live.map((k) => (
            <section
              className={`part spread ${styles.live}`}
              key={k}
              id={`hood-${k}`}
              aria-labelledby={`hood-${k}-title`}
            >
              {k === 'eval' ? (
                // the assistant's page: the search itself, then its test (whose words speak of "the search above")
                <div className={`${craftStyles.piece} ${styles.liveSearch}`} id="hood-search" data-veil="">
                  <Search size={craft.sizes.corpus} />
                </div>
              ) : null}
              <div className={`${craftStyles.piece} ${styles.livePiece}`} data-veil="">
                <h2 className="h-ink h-ink--s" id={`hood-${k}-title`}>
                  {workCraft.hood[k].title}
                </h2>
                <Piece kind={k} size={craft.sizes[k]} here={meta.slug} />
              </div>
            </section>
          ))
        : null}

      <p className={`part ${styles.back}`} data-veil="">
        <TextAction href={work.back.href} arrow>
          {work.back.label.replace(/\s*→$/, '')}
        </TextAction>
      </p>
    </PageMain>
  );
}
