import 'server-only';
import { contact } from '@content/pages/contact';
import { home } from '@content/pages/home';
import { resumePage } from '@content/pages/resume';
import { site } from '@content/site';
import { STORY_MAP } from '@/features/landscape/places';
import { allCases } from '@/features/work/cases';
import { allNotes } from '@/features/writing/notes';
import { plain } from '@/lib/markup';
import { fillTokens } from '@/lib/typography';
import type { ScrollLine, ScrollStop } from './types';

export type { ScrollLine, ScrollStop } from './types';

/**
 * The scroll, held: what each place on the map holds, as the sheet's inscription under the band (ScrollSheet). Every
 * line is a string the site already shows and a real link, so travelling the scroll is browsing the site's own
 * structure and every stop is rewarded by words: Home's section titles (HomePage's ids), the six projects (newest
 * first, as Work's table), the notes (newest first), the résumé's five sections (ResumePage's ids), Contact's one line
 * and the email. Nothing is written here; nothing for the 404 (it lies off the map). Built on the server once per
 * render of the root layout (ScrollMount).
 */
export async function scrollIndex(): Promise<ScrollStop[]> {
  const text = (s: string) => plain(fillTokens(s));
  const lines: Record<number, ScrollLine[]> = {
    0: [
      { label: text(home.about.title), href: '/#about-title' },
      { label: text(home.workOn.title), href: '/#work-on-title' },
      ...(home.now.lines.length ? [{ label: text(home.now.title), href: '/#now-title' }] : []),
      { label: text(home.writing.title), href: '/#writing-title' },
      { label: text(home.hello.title), href: '/#say-hello-title' },
    ],
    1: (await allCases()).map((c) => ({ label: text(c.title), href: c.href })),
    2: (await allNotes()).map((n) => ({ label: text(n.title), href: n.href })),
    3: [
      { label: text(resumePage.sections.summary), href: '/resume/#cv-summary-title' },
      { label: text(resumePage.sections.experience), href: '/resume/#cv-exp-title' },
      { label: text(resumePage.sections.skills), href: '/resume/#cv-skills-title' },
      { label: text(resumePage.sections.education), href: '/resume/#cv-edu-title' },
      { label: text(resumePage.sections.certifications), href: '/resume/#cv-certs-title' },
    ],
    4: [
      { label: text(contact.intro), href: '/contact/' },
      { label: text(contact.emailLabel), href: `mailto:${site.email}` },
    ],
  };
  return STORY_MAP.map((p) => ({ stretch: p.stretch, label: p.label, href: p.href, lines: lines[p.stretch] ?? [] }));
}
