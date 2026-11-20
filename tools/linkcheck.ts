/**
 * Every link on the site, from a running server (npm run build && npm start -- -p 3100; default http://127.0.0.1:3100):
 *   - every in-site link answers 200 and every #fragment exists on its page;
 *   - every outside link is https and on an allowed domain (the evidence, the profiles);
 *   - every mailto is the public address, and there is no tel: link;
 *   - no link leads to this site's own repository while content/site.ts showSourceCode is false (the launch gate:
 *     github.com is an allowed domain, so this is its own rule);
 *   - the addresses the machine-readable routes name (/sitemap.xml, /llms.txt, /writing/feed.xml) keep the same
 *     rules: the site's own answer 200, the others are https, allowed, and not the repository.
 * Pages are crawled from / and from the 404. Outside links are not fetched (CI must not fail when someone else's
 * site is down).
 *
 *   npm run check:links -- [--base http://127.0.0.1:3100]
 */
import { site } from '../content/site.ts';
import { repositoryPattern } from '../src/lib/compliance.ts';
import { opt } from './lib.ts';

const BASE = opt('--base', 'http://127.0.0.1:3100');
const SITE_HOST = new URL(site.url).hostname;
const ALLOWED = [SITE_HOST, 'github.com', 'www.linkedin.com', 'www.cgi.com', 'vectorinstitute.ai', 'cloud.google.com'];
const MAIL = `mailto:${site.email}`;
const REPO = site.showSourceCode ? null : repositoryPattern(site.sourceCodeUrl);
/** Routes for machines: every address they name is checked like a link. */
const LISTS = ['/sitemap.xml', '/llms.txt', '/writing/feed.xml'];

const seen = new Map<string, { status: number; ids: Set<string>; links: string[] }>();
const queue = ['/', '/no-such-page/']; // the 404 too: its links must lead somewhere
const queued = new Set(queue);
const problems: string[] = [];
let outside = 0;

const hrefsOf = (html: string) =>
  [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map((m) => m[1]!.replace(/&amp;/g, '&'));
const idsOf = (html: string) => new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]!));

async function load(pathname: string) {
  if (seen.has(pathname)) return seen.get(pathname)!;
  const res = await fetch(new URL(pathname, BASE), { redirect: 'manual' });
  const type = res.headers.get('content-type') || '';
  const html = type.includes('text/html') ? await res.text() : '';
  const page = { status: res.status, ids: idsOf(html), links: hrefsOf(html) };
  seen.set(pathname, page);
  return page;
}

/** An address off this site: https, on the allow-list, and never the site's own repository. */
function outsideLink(from: string, href: string, url: URL) {
  outside += 1;
  if (url.protocol !== 'https:') problems.push(`${from}: ${href} is not https`);
  else if (!ALLOWED.includes(url.hostname))
    problems.push(`${from}: ${href} (${url.hostname} is not on the allow-list)`);
  if (REPO?.test(href))
    problems.push(`${from}: ${href} leads to this site's repository while content/site.ts showSourceCode is false`);
}

while (queue.length) {
  const from = queue.shift()!;
  const page = await load(from);
  for (const href of page.links) {
    if (href.startsWith('mailto:')) {
      if (href !== MAIL) problems.push(`${from}: mailto ${href} (only ${MAIL})`);
      continue;
    }
    if (href.startsWith('tel:')) {
      problems.push(`${from}: a tel: link`);
      continue;
    }
    const url = new URL(href, new URL(from, BASE));
    if (url.origin !== new URL(BASE).origin) {
      outsideLink(from, href, url);
      continue;
    }
    const target = await load(url.pathname);
    // (a fragment on the page itself, like the skip link, is checked against the page whatever its status)
    if (target.status !== 200 && url.pathname !== from)
      problems.push(`${from}: ${url.pathname} answers ${target.status}`);
    if (url.hash && !target.ids.has(decodeURIComponent(url.hash.slice(1))))
      problems.push(`${from}: ${url.pathname}${url.hash} has no such anchor`);
    // follow it if it is a page (not a file) not seen yet
    if (target.status === 200 && !/\.[a-z0-9]+$/i.test(url.pathname) && !queued.has(url.pathname)) {
      queued.add(url.pathname);
      queue.push(url.pathname);
    }
  }
}

// the routes for machines: the addresses they name
let listed = 0;
for (const list of LISTS) {
  const res = await fetch(new URL(list, BASE));
  if (!res.ok) {
    problems.push(`${list} answers ${res.status}`);
    continue;
  }
  const text = (await res.text()).replace(/&amp;/g, '&');
  if (/\btel:/i.test(text)) problems.push(`${list}: a tel: link`);
  for (const m of new Set(text.match(/https?:\/\/[^\s<>"')\]]+/g) ?? [])) {
    const url = new URL(m);
    if (/(^|\.)w3\.org$|(^|\.)sitemaps\.org$/.test(url.hostname)) continue; // an XML namespace, not a link
    listed += 1;
    if (url.hostname !== SITE_HOST) {
      outsideLink(list, m, url);
      continue;
    }
    if (url.protocol !== 'https:') problems.push(`${list}: ${m} is not https`);
    const target = await load(url.pathname);
    if (target.status !== 200) problems.push(`${list}: ${url.pathname} answers ${target.status}`);
  }
}

if (problems.length) {
  console.error(`linkcheck: ${problems.length} problem(s)\n  ${[...new Set(problems)].join('\n  ')}`);
  process.exit(1);
}
console.log(
  `linkcheck: ${seen.size} addresses on the site and ${outside} outside links (${listed} addresses named by ${LISTS.join(', ')}): ` +
    `every link answers, every anchor exists, every outside link is https and allowed` +
    (REPO ? ', none leads to the repository' : ''),
);
