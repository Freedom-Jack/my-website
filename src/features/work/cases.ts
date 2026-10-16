import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { ComponentType } from 'react';
import { z } from 'zod';

/**
 * The Work cases: one MDX file per project in content/work/ (its file name is its address, /work/<file-name>/).
 * Front matter, checked here (a bad one fails the build): see content/work/rag-assistant.mdx for every field.
 * The body is "## Context", "## What I did", "## Outcome", "## Evidence", "## Stack" (each optional; "## The hard
 * part" when Jack writes it), with <Note term="…">…</Note> glossary notes after the paragraph they explain.
 */

const link = z.object({ label: z.string().min(1), url: z.url() }).strict();

export const caseFrontmatter = z
  .object({
    title: z.string().min(1),
    /** newest first: the order of the index table */
    order: z.number().int().positive(),
    years: z.string().regex(/^\d{4} – (\d{4}|present)$/, 'years like "2023 – 2024" or "2025 – present" (en dash)'),
    org: z.string().min(1),
    role: z.string().min(1),
    figure: z.object({ lead: z.string().optional(), value: z.string().min(1), note: z.string().min(1) }).strict(),
    summary: z.string().min(1),
    /** the index table's Outcome cell */
    outcome: z.string().min(1),
    /** the index table's Evidence cell; none: "Client work, no public page" */
    evidence: z.array(link).default([]),
    diagram: z
      .object({ name: z.string().min(1), caption: z.string().min(1), steps: z.array(z.string().min(1)).min(1) })
      .strict()
      .optional(),
  })
  .strict();

export type CaseMeta = z.infer<typeof caseFrontmatter> & { slug: string; href: string };
export interface Case {
  meta: CaseMeta;
  Body: ComponentType<{ components?: Record<string, unknown> }>;
}

const DIR = path.join(process.cwd(), 'content', 'work');

export function caseSlugs(): string[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => f.slice(0, -4))
    .sort();
}

export async function loadCase(slug: string): Promise<Case> {
  const mod = (await import(`../../../content/work/${slug}.mdx`)) as { default: Case['Body']; frontmatter: unknown };
  const parsed = caseFrontmatter.safeParse(mod.frontmatter);
  if (!parsed.success) throw new Error(`content/work/${slug}.mdx: ${parsed.error.message}`);
  const meta = { ...parsed.data, slug, href: `/work/${slug}/` };
  if (meta.diagram) {
    for (const kind of ['wide', 'tall']) {
      const file = path.join(DIR, 'diagrams', `${meta.diagram.name}.${kind}.svg`);
      if (!existsSync(file))
        throw new Error(`content/work/${slug}.mdx: no drawing ${path.relative(process.cwd(), file)}`);
    }
  }
  return { meta, Body: mod.default };
}

/** Every case's front matter, newest first (by `order`). */
export async function allCases(): Promise<CaseMeta[]> {
  const cases = await Promise.all(caseSlugs().map(async (s) => (await loadCase(s)).meta));
  return cases.sort((a, b) => a.order - b.order);
}
