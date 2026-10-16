import { readdirSync } from 'node:fs';
import path from 'node:path';
import type { ComponentType } from 'react';
import { z } from 'zod';

/**
 * The writing: one MDX file per piece in content/writing/ (its file name is its address,
 * /writing/<file-name>/). Front matter, checked here (a bad one fails the build):
 *   title, kind (Note | Essay), published, modified?, modifiedNote?, description, metaDescription, keywords?
 * Newest first everywhere. Adding a piece is one new file (CONTENT.md).
 */

const isoDate = z.union([z.string(), z.date()]).transform((v, ctx) => {
  const s = v instanceof Date ? v.toISOString().slice(0, 10) : v;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) ctx.addIssue({ code: 'custom', message: `not an ISO date (YYYY-MM-DD): ${s}` });
  return s;
});

export const noteFrontmatter = z
  .object({
    title: z.string().min(1),
    kind: z.enum(['Note', 'Essay']),
    published: isoDate,
    modified: isoDate.optional(),
    modifiedNote: z.string().optional(),
    description: z.string().min(1),
    metaDescription: z.string().min(1).max(160),
    keywords: z.array(z.string()).default([]),
  })
  .strict();

export type NoteMeta = z.infer<typeof noteFrontmatter> & { slug: string; href: string };
export interface Note {
  meta: NoteMeta;
  Body: ComponentType<{ components?: Record<string, unknown> }>;
}

const DIR = path.join(process.cwd(), 'content', 'writing');

export function noteSlugs(): string[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => f.slice(0, -4))
    .sort();
}

export async function loadNote(slug: string): Promise<Note> {
  const mod = (await import(`../../../content/writing/${slug}.mdx`)) as { default: Note['Body']; frontmatter: unknown };
  const parsed = noteFrontmatter.safeParse(mod.frontmatter);
  if (!parsed.success) throw new Error(`content/writing/${slug}.mdx: ${parsed.error.message}`);
  return { meta: { ...parsed.data, slug, href: `/writing/${slug}/` }, Body: mod.default };
}

/** Every piece's front matter, newest first. */
export async function allNotes(): Promise<NoteMeta[]> {
  const notes = await Promise.all(noteSlugs().map(async (s) => (await loadNote(s)).meta));
  return notes.sort((a, b) => b.published.localeCompare(a.published));
}
