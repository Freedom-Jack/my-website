import type { PageWords } from './types';

/**
 * Home (/): Jack's "about me" page (COPY.md §1; approved by Jack 2026-10-16), with the vanguard round's first screen
 * (`first`, 2026-11-12): the name, the verb line, the title line, one counted proof with its measure, the dated line
 * and one action. The words of the first screen are the approved ones, re-cut; where the cut is new it is marked
 * DRAFT (for Jack). The figures and the years come from the cases' own front matter (content/work/*.mdx), never
 * retyped here.
 * Inline markup in these strings: CONTENT.md ("**bold**", "[link](/path/)", "{kept together}", "{{years}}").
 * The Writing rows come from content/writing/ (newest first); the photo is public/images/qijin-xu-colour.jpg.
 */
export const home = {
  meta: {
    title: 'Qijin (Jack) Xu · Lead AI/ML Architect',
    description:
      'Qijin (Jack) Xu, Lead AI/ML Architect at CGI in Toronto, ships production AI for banks and insurers: LLM agents, RAG, and the data platforms beneath them.',
    /** The last change to Home's words (ProfilePage dateModified). */
    modified: '2026-10-22',
  },

  /** The approved hero sentences (COPY.md §1), kept as the record and for the search data (content/pages/llms.ts). */
  hero: {
    lead: [
      'Lead AI/ML Architect at CGI’s AI Center of Excellence in Toronto. {I design} and ship {production AI} for banks and insurers: {LLM agents,} {retrieval systems,} and the data platforms underneath them.',
      'Right now I’m leading an agent that reads and documents legacy code written in a proprietary language.',
    ],
    primary: { label: 'See the work', href: '/work/' },
    secondary: { label: 'Résumé', href: '/resume/' },
  },

  /**
   * The first screen (the vanguard round, 05-synthesis.md "The first screen"): every word is an approved sentence of
   * this file or a case's front matter, re-ordered; the title line is the one new cut, marked DRAFT where it shows.
   */
  first: {
    /** The approved hero sentence with the title moved after the verb (the lead's ruling 1): his words, this order. */
    verb: '{I design} and ship {production AI} for banks and insurers: {LLM agents,} {retrieval systems,} and the data platforms underneath them.',
    /** DRAFT: the title as a byline (content/resume.json basics.label, the employer, the city). */
    title: 'DRAFT · Lead AI/ML Architect, CGI AI Center of Excellence, Toronto.',
    /**
     * The one counted proof: the approved "What I work on" line (workOn.rows[0].line) split round its figure, which is
     * the case's own (content/work/rag-assistant.mdx `figure`; a unit test keeps the three equal). `case`: the case the
     * measure line links ("2023 to 2024 · the case →"; the years are the case's).
     */
    proof: {
      case: 'rag-assistant',
      measure: 'of questions resolved without a person, for **50,000+** users of an insurance support assistant.',
      more: 'the case',
    },
    /** The dated line: the approved second hero sentence (hero.lead[1]); its measure is the agent case's years. */
    now: { case: 'proprietary-language-agent', inProgress: 'in progress', asOf: 'as of' },
    /** The small words of the measure lines ("2023 to 2024"). */
    to: 'to',
    action: { label: 'See the work', href: '/work/' },
  },

  about: {
    title: 'About me',
    photo: {
      src: '/images/qijin-xu-colour.jpg',
      width: 720,
      height: 900,
      alt: 'Qijin Xu in glasses and a red sweater, head and shoulders',
    },
    paragraphs: [
      'I’ve spent the last {{years}} years putting AI into production at CGI: LLM agents, RAG platforms, and the data systems they stand on. Along the way the work earned two {CGI Impact Awards}, but the part I enjoy most is still the architecture: how the pieces fit, where the system can break, and how you know it works.',
      'I also build for myself. If a tool can make my own work easier, I usually {end up building it}.',
      'Away from the keyboard, I play basketball, play games, and read {wuxia and xianxia novels}.',
    ],
    /**
     * HELD for Jack (P5, 2026-11-13): approved words taken off Home to keep it under 400 words (the vanguard round's
     * budget), kept here word for word for his call. Not shown and not searched.
     */
    held: [
      'I’m optimistic about AI because it isn’t floating on hype. It sits on real foundations, from cloud platforms and chipmakers to industries like manufacturing and finance that are already seeing the gains.',
    ],
  },

  workOn: {
    title: 'What I work on',
    rows: [
      {
        title: 'Assistants that answer from your own knowledge',
        href: '/work/rag-assistant/',
        line: 'About **90%** of questions resolved without a person, for **50,000+** users of an insurance support assistant.',
      },
      {
        title: 'Agents for code nobody documented',
        href: '/work/proprietary-language-agent/',
        line: 'An agent that documents legacy code in a proprietary language and pulls out its business rules, projected to cut manual work by **50%**.',
      },
      {
        title: 'Data platforms AI can stand on',
        href: '/work/insurance-data-platform/',
        line: '**99.9%** uptime on Canada’s largest {auto-insurance} policy-history database, 2 TB on SQL Server.',
      },
    ],
    more: { label: 'All six projects →', href: '/work/' },
  },

  /**
   * "Now": shown only while it has real lines; update the month whenever they change (a unit test fails once the
   * month is more than 90 days old). `held`: the off-hours line, taken off Home with About's (above) for the 400-word
   * budget; About's last paragraph says the same.
   */
  now: {
    title: 'Now',
    month: '2026-10',
    lines: [
      {
        label: 'Building',
        text: 'an agent memory system, and [Logic Foundry](https://github.com/Freedom-Jack/logic-foundry), an agent that turns logic buried in old materials into reusable artifacts (docs for people, rubrics for AI agents, even model weights).',
      },
      { label: 'Exploring', text: 'an AI-powered stock app.' },
    ],
    held: [{ label: 'Off-hours', text: 'basketball, games, and a long xianxia novel.' }],
  },

  writing: {
    title: 'Writing',
    more: { label: 'All writing →', href: '/writing/' },
  },

  hello: {
    title: 'Say hello',
    line: 'For collaborations on production AI, or an invitation to speak or write about agents and retrieval, email me at [qxjack@gmail.com](mailto:qxjack@gmail.com). I’m also on [LinkedIn](https://www.linkedin.com/in/qijin-x-4899671a9/) and [GitHub](https://github.com/Freedom-Jack).',
  },
} satisfies PageWords & Record<string, unknown>;
