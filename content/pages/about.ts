import type { PageWords } from './types';

/**
 * About (/about/): everything about him that is not a project or a date. His own paragraphs are home.ts's `about`
 * (approved), kept there so the two pages never drift; the facts under "In brief" come from content/resume.json and
 * content/site.ts. NEW WORDS (for Jack) are marked; they wait in NEW-WORDS.md.
 *
 * WAITING FOR JACK: the 5 to 10 things about himself he is happy to publish (places he has been, interests, a line
 * or two). Until they arrive the preview shows where they will stand (`waiting`, QA builds only); the site itself
 * shows nothing in their place.
 */
export const about = {
  meta: {
    /** NEW WORDS (for Jack) */
    title: 'Qijin (Jack) Xu · About',
    /** NEW WORDS (for Jack): only what the page says */
    description:
      'About Qijin (Jack) Xu, Lead AI/ML Architect at CGI in Toronto: what he builds, why he is optimistic about AI, and what he does away from the keyboard.',
  },
  /** NEW WORDS (for Jack): the facts' heading */
  brief: {
    title: 'In brief',
    goesBy: 'Goes by',
    based: 'Based in',
    studied: 'Studied',
    awards: 'Awards',
    certified: 'Certified',
  },
  /** QA builds only: where his own facts will stand */
  waiting: {
    title: 'Waiting for your words',
    lines: ['Places you have been', 'What you care about outside work', 'A line or two about yourself'],
  },
} satisfies PageWords & Record<string, unknown>;
