import { Fragment } from 'react';
import { work } from '@content/pages/work';
import { PageMain } from '@/components/page/PageMain';
import { Strip } from '@/components/page/Strip';
import { Diagram } from '@/components/ui/Diagram';
import { InTheOpen } from '@/features/github/InTheOpen';
import { Inline, InlineLink } from '@/lib/inline';
import { collectionLd } from './jsonld';
import { allCases } from './cases';
import { OldAnchors } from './OldAnchors';
import styles from './work.module.css';

/**
 * Work (/work/): a concise index (DESIGN §11.E answer 2). The market-town strip with the title and intro in its
 * mist; "Six projects, newest first", each row leading to its own case page; How I build (the statement, its
 * line, the brush diagram and its steps); In the open (Jack's public repositories, read on the server at build
 * time and daily). It ends on the town once more. Words: content/pages/work.ts and content/work/*.mdx.
 */
export async function WorkIndex() {
  const cases = await allCases();
  const { index, build, open } = work;
  return (
    <PageMain page="work" className={styles.page} ld={[collectionLd(cases)]}>
      <Strip variant="sub" labelledBy="page-title">
        <h1 className="page-title" id="page-title">
          {work.title}
        </h1>
        <p className="lead">
          <Inline text={work.intro} />
        </p>
      </Strip>

      <section className={`sec wide ${styles.index}`} aria-labelledby="glance-title" data-veil="0.9">
        <h2 className="sec__title sec__title--item" id="glance-title">
          {index.title}
        </h2>
        <div className="table-wrap wide">
          <table className="table" role="table" aria-labelledby="glance-title">
            <thead role="rowgroup">
              <tr role="row">
                <th scope="col" role="columnheader">
                  {index.columns.years}
                </th>
                <th scope="col" role="columnheader">
                  {index.columns.project}
                </th>
                <th scope="col" role="columnheader">
                  {index.columns.outcome}
                </th>
                <th scope="col" role="columnheader">
                  {index.columns.evidence}
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {cases.map((c) => (
                // the row keeps the case's old anchor (/work/#rag-assistant), so links from before land here
                <tr role="row" key={c.slug} id={c.slug}>
                  <td role="cell" data-label={index.columns.years}>
                    {c.years}
                  </td>
                  <th scope="row" role="rowheader">
                    <InlineLink href={c.href}>
                      <Inline text={c.title} />
                    </InlineLink>
                  </th>
                  <td role="cell" data-label={index.columns.outcome}>
                    <span>
                      <Inline text={c.outcome} />
                    </span>
                  </td>
                  <td role="cell" data-label={index.columns.evidence}>
                    {c.evidence.length === 0 ? (
                      index.noEvidence
                    ) : c.evidence.length === 1 ? (
                      <InlineLink href={c.evidence[0]!.url}>{c.evidence[0]!.label}</InlineLink>
                    ) : (
                      <span className={styles.cellLinks}>
                        {c.evidence.map((e, i) => (
                          <Fragment key={e.url}>
                            {i > 0 ? <span className={styles.cellLinksSep}> · </span> : null}
                            <InlineLink href={e.url}>{e.label}</InlineLink>
                          </Fragment>
                        ))}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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
