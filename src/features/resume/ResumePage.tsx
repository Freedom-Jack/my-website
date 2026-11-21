import { resumePage } from '@content/pages/resume';
import { site } from '@content/site';
import { Inscription } from '@/components/page/Inscription';
import { PageMain } from '@/components/page/PageMain';
import { Arrow } from '@/components/ui/Arrow';
import { longDate, monthYear, shortMonthYear } from '@/lib/dates';
import { Inline } from '@/lib/inline';
import { bareUrl, resume } from './resume';
import styles from './resume.module.css';

/**
 * The Résumé (/resume/): the terraced fields, his record layer on layer. A plain document, rendered from
 * content/resume.json, ruled row on row.
 *
 * The place's name is inscribed in the painting's sky. Under the mist, the letterhead: his name in the brush (the
 * page's h1), his title, the record line (goes by, the city, the two profiles), and at the right the PDF, the JSON,
 * the email and "Updated". Then Summary (the opening), Experience (five ruled rows: the dates in the left rail,
 * the position, the organisation in its own column, the highlights in two columns), Awards and certifications (one
 * ledger, newest first), Skills (four ruled columns) and Education (one ruled row). Three edges hold every row: the
 * rail, column three and column eight.
 *
 * This page's print stylesheet is the PDF (tools/build-pdf.ts prints it), so the page and the PDF never disagree:
 * the same elements, the same words, in the same order. Two things are printed in place of what only a screen can
 * use: the addresses a reader of paper needs (the email, the site, the profiles' addresses, in the letterhead) and
 * one closing line (the date and where the live copy is).
 * No phone number, ever: the schema refuses one (features/resume/schema.ts).
 */

function Dates({ start, end }: { start: string; end?: string | undefined }) {
  return (
    <>
      <span className="nowrap">
        <time dateTime={start}>{shortMonthYear(start)}</time> –
      </span>{' '}
      <span className="nowrap">{end ? <time dateTime={end}>{shortMonthYear(end)}</time> : resumePage.present}</span>
    </>
  );
}

const year = (iso: string) => iso.slice(0, 4);

