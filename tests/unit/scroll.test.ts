import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { contact } from '@content/pages/contact';
import { home } from '@content/pages/home';
import { resumePage } from '@content/pages/resume';
import { site } from '@content/site';
import { STORY_MAP } from '@/features/landscape/places';
import { scrollIndex } from '@/features/scroll/index';
import { clampX, detent, durationFor, dxToStretch, FIRST, LAST, nearest, stepFrom } from '@/features/scroll/walk';
import { allCases } from '@/features/work/cases';
import { allNotes } from '@/features/writing/notes';
import { plain } from '@/lib/markup';

// allCases() and allNotes() import the MDX files themselves (Next's MDX loader, which Vitest does not have): here
// the two read the same front matter the way content.test.ts does, in the same order (cases by `order`, notes
// newest first). Everything else in the two modules is the real thing.
vi.mock('@/features/work/cases', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/features/work/cases')>();
  const { mdxFiles } = await import('./frontmatter');
  return {
    ...mod,
    allCases: async () =>
      mdxFiles('content/work')
        .map((c) => ({ ...mod.caseFrontmatter.parse(c.data), slug: c.slug, href: `/work/${c.slug}/` }))
        .sort((a, b) => a.order - b.order),
  };
});
vi.mock('@/features/writing/notes', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/features/writing/notes')>();
  const { mdxFiles } = await import('./frontmatter');
  return {
    ...mod,
    allNotes: async () =>
      mdxFiles('content/writing')
        .map((n) => ({ ...mod.noteFrontmatter.parse(n.data), slug: n.slug, href: `/writing/${n.slug}/` }))
        .sort((a, b) => b.published.localeCompare(a.published)),
  };
});

describe('the scroll, held: the arithmetic of the hand (features/scroll/walk)', () => {
  it('clamps a position to the map: NaN and friends land at Home, past the crossing is the crossing', () => {
    expect(FIRST).toBe(0);
    expect(LAST).toBe(4);
    expect(clampX(NaN)).toBe(0);
    expect(clampX(Infinity)).toBe(0);
    expect(clampX(-Infinity)).toBe(0);
    expect(clampX(-1)).toBe(0);
    expect(clampX(9)).toBe(4);
    expect(clampX(2.5)).toBe(2.5);
    expect(clampX(0)).toBe(0);
    expect(clampX(4)).toBe(4);
  });
  it('names the nearest place', () => {
    expect(nearest(1.4)).toBe(1);
    expect(nearest(1.5)).toBe(2);
    expect(nearest(3.7)).toBe(4);
    expect(nearest(9)).toBe(4);
    expect(nearest(-2)).toBe(0);
    expect(nearest(NaN)).toBe(0);
  });
  it('settles on a place within 0.3 of it, and rests where the hand left it otherwise', () => {
    expect(detent(1.3)).toBe(1);
    expect(detent(0.7)).toBe(1);
    expect(detent(2)).toBe(2);
    expect(detent(1.31)).toBeNull();
    expect(detent(1.5)).toBeNull();
    expect(detent(2.69)).toBeNull();
    // off the map: the end is a place
    expect(detent(4.2)).toBe(4);
    expect(detent(-0.2)).toBe(0);
  });
  it('takes a wider reach when asked (a phone band shows half a stretch, so every release settles)', () => {
    expect(detent(1.45, 0.5)).toBe(1);
    expect(detent(1.5, 0.5)).toBe(2);
    expect(detent(3.6, 0.5)).toBe(4);
    expect(detent(3.6, 0.3)).toBeNull();
    expect(detent(2.1, 0.05)).toBeNull();
    expect(detent(2.04, 0.05)).toBe(2);
  });
  it('steps to the next place in a direction: from between two, the one ahead; from a place, the neighbour', () => {
    expect(stepFrom(1.4, 1)).toBe(2);
    expect(stepFrom(1.4, -1)).toBe(1);
    expect(stepFrom(2, 1)).toBe(3);
    expect(stepFrom(2, -1)).toBe(1);
    expect(stepFrom(0, 1)).toBe(1);
    // a hair off a place (a tween's last frame) counts as the place
    expect(stepFrom(2 - 1e-7, 1)).toBe(3);
    expect(stepFrom(2 + 1e-7, -1)).toBe(1);
  });
  it('stays at the ends', () => {
    expect(stepFrom(4, 1)).toBe(4);
    expect(stepFrom(0, -1)).toBe(0);
    expect(stepFrom(9, 1)).toBe(4);
    expect(stepFrom(-3, -1)).toBe(0);
    expect(stepFrom(NaN, 1)).toBe(1);
    expect(stepFrom(NaN, -1)).toBe(0);
  });
  it('walks at 1.1 s a stretch, never under 300 ms nor over 4.4 s, whichever way', () => {
    expect(durationFor(1)).toBe(1100);
    expect(durationFor(-1)).toBe(1100);
    expect(durationFor(2)).toBe(2200);
    expect(durationFor(0)).toBe(300);
    expect(durationFor(0.1)).toBe(300);
    expect(durationFor(4)).toBe(4400);
    expect(durationFor(5)).toBe(4400);
    expect(durationFor(-9)).toBe(4400);
  });
  it('turns dragged pixels into stretches: the painting follows the hand, so dragging left moves the camera right', () => {
    expect(dxToStretch(-100, 200)).toBe(0.5);
    expect(dxToStretch(100, 200)).toBe(-0.5);
    expect(dxToStretch(0, 200)).toBeCloseTo(0, 12); // (-0: a sign on nothing, harmless downstream)
    expect(dxToStretch(-100, 0)).toBe(0);
    expect(dxToStretch(-100, -5)).toBe(0);
    expect(dxToStretch(NaN, 200)).toBe(0);
  });
});

