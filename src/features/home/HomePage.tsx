import { home } from '@content/pages/home';
import { site } from '@content/site';
import { PageMain } from '@/components/page/PageMain';
import { Glimpse } from '@/components/page/Glimpse';
import { Strip } from '@/components/page/Strip';
import { TextAction } from '@/components/ui/TextAction';
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
 * Home (/): Jack's "about me" page (COPY §1) with the vanguard round's first screen (05-synthesis.md): the name at a
 * fifth of the screen in his mountain's mist, the verb line, the title line, one counted proof (the case's figure as
 * a poster numeral beside its measure, then its years and "the case →"), the dated line with its measure, and the
 * one action. The painting is the pre-cut still from the first paint, the live painting fading in beneath it. Then,
 * on paper: About (the portrait, lazy), What I work on as ledger rows with the cases' own figures (never a
 * projection's), Now (dated), Writing rows built for three (kind · written · last tended, the note's own words), Say
 * hello, and the ending downstream (Work). Under 400 words in all (content/pages/home.ts `held`). Every word: content/pages/home.ts; every figure and
 * year: the case's front matter (content/work/*.mdx).
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

      <section className="hello wide" aria-labelledby="about-title" data-veil="0.88">
        {/* a plain <img>: the portrait sits with About, after the first screen, never on it (next/image would
            re-encode it and costs a client chunk and a request on the first load); its source comes as the reader nears
            it (data-near: features/landscape/glimpse-stills), so it never joins the first load; <noscript> without JS */}
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
        <div className="hello__text">
          <h2 className="sec__title" id="about-title">
            {about.title}
          </h2>
          {about.paragraphs.map((p) => (
            <p key={p}>
              <Inline text={p} />
            </p>
          ))}
        </div>
      </section>

      <Glimpse still="home-0" />
      <section className="sec" aria-labelledby="work-on-title" data-veil="">
        <h2 className="sec__title" id="work-on-title">
          {workOn.title}
        </h2>
        <ul className="ledger" role="list">
          {workOn.rows.map((row) => {
            // the row's figure is its case's own (the numeral is decorative: the line carries the figure in words); a
            // projection is never a numeral, it stays in the line with the word "projected" (A1)
            const c = byHref(row.href);
            const f = c && c.figure.basis !== 'projected' ? splitFigure(c.figure) : null;
            return (
              <li className="ledger__row ink-row" key={row.href}>
                {f ? (
                  <p className="ledger__figure" aria-hidden="true">
                    {f.lead ? <span className="ledger__figure-lead">{f.lead}</span> : null}
                    {f.value}
                  </p>
                ) : null}
                <h3 className="ledger__title">
                  <InlineLink href={row.href}>{row.title}</InlineLink>
                </h3>
                <p className="ledger__line">
                  <Inline text={row.line} />
                </p>
              </li>
            );
          })}
        </ul>
        <p className="more">
          <InlineLink href={workOn.more.href}>{workOn.more.label}</InlineLink>
        </p>
      </section>

      {now.lines.length ? (
        <section className="sec now" aria-labelledby="now-title" data-veil="">
          <h2 className="sec__title" id="now-title">
            {now.title}
            <span className="sec__date small">
              · <time dateTime={now.month}>{monthYear(now.month)}</time>
            </span>
          </h2>
          <ul className="rows rows--plain" role="list">
            {now.lines.map((line) => (
              <li key={line.label}>
                <b>{line.label}:</b> <Inline text={line.text} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {notes.length ? (
        <>
          <Glimpse phone still="home-1" />
          <section className="sec" aria-labelledby="writing-title" data-veil="">
            <h2 className="sec__title" id="writing-title">
              {writing.title}
            </h2>
            <ul className="ledger ledger--dated" role="list">
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
          </section>
        </>
      ) : null}

      <section className="sec" aria-labelledby="say-hello-title" data-veil="">
        <h2 className="sec__title" id="say-hello-title">
          {hello.title}
        </h2>
        <p>
          <Inline text={hello.line} />
        </p>
      </section>
    </PageMain>
  );
}
