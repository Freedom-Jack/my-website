import type { Metadata } from 'next';
import { site } from '@content/site';
import { writing } from '@content/pages/writing';
import type { PageMeta } from '@content/pages/types';
import og from '../../public/og/manifest.json';

/** An absolute URL on the site's canonical origin (content/site.ts `url`). */
export const absolute = (path: string) => new URL(path, `${site.url}/`).toString();

/**
 * The page's link-preview card (public/og/<page>.jpg, cut from the page's own hero by tools/build-og.ts and
 * recorded in its manifest): Home, Work, Writing, the Résumé and Contact each have their own; a case or a note has
 * its own once it is cut, and its section's until then.
 */
export function card(path: string): { url: string; width: number; height: number; alt: string } | null {
  const m = og as { cards: Record<string, { file: string; width: number; height: number; alt: string }> };
  const [section, slug] = path.replace(/^\/|\/$/g, '').split('/');
  const ids = !section ? ['home'] : slug ? [`${section}-${slug}`, section] : [section];
  for (const id of ids) {
    const c = m.cards[id];
    if (c) return { url: `/og/${c.file}`, width: c.width, height: c.height, alt: c.alt };
  }
  return null;
}

/**
 * A page's <head>: title, description, canonical, Open Graph and the Twitter card (COPY.md §8.1), with the page's
 * link-preview image. Titles lead with the exact search phrase "Qijin (Jack) Xu"; og:type is profile on Home,
 * article on a note, website elsewhere.
 */
export function pageMetadata(
  meta: PageMeta,
  path: string,
  {
    type = 'website',
    noindex = false,
    alternates,
  }: { type?: 'website' | 'profile' | 'article'; noindex?: boolean; alternates?: Metadata['alternates'] } = {},
): Metadata {
  const image = card(path);
  // every page advertises the writing's feed (a page's own alternates, the Résumé's PDF and JSON, add to it)
  const types = {
    'application/rss+xml': [{ url: '/writing/feed.xml', title: writing.feed.title }],
    ...alternates?.types,
  };
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: absolute(path), ...alternates, types },
    robots: noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      type,
      siteName: site.name,
      locale: 'en_CA',
      title: meta.title,
      description: meta.description,
      url: absolute(path),
      ...(image ? { images: [{ url: image.url, width: image.width, height: image.height, alt: image.alt }] } : {}),
      ...(type === 'profile'
        ? { firstName: site.givenName, lastName: site.familyName, username: site.links.github.handle }
        : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: meta.title,
      description: meta.description,
      ...(image ? { images: [{ url: image.url, alt: image.alt }] } : {}),
    },
  };
}
