import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import raw from '@content/resume.json';
import { home } from '@content/pages/home';
import { work } from '@content/pages/work';
import { site } from '@content/site';
import overrides from '@content/github/overrides.json';
import { resumeSchema } from '@/features/resume/schema';
import { publicResume } from '@/features/resume/resume';
import { caseFrontmatter } from '@/features/work/cases';
import { noteFrontmatter } from '@/features/writing/notes';
import { findBreaches } from '@/lib/compliance';
import { mdxFiles } from './frontmatter';

/** Every file under a folder, recursively. */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe('content/resume.json (the single source of the résumé, its PDF, resume.json and the JSON-LD)', () => {
  it('matches its schema', () => {
    expect(() => resumeSchema.parse(raw)).not.toThrow();
  });
  it('refuses a phone number field outright', () => {
    const withPhone = structuredClone(raw) as { basics: Record<string, unknown> };
    withPhone.basics.phone = '555 0100';
    expect(resumeSchema.safeParse(withPhone).success).toBe(false);
  });
  it('refuses a street address', () => {
    const withAddress = structuredClone(raw) as { basics: { location: Record<string, unknown> } };
    withAddress.basics.location.address = '1 Main Street';
    expect(resumeSchema.safeParse(withAddress).success).toBe(false);
  });
  it('lists the roles newest first', () => {
    const starts = raw.work.map((w) => w.startDate);
    expect([...starts].sort().reverse()).toEqual(starts);
  });
  it('never attributes the 2026 award to a project (COPY §10.17)', () => {
    const a2026 = raw.awards.find((a) => a.date === '2026');
    expect(a2026).toBeDefined();
    expect(a2026).not.toHaveProperty('summary');
    expect(a2026).not.toHaveProperty('note');
  });
  it('publishes a clean JSON Resume: no page-only fields, no markup, the site address', () => {
    const doc = publicResume([]);
    const text = JSON.stringify(doc);
    expect(text).not.toMatch(/\]\(https?:/); // no [link](url) markup
    expect(text).not.toMatch(/\{\{/); // tokens filled
    expect(doc.basics.url).toBe(`${site.url}/`);
    expect(doc.education[0]).not.toHaveProperty('honors');
    expect(doc.awards.every((a) => !('note' in a))).toBe(true);
  });
});

describe('content/writing/*.mdx', () => {
  const notes = mdxFiles('content/writing');
  it('has at least one piece', () => expect(notes.length).toBeGreaterThan(0));
  for (const n of notes) {
    it(`${n.file}: front matter`, () => {
      const r = noteFrontmatter.safeParse(n.data);
      expect(r.success, r.success ? '' : r.error.message).toBe(true);
    });
  }
});

describe('content/work/*.mdx', () => {
  const cases = mdxFiles('content/work');
  for (const c of cases) {
    it(`${c.file}: front matter, its drawing, its sections`, () => {
      const r = caseFrontmatter.safeParse(c.data);
      expect(r.success, r.success ? '' : r.error.message).toBe(true);
      if (r.success && r.data.diagram) {
        for (const kind of ['wide', 'tall']) {
          const svg = path.join('content/work/diagrams', `${r.data.diagram.name}.${kind}.svg`);
          expect(() => readFileSync(svg)).not.toThrow();
        }
      }
      const labels = [...c.body.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
      expect(labels.length).toBeGreaterThan(0);
      for (const l of labels)
        expect(['Context', 'What I did', 'The hard part', 'Outcome', 'Evidence', 'Stack']).toContain(l);
    });
  }
  it('orders are unique (the index table, newest first)', () => {
    const orders = cases.map((c) => (c.data as { order: number }).order);
    expect(new Set(orders).size).toBe(orders.length);
  });
  it('says how many there are where the words count them ("Six projects", "All six projects")', () => {
    const words = [
      'zero',
      'one',
      'two',
      'three',
      'four',
      'five',
      'six',
      'seven',
      'eight',
      'nine',
      'ten',
      'eleven',
      'twelve',
    ];
    const n = words[cases.length]!;
    expect(work.index.title.toLowerCase()).toContain(`${n} projects`);
    expect(work.back.label.toLowerCase()).toContain(`${n} projects`);
    expect(home.workOn.more.label.toLowerCase()).toContain(`${n} projects`);
    expect(work.meta.description.toLowerCase()).toContain(`${n} projects`);
  });
  it('Home links every "What I work on" row to a case that exists', () => {
    const slugs = cases.map((c) => c.slug);
    for (const row of home.workOn.rows) expect(slugs).toContain(row.href.replace(/^\/work\/|\/$/g, ''));
  });
});

describe('the hard rules, across every content file (DESIGN §2)', () => {
  const files = walk(path.join(process.cwd(), 'content')).filter((f) => /\.(ts|json|mdx|svg)$/.test(f));
  for (const f of files) {
    it(`${path.relative(process.cwd(), f)}: no phone, street address, PMP, CJK or old PDF`, () => {
      expect(findBreaches(readFileSync(f, 'utf8'))).toEqual([]);
    });
  }
  it('meta descriptions fit in 160 characters', () => {
    expect(home.meta.description.length).toBeLessThanOrEqual(160);
    expect(work.meta.description.length).toBeLessThanOrEqual(160);
  });
  it('the public email is the one Jack chose', () => expect(site.email).toBe('qxjack@gmail.com'));
  it('the footer\'s "Updated" month (typed by hand) is no older than any content date', () => {
    const notes = mdxFiles('content/writing').map((n) => n.data as { published: string; modified?: string });
    const dates = [
      home.meta.modified,
      home.now.month,
      raw.meta.lastModified,
      overrides.updated,
      ...notes.map((n) => n.modified ?? n.published),
    ];
    for (const d of dates)
      expect(String(d).slice(0, 7) <= site.updated, `${d} is newer than "${site.updated}"`).toBe(true);
  });
});
