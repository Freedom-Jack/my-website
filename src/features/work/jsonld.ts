import { work } from '@content/pages/work';
import { plain } from '@/lib/markup';
import { personRef } from '@/lib/jsonld';
import { absolute } from '@/lib/seo';
import type { CaseMeta } from './cases';

/** A case as schema.org CreativeWork: the same claims as its page (no figure that is not visible there). */
export function creativeWork(c: CaseMeta) {
  const url = absolute(c.href);
  return {
    '@type': 'CreativeWork',
    '@id': `${url}#work`,
    url,
    name: plain(c.title),
    description: plain(c.summary),
    creator: personRef,
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
    isPartOf: { '@id': `${absolute('/work/')}#page` },
    inLanguage: 'en-CA',
  };
}
