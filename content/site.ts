import resume from './resume.json' with { type: 'json' };

/**
 * The site's own settings: the address, the nav, the footer's "Updated", and what search engines and AI agents
 * are told about him. The facts themselves (name, title, email, city, profiles) come from content/resume.json,
 * the single source: change them there. How to edit anything: CONTENT.md.
 *
 * Hard rules (DESIGN.md §2): no phone number anywhere, no street address (the city only), no project-management credential, the public
 * email is qxjack@gmail.com, and the only Chinese character on the site is the seal's.
 */

const github = resume.basics.profiles.find((p) => p.network === 'GitHub')!;
const linkedin = resume.basics.profiles.find((p) => p.network === 'LinkedIn')!;

export const site = {
  /** The name shown everywhere. "Jack" appears visibly only in the About-me sign-off and "Goes by Jack". */
  name: resume.basics.name,
  givenName: 'Qijin',
  familyName: 'Xu',
  /** The name he goes by: the About-me sign-off ("— Jack") and the Résumé's "Goes by Jack". */
  goesBy: 'Jack',
  /** Search engines and AI agents only (titles, meta, JSON-LD), never visible text. */
  searchName: 'Qijin (Jack) Xu',
  /** The author line under a note and a case (the colophon), third person; the name links home. */
  bio: '[Qijin Xu](/) is a Lead AI/ML Architect at CGI’s AI Center of Excellence in Toronto. He designs and ships production AI for banks and insurers: LLM agents, RAG systems, and data platforms.',
  alternateNames: ['Jack Xu', 'Qijin (Jack) Xu'],
  jobTitle: resume.basics.label,
  email: resume.basics.email,
  city: resume.basics.location.city,
  region: resume.basics.location.region,
  country: resume.basics.location.countryCode,
  countryName: 'Canada',
  timeZone: 'Eastern Time',
  timeZoneId: 'America/Toronto',

  /**
   * The canonical origin. The custom domain qijinxu.com is parked until launch (DESIGN §12): at launch this one
   * line changes, and every canonical URL, the JSON-LD, llms.txt, resume.json, the PDF's letterhead and the print
   * name line follow it.
   */
  url: 'https://my-website-freedomjack.vercel.app',

  links: {
    github: { label: 'GitHub', handle: github.username, url: github.url },
    linkedin: { label: 'LinkedIn', handle: linkedin.username, url: linkedin.url },
  },

  /**
   * The header's nav, in the painting's order (DESIGN §12, round 5): the nav, the handscroll and the footer's
   * story map all run Work → Writing → Résumé → Contact, so moving along the nav moves along the painting.
   */
  nav: [
    { label: 'Work', href: '/work/' },
    { label: 'Writing', href: '/writing/' },
    { label: 'Résumé', href: '/resume/' },
    { label: 'Contact', href: '/contact/' },
  ],

  /** The tail's "Still the landscape": what the control does, for a tooltip and screen readers. */
  stillHint: 'Stops the painting’s motion; remembered on this device.',

  /**
   * The way on (the vanguard round): every page but Contact and the 404 ends on one line pointing downstream, to the
   * next place in the painting's order, with that page's own sentence (components/page/NextPlace). The label is new.
   */
  ending: { label: 'Downstream' },

  /**
   * The tail of the scroll (the footer on every page; components/layout/Tail): the colophon line (DRAFT, for Jack:
   * its honesty about how the site was made is his to word), the build stamp (the short commit and the date, written
   * at build; a measured number only when CI wrote content/measured.json, with its profile named), "Last changed",
   * Still, the five names, the email and the one seal.
   */
  tail: {
    colophon:
      'DRAFT · Words on paper and one painting, drawn by code in your browser. No analytics, nothing fetched from a third party, and nothing you type is sent anywhere.',
    build: 'Build',
    lastChanged: 'Last changed',
    /** the measured number's words: "LCP 1.1 s, Lighthouse mobile, simulated" */
    lcp: 'LCP',
    names: 'All pages',
  },

  /** "Last changed October 2026" in the tail: the month of the last content change. Change it with the words. */
  updated: '2026-10',

  /**
   * The footer's "Source code" link and Work's entry for this repository stay withheld until the public repo no
   * longer holds the old résumé file (DESIGN §2, the launch gate). Set to true only after Jack confirms.
   */
  showSourceCode: false,
  sourceCodeUrl: 'https://github.com/Freedom-Jack/my-website',

  /** Person JSON-LD (COPY.md §8.2): third person, the same claims as the visible text. */
  seo: {
    description:
      'Lead AI/ML Architect at CGI’s AI Center of Excellence in Toronto. Designs and ships production AI for banks and insurers: LLM agents, retrieval-augmented generation (RAG) systems, and the data platforms beneath them.',
    employer: {
      name: 'CGI',
      legalName: 'CGI Inc.',
      url: 'https://www.cgi.com/',
      sameAs: 'https://en.wikipedia.org/wiki/CGI_Inc.',
    },
    university: { sameAs: 'https://en.wikipedia.org/wiki/York_University' },
    occupationSkills:
      'LLM agents, LangGraph, retrieval-augmented generation, vLLM, data engineering, Apache Spark, Kafka, Azure, AWS, GCP',
    knowsAbout: [
      'Artificial intelligence',
      'Machine learning',
      'Large language models',
      'AI agents',
      'LangGraph',
      'Retrieval-augmented generation',
      'Model Context Protocol',
      'vLLM',
      'Computer vision',
      'Data engineering',
      'Data lineage',
      'Apache Spark',
      'Apache Kafka',
      'Microsoft Azure',
      'Amazon Web Services',
      'Google Cloud Platform',
      'Python',
    ],
  },
} as const;

export type Site = typeof site;
