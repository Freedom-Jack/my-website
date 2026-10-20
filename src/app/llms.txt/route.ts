import { llms } from '@content/pages/llms';
import { site } from '@content/site';
import { plain } from '@/lib/markup';
import { absolute } from '@/lib/seo';

/** /llms.txt (COPY.md §8.8): facts only, each one also visible on the site; never instructions to AI agents. */
export const dynamic = 'force-static';

export function GET() {
  const lines = [
    `# ${site.name}`,
    '',
    `> ${plain(llms.summary)}`,
    '',
    'Key facts (details and sources on the linked pages):',
    ...llms.facts.map((f) => `- ${plain(f)}`),
    '',
    '## Pages',
    ...llms.pages.map((p) => `- [${p.label}](${absolute(p.path)}): ${p.what}`),
    '',
    '## Public evidence',
    ...llms.evidence.map((e) => `- [${e.label}](${e.url})`),
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
