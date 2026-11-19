import { Fragment } from 'react';
import { resumePage } from '@content/pages/resume';
import { site } from '@content/site';
import { PageMain } from '@/components/page/PageMain';
import { Glimpse } from '@/components/page/Glimpse';
import { Strip } from '@/components/page/Strip';
import { TextAction } from '@/components/ui/TextAction';
import { longDate, monthYear, shortMonthYear } from '@/lib/dates';
import { Inline } from '@/lib/inline';
import { bareUrl, resume } from './resume';
import styles from './resume.module.css';

/**
 * The Résumé (/resume/), rendered from content/resume.json. The first screen: the terraced fields' hero with the name
 * and the title.
 *
 * Below it, on screen: the letterhead (the contact line, "Updated", three actions: the PDF, the JSON, the
 * email) and the summary at the left while the terraces stand at the right; Experience as a timeline the reading
 * draws (a brush line down the roles that runs as far as the reader has read, a mark per role, the years in their
 * own column in mono, the title and the organisation, the points under them); Skills in four columns across the
 * frame; Education beside Awards and certifications; then the ending downstream (Contact).
 * This page's print stylesheet is the PDF (tools/build-pdf.ts prints it), so the page and the PDF never disagree:
 * every screen-only rule is inside `@media screen`, and the document's order and words are the same in both.
 * No phone number, ever: the schema refuses one (features/resume/schema.ts).
 */

function Dates({ start, end }: { start: string; end?: string | undefined }) {
  return (
    <span className="nowrap">
      <time dateTime={start}>{shortMonthYear(start)}</time> –{' '}
      {end ? <time dateTime={end}>{shortMonthYear(end)}</time> : resumePage.present}
    </span>
  );
}

