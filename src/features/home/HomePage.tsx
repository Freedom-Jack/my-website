import { home } from '@content/pages/home';
import { site } from '@content/site';
import { PageMain } from '@/components/page/PageMain';
import { Glimpse } from '@/components/page/Glimpse';
import { Strip } from '@/components/page/Strip';
import { TextAction } from '@/components/ui/TextAction';
import { Ask } from '@/features/ask/Ask';
import { allCases } from '@/features/work/cases';
import { allNotes } from '@/features/writing/notes';
import { Inline, InlineLink } from '@/lib/inline';
import { longDate, monthYear } from '@/lib/dates';
import { splitFigure } from '@/lib/figure';
import { profilePageLd, websiteLd } from '@/lib/jsonld';
import styles from './home.module.css';

/** "2023 – 2024" read as "2023 to 2024" in a mono measure line (the same years, the case's own). */
const span = (years: string, to: string) => years.replace(' – ', ` ${to} `);

/**
 * Home (/): Jack's "about me" page (COPY §1).
 *
 * The first screen is the live site's (the vanguard round's: the name at a fifth of the screen in his mountain's
 * mist, the verb line, the title line, one counted proof, the dated line, the one action), untouched by round 7.
 *
 * Below it (round 7) the page uses the whole frame, and the words step across the painting as it slides west:
 *   About me, with the portrait, at the left while his mountain still stands at the right, and Now in a cloud of its
 *   own that drifts up across the peaks;
 *   What I work on as three steps down the page, left to right, each with its case's own figure as an ink numeral (a
 *   projection is an outline, never filled: it is not yet real), the mountain showing between the steps;
 *   Ask the painting (features/ask): a real model in the visitor's browser, answering with a line of the site's own;
 *   Writing and Say hello side by side;
 *   and the ending: the next place's name inked into the painting where the river town has come into view.
 * Every word: content/pages/home.ts; every figure and year: the case's front matter (content/work/*.mdx).
 */
