import { site } from '@content/site';
import { resume } from '@/features/resume/resume';
import { home } from '@content/pages/home';
import { absolute } from './seo';

/**
 * Structured data (COPY.md §8): honest, the same claims as the visible text, built from content/ only.
 * Person on every page (root layout); WebSite and ProfilePage on Home; CollectionPage on Work; CreativeWork on a
 * case; BlogPosting on a note.
 */

const PERSON = `${site.url}/#person`;
const WEBSITE = `${site.url}/#website`;

export function personLd() {
  const edu = resume.education[0];
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': PERSON,
    name: site.name,
    givenName: site.givenName,
    familyName: site.familyName,
    alternateName: site.alternateNames,
    description: site.seo.description,
    url: `${site.url}/`,
    email: `mailto:${site.email}`,
    image: absolute(home.about.photo.src),
    jobTitle: site.jobTitle,
    worksFor: { '@type': 'Organization', ...site.seo.employer },
    hasOccupation: {
      '@type': 'Occupation',
      name: site.jobTitle,
      occupationLocation: { '@type': 'City', name: site.city },
      skills: site.seo.occupationSkills,
    },
    address: {
      '@type': 'PostalAddress',
      addressLocality: site.city,
      addressRegion: site.region,
      addressCountry: site.country,
    },
    ...(edu
      ? {
          alumniOf: {
            '@type': 'CollegeOrUniversity',
            name: edu.institution,
            url: edu.url,
            sameAs: site.seo.university.sameAs,
          },
        }
      : {}),
    hasCredential: [
      ...resume.education.map((e) => ({
        '@type': 'EducationalOccupationalCredential',
        name: `${e.studyType.replace(/^Bachelor of Science/, 'Bachelor of Science in ' + e.area)}`,
        credentialCategory: 'degree',
        dateCreated: e.endDate.slice(0, 4),
        recognizedBy: { '@type': 'CollegeOrUniversity', name: e.institution, url: e.url },
      })),
      ...resume.certificates.map((c) => ({
        '@type': 'EducationalOccupationalCredential',
        name: c.name,
        credentialCategory: 'certification',
        dateCreated: c.date.slice(0, 4),
        recognizedBy: { '@type': 'Organization', name: c.issuer, url: c.issuerUrl },
        ...(c.url ? { url: c.url } : {}),
      })),
    ],
    award: resume.awards.map((a) => `${a.title} ${a.date.slice(0, 4)}`),
    knowsAbout: site.seo.knowsAbout,
    sameAs: [site.links.github.url, site.links.linkedin.url],
  };
}

export function websiteLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE,
    url: `${site.url}/`,
    name: site.name,
    alternateName: [site.searchName, 'Jack Xu'],
    inLanguage: 'en-CA',
    publisher: { '@id': PERSON },
  };
}

export function profilePageLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': `${site.url}/#page`,
    url: `${site.url}/`,
    name: home.meta.title,
    inLanguage: 'en-CA',
    isPartOf: { '@id': WEBSITE },
    dateModified: home.meta.modified,
    mainEntity: { '@id': PERSON },
  };
}

export const personRef = { '@id': PERSON };
export const websiteRef = { '@id': WEBSITE };

/** A subpage's trail (BreadcrumbList): Home › the section › the page, from the nav's own labels. */
export function breadcrumbLd(trail: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Home', path: '/' }, ...trail].map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: absolute(t.path),
    })),
  };
}

/** <script type="application/ld+json">; "<" is escaped so no string can close the script. */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
