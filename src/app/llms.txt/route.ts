import { home } from '@content/pages/home';
import { llms } from '@content/pages/llms';
import { site } from '@content/site';
import { allCases } from '@/features/work/cases';
import { monthYear } from '@/lib/dates';
import { plain } from '@/lib/markup';
import { absolute } from '@/lib/seo';

/** /llms.txt (COPY.md §8.8): facts only, each one also visible on the site; never instructions to AI agents. */
export const dynamic = 'force-static';

export async function GET() {
  const cases = await allCases();
  const lines = [
    `# ${site.name}`,
    '',
    `> ${plain(llms.summary)}`,
    '',
    'Key facts (details and sources on the linked pages):',
    ...llms.facts.map((f) => `- ${plain(f)}`),
    ...(home.now.lines.length
      ? [`- Now (${monthYear(home.now.month)}): ${home.now.lines.map((l) => `${l.label}: ${plain(l.text)}`).join(' ')}`]
      : []),
    '',
    '## Pages',
    ...llms.pages.map((p) => `- [${p.label}](${absolute(p.path)}): ${p.what}`),
    '',
    '## Projects',
    ...cases.map(
      (c) => `- [${plain(c.title)}](${absolute(c.href)}): ${plain(c.outcome)} (${c.years}; ${c.role}, ${c.org})`,
    ),
    '',
    '## Public evidence',
    ...llms.evidence.map((e) => `- [${e.label}](${e.url})`),
    '',
  ];
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  });
}
