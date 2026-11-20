import type { PageWords } from './types';

/**
 * The Résumé (/resume/): its facts live in content/resume.json (the single source of this page, /resume.pdf,
 * /resume.json and the JSON-LD). This file holds the page's own words.
 */
export const resumePage = {
  meta: {
    title: 'Qijin (Jack) Xu · Résumé',
    description:
      'Résumé of Qijin (Jack) Xu, Lead AI/ML Architect at CGI in Toronto: LLM agents, RAG, data engineering, and cloud. On the web, as a PDF and as JSON.',
  },
  /** The place's name, inscribed in the painting's sky (the nav's own word; the page's h1 is his name). */
  title: 'Résumé',
  /** "Goes by Jack": the letterhead's record line opens with it. */
  goesBy: 'Goes by {name}',
  /** "Updated October 22, 2026": the letterhead's last line, from content/resume.json meta.lastModified. */
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
  /** "GPA 3.9/4.0": the score beside the degree. */
  gpa: 'GPA {score}',
} satisfies PageWords & Record<string, unknown>;
