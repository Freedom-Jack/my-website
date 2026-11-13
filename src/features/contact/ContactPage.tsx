import { contact } from '@content/pages/contact';
import { resumePage } from '@content/pages/resume';
import { site } from '@content/site';
import { PageMain } from '@/components/page/PageMain';
import { Strip } from '@/components/page/Strip';
import { Inline } from '@/lib/inline';
import { CopyEmail } from './CopyEmail';
import { LocalTime } from './LocalTime';
import styles from './contact.module.css';

/**
 * Contact (/contact/): the crossing's strip with the title and its one sentence in the mist; then the address,
 * the page's focal point, with "Copy email" beside it ("Copied" said once, plainly); the response line (DRAFT); the other ways, one per line on
 * hairlines, their labels in mono; the time zone with the hour where he is. A short page: it ends on the crossing's
 * closing scene and then on the full tail (no ending line: Contact is the last place).
 * Words: content/pages/contact.ts.
 */
export function ContactPage() {
  const [user, domain] = site.email.split('@');
  const [whereA, whereB] = contact.where
    .replace('{city}', site.city)
    .replace('{country}', site.countryName)
    .replace('{timeZone}', site.timeZone)
    .split('{time}');
  return (
    <PageMain page="contact" glimpseEnd>
      <Strip variant="sub" labelledBy="contact-title" still="contact">
        <h1 className="page-title" id="contact-title">
          {contact.title}
        </h1>
        <p className="lead">
          <Inline text={contact.intro} />
        </p>
      </Strip>

      <section className={`sec ${styles.contact}`} data-veil="">
        <p className={`mono ${styles.contact__label}`}>{contact.emailLabel}</p>
        <div className={styles.contact__mail}>
          <p className={styles.contact__email}>
            <a href={`mailto:${site.email}`}>
              {user}@<wbr />
              {domain}
            </a>
          </p>
          <CopyEmail email={site.email} label={contact.copy.label} done={contact.copy.done} />
        </div>
        <p className={styles.contact__response}>{contact.response}</p>
        <dl className={styles.contact__list}>
          <div className={styles.contact__way}>
            <dt className="mono">{contact.ways.github}</dt>
            <dd>
              <a href={site.links.github.url}>{site.links.github.handle}</a>
            </dd>
          </div>
          <div className={styles.contact__way}>
            <dt className="mono">{contact.ways.linkedin}</dt>
            <dd>
              <a href={site.links.linkedin.url}>{site.name}</a>
            </dd>
          </div>
          <div className={styles.contact__way}>
            <dt className="mono">{contact.ways.resume}</dt>
            <dd>
              <a href="/resume.pdf" target="_blank" rel="noopener" type="application/pdf">
                {resumePage.pdf}
                <span className="visually-hidden">, opens in a new tab</span>
              </a>
            </dd>
          </div>
        </dl>
        <p className={`small ${styles.contact__where}`}>
          {whereA}
          <LocalTime zone={site.timeZoneId} text={contact.time} />
          {whereB}
        </p>
      </section>
    </PageMain>
  );
}
