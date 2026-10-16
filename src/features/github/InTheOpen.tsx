import { work } from '@content/pages/work';
import { monthYear } from '@/lib/dates';
import { InlineLink } from '@/lib/inline';
import { openSource } from './fetch';
import type { Entry } from './rules';

/**
 * Work's "In the open" (COPY.md §3.4): rendered on the server from Jack's public repositories (features/github).
 * Featured and Recent as rows; the older ones as a quiet table, "Early work, 2019–2020". An empty group renders
 * nothing: no heading, no placeholder. No stars, heatmaps, widgets or language dots.
 */
function Rows({ title, items }: { title: string; items: Entry[] }) {
  const { open } = work;
  return (
    <>
      <h3 className="sec__sub">{title}</h3>
      <ul className="rows" role="list">
        {items.map((e) => (
          <li className="row ink-row" key={e.name}>
            <h4 className="row__title">
              <InlineLink href={e.url}>{e.name}</InlineLink>
            </h4>
            <p className="row__line">{e.line}</p>
            <p className="row__meta small">
              {open.updated} {monthYear(e.pushed.slice(0, 7))}
              {e.demo ? (
                <>
                  {' · '}
                  <InlineLink href={e.demo}>{open.demo}</InlineLink>
                </>
              ) : null}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}

export async function InTheOpen() {
  const { open } = work;
  const g = await openSource();
  const range = g.earlyRange;
  return (
    <>
      {g.featured.length ? <Rows title={open.featured} items={g.featured} /> : null}
      {g.recent.length ? <Rows title={open.recent} items={g.recent} /> : null}
      {g.early.length && range ? (
        <>
          <h3 className="sec__sub">
            {range.last > 2020 ? open.earlier : open.early},{' '}
            {range.first === range.last ? range.first : `${range.first}–${range.last}`}
          </h3>
          <div className="table-wrap wide">
            <table className="table table--quiet" role="table">
              <caption className="table__caption visually-hidden">{open.earlyCaption}</caption>
              <thead role="rowgroup">
                <tr role="row">
                  <th scope="col" role="columnheader">
                    {open.columns.year}
                  </th>
                  <th scope="col" role="columnheader">
                    {open.columns.repository}
                  </th>
                  <th scope="col" role="columnheader">
                    {open.columns.what}
                  </th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {g.early.map((e) => (
                  <tr role="row" key={e.name}>
                    <td role="cell" data-label={open.columns.year}>
                      {e.year}
                    </td>
                    <th scope="row" role="rowheader">
                      <InlineLink href={e.url}>{e.name}</InlineLink>
                    </th>
                    <td role="cell" data-label={open.columns.what}>
                      {e.line}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  );
}
