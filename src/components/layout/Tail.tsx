import { site } from '@content/site';
import { Seal } from '@/components/ui/Seal';
import { AskInvite } from '@/features/ask/AskInvite';
import { SCROLL_MAP } from '@/features/landscape/places';
import { build } from '@/lib/build';
import { monthYear } from '@/lib/dates';
import { StillToggle } from './StillToggle';
import { ScrollMap } from './ScrollMap';

/**
 * The tail of the scroll (the footer, on every page): the whole scroll in miniature with the five places' names
 * under it (ScrollMap), then the colophon and the build stamp at the left (lib/build: the short commit and the build
 * day; a measured number only once `check:budgets -- --write` has written content/measured.json), and at the right
 * "Still the landscape", the email and the one seal: the only Chinese character on the site, a path. After an
 * in-site page change the route announcer reads the new page's title (features/navigation).
 */
export function Tail() {
  const lcp = build.lcpMs === null ? null : `${(build.lcpMs / 1000).toFixed(1)} s`;
  return (
    <footer className="tail">
      <div className="tail__map">
        <AskInvite />
        <ScrollMap label={site.tail.names} places={SCROLL_MAP} />
      </div>
      <div className="row tail__base">
        <div className="tail__words">
          <p>{site.tail.colophon}</p>
          <p className="rec tail__stamp">
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
          </p>
          <a href={`mailto:${site.email}`}>{site.email}</a>
          <Seal id="seal-carve-tail" />
        </div>
      </div>
    </footer>
  );
}
