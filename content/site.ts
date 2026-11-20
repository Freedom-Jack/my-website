import resume from './resume.json' with { type: 'json' };

/**
 * The site's own settings: the address, the nav, the tail's words and "Last changed", and what search engines and AI
 * agents are told about him. The facts themselves (name, title, email, city, profiles) come from content/resume.json,
 * the single source: change them there. How to edit anything: CONTENT.md.
 *
 * Hard rules (CLAUDE.md): no phone number anywhere, no street address (the city only), no project-management
 * credential, the public email is qxjack@gmail.com, and the only Chinese character on the site is the seal's.
 */

const github = resume.basics.profiles.find((p) => p.network === 'GitHub')!;
const linkedin = resume.basics.profiles.find((p) => p.network === 'LinkedIn')!;

export const site = {
  /** The name shown everywhere: "Qijin Xu", never with "(Jack)" in it (CLAUDE.md, hard rules). */
  name: resume.basics.name,
  givenName: 'Qijin',
  familyName: 'Xu',
  /** The name he goes by: the Résumé's "Goes by Jack". */
  goesBy: 'Jack',
  /** Search engines and AI agents only (titles, meta, JSON-LD), never visible text. */
  searchName: 'Qijin (Jack) Xu',
  /** A third-person line about him: Contact prints it ("Bio", for someone who has to introduce him); the Ask reads it. */
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
   * The canonical origin. The custom domain qijinxu.com is parked until launch: at launch this one
   * line changes, and every canonical URL, the JSON-LD, llms.txt, resume.json, the PDF's letterhead and the print
   * name line follow it.
   */
  url: 'https://my-website-freedomjack.vercel.app',

  links: {
    github: { handle: github.username, url: github.url },
    linkedin: { url: linkedin.url },
  },

  /**
   * The header's nav, in the painting's order: the nav, the handscroll and the tail's scroll map
   * (components/layout/ScrollMap) all run Work → Writing → Résumé → Contact, so moving along the nav moves along the
   * painting.
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
   * The way on: every page but Contact and the 404 ends on the next place downstream, by its name
   * (components/page/NextPlace). This word names that link for screen readers.
   */
  ending: { label: 'Downstream' },

  /**
   * The tail of the scroll (the footer on every page; components/layout/Tail): the colophon line (DRAFT, for Jack:
   * its honesty about how the site was made is his to word), the build stamp (the short commit and the date, written
   * at build; a measured number only once `npm run check:budgets -- --write` has filled content/measured.json, with
   * its profile named), "Last changed", Still, the five names, the email and the one seal.
   */
  tail: {
    colophon:
      'Words on paper and one painting, drawn by code. No analytics, nothing fetched from a third party, and nothing you type is sent anywhere.',
    build: 'Build',
    lastChanged: 'Last changed',
    /** the measured number's words: "LCP 1.1 s, Lighthouse mobile, simulated" */
    lcp: 'LCP',
    names: 'All pages',
  },

  /** "Last changed October 2026" in the tail: the month of the last content change. Change it with the words. */
  updated: '2026-10',

  /**
   * The launch gate (CLAUDE.md, hard rules): no "Source code" link and no Work entry for this repository while the
   * public repo still holds the old résumé file. Set to true only after Jack confirms. While it is false,
   * `npm run check:compliance` and `npm run check:links` fail on any link to the repository; the tail has no such
   * link, and github/rules.ts DENY keeps the repository off Work.
   */
  showSourceCode: false,
  sourceCodeUrl: 'https://github.com/Freedom-Jack/my-website',

  /** Person JSON-LD: third person, the same claims as the visible text. */
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
