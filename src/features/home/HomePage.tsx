import { home } from '@content/pages/home';
import resume from '@content/resume.json' with { type: 'json' };
import { site } from '@content/site';
import { Inscription } from '@/components/page/Inscription';
import { PageMain } from '@/components/page/PageMain';
import { Go } from '@/components/ui/Go';
import { Seal } from '@/components/ui/Seal';
import { allCases } from '@/features/work/cases';
import { allNotes } from '@/features/writing/notes';
import { Inline, InlineLink } from '@/lib/inline';
import { longDate, monthYear, shortMonthYear } from '@/lib/dates';
import { splitFigure } from '@/lib/figure';
import { profilePageLd, websiteLd } from '@/lib/jsonld';
import styles from './home.module.css';

/** "2023 – 2024" read as "2023 to 2024" in the record's voice (the same years, the case's own). */
const span = (years: string, to: string) => years.replace(' – ', ` ${to} `);

/**
 * Home (/): his mountain, the river's source.
 *
 * The first screen is the painting with his name inscribed in its sky, signed with the seal, and under the mist at
 * its foot the three things a visitor needs at once: what he does (his own sentence), one counted proof with its
 * measure and its case, and what he leads now, with the two awards as a quiet line.
 * Then, as the band stands back and the scroll unrolls toward the river town:
 *   What I work on: three lines of work, each led by its case's own figure (a projection is drawn in outline);
 *   the role he holds now, in the résumé's own words (what he leads, how he knows it works, across how much);
 *   About me, with the portrait, and Now;
 *   Writing and Say hello;
 *   and the way on to Work.
 * Every word: content/pages/home.ts and content/resume.json; every figure and year: the case's front matter.
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
  const role = resume.work[0]!;
  return (
    <PageMain page="home" className={styles.home} ld={[websiteLd(), profilePageLd()]}>
      <Inscription>
        <h1 className={`title title--name ${styles.name}`} id="name">
          {site.name}
          <Seal id="seal-carve-name" />
        </h1>
        <p className="title__under title__under--wide">{first.title}</p>
      </Inscription>

      {/* the first screen's words, under the mist at the painting's foot */}
      <section className={`row sec sec--first ${styles.first}`} aria-labelledby="name">
        <p className={`title__under title__under--narrow ${styles.titleNarrow}`}>{first.title}</p>
        <p className={`lead ${styles.verb}`}>
          <Inline text={first.verb} />
        </p>
        <div className={styles.proof}>
          <p className={`num ${styles.proofNum}`}>
            {fig.lead ? <span className="num__lead">{fig.lead}</span> : null}
            {fig.value}
          </p>
          <p className={`small soft ${styles.proofLine}`}>
            <Inline text={first.proof.measure} />
          </p>
          <p className="rec">
            <InlineLink href={proofCase.href}>
              {span(proofCase.years, first.to)} · {first.proof.more}
            </InlineLink>
          </p>
        </div>
        <div className={styles.nowLine}>
          <p className="label">
            {first.now.asOf} <time dateTime={now.month}>{monthYear(now.month)}</time>
          </p>
          <p className={styles.nowText}>
            <Inline text={hero.lead[1]!} />
          </p>
          <p className="rec">
            {span(nowCase.years, first.to)}, {first.now.inProgress}
          </p>
          <ul className={`rec ${styles.awards}`} role="list">
            {resume.awards.map((a) => (
              <li key={a.date}>
                {a.title} {a.date}, {a.note}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* What I work on: three lines of work across the page, each led by its case's own figure */}
      <section className="row sec" aria-labelledby="work-on-title">
        <div className="sec__rail">
          <h2 className="label" id="work-on-title">
            {workOn.title}
          </h2>
        </div>
        <div className="sec__body">
          <ol className={styles.steps} role="list">
            {workOn.rows.map((row) => {
              // the step's figure is its case's own (the numeral is decorative: the line carries the figure in
              // words). A projection is drawn as an outline under its own label, never as filled ink
              const c = byHref(row.href);
              const f = c ? splitFigure(c.figure) : null;
              const projected = c?.figure.basis === 'projected';
              return (
                <li className={styles.step} key={row.href}>
                  {f ? (
                    <p className={projected ? 'num num--projected' : 'num'} aria-hidden="true">
                      <span className="num__lead">{f.lead || ' '}</span>
                      {f.value}
                    </p>
                  ) : null}
                  <h3 className="h-item">
                    <InlineLink href={row.href}>{row.title}</InlineLink>
                  </h3>
                  <p className="small soft">
                    <Inline text={row.line} />
                  </p>
                </li>
              );
            })}
          </ol>
          <p className={styles.all}>
            <Go href={workOn.more.href}>{workOn.more.label.replace(/\s*→$/, '')}</Go>
          </p>
        </div>
      </section>

      {/* the role he holds now, in the résumé's own words: what he leads, how he knows it works, across how much */}
      <section className="row sec" aria-labelledby="role-title">
        <div className="sec__rail">
          <p className="label">
            <time dateTime={role.startDate}>{shortMonthYear(role.startDate)}</time> – {first.now.inProgress}
          </p>
        </div>
        <div className="sec__body">
          <h2 className={`h-brush ${styles.roleTitle}`} id="role-title">
            {role.position}
          </h2>
          <ul className={styles.role} role="list">
            {role.highlights.map((h) => (
              <li key={h}>
                <p className="small">
                  <Inline text={h} />
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* About me: his own paragraphs, the first as the section's opening, the portrait at the right, and Now */}
      <section className="row sec" aria-labelledby="about-title">
        <div className="sec__rail">
          <h2 className="label" id="about-title">
            {about.title}
          </h2>
        </div>
        <div className={`sec__body ${styles.about}`}>
          <p className={`lead ${styles.aboutSay}`}>
            <Inline text={about.paragraphs[0]!} />
          </p>
          <div className={styles.aboutRest}>
            {about.paragraphs.slice(1).map((p) => (
              <p key={p} className="small soft">
                <Inline text={p} />
              </p>
            ))}
          </div>
          <div className={`portrait ${styles.photo}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- one static JPEG, below the first screen */}
            <img
              src={about.photo.src}
              width={about.photo.width}
              height={about.photo.height}
              alt={about.photo.alt}
              loading="lazy"
              decoding="async"
            />
          </div>
          {now.lines.length ? (
            <aside className={styles.now} aria-labelledby="now-title">
              <h3 className="label" id="now-title">
                {now.title} · <time dateTime={now.month}>{monthYear(now.month)}</time>
              </h3>
              <ul role="list">
                {now.lines.map((line) => (
                  <li key={line.label} className="small soft">
                    <b>{line.label}:</b> <Inline text={line.text} />
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}
        </div>
      </section>

      {/* Writing and Say hello, side by side */}
      <section className="row sec">
        {notes.length ? (
          <>
            <div className="sec__rail">
              <h2 className="label" id="writing-title">
                {writing.title}
              </h2>
            </div>
            <ul className={styles.notes} role="list" aria-labelledby="writing-title">
              {notes.slice(0, 2).map((n) => (
                <li key={n.slug}>
                  <p className="rec">
                    {n.kind} · <time dateTime={n.published}>{longDate(n.published)}</time>
                  </p>
                  <h3 className={`h-brush ${styles.noteTitle}`}>
                    <InlineLink href={n.href}>{n.title}</InlineLink>
                  </h3>
                  <p className="small soft">{n.description}</p>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <div className={styles.hello}>
          <h2 className="label" id="say-hello-title">
            {hello.title}
          </h2>
          <p className="say">
            <Inline text={hello.line} />
          </p>
        </div>
      </section>
    </PageMain>
  );
}