/** The ids an in-site fragment link needs, as the page's component writes them. */
const SOURCES: Record<string, string> = {
  '/': 'src/features/home/HomePage.tsx',
  '/resume/': 'src/features/resume/ResumePage.tsx',
};

describe('the scroll, held: what each place holds (features/scroll/index)', () => {
  it('stops at the five places in the story map’s order, each the page it is', async () => {
    const stops = await scrollIndex();
    expect(stops.map((s) => s.stretch)).toEqual([0, 1, 2, 3, 4]);
    expect(stops.map((s) => s.label)).toEqual(['Home', 'Work', 'Writing', 'Résumé', 'Contact']);
    expect(stops.map((s) => s.href)).toEqual(['/', '/work/', '/writing/', '/resume/', '/contact/']);
    expect(stops.map((s) => [s.stretch, s.label, s.href])).toEqual(STORY_MAP.map((p) => [p.stretch, p.label, p.href]));
    // the 404 lies off the map
    expect(stops.some((s) => s.stretch === 5)).toBe(false);
  });
  it('writes every line as plain words with a real link, in-site or the email', async () => {
    for (const s of await scrollIndex()) {
      expect(s.lines.length, s.label).toBeGreaterThan(0);
      for (const l of s.lines) {
        expect(l.label.trim().length, `${s.label}: ${l.href}`).toBeGreaterThan(0);
        expect(l.label, `${s.label}: ${l.href}`).not.toMatch(/[*[\]{}]/);
        expect(l.label, `${s.label}: ${l.href}`).not.toContain('(Jack)');
        expect(l.href.startsWith('/') || l.href === `mailto:${site.email}`, `${s.label}: ${l.href}`).toBe(true);
      }
      expect(site.email).toBe('qxjack@gmail.com');
    }
  });
  it('holds, at Work, the cases in the table’s order (newest first) and, at Writing, the notes', async () => {
    const stops = await scrollIndex();
    const cases = await allCases();
    const notes = await allNotes();
    expect(cases.length).toBeGreaterThan(0);
    expect(notes.length).toBeGreaterThan(0);
    expect(stops[1]!.lines).toEqual(cases.map((c) => ({ label: plain(c.title), href: c.href })));
    expect(stops[2]!.lines).toEqual(notes.map((n) => ({ label: plain(n.title), href: n.href })));
  });
  it('holds, at Home, its section titles, with "Now" only while it has lines (it has them today)', async () => {
    const stops = await scrollIndex();
    const lines = stops[0]!.lines;
    expect(home.now.lines.length).toBeGreaterThan(0);
    expect(lines).toEqual([
      { label: plain(home.about.title), href: '/#about-title' },
      { label: plain(home.workOn.title), href: '/#work-on-title' },
      { label: plain(home.now.title), href: '/#now-title' },
      { label: plain(home.writing.title), href: '/#writing-title' },
      { label: plain(home.hello.title), href: '/#say-hello-title' },
    ]);
    expect(lines.find((l) => l.label === 'Now')?.href).toBe('/#now-title');
  });
  it('holds, at the Résumé, its five sections, and at Contact its one line and the email', async () => {
    const stops = await scrollIndex();
    const s = resumePage.sections;
    expect(stops[3]!.lines).toEqual([
      { label: plain(s.summary), href: '/resume/#cv-summary-title' },
      { label: plain(s.experience), href: '/resume/#cv-exp-title' },
      { label: plain(s.skills), href: '/resume/#cv-skills-title' },
      { label: plain(s.education), href: '/resume/#cv-edu-title' },
      { label: plain(s.certifications), href: '/resume/#cv-certs-title' },
    ]);
    expect(stops[4]!.lines).toEqual([
      { label: plain(contact.intro), href: '/contact/' },
      { label: plain(contact.emailLabel), href: `mailto:${site.email}` },
    ]);
  });
  it('links every fragment to a heading its page really writes (HomePage, ResumePage)', async () => {
    for (const s of await scrollIndex()) {
      for (const l of s.lines) {
        const [page, id] = l.href.split('#');
        if (id === undefined) continue;
        const file = SOURCES[page!];
        expect(file, `${l.href}: a fragment on a page without ids to check`).toBeDefined();
        const src = readFileSync(path.join(process.cwd(), file!), 'utf8');
        expect(src, `${l.href}: #${id} in ${file}`).toContain(`id="${id}"`);
      }
    }
  });
});

describe('the scroll, held: its words are draft until Jack writes them (content/site.ts scroll)', () => {
  it('marks every interface string DRAFT', () => {
    const words = Object.entries(site.scroll);
    expect(words.map(([k]) => k).sort()).toEqual(['close', 'deep', 'high', 'hint', 'level', 'name', 'open'].sort());
    for (const [k, v] of words) expect(v, k).toMatch(/^DRAFT · /);
  });
});
