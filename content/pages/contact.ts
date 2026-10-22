import type { PageWords } from './types';

/**
 * Contact (/contact/): who should write, and about what (COPY.md §6). Aimed at collaboration and speaking: no
 * "hiring" language (his employer can read the site). No form. The address, profiles and city come from
 * content/resume.json (through content/site.ts).
 */
export const contact = {
  meta: {
    title: 'Qijin (Jack) Xu · Contact',
    description:
      'Write to Qijin (Jack) Xu, Lead AI/ML Architect at CGI in Toronto, about collaborations on production AI or invitations to speak: qxjack@gmail.com.',
  },
  title: 'Contact',
  intro:
    'I’m always glad to hear about collaborations on production AI, and invitations to speak or write about agents, retrieval, and AI architecture.',
  emailLabel: 'Email',
  copy: { label: 'Copy email', done: 'Copied' },
  ways: { github: 'GitHub', linkedin: 'LinkedIn', resume: 'Résumé' },
  /** "Based in Toronto, Canada (Eastern Time, 9:41 there).": {time} is the local time, filled in the browser. */
  where: 'Based in {city}, {country} ({timeZone}{time}).',
  /** ", 9:41 there" */
  time: ', {time} there',
} satisfies PageWords & Record<string, unknown>;
