import Image from 'next/image';
import { home } from '@content/pages/home';
import { site } from '@content/site';
import { PageMain } from '@/components/page/PageMain';
import { Glimpse } from '@/components/page/Glimpse';
import { Strip } from '@/components/page/Strip';
import { InkButton } from '@/components/ui/InkButton';
import { Seal } from '@/components/ui/Seal';
import { allNotes } from '@/features/writing/notes';
import { Inline, InlineLink } from '@/lib/inline';
import { longDate, monthYear } from '@/lib/dates';
import { profilePageLd, websiteLd } from '@/lib/jsonld';
import styles from './home.module.css';

/**
 * Home: Jack's "about me" page (SPEC-R4A §10.1, COPY §1). Reading first, then the art. It opens on the painted
 * strip of his mountain with the name and his sentence in its mist (wide screens; below the strip on narrower
 * ones), then his colour photo beside "About me" and the signature, What I work on, Now, Writing and Say hello,
 * and ends on his mountain once more. Every word: content/pages/home.ts.
 */
export async function HomePage() {
  const notes = await allNotes();
  const { hero, about, workOn, now, writing, hello } = home;
  return (
    <PageMain page="home" className={styles.page} ld={[websiteLd(), profilePageLd()]}>
      <Strip variant="home" labelledBy="name">
        <h1 className="name" id="name" data-arrive="name">
          {site.name}
        </h1>
        {hero.lead.map((p) => (
          <p className="lead" key={p}>
            <Inline text={p} />
          </p>
        ))}
        <p className="hero__actions actions">
          <InkButton href={hero.primary.href} arrow>
            {hero.primary.label}
          </InkButton>
          <InlineLink href={hero.secondary.href}>{hero.secondary.label}</InlineLink>
        </p>
      </Strip>

      <section className="hello wide" aria-labelledby="about-title" data-veil="0.88">
        <Image
          className="hello__photo"
          src={about.photo.src}
          width={about.photo.width}
          height={about.photo.height}
          alt={about.photo.alt}
          priority
          unoptimized
        />
        <div className="hello__text">
          <h2 className="sec__title" id="about-title">
            {about.title}
          </h2>
          {about.paragraphs.map((p) => (
            <p key={p}>
              <Inline text={p} />
            </p>
          ))}
          <p className="signoff">
            <span className="signoff__name">{about.signoff}</span>
            <Seal id="seal-carve-sign" sign />
          </p>
        </div>
      </section>

      <Glimpse still="home-0" />
      <section className="sec" aria-labelledby="work-on-title" data-veil="">
        <h2 className="sec__title" id="work-on-title">
          {workOn.title}
        </h2>
        <ul className="rows" role="list">
          {workOn.rows.map((row) => (
            <li className="row ink-row" key={row.href}>
              <h3 className="row__title">
                <InlineLink href={row.href}>{row.title}</InlineLink>
              </h3>
              <p className="row__line">
                <Inline text={row.line} />
              </p>
            </li>
          ))}
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
            <ul className="rows" role="list">
              {notes.slice(0, 3).map((n) => (
                <li className="row ink-row" key={n.slug}>
                  <p className="row__meta small">
                    {n.kind} · <time dateTime={n.published}>{longDate(n.published)}</time>
                  </p>
                  <h3 className="row__title">
                    <InlineLink href={n.href}>{n.title}</InlineLink>
                  </h3>
                  <p className="row__line">{n.description}</p>
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
