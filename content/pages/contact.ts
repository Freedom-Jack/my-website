import type { PageWords } from './types';

/**
 * Contact (/contact/): who should write, and about what. Aimed at collaboration and speaking: no
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
  /** DRAFT (for Jack): the one response line under the address. */
  response: 'I read everything and answer within a week.',
  copy: { label: 'Copy email', done: 'Copied' },
  ways: { github: 'GitHub', linkedin: 'LinkedIn', resume: 'Résumé' },
  /**
   * The line under the title: "Based in Toronto, Canada (Eastern Time, 9:41 pm there)."; {time} is the local time,
   * filled in the browser (without JavaScript the line reads without it).
   */
  where: 'Based in {city}, {country} ({timeZone}{time}).',
  /** ", 9:41 there" */
  time: ', {time} there',
  /**
   * NEW WORDS (for Jack): the one label over his third-person line (content/site.ts `bio`) and his portrait, for
   * someone who has to introduce him (an organiser, an editor).
   */
  bio: { label: 'Bio' },
} satisfies PageWords & Record<string, unknown>;
