import type { MetadataRoute } from 'next';
import { home } from '@content/pages/home';
import { allCases } from '@/features/work/cases';
import { allNotes } from '@/features/writing/notes';
import { resume } from '@/features/resume/resume';
import { absolute } from '@/lib/seo';

/** /sitemap.xml (COPY.md §8.9): every page, the PDF and the JSON Resume; never the 404 or the old addresses. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [cases, notes] = await Promise.all([allCases(), allNotes()]);
  const changed = resume.meta.lastModified;
  return [
    { url: absolute('/'), lastModified: home.meta.modified },
    { url: absolute('/work/'), lastModified: changed },
    ...cases.map((c) => ({ url: absolute(c.href), lastModified: changed })),
    { url: absolute('/writing/'), lastModified: notes[0]?.modified ?? notes[0]?.published ?? changed },
    ...notes.map((n) => ({ url: absolute(n.href), lastModified: n.modified ?? n.published })),
    { url: absolute('/resume/'), lastModified: changed },
    { url: absolute('/contact/'), lastModified: changed },
    { url: absolute('/resume.json'), lastModified: changed },
    { url: absolute('/resume.pdf'), lastModified: changed },
  ];
}