export function ResumePage() {
  const r = resume;
  const t = resumePage;
  const host = new URL(site.url).host;
  const profile = (network: string) => r.basics.profiles.find((p) => p.network === network);
  const github = profile('GitHub');
  const linkedin = profile('LinkedIn');
  return (
    <PageMain page="resume" className={styles.page} printName={false}>
      <article className={styles.cv} aria-labelledby="cv-name">
        <Strip variant="sub" labelledBy="cv-name" still="resume">
          <h1 className="page-title" id="cv-name">
            {r.basics.name}
          </h1>
          <p className="lead">{r.basics.label}</p>
        </Strip>
        <div className={styles['cv-head']} data-veil="0.9">
          {/* The PDF's letterhead prints the name and the title beside the contact details; the hero above is not
              printed, so these two print-only lines carry them (hidden on screen, where the hero has them). */}
          <p className={`page-title ${styles['cv-head__name']}`}>{r.basics.name}</p>
          <p className={`lead ${styles['cv-head__role']}`}>{r.basics.label}</p>
          <p className={`small ${styles['cv-head__contact']}`}>
            {/* No phone number: never on the public résumé or its PDF (CLAUDE.md, hard rules). */}
            <span>{t.goesBy.replace('{name}', site.goesBy)}</span>
            <span>
              {r.basics.location.city}, {r.basics.location.region}, {site.countryName}
            </span>
            <span className={styles['cv-head__site']}>
              {/* the PDF's letterhead only: on screen the address is the third action, below */}
              <a href={`mailto:${r.basics.email}`}>{r.basics.email}</a>
            </span>
            {github ? (
              <span>
                <a href={github.url}>{bareUrl(github.url)}</a>
              </span>
            ) : null}
            {linkedin ? (
              <span>
                <a href={linkedin.url}>{bareUrl(linkedin.url).replace(/^www\./, '')}</a>
              </span>
            ) : null}
            <span className={styles['cv-head__site']}>
              {/* the PDF's letterhead only: on screen the reader is already here */}
              <a href={`${site.url}/`}>{host}</a>
            </span>
          </p>
          <p className={`actions ${styles['cv-head__actions']}`}>
            <TextAction href="/resume.pdf" newTab type="application/pdf">
              {t.pdf}
            </TextAction>
            <a href="/resume.json" type="application/json">
              {t.json}
            </a>
            <a href={`mailto:${r.basics.email}`}>{r.basics.email}</a>
          </p>
          <p className={`small mono ${styles['cv-head__updated']}`}>
            {t.updated}{' '}
            <time dateTime={r.meta.lastModified}>
              {r.meta.lastModified.length === 10 ? longDate(r.meta.lastModified) : monthYear(r.meta.lastModified)}
            </time>
          </p>
        </div>

        <section
          className={`sec ${styles['cv-sec']} ${styles.summary}`}
          aria-labelledby="cv-summary-title"
          data-veil=""
        >
          <h2 className="sec__title h-ink" id="cv-summary-title">
            {t.sections.summary}
          </h2>
          <p>
            <Inline text={r.basics.summary} />
          </p>
        </section>

        <Glimpse still="resume-0" />
        <section className={`sec ${styles['cv-sec']} ${styles.exp}`} aria-labelledby="cv-exp-title" data-veil="">
          <h2 className="sec__title h-ink" id="cv-exp-title">
            {t.sections.experience}
          </h2>
          {/* (the line the reading draws and each role's mark: empty elements, screen only) */}
          <div className={styles.timeline__wrap}>
            <span className={styles.timeline__line} aria-hidden="true" />
            <ol className={styles.timeline} role="list">
              {r.work.map((w) => (
                <li className={styles.timeline__entry} key={`${w.position}-${w.startDate}`}>
                  <span className={styles.timeline__mark} aria-hidden="true" />
                  <h3 className={`sec__sub ${styles.timeline__role}`}>
                    <span className={styles.timeline__years}>
                      <Dates start={w.startDate} end={w.endDate} />
                    </span>
                    <span className={styles.timeline__dot}>{' · '}</span>
                    <span>
                      {w.position}
                      {' · '}
                      <span className={styles.timeline__org}>{w.name}</span>
                    </span>
                  </h3>
                  <ul className={styles.timeline__points} role="list">
                    {w.highlights.map((h) => (
                      <li key={h}>
                        <Inline text={h} />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <Glimpse still="resume-1" />
        <section className={`sec ${styles['cv-sec']} ${styles.skills}`} aria-labelledby="cv-skills-title" data-veil="">
          <h2 className="sec__title h-ink" id="cv-skills-title">
            {t.sections.skills}
          </h2>
          <dl className={styles['cv-skills']}>
            {r.skills.map((s) => (
              <div key={s.name}>
                <dt>{s.name}</dt>
                <dd>{s.keywords.join(', ')}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className={styles.pair}>
          <section className={`sec ${styles['cv-sec']}`} aria-labelledby="cv-edu-title" data-veil="">
            <h2 className="sec__title h-ink h-ink--s" id="cv-edu-title">
              {t.sections.education}
            </h2>
            {r.education.map((e) => (
              <Fragment key={e.institution}>
                <p>
                  <b>{e.institution}</b>
                  {e.location ? `, ${e.location}` : ''}. {e.degree},{' '}
                  <span className="nowrap">
                    <time dateTime={e.startDate.slice(0, 4)}>{e.startDate.slice(0, 4)}</time> –{' '}
                    <time dateTime={e.endDate.slice(0, 4)}>{e.endDate.slice(0, 4)}</time>
                  </span>
                  .
                </p>
                {e.score || e.honors?.length ? (
                  <p className={styles['cv-edu__detail']}>
                    {[e.score ? `GPA ${e.score}` : null, ...(e.honors ?? [])].filter(Boolean).join(' · ')}
                  </p>
                ) : null}
              </Fragment>
            ))}
          </section>

          <section className={`sec ${styles['cv-sec']}`} aria-labelledby="cv-certs-title" data-veil="">
            <h2 className="sec__title h-ink h-ink--s" id="cv-certs-title">
              {t.sections.certifications}
            </h2>
            <ul className={`rows rows--plain ${styles['cv-certs']}`} role="list">
              {r.awards.map((a) => (
                <li key={`${a.title}-${a.date}`}>
                  {a.title} ({a.date.slice(0, 4)}){a.note ? `, ${a.note}` : ''}
                </li>
              ))}
              {r.certificates.map((c) => (
                <li key={c.name}>
                  {c.name} ({c.date.slice(0, 4)})
                </li>
              ))}
            </ul>
          </section>
        </div>

        <footer className={styles['cv-print-foot']}>
          <p>
            {r.basics.name} · {r.basics.email} · {host}/resume/
          </p>
        </footer>
      </article>
    </PageMain>
  );
}
