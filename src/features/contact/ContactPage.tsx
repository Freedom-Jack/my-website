import { contact } from '@content/pages/contact';
import { site } from '@content/site';
import { PageMain } from '@/components/page/PageMain';
import { Strip } from '@/components/page/Strip';
import { Inline } from '@/lib/inline';
import { CopyEmail } from './CopyEmail';
import styles from './contact.module.css';

/**
 * Contact (/contact/): the crossing's strip with the title and its one sentence in the mist; then the address,
 * the page's focal point, with "Copy email" beside it; the other ways, one per line; the time zone. A short page:
 * it ends on the footer's story map, no closing scene (DESIGN §11.E answer 8). Words: content/pages/contact.ts.
 */
export function ContactPage() {
  const [user, domain] = site.email.split('@');
  const where = contact.where
    .replace('{city}', site.city)
    .replace('{country}', site.countryName)
    .replace('{timeZone}', site.timeZone);
  return (
    <PageMain page="contact">
      <Strip variant="sub" labelledBy="contact-title">
        <h1 className="page-title" id="contact-title">
          {contact.title}
        </h1>
        <p className="lead">
          <Inline text={contact.intro} />
        </p>
      </Strip>

      <section className={`sec ${styles.contact}`} data-veil="">
        <p className={`small ${styles.contact__label}`}>{contact.emailLabel}</p>
        <div className={styles.contact__mail}>
          <p className={styles.contact__email}>
            <a className="brush" href={`mailto:${site.email}`}>
              {user}@<wbr />
              {domain}
            </a>
          </p>
          <CopyEmail email={site.email} label={contact.copy.label} done={contact.copy.done} />
        </div>
        <svg className="ink-defs" aria-hidden="true" focusable="false">
          {/* the stamp's stone: a chipped edge, and sparse fine specks where the ink did not take */}
          <filter id="stamp-stone" x="-8%" y="-20%" width="116%" height="140%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves={3} seed={21} result="n" />
            <feDisplacementMap
              in="SourceGraphic"
              in2="n"
              scale={3}
              xChannelSelector="R"
              yChannelSelector="G"
              result="d"
            />
            <feTurbulence type="fractalNoise" baseFrequency="0.45" numOctaves={2} seed={8} result="g" />
            <feColorMatrix
              in="g"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -14 10.1"
              result="speck"
            />
            <feComposite in="d" in2="speck" operator="in" />
          </filter>
        </svg>
        <dl className={styles.contact__list}>
          <div className={styles.contact__way}>
            <dt className="small">{contact.ways.github}</dt>
            <dd>
              <a className="brush brush--rest" href={site.links.github.url}>
                {site.links.github.handle}
              </a>
            </dd>
          </div>
          <div className={styles.contact__way}>
            <dt className="small">{contact.ways.linkedin}</dt>
            <dd>
              <a className="brush brush--rest" href={site.links.linkedin.url}>
                {site.name}
              </a>
            </dd>
          </div>
          <div className={styles.contact__way}>
            <dt className="small">{contact.ways.resume}</dt>
            <dd>
              <a className="brush brush--rest" href="/resume.pdf" target="_blank" rel="noopener" type="application/pdf">
                View résumé (PDF)<span className="visually-hidden">, opens in a new tab</span>
              </a>
            </dd>
          </div>
        </dl>
        <p className={`small ${styles.contact__where}`}>{where}</p>
      </section>
    </PageMain>
  );
}
