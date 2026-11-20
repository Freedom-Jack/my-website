import { work } from '@content/pages/work';
import styles from '@/features/work/work.module.css';
import { InlineLink } from '@/lib/inline';
import { openSource } from './fetch';
import type { Entry } from './rules';

/**
 * Work's "In the open": rendered on the server from Jack's public repositories (features/github).
 * One ruled list, the featured ones first, then the recent: the year in the record's voice, the repository's name
 * (a link), its line. The older ones stand behind a plain fold, "Early work, 2019 – 2020" (course work on request,
 * never the section's face). An empty group renders nothing. No stars, heatmaps, widgets or language dots.
 */
function Rows({ items }: { items: Entry[] }) {
  const { open } = work;
  return (
    <ul role="list">
      {items.map((e) => (
        <li className={styles.repo} key={e.name}>
          <p className="rec">{e.year}</p>
          <h3 className={`h-item ${styles.repoName}`}>
            <InlineLink href={e.url}>{e.name}</InlineLink>
          </h3>
          <p className="small soft">
            {e.line}
            {e.demo ? (
              <>
                {' '}
                <InlineLink href={e.demo}>{open.demo}</InlineLink>
              </>
            ) : null}
          </p>
        </li>
      ))}
    </ul>
  );
}

export async function InTheOpen() {
  const { open } = work;
  const g = await openSource();
  const shown = [...g.featured, ...g.recent];
  const range = g.earlyRange;
  return (
    <>
      {shown.length ? <Rows items={shown} /> : null}
      {g.early.length && range ? (
        <details className={styles.early}>
          <summary>
            <span>
              {range.last > 2020 ? open.earlier : open.early},{' '}
              {range.first === range.last ? range.first : `${range.first} – ${range.last}`}
            </span>
          </summary>
          <Rows items={g.early} />
        </details>
      ) : null}
    </>
  );
}
