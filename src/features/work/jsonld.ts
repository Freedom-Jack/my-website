import { work } from '@content/pages/work';
import { plain } from '@/lib/markup';
import { personRef, websiteRef } from '@/lib/jsonld';
import { absolute, card } from '@/lib/seo';
import type { CaseMeta } from './cases';

/** A case as schema.org CreativeWork: the same claims as its page (no figure that is not visible there). */
export function creativeWork(c: CaseMeta) {
  const url = absolute(c.href);
  const image = card(c.href);
  // "2023 – 2024" → "2023/2024"; "2025 – present" → "2025/.." (an ISO 8601 interval)
  const [from, to] = c.years.split(' – ');
  return {
    '@type': 'CreativeWork',
    '@id': `${url}#work`,
    url,
    name: plain(c.title),
    description: plain(c.summary),
    creator: personRef,
    publisher: personRef,
    temporalCoverage: `${from}/${to === 'present' ? '..' : to}`,
    keywords: c.role,
    ...(image
      ? { image: { '@type': 'ImageObject', url: absolute(image.url), width: image.width, height: image.height } }
      : {}),
    ...(c.evidence.length ? { citation: c.evidence.map((e) => e.url) } : {}),
  };
}

/** /work/ (COPY.md §8.6): the index as a CollectionPage of the cases. */
export function collectionLd(cases: CaseMeta[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${absolute('/work/')}#page`,
    url: absolute('/work/'),
    name: work.meta.title,
    description: work.meta.description,
    inLanguage: 'en-CA',
    author: personRef,
    about: personRef,
    hasPart: cases.map(creativeWork),
  };
}

/** A case page. */
export function caseLd(c: CaseMeta) {
  return {
    '@context': 'https://schema.org',
    ...creativeWork(c),
    isPartOf: [{ '@id': `${absolute('/work/')}#page` }, websiteRef],
    inLanguage: 'en-CA',
  };
}
