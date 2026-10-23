import { personRef, websiteRef } from '@/lib/jsonld';
import { absolute, card } from '@/lib/seo';
import type { NoteMeta } from './notes';

/** A note as schema.org BlogPosting (COPY.md §8.5): dateModified follows the byline's "Updated" date; its image is
 *  its link-preview card. */
export function blogPostingLd(n: NoteMeta) {
  const url = absolute(n.href);
  const image = card(n.href);
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
    publisher: personRef,
    isPartOf: websiteRef,
    ...(image
      ? { image: { '@type': 'ImageObject', url: absolute(image.url), width: image.width, height: image.height } }
      : {}),
    keywords: n.keywords,
  };
}