export async function HomePage() {
  const [notes, cases] = await Promise.all([allNotes(), allCases()]);
  const { first, hero, about, workOn, now, writing, hello } = home;
  const byHref = (href: string) => cases.find((c) => c.href === href);
  const proofCase = cases.find((c) => c.slug === first.proof.case);
  const nowCase = cases.find((c) => c.slug === first.now.case);
  if (!proofCase || !nowCase)
    throw new Error('content/pages/home.ts: the first screen names a case that does not exist');
  const fig = splitFigure(proofCase.figure);
  return (
    <PageMain page="home" className={styles.page} ld={[websiteLd(), profilePageLd()]}>
      <Strip variant="home" labelledBy="name" still="home" veil={0.9}>
        <h1 className="name" id="name">
          {site.name}
        </h1>
        <p className="first__verb">
          <Inline text={first.verb} />
        </p>
        <p className="first__title">{first.title}</p>
        <div className="first__proof">
          <p className="first__figure">
            <span className="first__fig">
              {fig.lead ? <span className="first__lead">{fig.lead}</span> : null}
              <b className="fig">{fig.value}</b>
            </span>
            <span className="first__measure">
              <Inline text={first.proof.measure} />
            </span>
          </p>
          <p className="first__source mono">
            <InlineLink href={proofCase.href}>
              <span className="first__years">{span(proofCase.years, first.to)}</span>
              <span aria-hidden="true"> · </span>
              <span className="first__link">{first.proof.more} →</span>
            </InlineLink>
          </p>
        </div>
        <div className="first__now">
          <p className="first__line">
            <Inline text={hero.lead[1]!} />
          </p>
          <p className="first__source mono">
            {span(nowCase.years, first.to)}, {first.now.inProgress} · {first.now.asOf}{' '}
            <time dateTime={now.month}>{monthYear(now.month)}</time>
          </p>
        </div>
        <p className="first__action">
          <TextAction href={first.action.href} arrow>
            {first.action.label}
          </TextAction>
        </p>
      </Strip>

      {/* About me and Now: the long read at the left, where no painting stands yet; Now floats in its own cloud at the
          right and drifts up across his mountain */}
      <section className={`part spread ${styles.about}`} aria-labelledby="about-title">
        <div className={styles.aboutMain} data-veil="0.88">
          {/* a plain <img>: the portrait sits with About, after the first screen, never on it; its source comes as the
              reader nears it (data-near: features/landscape/glimpse-stills), so it never joins the first load;
              <noscript> without JS. The frame: the photo is multiplied into its own paper, inside one layer (blended
              against the page itself, the whole page was composited the slow way while the portrait was on screen) */}
          <div className={`hello__frame ${styles.photo}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="hello__photo"
              data-src={about.photo.src}
              data-near=""
              width={about.photo.width}
              height={about.photo.height}
              alt={about.photo.alt}
              loading="lazy"
              decoding="async"
            />
            <noscript>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="hello__photo"
                src={about.photo.src}
                width={about.photo.width}
                height={about.photo.height}
                alt={about.photo.alt}
                decoding="async"
              />
            </noscript>
          </div>
          <div className={styles.aboutText}>
            <h2 className="h-ink" id="about-title">
              {about.title}
            </h2>
            {about.paragraphs.map((p) => (
              <p key={p}>
                <Inline text={p} />
              </p>
            ))}
          </div>
        </div>
        {now.lines.length ? (
          <aside className={styles.now} aria-labelledby="now-title" data-veil="">
            <p className="tag">
              <time dateTime={now.month}>{monthYear(now.month)}</time>
            </p>
            <h2 className="h-ink h-ink--s" id="now-title">
              {now.title}
            </h2>
            <ul className={styles.nowList} role="list">
              {now.lines.map((line) => (
                <li key={line.label}>
                  <b>{line.label}:</b> <Inline text={line.text} />
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </section>

      <Glimpse still="home-0" />
      {/* What I work on: three steps down the page, left to right; each step keeps its own cloud, so his mountain
          shows between them as it crosses the screen */}
      <section className="part" aria-labelledby="work-on-title">
        <div data-veil="">
          <h2 className="h-ink" id="work-on-title">
            {workOn.title}
          </h2>
        </div>
        <ol className={`spread ${styles.steps}`} role="list">
          {workOn.rows.map((row) => {
            // the step's figure is its case's own (the numeral is decorative: the line carries the figure in words).
            // A projection is drawn as an outline under its own label ("Projected"), never as filled ink: it is not
            // yet real (the vanguard round kept it out of the numerals altogether, A1; an outline says the same)
            const c = byHref(row.href);
            const f = c ? splitFigure(c.figure) : null;
            const projected = c?.figure.basis === 'projected';
            return (
              <li className={`${styles.step} ink-row`} key={row.href} data-veil="">
                {f ? (
                  <p className={projected ? `num ${styles.projected}` : 'num'} aria-hidden="true">
                    {f.lead ? <span className="num__lead">{f.lead}</span> : null}
                    {f.value}
                  </p>
                ) : null}
                <h3 className={styles.stepTitle}>
                  <InlineLink href={row.href}>{row.title}</InlineLink>
                </h3>
                <p className={styles.stepLine}>
                  <Inline text={row.line} />
                </p>
              </li>
            );
          })}
        </ol>
        <p className={styles.all} data-veil="">
          <TextAction href={workOn.more.href} arrow>
            {workOn.more.label.replace(/\s*→$/, '')}
          </TextAction>
        </p>
      </section>

      {/* the page's moment: a real model in the visitor's own browser, answering with a line of this site */}
      <Ask />

      <Glimpse phone still="home-1" />
      <section className={`part spread ${styles.last}`}>
        {notes.length ? (
          <div className={styles.writing} data-veil="">
            <h2 className="h-ink" id="writing-title">
              {writing.title}
            </h2>
            <ul className={`ledger ledger--dated ${styles.notes}`} role="list" aria-labelledby="writing-title">
              {notes.slice(0, 3).map((n) => (
                <li className="ledger__row ink-row" key={n.slug}>
                  <p className="ledger__meta mono">
                    {n.kind} · <time dateTime={n.published}>{longDate(n.published)}</time>
                    {n.modified && n.modifiedNote ? (
                      <>
                        {' · '}
                        {n.modifiedNote} <time dateTime={n.modified}>{longDate(n.modified)}</time>
                      </>
                    ) : null}
                  </p>
                  <h3 className="ledger__title">
                    <InlineLink href={n.href}>{n.title}</InlineLink>
                  </h3>
                  <p className="ledger__line">{n.description}</p>
                </li>
              ))}
            </ul>
            {notes.length > 3 ? (
              <p className="more">
                <InlineLink href={writing.more.href}>{writing.more.label}</InlineLink>
              </p>
            ) : null}
          </div>
        ) : null}
        <div className={styles.hello} data-veil="">
          <h2 className="h-ink" id="say-hello-title">
            {hello.title}
          </h2>
          <p className={styles.helloLine}>
            <Inline text={hello.line} />
          </p>
        </div>
      </section>
    </PageMain>
  );
}
