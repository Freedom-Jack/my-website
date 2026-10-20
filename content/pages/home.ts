import type { PageWords } from './types';

/**
 * Home (/): Jack's "about me" page (COPY.md §1; approved by Jack 2026-10-16).
 * Inline markup in these strings: CONTENT.md ("**bold**", "[link](/path/)", "{kept together}", "{{years}}").
 * The Writing rows come from content/writing/ (newest first); the photo is public/images/qijin-xu-colour.jpg.
 */
export const home = {
  meta: {
    title: 'Qijin (Jack) Xu · Lead AI/ML Architect',
    description:
      'Qijin (Jack) Xu is a Lead AI/ML Architect at CGI’s AI Center of Excellence in Toronto. He designs and ships production AI: LLM agents, RAG and data platforms.',
    /** The last change to Home's words (ProfilePage dateModified). */
    modified: '2026-10-10',
  },

  hero: {
    lead: [
      'Lead AI/ML Architect at CGI’s AI Center of Excellence in Toronto. {I design} and ship {production AI} for banks and insurers: {LLM agents,} {retrieval systems,} and the data platforms underneath them.',
      'Right now I’m leading an agent that reads and documents legacy code written in a proprietary language.',
    ],
    primary: { label: 'See the work', href: '/work/' },
    secondary: { label: 'Résumé', href: '/resume/' },
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
      'I’ve spent the last {{years}} years putting AI into production at CGI: LLM agents, RAG platforms, and the data systems they stand on. Along the way the work earned two CGI Impact Awards, but the part I enjoy most is still the architecture: how the pieces fit, where the system can break, and how you know it works.',
      'I’m optimistic about AI because it isn’t floating on hype. It sits on real foundations, from cloud platforms and chipmakers to industries like manufacturing and finance that are already seeing the gains.',
      'I also build for myself. If a tool can make my own work easier, I usually end up building it.',
      'Away from the keyboard, I play basketball, play games, and read wuxia and xianxia novels.',
    ],
    /** The painter's signature: the em dash, a space, then the name he goes by. */
    signoff: '— Jack',
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
        line: 'An agent that documents legacy code in a proprietary language and pulls out its business rules: a projected **50%** less manual work.',
      },
      {
        title: 'Data platforms AI can stand on',
        href: '/work/insurance-data-platform/',
        line: '**99.9%** uptime on Canada’s largest auto-insurance policy-history database, 2 TB on SQL Server.',
      },
    ],
    more: { label: 'All six projects →', href: '/work/' },
  },

  /** "Now": shown only while it has real lines; update the month whenever they change. */
  now: {
    title: 'Now',
    month: '2026-10',
    lines: [
      {
        label: 'Building',
        text: 'an agent memory system, and Logic Foundry, an agent that turns logic buried in old materials into reusable artifacts: docs for people, rubrics for AI agents, even model weights.',
      },
      { label: 'Exploring', text: 'an AI-powered stock app.' },
      { label: 'Off-hours', text: 'basketball, games, and a long xianxia novel.' },
    ],
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
