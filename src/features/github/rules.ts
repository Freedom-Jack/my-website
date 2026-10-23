import { z } from 'zod';
import { CJK, PHONE } from '@/lib/compliance';

/**
 * Work's "In the open": which of Jack's public GitHub repositories are listed, and how (COPY.md §3.4; the demo's
 * tools/sync-projects.py, as a tested module). Pure: the fetch lives in fetch.ts, at build time / ISR, never in
 * the visitor's browser.
 *
 * Rules, in order: public; not a fork; not archived; not empty; never a denied repository; placeholders skipped
 * (under 10 KB, or described "TBA", "To be announced", "coming soon": they appear by themselves once real code
 * lands); a description or an override line, ending with a full stop, ≤ 160 characters, no CJK, no phone pattern.
 * Groups: the topic "featured" (or an override) first; "Recent" = pushed within the 24 months before the
 * snapshot; "Early work" = the rest, newest year first. An empty group renders nothing.
 */

/** Never listed. Personal application materials; and this site's own source, until its public history no longer
 *  holds the old résumé file (DESIGN §2, the launch gate: content/site.ts showSourceCode). */
export const DENY = new Set(['job-application', 'my-website']);
export const PLACEHOLDER_KB = 10;
export const PLACEHOLDER = /^(tba|to be (announced|anounced)|coming soon)\.?$/i;
export const RECENT_MONTHS = 24;
export const LINE_MAX = 160;
export const USER = 'Freedom-Jack';

export const repoSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  size: z.number().optional(),
  fork: z.boolean().optional(),
  archived: z.boolean().optional(),
  private: z.boolean().optional(),
  pushed_at: z.string(),
  created_at: z.string(),
  topics: z.array(z.string()).optional(),
  html_url: z.string().optional(),
});
export type Repo = z.infer<typeof repoSchema>;

export const overridesSchema = z
  .object({
    updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    repos: z.array(
      z
        .object({
          name: z.string().regex(/^[A-Za-z0-9._-]{1,100}$/),
          line: z.string().optional(),
          year: z.number().int().min(2000).max(2100).optional(),
          group: z.enum(['featured', 'recent', 'early']).optional(),
          order: z.number().optional(),
          hidden: z.literal(true).optional(),
          demo: z.string().startsWith('https://').optional(),
        })
        .strict(),
    ),
  })
  .strict();
export type Overrides = z.infer<typeof overridesSchema>;
export type Override = Overrides['repos'][number];

export interface Entry {
  name: string;
  url: string;
  line: string;
  year: number;
  pushed: string;
  group: 'featured' | 'recent' | 'early';
  order: number | undefined;
  demo: string | undefined;
}

export const denied = (name: string) => DENY.has(name.toLowerCase());

/** What is wrong with a line of description (empty: fine). */
export function lineErrors(line: string): string[] {
  const errs: string[] = [];
  if (!line.trim()) return ['line is empty'];
  if (!line.trimEnd().endsWith('.')) errs.push('line must end with a full stop');
  if (/\b(19|20)\d{2}\b/.test(line)) errs.push('line must not contain a year (the year column shows it)');
  if (line.length > LINE_MAX) errs.push(`line is longer than ${LINE_MAX} characters`);
  if (CJK.test(line)) errs.push('line contains a CJK character');
  if (PHONE.test(line)) errs.push('line contains a phone-number pattern');
  return errs;
}

/** The overrides as checked data; a denied repository may never be named in them (the file is public). */
export function parseOverrides(raw: unknown): Map<string, Override> {
  const data = overridesSchema.parse(raw);
  const out = new Map<string, Override>();
  for (const o of data.repos) {
    if (denied(o.name)) throw new Error(`content/github/overrides.json: ${o.name} must never be named here`);
    if (o.line !== undefined) {
      const errs = lineErrors(o.line);
      if (errs.length) throw new Error(`content/github/overrides.json: ${o.name}: ${errs.join('; ')}`);
    }
    out.set(o.name.toLowerCase(), o);
  }
  return out;
}

/** The public candidates the API returned (what the snapshot keeps). */
export function candidates(repos: Repo[]): Repo[] {
  return repos.filter((r) => !r.private && !r.fork && !r.archived && (r.size ?? 0) > 0 && !denied(r.name));
}

const day = (iso: string) => iso.slice(0, 10);

/** The listed entries, grouped by the rules above. `fetched` is when the list was read (ISO). */
export function choose(repos: Repo[], overrides: Map<string, Override>, fetched: string): Entry[] {
  const f = new Date(`${day(fetched)}T00:00:00Z`);
  const cutoff = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() - RECENT_MONTHS, Math.min(f.getUTCDate(), 28)));
  const out: Entry[] = [];
  for (const r of candidates(repos)) {
    const o = overrides.get(r.name.toLowerCase());
    const desc = (r.description ?? '').trim();
    if (o?.hidden) continue;
    if ((r.size ?? 0) < PLACEHOLDER_KB || PLACEHOLDER.test(desc)) continue;
    let line = (o?.line ?? desc).trim();
    if (!line) continue;
    if (!line.endsWith('.')) line += '.';
    if (lineErrors(line).length && o?.line === undefined) continue; // its GitHub description needs an override line
    const url = r.html_url ?? `https://github.com/${USER}/${r.name}`;
    if (!url.startsWith(`https://github.com/${USER}/`)) continue;
    const pushed = day(r.pushed_at);
    const group =
      o?.group ??
      ((r.topics ?? []).includes('featured')
        ? 'featured'
        : new Date(`${pushed}T00:00:00Z`) >= cutoff
          ? 'recent'
          : 'early');
    out.push({
      name: r.name,
      url,
      line,
      year: o?.year ?? Number(r.created_at.slice(0, 4)),
      pushed,
      group,
      order: o?.order,
      demo: o?.demo,
    });
  }
  return out;
}

const byOrder = (newest: (e: Entry) => number) => (a: Entry, b: Entry) =>
  (a.order ?? Infinity) - (b.order ?? Infinity) ||
  newest(a) - newest(b) ||
  a.name.toLowerCase().localeCompare(b.name.toLowerCase());

export interface Groups {
  featured: Entry[];
  recent: Entry[];
  early: Entry[];
  /** "Early work, 2019 – 2020" (or "Earlier work, …" once the newest is after 2020); null when empty */
  earlyRange: { first: number; last: number } | null;
}

export function group(entries: Entry[]): Groups {
  const pushedDesc = (e: Entry) => -Date.parse(e.pushed);
  const featured = entries.filter((e) => e.group === 'featured').sort(byOrder(pushedDesc));
  const recent = entries.filter((e) => e.group === 'recent').sort(byOrder(pushedDesc));
  const early = entries.filter((e) => e.group === 'early').sort(byOrder((e) => -e.year));
  const years = early.map((e) => e.year);
  return {
    featured,
    recent,
    early,
    earlyRange: years.length ? { first: Math.min(...years), last: Math.max(...years) } : null,
  };
}
