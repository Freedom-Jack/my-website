import { site } from '@content/site';
import { Seal } from '@/components/ui/Seal';
import { build } from '@/lib/build';
import { monthYear } from '@/lib/dates';
import { StillToggle } from './StillToggle';

/**
 * The tail (the footer, on every page): the scroll's end. The page's last screen is the painting whole again, with
 * the mounting paper and the roller a handscroll ends on at the window's edge (.scroll-end, styles/shell.css), and
 * at its foot the colophon, where a handscroll carries one. Not a second header: the way to every page is the
 * header's. At the left the colophon and the build stamp (lib/build: the short
 * commit and the build day; a measured number only once `check:budgets -- --write` has written
 * content/measured.json); at the right "Still the landscape", the email and the seal that signs the page. After an
 * in-site page change the route announcer reads the new page's title (features/navigation).
 */
export function Tail() {
  const lcp = build.lcpMs === null ? null : `${(build.lcpMs / 1000).toFixed(1)} s`;
  return (
    <footer className="tail">
      <i className="scroll-end" aria-hidden="true" />
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
