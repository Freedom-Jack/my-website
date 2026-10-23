import { writing } from '@content/pages/writing';
import { site } from '@content/site';
import { allNotes } from '@/features/writing/notes';
import { absolute } from '@/lib/seo';

/** /writing/feed.xml: the writing as RSS 2.0, newest first. */
export const dynamic = 'force-static';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rfc822 = (iso: string) => new Date(`${iso}T12:00:00Z`).toUTCString();

export async function GET() {
  const notes = await allNotes();
  const items = notes
    .map(
      (n) => `    <item>
      <title>${esc(n.title)}</title>
      <link>${absolute(n.href)}</link>
      <guid isPermaLink="true">${absolute(n.href)}</guid>
      <description>${esc(n.description)}</description>
      <pubDate>${rfc822(n.published)}</pubDate>
    </item>`,
    )
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(writing.feed.title)}</title>
    <link>${absolute('/writing/')}</link>
    <description>${esc(writing.feed.description)}</description>
    <language>en-CA</language>
    <lastBuildDate>${rfc822(
      notes
        .map((n) => n.modified ?? n.published)
        .sort()
        .at(-1) ?? '2026-01-01',
    )}</lastBuildDate>
    <managingEditor>${site.email} (${esc(site.name)})</managingEditor>
    <atom:link href="${absolute('/writing/feed.xml')}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
