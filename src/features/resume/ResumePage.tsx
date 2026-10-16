import { Fragment } from 'react';
import { resumePage } from '@content/pages/resume';
import { site } from '@content/site';
import { PageMain } from '@/components/page/PageMain';
import { Strip } from '@/components/page/Strip';
import { InkButton } from '@/components/ui/InkButton';
import { shortMonthYear } from '@/lib/dates';
import { Inline } from '@/lib/inline';
import { bareUrl, resume } from './resume';
import styles from './resume.module.css';

/**
 * The Résumé (/resume/), rendered from content/resume.json. A low doc strip of the terraced fields (art only),
 * then the letterhead on paper and the document as a hanging indent; it ends on the fields once more. This page's
 * print stylesheet IS the PDF (tools/build-pdf.ts prints it), so the page and the PDF never disagree.
 * No phone number, ever: the schema refuses one (features/resume/schema.ts).
 */

// One hand-drawn dry-brush stroke per role, from its year down to the next (decorative; the last role has none).
const STROKES = [
  {
    ink: 'M6.3 0C7.7.6 7.9 3 7.6 9 7.3 26 7.1 47 6.9 65 6.7 81 6.6 92 6.2 100 5.9 92 5.6 81 5.4 65 5.1 47 4.7 26 4.5 9 4.4 3 4.8.5 6.3 0Z',
    dry: 'M7.5 28C7.4 47 7.2 66 6.8 97',
  },
  {
    ink: 'M5.8 0C7.2.7 7.6 3.4 7.4 10 7.1 27 6.6 45 6.6 63 6.6 80 6.9 91 6.4 100 6.1 91 5.7 80 5.3 63 5.1 45 4.4 27 4.3 10 4.2 3.2 4.5.6 5.8 0Z',
    dry: 'M7.3 33C7.1 51 7.3 70 6.9 96',
  },
  {
    ink: 'M6.1 0C7.5.5 7.8 2.8 7.5 8.6 7.2 25 7.4 44 7 62 6.6 80 6.3 91 6 100 5.7 91 5.5 80 5.5 62 5.5 44 4.7 25 4.4 8.6 4.3 2.9 4.7.5 6.1 0Z',
    dry: 'M7.6 30C7.5 49 7.2 67 6.7 95',
  },
  {
    ink: 'M6 0C7.4.6 7.7 3.1 7.5 9.4 7.2 26 6.8 46 6.8 64 6.8 81 6.6 92 6.3 100 6 92 5.6 81 5.4 64 5.3 46 4.6 26 4.4 9.4 4.3 3.1 4.6.6 6 0Z',
    dry: 'M7.4 31C7.4 50 7.1 68 6.8 96',
  },
];

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
      <Strip variant="doc" />
      <article className={styles.cv} aria-labelledby="cv-name">
        <header className={styles['cv-head']} data-veil="0.9">
          <h1 className="page-title" id="cv-name">
            {r.basics.name}
          </h1>
          <p className={`lead ${styles['cv-head__role']}`}>{r.basics.label}</p>
          <p className={`small ${styles['cv-head__contact']}`}>
            {/* No phone number: Jack decided it stays off the public résumé and its PDF. */}
            <span>{t.goesBy.replace('{name}', site.goesBy)}</span>
            <span>
              {r.basics.location.city}, {r.basics.location.region}, {site.countryName}
            </span>
            <span>
              <a className="brush brush--rest" href={`mailto:${r.basics.email}`}>
                {r.basics.email}
              </a>
            </span>
            {github ? (
              <span>
                <a className="brush brush--rest" href={github.url}>
                  {bareUrl(github.url)}
                </a>
              </span>
            ) : null}
            {linkedin ? (
              <span>
                <a className="brush brush--rest" href={linkedin.url}>
                  {bareUrl(linkedin.url).replace(/^www\./, '')}
                </a>
              </span>
            ) : null}
            <span>
              <a className="brush brush--rest" href={`${site.url}/`}>
                {host}
              </a>
            </span>
          </p>
          <p className={`actions ${styles['cv-head__actions']}`}>
            <InkButton href="/resume.pdf" newTab type="application/pdf">
              {t.pdf}
            </InkButton>
            <a className="brush brush--rest" href="/resume.json" type="application/json">
              {t.json}
            </a>
          </p>
          <p className={`small ${styles['cv-head__note']}`}>{t.note}</p>
        </header>

        <section className={`sec ${styles['cv-sec']}`} aria-labelledby="cv-summary-title" data-veil="">
          <h2 className="sec__title" id="cv-summary-title">
            {t.sections.summary}
          </h2>
          <p>
            <Inline text={r.basics.summary} />
          </p>
        </section>

        <section className={`sec ${styles['cv-sec']}`} aria-labelledby="cv-exp-title" data-veil="">
          <h2 className="sec__title" id="cv-exp-title">
            {t.sections.experience}
          </h2>
          <ol className={styles.timeline} role="list">
            {r.work.map((w, i) => {
              const stroke = i < r.work.length - 1 ? STROKES[i % STROKES.length] : null;
              return (
                <li className={styles.timeline__entry} key={`${w.position}-${w.startDate}`}>
                  <span className={`fig ${styles.timeline__year}`} aria-hidden="true">
                    {w.startDate.slice(0, 4)}
                  </span>
                  {stroke ? (
                    <svg
                      className={styles.timeline__stroke}
                      viewBox="0 0 12 100"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path className={styles.timeline__ink} d={stroke.ink} />
                      <path className={styles.timeline__dry} pathLength={100} d={stroke.dry} />
                    </svg>
                  ) : null}
                  <div className={styles.timeline__body}>
                    <h3 className={`sec__sub ${styles.timeline__role}`}>{w.position}</h3>
                    <p className={`small ${styles.timeline__meta}`}>
                      {w.name} · {w.location ? `${w.location} · ` : null}
                      <Dates start={w.startDate} end={w.endDate} />
                    </p>
                    <ul className={styles.timeline__points} role="list">
                      {w.highlights.map((h) => (
                        <li key={h}>
                          <Inline text={h} />
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section className={`sec ${styles['cv-sec']}`} aria-labelledby="cv-skills-title" data-veil="">
          <h2 className="sec__title" id="cv-skills-title">
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

        <section className={`sec ${styles['cv-sec']}`} aria-labelledby="cv-edu-title" data-veil="">
          <h2 className="sec__title" id="cv-edu-title">
            {t.sections.education}
          </h2>
          {r.education.map((e) => (
            <Fragment key={e.institution}>
              <p className={styles['cv-edu']}>
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
          <h2 className="sec__title" id="cv-certs-title">
            {t.sections.certifications}
          </h2>
          <ul className={`rows rows--plain ${styles['cv-certs']}`} role="list">
            {r.certificates.map((c) => (
              <li key={c.name}>
                {c.name} ({c.date.slice(0, 4)})
              </li>
            ))}
            {r.awards.map((a) => (
              <li key={`${a.title}-${a.date}`}>
                {a.title} ({a.date.slice(0, 4)}){a.note ? `, ${a.note}` : ''}
              </li>
            ))}
          </ul>
        </section>

        <footer className={styles['cv-print-foot']}>
          <p>
            {r.basics.name} · {r.basics.email} · {host}/resume/
          </p>
        </footer>
      </article>
    </PageMain>
  );
}
