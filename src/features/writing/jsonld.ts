import { personRef } from '@/lib/jsonld';
import { absolute } from '@/lib/seo';
import type { NoteMeta } from './notes';

/** A note as schema.org BlogPosting (COPY.md §8.5): dateModified follows the byline's "Typos fixed" date. */
export function blogPostingLd(n: NoteMeta) {
  const url = absolute(n.href);
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: n.title,
    description: n.description,
    datePublished: n.published,
    dateModified: n.modified ?? n.published,
    inLanguage: 'en-CA',
    url,
    mainEntityOfPage: url,
    author: personRef,
    keywords: n.keywords,
  };
}
