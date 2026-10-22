import { publicResume } from '@/features/resume/resume';
import { allNotes } from '@/features/writing/notes';
import { absolute } from '@/lib/seo';

/** /resume.json: the JSON Resume (v1.0.0), made from content/resume.json at build time. */
export const dynamic = 'force-static';

export async function GET() {
  const notes = await allNotes();
  const doc = publicResume(notes.map((n) => ({ name: n.title, releaseDate: n.published, url: absolute(n.href) })));
  return new Response(`${JSON.stringify(doc, null, 2)}\n`, {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  });
}
