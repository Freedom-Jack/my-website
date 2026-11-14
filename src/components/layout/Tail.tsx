import { site } from '@content/site';
import { Seal } from '@/components/ui/Seal';
import { STORY_MAP } from '@/features/landscape/places';
import { build } from '@/lib/build';
import { monthYear } from '@/lib/dates';
import { StillToggle } from './StillToggle';
import { TailNames } from './TailNames';

/**
 * The tail of the scroll (the footer, on every page, the 404 included): the colophon line (DRAFT, content/site.ts),
 * the build stamp in mono (the short commit and the day the pages were built, read at build: lib/build; a measured
 * number only when CI wrote content/measured.json, with its profile named), "Last changed", "Still the landscape",
 * the five names in the painting's order (the current one marked: TailNames), the email, and last the one seal: the
 * only red on the page and the only Chinese character on the site, a path. After an in-site page change the route
 * announcer reads the new page's title (features/navigation). On paper; nothing here moves.
 */
export function Tail() {
  const lcp = build.lcpMs === null ? null : `${(build.lcpMs / 1000).toFixed(1)} s`;
  return (
    <footer className="site-footer tail">
      <div className="frame">
        <p className="tail__colophon">{site.tail.colophon}</p>
        {/* The stamp in phrases a phone's column holds: the measured number alone is ~63 characters of mono (530 px,
            wider than a 360 px phone's 328 px column), so only its pairs are kept whole ("LCP 2.5 s", "222 KB", the
            date) and its words wrap. Each kept phrase carries the "·" before it, after a real space that belongs to
            the paragraph (not to the nowrap phrase, which could not break there), so a line breaks between phrases
            in every engine and a "·" never ends one (as the case's basis mark: features/work/CasePage). */}
        <p className="tail__stamp mono">
          <span className="nowrap">
            {site.tail.build} <time dateTime={build.date}>{build.date}</time> · {build.sha}
          </span>
          {lcp ? (
            <>
              {' '}
              <span className="nowrap">
                · {site.tail.lcp} {lcp}
              </span>
              {build.transferKB !== null ? (
                <>
                  {' '}
                  <span className="nowrap">· {build.transferKB} KB</span>
                </>
              ) : null}
              , {build.profile}
              {build.measuredOn ? (
                <>
                  {' '}
                  (<time dateTime={build.measuredOn}>{build.measuredOn}</time>)
                </>
              ) : null}
            </>
          ) : null}{' '}
          <span className="nowrap">
            · {site.tail.lastChanged} <time dateTime={site.updated}>{monthYear(site.updated)}</time>
          </span>
        </p>
        <div className="tail__base">
          <p className="tail__still">
            <StillToggle />
          </p>
          <TailNames label={site.tail.names} places={STORY_MAP} />
          <p className="tail__mail">
            <a href={`mailto:${site.email}`}>{site.email}</a>
          </p>
        </div>
        <p className="tail__seal">
          <Seal id="seal-carve-tail" />
        </p>
        <p className="visually-hidden" id="route-announcer" aria-live="polite" aria-atomic="true" />
      </div>
    </footer>
  );
}
