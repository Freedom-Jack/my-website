import type { Metadata } from 'next';
import { site } from '@content/site';
import type { PageMeta } from '@content/pages/types';

/** An absolute URL on the site's canonical origin (content/site.ts `url`). */
export const absolute = (path: string) => new URL(path, `${site.url}/`).toString();

/**
 * A page's <head>: title, description, canonical, Open Graph (COPY.md §8.1). Titles lead with the exact search
 * phrase "Qijin (Jack) Xu"; og:type is profile on Home, article on a note, website elsewhere.
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
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: absolute(path), ...alternates },
    robots: noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      type,
      siteName: site.name,
      locale: 'en_CA',
      title: meta.title,
      description: meta.description,
      url: absolute(path),
    },
  };
}
