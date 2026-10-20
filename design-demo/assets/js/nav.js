// nav.js — marks where you are, and notices when the header has to stack (very narrow phones).
//
//   import { initNav, markCurrent, norm } from '/assets/js/nav.js';
//   const nav = initNav();      // { update(), destroy() }
//   nav.update();               // after a route change: re-mark the links
//
// - aria-current="page" on the link for this page (the home link, "Qijin Xu", on /; it carries no extra
//   mark: the seal is the mark); aria-current="true" on its section's link (Writing in the footer's story
//   map while reading the Note; the header nav has no Writing, so the Note marks nothing there). A
//   not-found page marks nothing: it is not part of any section, whatever its URL. The brush mark stays
//   under a current nav link (effects.css). The HTML already carries the right values
//   (tools/sync-shared.py); this keeps them right after a route change. markCurrent() is shared with the
//   footer's story map (story-map.js).
// - .site-header.is-stacked while the nav sits on a row of its own under the home link (below 340 px),
//   so CSS can tell the two layouts apart.

let live = null;

/** A path as the site writes it: '/work/' (index.html dropped, trailing slash for folder routes). */
export const norm = (path) => {
  let p = path.replace(/index\.html$/, '');
  if (!p.endsWith('/') && !/\.[a-z0-9]+$/i.test(p)) p += '/';
  return p;
};

/**
 * Mark the link to the current page aria-current="page", the link to its section "true", none on the
 * not-found page. `links`: anchors with same-origin hrefs.
 */
export function markCurrent(links, { here = norm(location.pathname), lost = document.body?.dataset.page === 'not-found' } = {}) {
  for (const a of links) {
    const p = norm(new URL(a.href, location.href).pathname);
    if (lost) a.removeAttribute('aria-current');
    else if (p === here) a.setAttribute('aria-current', 'page');
    else if (p !== '/' && here.startsWith(p)) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  }
}

export function initNav(root = document) {
  const header = root.querySelector('.site-header');
  if (!header) return { update() {}, destroy() {} };
  if (live) return live;

  const home = header.querySelector('.home-link');
  const nav = header.querySelector('.site-nav');
  const check = () => {
    if (home && nav) header.classList.toggle('is-stacked', nav.offsetTop >= home.offsetTop + home.offsetHeight - 1);
  };
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(check) : null;
  ro?.observe(header);

  const update = () => {
    markCurrent(header.querySelectorAll('.site-nav a[href], a.home-link[href]'));
    check();
  };
  update();

  live = {
    update,
    destroy() {
      ro?.disconnect();
      header.classList.remove('is-stacked');
      live = null;
    },
  };
  return live;
}
