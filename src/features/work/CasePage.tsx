import { Children, type ComponentProps, isValidElement, type ReactNode } from 'react';
import { hood } from '@content/craft/hood';
import { casePage } from '@content/pages/case';
import { work } from '@content/pages/work';
import { Inscription } from '@/components/page/Inscription';
import { PageMain } from '@/components/page/PageMain';
import { Diagram } from '@/components/ui/Diagram';
import { Go } from '@/components/ui/Go';
import { MarginNote } from '@/components/ui/MarginNote';
import { buildCraft } from '@/features/craft/build';
import type { PieceKind } from '@/features/craft/client/Piece';
import { Hood } from '@/features/craft/Hood';
import { splitFigure } from '@/lib/figure';
import { Inline, InlineLink } from '@/lib/inline';
import { breadcrumbLd } from '@/lib/jsonld';
import { plain } from '@/lib/markup';
import { allCases, type Case } from './cases';
import { caseLd } from './jsonld';
import styles from './work.module.css';

/** The live piece of "Under the hood" each case is tied to (content/craft/hood.ts `case`). */
const LIVE: Record<string, PieceKind> = {
  [hood.mask.case]: 'mask',
  [hood.eval.case]: 'eval',
  [hood.lineage.case]: 'lineage',
};
/** The part of a case's body its drawing follows. */
const DRAWN_AFTER = 'my-part';

/**
 * One Work case, on its own page (/work/<slug>/), inside the town.
 *
 * The title is inscribed in the town's sky with the organisation, the years and his role under it. Under the mist:
 *   the figure, large, with its lead, its measure and where it comes from (a projection is drawn in outline; an
 *   internal figure says so), and the summary beside it as the page's opening;
 *   the case's body from its MDX, part by part (Problem, My part, The hard part, Outcome and status, Evidence,
 *   Stack; a missing part is left out): each part's name in the left rail, its words in a reading measure, its
 *   glossary notes in the margin beside the paragraph they explain; the case's drawing, where it has one, across
 *   the page after "My part"; Evidence and Stack side by side as the small print;
 *   Under the hood, on the three cases a live piece is tied to: that piece, running in the reader's browser;
 *   the NDA line where there is no public evidence, the way back to the six, and the cases on either side.
 * Words: content/work/<slug>.mdx, content/pages/case.ts.
 */
export async function CasePage({ c }: { c: Case }) {
  const { meta, Body } = c;
  const fig = splitFigure(meta.figure);
  const projected = meta.figure.basis === 'projected';
  const live = LIVE[meta.slug];
  // (the piece's size, said before it is reached, and whether the build could make it: computed from content/)
  const craft = live ? buildCraft() : null;
  const all = await allCases();
  const at = all.findIndex((x) => x.slug === meta.slug);
  const beside = [all[at - 1], all[at + 1]].filter((x) => x !== undefined);

  const drawing = meta.diagram ? (
    <Diagram
      name={meta.diagram.name}
      caption={meta.diagram.caption}
      steps={meta.diagram.steps}
      className={styles.drawing}
    />
  ) : null;

  /** A part of the body (section.case__part, made by the MDX transform: its h2, then its content): the name in the
   *  rail, the words beside it; the drawing follows "My part". */
  function Part({ children }: ComponentProps<'section'>) {
    const [head, ...rest] = Children.toArray(children);
    const id = isValidElement<{ id?: string }>(head) ? head.props.id : undefined;
    return (
      <>
        <section className={styles.part} data-part={id}>
          <div className={styles.partRail}>{head}</div>
          <div className={styles.partBody}>{rest}</div>
        </section>
        {id === DRAWN_AFTER ? drawing : null}
      </>
    );
  }
  const Label = ({ children, id }: ComponentProps<'h2'>): ReactNode => (
    <h2 className="label" id={id}>
      {children}
    </h2>
  );

  return (
    <PageMain
      page="case"
      ld={[
        caseLd(meta),
        breadcrumbLd([
          { name: work.title, path: '/work/' },
          { name: plain(meta.title), path: meta.href },
        ]),
      ]}
    >
      <Inscription y="1.25rem">
        <h1 className="title title--long" id="case-title">
          <Inline text={meta.title} />
        </h1>
        <p className="title__under">
          {meta.org} · {meta.years} · {meta.role}
        </p>
      </Inscription>

      {/* the figure, large, and the summary beside it */}
      <section className={`row sec sec--first ${styles.lede}`} aria-labelledby="case-title">
        <div className={styles.fig}>
          <p className={projected ? `num num--projected ${styles.figNum}` : `num ${styles.figNum}`}>
            <span className={meta.figure.lead ? `num__lead ${styles.notation}` : 'num__lead'}>
              {fig.lead || '\u00a0'}
            </span>
            {fig.value}
          </p>
          <p className={`soft ${styles.measure}`}>
            <Inline text={meta.figure.note} />
          </p>
          {meta.figure.basis === 'internal' ? <p className="rec">{casePage.basis.internal}</p> : null}
        </div>
        <p className={`lead ${styles.summary}`}>
          <Inline text={meta.summary} />
        </p>
      </section>

      <article className={`row ${styles.body}`} aria-labelledby="case-title">
        <Body components={{ Note: MarginNote, section: Part, h2: Label }} />
      </article>

      {live && craft && (live !== 'mask' || craft.mask) ? <Hood kind={live} size={craft.sizes[live]} /> : null}

      <footer className={`row sec ${styles.end}`}>
        <div className={styles.endSay}>
          {meta.evidence.length ? null : <p className={`rec ${styles.nda}`}>{casePage.nda}</p>}
          <p>
            <Go href={work.back.href}>{work.back.label.replace(/\s*→$/, '')}</Go>
          </p>
        </div>
        <ul className={styles.beside} role="list">
          {beside.map((x) => (
            <li key={x.slug}>
              <p className="rec">{x.years}</p>
              <p className="h-item">
                <InlineLink href={x.href}>
                  <Inline text={x.title} />
                </InlineLink>
              </p>
            </li>
          ))}
        </ul>
      </footer>
    </PageMain>
  );
}
