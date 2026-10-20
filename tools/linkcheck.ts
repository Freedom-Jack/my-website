/**
 * Every link on the site, from a running server (npm run build && npm start; default http://127.0.0.1:3100):
 * every in-site link answers 200 and every #fragment exists on its page; every outside link is https and on an
 * allowed domain (the evidence, the profiles); every mailto is the public address. Outside links are not fetched
 * (CI must not fail when someone else's site is down).
 *
 *   npm run check:links -- [--base http://127.0.0.1:3100]
 */
import { site } from '../content/site.ts';

const args = process.argv.slice(2);
const i = args.indexOf('--base');
const BASE = i >= 0 ? args[i + 1]! : 'http://127.0.0.1:3100';
const ALLOWED = [
  new URL(site.url).hostname,
  'github.com',
  'www.linkedin.com',
  'www.cgi.com',
  'vectorinstitute.ai',
  'cloud.google.com',
];
const MAIL = 'mailto:qxjack@gmail.com';

const seen = new Map<string, { status: number; ids: Set<string>; links: string[] }>();
const queue = ['/', '/no-such-page/']; // the 404 too: its links must lead somewhere
const queued = new Set(queue);
const problems: string[] = [];

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
      if (url.protocol !== 'https:') problems.push(`${from}: ${href} is not https`);
      else if (!ALLOWED.includes(url.hostname))
        problems.push(`${from}: ${href} (${url.hostname} is not on the allow-list)`);
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

if (problems.length) {
  console.error(`linkcheck: ${problems.length} problem(s)\n  ${[...new Set(problems)].join('\n  ')}`);
  process.exit(1);
}
console.log(`linkcheck: ${seen.size} addresses, every link answers and every outside link is https and allowed`);
