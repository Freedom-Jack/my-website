import { about } from '@content/pages/about';
import { home } from '@content/pages/home';
import resume from '@content/resume.json' with { type: 'json' };
import { site } from '@content/site';
import { Inscription } from '@/components/page/Inscription';
import { PageMain } from '@/components/page/PageMain';
import { Inline } from '@/lib/inline';
import styles from './about.module.css';

/**
 * About (/about/): inside his mountain, at the hut on the ridge. Everything about him that is not a project or a
 * date (those are Work and the Résumé).
 *
 * On the paper: the page's head (the title, his title line); his own account of himself, its first paragraph as the
 * page's large line and the rest beside it; and 01, In brief: a handful of facts, each on a small leaf.
 * Words: content/pages/home.ts `about` (his approved paragraphs), content/pages/about.ts, content/resume.json.
 */
export function AboutPage() {
  const { paragraphs, title } = home.about;
  const school = resume.education[0]!;
  const facts: [string, string][] = [
    [about.brief.goesBy, site.goesBy],
    [about.brief.based, `${site.city}, ${site.region}, ${site.countryName}`],
    [about.brief.studied, `${school.degree}, ${school.institution}`],
    [about.brief.awards, resume.awards.map((a) => `${a.title} ${a.date}`).join(' · ')],
    [about.brief.certified, resume.certificates.map((c) => c.name).join(' · ')],
  ];
  return (
    <PageMain page="about" className={styles.about}>
      <Inscription>
        <h1 className="title" id="about-title">
          {title}
        </h1>
        <p className="title__under">{home.first.title}</p>
      </Inscription>

      <section className={`row sec ${styles.story}`} aria-labelledby="about-title">
        <p className={`brush ${styles.lead}`}>
          <Inline text={paragraphs[0]!} />
        </p>
        <div className={styles.rest}>
          {paragraphs.slice(1).map((p) => (
            <p key={p} className="say">
              <Inline text={p} />
            </p>
          ))}
        </div>
      </section>

      <section className={`row sec ${styles.brief}`} aria-labelledby="brief-title">
        <header className="sec-head">
          <span className="sec-head__n">01</span>
          <h2 className="sec-head__title" id="brief-title">
            {about.brief.title}
          </h2>
        </header>
        <dl className={styles.facts}>
          {facts.map(([k, v]) => (
            <div className={`leaf reveal ${styles.fact}`} key={k}>
              <dt className="label">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
          {process.env.NEXT_PUBLIC_INK_QA === '1' ? (
            <div className={`leaf ${styles.fact} ${styles.waiting}`}>
              <dt className="label">{about.waiting.title}</dt>
              <dd>
                <ul role="list">
                  {about.waiting.lines.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
        </dl>
      </section>
    </PageMain>
  );
}
