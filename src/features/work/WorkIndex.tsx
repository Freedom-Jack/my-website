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
import { Search } from '@/features/craft/client/Search';
import { collectionLd } from './jsonld';
import { allCases } from './cases';
import { OldAnchors } from './OldAnchors';
import styles from './work.module.css';

/**
 * Work (/work/): a concise index (DESIGN §11.E answer 2). The market-town strip with the title and intro in its
 * mist; the search; "Six projects, newest first" as dated ledger rows (the figure as a poster numeral, never a
 * projection's; its years and his role; the project, leading to its own case page; the outcome with its public
 * evidence under it), right after the search on phones too; How I build (the statement, its
 * line, the brush diagram and its steps); In the open (Jack's public repositories, read on the server at build
 * time and daily). It ends on the town once more. Words: content/pages/work.ts and content/work/*.mdx.
 */
export async function WorkIndex() {
  const cases = await allCases();
  const { index, build, open } = work;
  // the craft's sizes, said before any click (computed from content/ at build; features/craft/build.ts)
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

      {/* no label here: the search's own <form role="search"> is the one landmark (an empty region without JS) */}
      <section className="sec" data-veil="0.92">
        <Search size={craft.sizes.corpus} />
      </section>

      <section className="sec" aria-labelledby="glance-title" data-veil="0.9">
        <h2 className="sec__title sec__title--item" id="glance-title">
          {index.title}
        </h2>
        <ul className="ledger" role="list">
          {cases.map((c) => {
            // the figure as a poster numeral (decorative: the outcome carries it in words); a projection never (A1)
            const f = c.figure.basis === 'projected' ? null : splitFigure(c.figure);
            return (
              // the row keeps the case's old anchor (/work/#rag-assistant), so links from before land here
              <li className="ledger__row ink-row" key={c.slug} id={c.slug}>
                {f ? (
                  <p className="ledger__figure" aria-hidden="true">
                    {f.lead ? <span className="ledger__figure-lead">{f.lead}</span> : null}
                    {f.value}
                  </p>
                ) : null}
                <p className="ledger__meta mono">
                  {c.years} · {c.role}
                </p>
                <h3 className="ledger__title">
                  <InlineLink href={c.href}>
                    <Inline text={c.title} />
                  </InlineLink>
                </h3>
                <p className="ledger__line">
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
              </li>
            );
          })}
        </ul>
      </section>

      <Glimpse still="work-0" />
      <section className="sec" aria-labelledby="build-title" data-veil="">
        <h2 className="sec__title" id="build-title">
          {build.title}
        </h2>
        <p className="lead">
          <Inline text={build.statement} />
        </p>
        <p>
          <Inline text={build.line} />
        </p>
        <Diagram name={build.diagram.name} caption={build.diagram.caption} steps={build.diagram.steps} />
      </section>

      <Hood craft={craft} />

      <Glimpse still="work-1" />
      <section className={`sec ${styles.open}`} id="open" aria-labelledby="open-title" data-veil="0.9">
        <h2 className="sec__title" id="open-title">
          {open.title}
        </h2>
        <p>
          <Inline text={open.intro} />
        </p>
        <InTheOpen />
        <p className="more">
          <InlineLink href={open.all.href}>{open.all.label}</InlineLink>
        </p>
      </section>
      <OldAnchors slugs={cases.map((c) => c.slug)} />
    </PageMain>
  );
}