export function ResumePage() {
  const r = resume;
  const t = resumePage;
  const host = new URL(site.url).host;
  const updated = (
    <>
      {t.updated}{' '}
      <time dateTime={r.meta.lastModified}>
        {r.meta.lastModified.length === 10 ? longDate(r.meta.lastModified) : monthYear(r.meta.lastModified)}
      </time>
    </>
  );
  // one ledger, newest first: an award says what it was for, a certification who issued it
  const records = [
    ...r.awards.map((a) => ({ year: year(a.date), name: a.title, note: a.note ?? a.awarder })),
    ...r.certificates.map((c) => ({ year: year(c.date), name: c.name, note: c.issuer })),
  ].sort((a, b) => b.year.localeCompare(a.year));

  return (
    <PageMain page="resume" className={styles.page} printName={false}>
      <Inscription>
        <p className="title">{t.title}</p>
      </Inscription>

      <article className={styles.cv} aria-labelledby="cv-name">
        {/* the letterhead: the first row under the mist */}
        <header className={`row sec--first ${styles.head}`}>
          <div className={styles.who}>
            <h1 className={`title title--long ${styles.name}`} id="cv-name">
              {r.basics.name}
            </h1>
            <p className={`lead ${styles.jobTitle}`}>{r.basics.label}</p>
          </div>
          {/* No phone number: never on the public résumé or its PDF (AGENTS.md, hard rules). */}
          <ul className={`rec ${styles.dots} ${styles.facts}`} role="list">
            <li>{t.goesBy.replace('{name}', site.goesBy)}</li>
            <li>
              {r.basics.location.city}, {r.basics.location.region}, {site.countryName}
            </li>
            {/* (paper only: on screen the email stands at the right and the reader is already here) */}
            <li className={styles.inPrint}>
              <a href={`mailto:${r.basics.email}`}>{r.basics.email}</a>
            </li>
            <li className={styles.inPrint}>
              <a href={`${site.url}/`}>{host}</a>
            </li>
            {r.basics.profiles.map((p) => (
              <li className={styles.profile} key={p.network}>
                <a href={p.url}>
                  <span className={styles.onScreen}>{p.network}</span>
                  <span className={styles.inPrint}>{bareUrl(p.url)}</span>
                </a>
              </li>
            ))}
          </ul>
          <div className={styles.side}>
            <a className="btn" href="/resume.pdf">
              {t.pdf}
              <Arrow />
            </a>
            <p className={`small ${styles.also}`}>
              <a href="/resume.json" type="application/json">
                {t.json}
              </a>
              <a href={`mailto:${r.basics.email}`}>{r.basics.email}</a>
            </p>
            <p className="rec">{updated}</p>
          </div>
        </header>

        {/* Summary: the opening */}
        <section className={`row ${styles.sec} ${styles.summary}`} aria-labelledby="cv-summary-title">
          <h2 className={`label ${styles.railLabel}`} id="cv-summary-title">
            {t.sections.summary}
          </h2>
          <p className={`lead ${styles.opening}`}>
            <Inline text={r.basics.summary} />
          </p>
        </section>

        {/* Experience: a ruled row a role, the dates in the rail */}
        <section className={`row ${styles.sec}`} aria-labelledby="cv-exp-title">
          <h2 className={`label ${styles.secLabel}`} id="cv-exp-title">
            {t.sections.experience}
          </h2>
          <ol className={styles.rows} role="list">
            {r.work.map((w) => (
              <li className={`${styles.line} ${styles.role}`} key={`${w.position}-${w.startDate}`}>
                <h3 className={`h-item ${styles.position}`}>{w.position}</h3>
                <p className={`rec ${styles.org}`}>
                  {w.name}
                  {w.location ? ` · ${w.location}` : ''}
                </p>
                <p className={`rec ${styles.when}`}>
                  <Dates start={w.startDate} end={w.endDate} />
                </p>
                <ul className={w.highlights.length > 1 ? `${styles.points} ${styles.pointsTwo}` : styles.points}>
                  {w.highlights.map((h) => (
                    <li key={h}>
                      <Inline text={h} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>

        {/* Awards and certifications: one ledger, newest first */}
        <section className={`row ${styles.sec}`} aria-labelledby="cv-certs-title">
          <h2 className={`label ${styles.secLabel}`} id="cv-certs-title">
            {t.sections.certifications}
          </h2>
          <ul className={styles.rows} role="list">
            {records.map((a) => (
              <li className={`${styles.line} ${styles.record}`} key={`${a.name}-${a.year}`}>
                <p className={`rec ${styles.when}`}>
                  <time dateTime={a.year}>{a.year}</time>
                </p>
                <p className={styles.what}>{a.name}</p>
                <p className={`small soft ${styles.note}`}>{a.note}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Skills: four ruled columns */}
        <section className={`row ${styles.sec}`} aria-labelledby="cv-skills-title">
          <h2 className={`label ${styles.secLabel}`} id="cv-skills-title">
            {t.sections.skills}
          </h2>
          <dl className={styles.skills}>
            {r.skills.map((s) => (
              <div className={styles.skill} key={s.name}>
                <dt className="rec">{s.name}</dt>
                <dd className="small">{s.keywords.join(', ')}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Education: one ruled row */}
        <section className={`row ${styles.sec}`} aria-labelledby="cv-edu-title">
          <h2 className={`label ${styles.secLabel}`} id="cv-edu-title">
            {t.sections.education}
          </h2>
          <ul className={styles.rows} role="list">
            {r.education.map((e) => (
              <li className={`${styles.line} ${styles.school}`} key={e.institution}>
                <h3 className={`h-item ${styles.position}`}>{e.degree}</h3>
                <p className={`rec ${styles.org}`}>
                  {e.institution}
                  {e.location ? ` · ${e.location}` : ''}
                </p>
                <p className={`rec ${styles.when}`}>
                  <span className="nowrap">
                    <time dateTime={year(e.startDate)}>{year(e.startDate)}</time> –{' '}
                    <time dateTime={year(e.endDate)}>{year(e.endDate)}</time>
                  </span>
                </p>
                {e.score || e.honors?.length ? (
                  <ul className={`small soft ${styles.dots} ${styles.note}`} role="list">
                    {e.score ? <li>{t.gpa.replace('{score}', e.score)}</li> : null}
                    {(e.honors ?? []).map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        {/* paper only: the date, and where the live copy is */}
        <footer className={`rec ${styles.foot}`}>
          <p>
            {updated} · {host}/resume/
          </p>
        </footer>
      </article>
    </PageMain>
  );
}
