import type { PageWords } from './types';

/**
 * The Résumé (/resume/): its facts live in content/resume.json (the single source of this page, /resume.pdf,
 * /resume.json and the JSON-LD). This file holds the page's own words (COPY.md §5).
 */
export const resumePage = {
  meta: {
    title: 'Qijin (Jack) Xu · Résumé',
    description:
      'Résumé of Qijin (Jack) Xu, Lead AI/ML Architect at CGI in Toronto: LLM agents, RAG, data engineering, and cloud. On the web, as a PDF and as JSON.',
  },
  /** "Goes by Jack": the contact line's first item. */
  goesBy: 'Goes by {name}',
  /** "Updated October 22, 2026": the line under the letterhead, from content/resume.json meta.lastModified. */
  updated: 'Updated',
  pdf: 'View résumé (PDF)',
  json: 'JSON Resume',
  sections: {
    summary: 'Summary',
    experience: 'Experience',
    skills: 'Skills',
    education: 'Education',
    certifications: 'Awards and certifications',
  },
  present: 'present',
  /**
   * DRAFT (for Jack): the one sentence the page before it ends on ("Downstream · Résumé →"). The counts are
   * content/resume.json's: five roles since the 2019 internship, two CGI Impact Awards, two cloud certifications.
   */
  line: 'DRAFT · Five roles since 2019, two CGI Impact Awards and two cloud certifications: on one page, as a PDF and as JSON.',
} satisfies PageWords & Record<string, unknown>;
