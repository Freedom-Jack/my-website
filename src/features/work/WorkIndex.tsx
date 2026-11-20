import { casePage } from '@content/pages/case';
import { work } from '@content/pages/work';
import { Inscription } from '@/components/page/Inscription';
import { PageMain } from '@/components/page/PageMain';
import { Diagram } from '@/components/ui/Diagram';
import { Go } from '@/components/ui/Go';
import { InTheOpen } from '@/features/github/InTheOpen';
import { splitFigure } from '@/lib/figure';
import { Inline, InlineLink } from '@/lib/inline';
import type { CaseMeta } from './cases';
import { allCases } from './cases';
import { collectionLd } from './jsonld';
import styles from './work.module.css';

/** How many of the newest projects are shown with room; the rest stand as the ruled set. */
const LARGE = 2;

/**
 * Work (/work/): the river town.
 *
 * The title is inscribed in the town's sky, high (the town's crag stands under it at the far left), with the list's
 * own name beside it on its baseline. Under the mist:
 *   the thesis, the page's one inscribed line, with the honesty line beside it;
 *   the six projects as one list in two scales: the two newest with room (the figure as an ink numeral with its
 *   measure and its basis, the title in the brush, the summary, the role, the outcome, the evidence, the way to the
 *   case; the second mirrors the first), then the other four as a ruled set, two columns of two;
 *   How I build: his line and the brush diagram across the ten columns;
 *   In the open: his public repositories (features/github, read on the server at build time and daily).
 * A projection is drawn in outline and led by "Projected"; an internal figure says so beside its measure.
 * Words: content/pages/work.ts and content/work/*.mdx.
 */
export async function WorkIndex() {
  const cases = await allCases();
  const { index, build, open } = work;
  return (
    <PageMain page="work" className={styles.work} ld={[collectionLd(cases)]}>
      <Inscription y="1.25rem">
        <h1 className="title" id="work-title">
          {work.title}
        </h1>
        <p className="title__under" id="six-title">
          {index.title}
        </p>
      </Inscription>

      {/* the thesis, inscribed, and the honesty line beside it */}
      <section className={`row sec sec--first ${styles.first}`} aria-labelledby="work-title">
        <p className={`brush ${styles.thesis}`}>
          <Inline text={build.statement} />
        </p>
        <p className={`say ${styles.intro}`}>
          <Inline text={work.intro} />
        </p>
      </section>

      {/* the six projects: one list, two scales. (Each entry keeps its case's anchor: /work/#rag-assistant.) */}
      <ol className={`row ${styles.six}`} role="list" aria-labelledby="six-title">
        {cases.map((c, i) => (i < LARGE ? <Large c={c} key={c.slug} /> : <Small c={c} key={c.slug} />))}
      </ol>

      <section className={`row sec ${styles.build}`} aria-labelledby="build-title">
        <div className="sec__rail">
          <h2 className="label" id="build-title">
            {build.title}
          </h2>
        </div>
        <div className="sec__body">
          <p className={`lead ${styles.buildLine}`}>
            <Inline text={build.line} />
          </p>
          <Diagram name={build.diagram.name} caption={build.diagram.caption} steps={build.diagram.steps} />
        </div>
      </section>

      <section className={`row sec ${styles.open}`} id="open" aria-labelledby="open-title">
        <div className="sec__rail">
          <h2 className="label" id="open-title">
            {open.title}
          </h2>
        </div>
        <div className={styles.openSay}>
          <p className="say">
            <Inline text={open.intro} />
          </p>
          <p>
            <Go href={open.all.href}>{open.all.label.replace(/\s*→$/, '')}</Go>
          </p>
        </div>
        <div className={styles.openList}>
          <InTheOpen />
        </div>
      </section>
    </PageMain>
  );
}

/** A figure as an ink numeral under its small lead. A lead the case wrote itself ("mAP ≥") is a notation: it keeps
 *  its own letters; a projection is drawn in outline. */
function Numeral({ c, className, hidden }: { c: CaseMeta; className?: string; hidden?: boolean }) {
  const f = splitFigure(c.figure);
  const cls = ['num', c.figure.basis === 'projected' ? 'num--projected' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <p className={cls} aria-hidden={hidden || undefined}>
      <span className={c.figure.lead ? `num__lead ${styles.notation}` : 'num__lead'}>{f.lead || ' '}</span>
      {f.value}
    </p>
  );
}

/** One of the two newest: the figure with its measure and its basis at one side, the words at the other. */
function Large({ c }: { c: CaseMeta }) {
  const { index } = work;
  return (
    <li className={styles.large} id={c.slug}>
      <div className={styles.largeFig}>
        <Numeral c={c} />
        <p className={`small soft ${styles.measure}`}>
          <Inline text={c.figure.note} />
        </p>
        {c.figure.basis === 'internal' ? <p className="rec">{casePage.basis.internal}</p> : null}
      </div>
      <div className={styles.largeWords}>
        <p className="rec">
          {c.years} · {c.role} · {c.org}
        </p>
        <h2 className={`h-brush ${styles.largeTitle}`}>
          <InlineLink href={c.href}>
            <Inline text={c.title} />
          </InlineLink>
        </h2>
        <p className={`say ${styles.largeSay}`}>
          <Inline text={c.summary} />
        </p>
        <div className={styles.facts}>
          <p className="small soft">
            <Inline text={c.outcome} />
          </p>
          <p className={`rec ${styles.evidence}`}>
            {c.evidence.length
              ? c.evidence.map((e) => (
                  <InlineLink key={e.url} href={e.url}>
                    {e.label}
                  </InlineLink>
                ))
              : index.noEvidence}
          </p>
        </div>
        <p className={styles.more}>
          <Go href={c.href}>{index.more}</Go>
        </p>
      </div>
    </li>
  );
}

/** One of the other four: a smaller numeral (decorative: the outcome beside it carries the figure and its measure
 *  in words), the title, the outcome in a line, the years and his role. */
function Small({ c }: { c: CaseMeta }) {
  return (
    <li className={styles.small} id={c.slug}>
      <Numeral c={c} className={styles.smallNum} hidden />
      <div className={styles.smallWords}>
        <h2 className="h-item">
          <InlineLink href={c.href}>
            <Inline text={c.title} />
          </InlineLink>
        </h2>
        <p className="small soft">
          <Inline text={c.outcome} />
        </p>
        <p className="rec">
          {c.years} · {c.role}
        </p>
      </div>
    </li>
  );
}
