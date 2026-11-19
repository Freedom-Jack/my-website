import { site } from '@content/site';
import { Seal } from '@/components/ui/Seal';
import { elementOn } from '@/features/landscape/elements';
import { SCROLL_MAP } from '@/features/landscape/places';
import { ScrollOpener } from '@/features/scroll/ScrollOpener';
import { build } from '@/lib/build';
import { monthYear } from '@/lib/dates';
import { StillToggle } from './StillToggle';
import { ScrollMap } from './ScrollMap';

/**
 * The tail of the scroll (the footer, on every page, the 404 included): the whole scroll in miniature (ScrollMap);
 * then, on the page's own twelve columns, the colophon line and the build stamp in mono at the left (lib/build: the
 * short commit and the build day; a measured number only when `check:budgets -- --write` wrote content/measured.json,
 * with its profile named; "Last changed"), and at the right "Still the landscape" (and the scroll's opener where that
 * element is on: features/scroll), the email and the one seal: the only Chinese character on the site, a path. It
 * lies in a bank of mist of its own (plates/veils.ts). After an in-site page change the route announcer reads the new
 * page's title (features/navigation).
 */
export function Tail() {
  const lcp = build.lcpMs === null ? null : `${(build.lcpMs / 1000).toFixed(1)} s`;
  return (
    <footer className="site-footer tail" data-veil="bank">
      <ScrollMap label={site.tail.names} places={SCROLL_MAP} />
      <div className="frame">
        <div className="tail__base spread">
          <div className="tail__words">
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
          </div>
          <div className="tail__side">
            <p className="tail__still">
              <StillToggle />
              {elementOn('scroll') ? (
                <span className="scroll-opener-wrap">
                  {' · '}
                  <ScrollOpener />
                </span>
              ) : null}
            </p>
            <p className="tail__mail">
              <a href={`mailto:${site.email}`}>{site.email}</a>
            </p>
            <Seal id="seal-carve-tail" />
          </div>
        </div>
        <p className="visually-hidden" id="route-announcer" aria-live="polite" aria-atomic="true" />
      </div>
    </footer>
  );
}
