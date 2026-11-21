import { casePage } from '@content/pages/case';
import { work } from '@content/pages/work';
import { Inscription } from '@/components/page/Inscription';
import { PageMain } from '@/components/page/PageMain';
import { Diagram } from '@/components/ui/Diagram';
import { Arrow } from '@/components/ui/Arrow';
import { Cover } from '@/components/ui/Cover';
import { Go } from '@/components/ui/Go';
import { InTheOpen } from '@/features/github/InTheOpen';
import { splitFigure } from '@/lib/figure';
import { Inline, InlineLink } from '@/lib/inline';
import type { CaseMeta } from './cases';
import { allCases } from './cases';
import { collectionLd } from './jsonld';
import styles from './work.module.css';

/** How many of the newest projects are shown with room; the rest are the smaller leaves. */
const LARGE = 2;
/** Where along the river town each project's leaf looks (0 west to 100 east): six different corners of one scene. */
const LOOK = [58, 86, 30, 72, 44, 96];

/**
 * Work (/work/): the river town. What he has built, told as projects (the Résumé is the record by date; this page
 * is the stories).
 *
 * The town's inscription stands in its sky. On the paper:
 *   the page's head: the title, and the honesty line beside it;
 *   the thesis, the page's one large line, with his own account of it;
 *   01, the six projects, each on a leaf that opens on a corner of the town: the two newest with room (the figure
 *       in ink with its measure and its basis, the title, the summary, the outcome, the evidence), then the other
 *       four, smaller. A leaf is its case's link;
 *   02, How I build: the brush diagram on a leaf;
 *   03, In the open: his public repositories (features/github, read on the server at build time and daily).
 * A projection is drawn in outline and led by "Projected"; an internal figure says so beside its measure.
 * Words: content/pages/work.ts and content/work/*.mdx.
 */
export async function WorkIndex() {
  const cases = await allCases();
  const { index, build, open } = work;
  return (
    <PageMain page="work" className={styles.work} ld={[collectionLd(cases)]}>
      <Inscription>
        <h1 className="title" id="work-title">
          {work.title}
        </h1>
        <p className="title__under">
          <Inline text={work.intro} />
        </p>
      </Inscription>

      {/* the thesis, and his own account of it */}
      <section className={`row sec ${styles.first}`} aria-labelledby="work-title">
        <p className={`brush ${styles.thesis}`}>
          <Inline text={build.statement} />
        </p>
        <p className={`say ${styles.intro}`}>
          <Inline text={build.line} />
        </p>
      </section>

      {/* 01: the six projects. (Each leaf keeps its case's anchor: /work/#rag-assistant.) */}
      <section className={`row ${styles.projects}`} aria-labelledby="six-title">
        <header className="sec-head">
          <span className="sec-head__n">01</span>
          <h2 className="sec-head__title" id="six-title">
            {index.title}
          </h2>
        </header>
        <ol className={styles.six} role="list">
          {cases.map((c, i) =>
            i < LARGE ? (
              <Large c={c} look={LOOK[i % LOOK.length]!} key={c.slug} />
            ) : (
              <Small c={c} look={LOOK[i % LOOK.length]!} key={c.slug} />
            ),
          )}
        </ol>
      </section>

      <section className={`row sec ${styles.build}`} aria-labelledby="build-title">
        <header className="sec-head">
          <span className="sec-head__n">02</span>
          <h2 className="sec-head__title" id="build-title">
            {build.title}
          </h2>
        </header>
        <div className={`leaf reveal ${styles.buildLeaf}`}>
          <div className="leaf__body">
            <Diagram name={build.diagram.name} caption={build.diagram.caption} steps={build.diagram.steps} />
          </div>
        </div>
      </section>

      <section className={`row sec ${styles.open}`} id="open" aria-labelledby="open-title">
        <header className="sec-head">
          <span className="sec-head__n">03</span>
          <h2 className="sec-head__title" id="open-title">
            {open.title}
          </h2>
        </header>
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
      <span className={c.figure.lead ? `num__lead ${styles.notation}` : 'num__lead'}>{f.lead || ' '}</span>
      {f.value}
    </p>
  );
}

/** One of the two newest: a wide leaf. The scene, then the words at one side and the figure with its measure and
 *  its basis at the other. */
function Large({ c, look }: { c: CaseMeta; look: number }) {
  const { index } = work;
  return (
    <li className={`leaf leaf--link reveal ${styles.large}`} id={c.slug}>
      <Cover scene="work" x={look} zoom={210} ratio="3 / 1" />
      <div className={`leaf__body ${styles.largeBody}`}>
        <div className={styles.largeWords}>
          <ul className="chips" role="list">
            <li className="chip">{c.years}</li>
            <li className="chip">{c.role}</li>
            <li className="chip">{c.org}</li>
          </ul>
          <h3 className="leaf__title">
            <InlineLink href={c.href} className="leaf__to">
              <Inline text={c.title} />
            </InlineLink>
          </h3>
          <p className="soft">
            <Inline text={c.summary} />
          </p>
          <p className="small soft">
            <Inline text={c.outcome} />
          </p>
        </div>
        <div className={styles.largeFig}>
          <Numeral c={c} />
          <p className={`small soft ${styles.measure}`}>
            <Inline text={c.figure.note} />
          </p>
          {c.figure.basis === 'internal' ? <p className="rec">{casePage.basis.internal}</p> : null}
        </div>
        <div className={`leaf__foot ${styles.largeFoot}`}>
          <p className={styles.evidence}>
            {c.evidence.length
              ? c.evidence.map((e) => (
                  <InlineLink key={e.url} href={e.url}>
                    {e.label}
                  </InlineLink>
                ))
              : index.noEvidence}
          </p>
          <span className="leaf__go" aria-hidden="true">
            {index.more}
            <Arrow />
          </span>
        </div>
      </div>
    </li>
  );
}

/** One of the other four: a smaller leaf. The scene, the numeral (decorative: the outcome under it carries the
 *  figure and its measure in words), the title, the outcome, the years and his role. */
function Small({ c, look }: { c: CaseMeta; look: number }) {
  return (
    <li className={`leaf leaf--link reveal ${styles.small}`} id={c.slug}>
      <Cover scene="work" x={look} zoom={300} ratio="7 / 2" />
      <div className="leaf__body">
        <Numeral c={c} className={styles.smallNum} hidden />
        <h3 className={`leaf__title ${styles.smallTitle}`}>
          <InlineLink href={c.href} className="leaf__to">
            <Inline text={c.title} />
          </InlineLink>
        </h3>
        <p className="small soft">
          <Inline text={c.outcome} />
        </p>
        <ul className={`chips ${styles.smallChips}`} role="list">
          <li className="chip">{c.years}</li>
          <li className="chip">{c.role}</li>
        </ul>
      </div>
    </li>
  );
}
