import { contact } from '@content/pages/contact';
import { resumePage } from '@content/pages/resume';
import { site } from '@content/site';
import { Inscription } from '@/components/page/Inscription';
import { PageMain } from '@/components/page/PageMain';
import { Inline } from '@/lib/inline';
import { CopyEmail } from './CopyEmail';
import { LocalTime } from './LocalTime';
import styles from './contact.module.css';

/**
 * Contact (/contact/): the ferry crossing, the end of the scroll, where the paper is left open for the visitor.
 *
 * The title is inscribed in the crossing's sky, with where he is (and the hour there) under it. Under the mist:
 *   the invitation at the left, and at the right the address, the page's one large line, in the brush, filling its
 *   six columns; "Copy email" under it presses the seal, beside the one line about answering;
 *   the other ways, three across a ruled row;
 *   and, for someone who has to introduce him, his third-person line beside his portrait.
 * Then open paper and the tail: nothing follows Contact. No form.
 * Words: content/pages/contact.ts; the address, the profiles, the city and the bio: content/site.ts.
 */
export function ContactPage() {
  const [whereA, whereB] = contact.where
    .replace('{city}', site.city)
    .replace('{country}', site.countryName)
    .replace('{timeZone}', site.timeZone)
    .split('{time}');
  return (
    <PageMain page="contact" className={styles.contact}>
      <Inscription>
        <h1 className="title" id="contact-title">
          {contact.title}
        </h1>
        <p className={`title__under ${styles.where}`}>
          {whereA}
          <LocalTime zone={site.timeZoneId} text={contact.time} />
          {whereB}
        </p>
      </Inscription>

      {/* the invitation, and the address: the page's one large line */}
      <section className={`row sec sec--first ${styles.first}`} aria-labelledby="contact-title">
        <p className={`lead ${styles.intro}`}>
          <Inline text={contact.intro} />
        </p>
        <div className={`leaf ${styles.mail}`}>
          <p className="label" id="email-label">
            {contact.emailLabel}
          </p>
          <p className={`brush ${styles.address}`}>
            <a href={`mailto:${site.email}`} id="email-address" aria-labelledby="email-label email-address">
              {site.email}
            </a>
          </p>
          <div className={styles.under}>
            <CopyEmail email={site.email} label={contact.copy.label} done={contact.copy.done} />
            <p className={`small soft ${styles.response}`}>{contact.response}</p>
          </div>
        </div>
      </section>

      {/* the other ways: three across a ruled row */}
      <div className={`row sec ${styles.waysRow}`}>
        <dl className={styles.ways}>
          <div className={`leaf leaf--link reveal ${styles.way}`}>
            <dt className="label">{contact.ways.github}</dt>
            <dd className="h-item">
              <a href={site.links.github.url} className="leaf__to">
                {site.links.github.handle}
              </a>
            </dd>
          </div>
          <div className={`leaf leaf--link reveal ${styles.way}`}>
            <dt className="label">{contact.ways.linkedin}</dt>
            <dd className="h-item">
              <a href={site.links.linkedin.url} className="leaf__to">
                {site.name}
              </a>
            </dd>
          </div>
          <div className={`leaf leaf--link reveal ${styles.way}`}>
            <dt className="label">{contact.ways.resume}</dt>
            <dd className="h-item">
              <a href="/resume.pdf" type="application/pdf" className="leaf__to">
                {resumePage.pdf}
              </a>
            </dd>
          </div>
        </dl>
      </div>

      {/* for someone who has to introduce him: his third-person line */}
      <section className={`row sec ${styles.bio}`} aria-labelledby="bio-title">
        <div className="sec__rail">
          <h2 className="label" id="bio-title">
            {contact.bio.label}
          </h2>
        </div>
        <div className={`leaf ${styles.bioLeaf}`}>
          <p className={`say ${styles.bioLine}`}>
            <Inline text={site.bio} />
          </p>
        </div>
      </section>
    </PageMain>
  );
}
