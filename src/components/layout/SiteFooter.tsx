import { site } from '@content/site';
import { monthYear } from '@/lib/dates';
import { StillToggle } from './StillToggle';
import { StoryMap } from './StoryMap';

/**
 * The footer, on paper: the story map of the whole painting (each place links to its page), then
 * "© 2026 Qijin Xu · Toronto" with Email · LinkedIn · GitHub · View résumé (PDF), then
 * "Updated October 2026 · Still the landscape". After an in-site page change the route announcer reads the
 * new page's title (features/navigation).
 */
export function SiteFooter() {
  const year = site.updated.slice(0, 4);
  return (
    <footer className="site-footer">
      <div className="frame">
        <StoryMap />
        <div className="site-footer__base">
          <div className="site-footer__line">
            <p className="site-footer__copy">
              <span className="nowrap">
                © {year} {site.name} · {site.city}
              </span>
            </p>
            <ul className="site-footer__links" role="list">
              <li>
                <a className="brush" href={`mailto:${site.email}`}>
                  Email
                </a>
              </li>
              <li>
                <a className="brush" href={site.links.linkedin.url}>
                  {site.links.linkedin.label}
                </a>
              </li>
              <li>
                <a className="brush" href={site.links.github.url}>
                  {site.links.github.label}
                </a>
              </li>
              {site.showSourceCode ? (
                <li>
                  <a className="brush" href={site.sourceCodeUrl}>
                    Source code
                  </a>
                </li>
              ) : null}
              <li>
                <a className="brush" href="/resume.pdf" target="_blank" rel="noopener" type="application/pdf">
                  View résumé (PDF)<span className="visually-hidden">, opens in a new tab</span>
                </a>
              </li>
            </ul>
          </div>
          <p className="site-footer__updated">
            Updated <time dateTime={site.updated}>{monthYear(site.updated)}</time>
            <span className="still">
              {' · '}
              <StillToggle />
            </span>
          </p>
        </div>
        <p className="visually-hidden" id="route-announcer" aria-live="polite" aria-atomic="true" />
      </div>
    </footer>
  );
}
