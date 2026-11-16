import { Fragment } from 'react';
import { work } from '@content/pages/work';
import { PageMain } from '@/components/page/PageMain';
import { Glimpse } from '@/components/page/Glimpse';
import { Strip } from '@/components/page/Strip';
import { Diagram } from '@/components/ui/Diagram';
import { InTheOpen } from '@/features/github/InTheOpen';
import { splitFigure } from '@/lib/figure';
import { Inline, InlineLink } from '@/lib/inline';
import { buildCraft } from '@/features/craft/build';
import { Hood } from '@/features/craft/Hood';
import { collectionLd } from './jsonld';
import { allCases } from './cases';
import { OldAnchors } from './OldAnchors';
import styles from './work.module.css';

/**
 * Work (/work/): a concise index (DESIGN §11.E answer 2). The first screen is the live site's: the market-town strip
 * with the title and intro in its mist.
 *
 * Below it (round 7) the page follows the river town as it crosses the screen:
 *   "Six projects, newest first" at the left while the town still stands at the right: six rows the width of nine
 *   columns, each with its figure as an ink numeral (a projection as an outline, never filled ink), the project
 *   (leading to its own case page), its outcome and public evidence, its years and his role at the row's end;
 *   How I build across the whole frame: the statement set large, its line, and the brush diagram beside them;
 *   Under the hood, the page's moment (features/craft/Hood): four real things running in the visitor's browser,
 *   laid open: a grammar holding a model's output token by token, the search's own test, the search, the lineage;
 *   In the open at the right, once the town has gone west (Jack's public repositories, read on the server at build
 *   time and daily);
 *   and the ending: Writing, inked into the open water downstream.
 * Words: content/pages/work.ts and content/work/*.mdx.
 */
export async function WorkIndex() {
  const cases = await allCases();
  const { index, build, open } = work;
  // the craft's sizes, said before a piece is reached (computed from content/ at build; features/craft/build.ts)
  const craft = buildCraft();
  return (
    <PageMain page="work" className={styles.page} ld={[collectionLd(cases)]}>
      <Strip variant="sub" labelledBy="page-title" still="work">
        <h1 className="page-title" id="page-title">
          {work.title}
        </h1>
        <p className="lead">
          <Inline text={work.intro} />
        </p>
      </Strip>

      <section className={`part ${styles.six}`} aria-labelledby="glance-title">
        <div className={styles.head} data-veil="0.9">
          <h2 className="h-ink" id="glance-title">
            {index.title}
          </h2>
        </div>
        <ol className={styles.projects} role="list" data-veil="0.9">
          {cases.map((c) => {
            // the figure as an ink numeral (decorative: the outcome carries it in words); a projection is an outline
            // under its own label, never filled ink (the vanguard round's A1 kept it out of the numerals altogether)
            const f = splitFigure(c.figure);
            const projected = c.figure.basis === 'projected';
            return (
              // the row keeps the case's old anchor (/work/#rag-assistant), so links from before land here
              <li className={`${styles.project} ink-row`} key={c.slug} id={c.slug}>
                <p
                  className={projected ? `num ${styles.numeral} ${styles.outline}` : `num ${styles.numeral}`}
                  aria-hidden="true"
                >
                  {f.lead ? <span className="num__lead">{f.lead}</span> : null}
                  {f.value}
                </p>
                <div className={styles.what}>
                  <h3 className={styles.title}>
                    <InlineLink href={c.href}>
                      <Inline text={c.title} />
                    </InlineLink>
                  </h3>
                  <p className={styles.outcome}>
                    <Inline text={c.outcome} />
                    {c.evidence.length ? (
                      <span className={styles.evidence}>
                        {c.evidence.map((e, i) => (
                          <Fragment key={e.url}>
                            {i > 0 ? ' · ' : null}
                            <InlineLink href={e.url}>{e.label}</InlineLink>
                          </Fragment>
                        ))}
                      </span>
                    ) : (
                      <span className="visually-hidden"> · {index.noEvidence}</span>
                    )}
                  </p>
                </div>
                <p className={`mono ${styles.when}`}>
                  <span>{c.years}</span> <span>{c.role}</span>
                </p>
              </li>
            );
          })}
        </ol>
      </section>

      <Glimpse still="work-0" />
      <section className={`part spread ${styles.build}`} aria-labelledby="build-title">
        <div className={styles.buildText} data-veil="">
          <h2 className="h-ink" id="build-title">
            {build.title}
          </h2>
          <p className={styles.statement}>
            <Inline text={build.statement} />
          </p>
          <p>
            <Inline text={build.line} />
          </p>
        </div>
        <div className={styles.buildArt} data-veil="">
          <Diagram name={build.diagram.name} caption={build.diagram.caption} steps={build.diagram.steps} />
        </div>
      </section>

      <Hood craft={craft} />

      <Glimpse still="work-1" />
      <section className={`part spread ${styles.open}`} id="open" aria-labelledby="open-title">
        <div className={styles.openBody} data-veil="0.9">
          <h2 className="h-ink" id="open-title">
            {open.title}
          </h2>
          <p>
            <Inline text={open.intro} />
          </p>
          <InTheOpen />
          <p className="more">
            <InlineLink href={open.all.href}>{open.all.label}</InlineLink>
          </p>
        </div>
      </section>
      <OldAnchors slugs={cases.map((c) => c.slug)} />
    </PageMain>
  );
}
