import { home } from '@content/pages/home';
import { site } from '@content/site';
import { Inscription } from '@/components/page/Inscription';
import { PageMain } from '@/components/page/PageMain';
import { Cover } from '@/components/ui/Cover';
import { Seal } from '@/components/ui/Seal';
import { Inline } from '@/lib/inline';
import { monthYear } from '@/lib/dates';
import { profilePageLd, websiteLd } from '@/lib/jsonld';
import styles from './home.module.css';

/** Where along his mountain each of the three leaves looks (0 west to 100 east). */
const LOOK = [62, 84, 22];

/**
 * Home (/): his mountain, the river's source. About him, and short: two things.
 *
 * The first screen is the painting, its inscription in the sky. On the paper:
 *   1  who he is: his name, signed with the seal, his title line, and his own sentence about what he does;
 *   2  Now: what he is leading, then what he is building, what he is exploring and what he does off-hours, each on
 *      a leaf that opens on a corner of his mountain, under the month they were written.
 * Everything else has its own page: the projects are Work, the dates are the Résumé.
 * Every word: content/pages/home.ts.
 */
export function HomePage() {
  const { first, hero, now } = home;
  const leaves = [...now.lines, ...now.held];
  return (
    <PageMain page="home" className={styles.home} ld={[websiteLd(), profilePageLd()]}>
      <Inscription place="home" />

      {/* 1: who he is */}
      <section className={`row ${styles.who}`} aria-labelledby="name">
        <h1 className={`title title--name ${styles.name}`} id="name">
          {site.name}
          <Seal id="seal-carve-name" />
        </h1>
        <p className={`label ${styles.role}`}>{first.title}</p>
        <p className={`brush ${styles.verb}`}>
          <Inline text={first.verb} />
        </p>
      </section>

      {/* 2: Now */}
      {leaves.length ? (
        <section className={`row sec ${styles.now}`} aria-labelledby="now-title">
          <header className="sec-head">
            <h2 className="sec-head__title" id="now-title">
              {now.title}
            </h2>
            <span className="sec-head__note">
              <time dateTime={now.month}>{monthYear(now.month)}</time>
            </span>
          </header>
          <p className={`say ${styles.nowLine}`}>
            <Inline text={hero.lead[1]!} />
          </p>
          <ul className={styles.leaves} role="list">
            {leaves.map((line, i) => (
              <li className="leaf reveal" key={line.label}>
                <Cover scene="home" x={LOOK[i % LOOK.length]!} zoom={230} ratio="16 / 7" />
                <div className="leaf__body">
                  <h3 className="leaf__title">{line.label}</h3>
                  <p className="soft">
                    <Inline text={line.text} />
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </PageMain>
  );
}
