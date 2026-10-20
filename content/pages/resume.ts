import type { PageWords } from './types';

/**
 * The Résumé (/resume/): its facts live in content/resume.json (the single source of this page, /resume.pdf,
 * /resume.json and the JSON-LD). This file holds the page's own words (COPY.md §5).
 */
export const resumePage = {
  meta: {
    title: 'Qijin (Jack) Xu · Résumé',
    description:
      'Résumé of Qijin (Jack) Xu, Lead AI/ML Architect in Toronto: LLM agents, RAG, data engineering and cloud. On the web, as a PDF and as JSON.',
  },
  /** "Goes by Jack": the contact line's first item. */
  goesBy: 'Goes by {name}',
  pdf: 'View résumé (PDF)',
  json: 'JSON Resume',
  note: 'This page is the current résumé. The PDF is made from this page, and a machine-readable copy is available as JSON Resume.',
  sections: {
    summary: 'Summary',
    experience: 'Experience',
    skills: 'Skills',
    education: 'Education',
    certifications: 'Certifications and awards',
  },
  present: 'Present',
} satisfies PageWords & Record<string, unknown>;
