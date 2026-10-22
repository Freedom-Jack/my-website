import raw from '@content/resume.json';
import { site } from '@content/site';
import { plain } from '@/lib/markup';
import { typeset } from '@/lib/typography';
import { resumeSchema, type Resume } from './schema';

/** content/resume.json, validated (a bad edit fails the build here, and in CI's content check). */
export const resume: Resume = resumeSchema.parse(raw);

/** A web address as the résumé writes it: no scheme, no www, no trailing slash ("github.com/Freedom-Jack"). */
export const bareUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

interface Publication {
  name: string;
  releaseDate: string;
  url: string;
}

/**
 * The public JSON Resume (/resume.json): the schema's own fields only, plain text, the site's address, the
 * notes as publications. No phone, no address (the schema check refuses them in the source).
 */
export function publicResume(publications: Publication[]) {
  const r = resume;
  const text = (s: string) => typeset(plain(s)).replace(/\u00A0/g, ' ');
  return {
    $schema: r.$schema,
    basics: {
      name: r.basics.name,
      label: r.basics.label,
      email: r.basics.email,
      url: `${site.url}/`,
      summary: text(r.basics.summary),
      location: r.basics.location,
      profiles: r.basics.profiles,
    },
    work: r.work.map((w) => ({
      name: w.name,
      ...(w.location ? { location: w.location } : {}),
      ...(w.url ? { url: w.url } : {}),
      position: w.position,
      startDate: w.startDate,
      ...(w.endDate ? { endDate: w.endDate } : {}),
      highlights: w.highlights.map(text),
    })),
    education: r.education.map((e) => ({
      institution: e.institution,
      ...(e.url ? { url: e.url } : {}),
      area: e.area,
      studyType: e.studyType,
      startDate: e.startDate,
      endDate: e.endDate,
      ...(e.score ? { score: e.score } : {}),
    })),
    awards: [
      ...r.awards.map((a) => ({
        title: a.title,
        date: a.date,
        awarder: a.awarder,
        ...(a.summary ? { summary: a.summary } : {}),
      })),
      // an education honour (the page shows it under Education; the schema has no such field, so it is an award here)
      ...r.education.flatMap((e) =>
        (e.honors ?? []).map((h) => ({ title: h, date: e.endDate.slice(0, 4), awarder: e.institution })),
      ),
    ],
    certificates: r.certificates.map((c) => ({
      name: c.name,
      date: c.date,
      issuer: c.issuer,
      ...(c.url ? { url: c.url } : {}),
    })),
    publications: publications.map((p) => ({
      name: p.name,
      publisher: `Personal site of ${site.name}`,
      releaseDate: p.releaseDate,
      url: p.url,
    })),
    skills: r.skills,
    meta: { canonical: `${site.url}/resume.json`, version: r.meta.version, lastModified: r.meta.lastModified },
  };
}
