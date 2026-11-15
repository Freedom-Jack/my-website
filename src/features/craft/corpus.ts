import 'server-only';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { home } from '@content/pages/home';
import { work } from '@content/pages/work';
import { contact } from '@content/pages/contact';
import { site } from '@content/site';
import { resume } from '@/features/resume/resume';
import { placeForPath } from '@/features/landscape/places';
import { plain } from '@/lib/markup';

/**
 * The site's words as a corpus (the craft's one source): section-sized passages of content/ (paragraphs, rows and
 * list items run together until about forty words, never a lone short sentence; the attack's A4) with their page,
 * section, anchor, place and position in the painting (A2) and the hash of the file they came from. Built at build time by the routes under
 * src/app/craft/ and by the unit test; never generated, never edited: a chunk is a verbatim passage (the inline
 * markup removed, the {{years}} token filled, as the page prints it). A chunk's `id` is stable across builds
 * (page, section, order), so the DRAFT eval set and the recorded run point at the same passages tomorrow.
 */

export interface Chunk {
  id: string;
  text: string;
  /** the page it is read on */
  href: string;
  page: string;
  /** the section's heading, as the page prints it ("Outcome", "Note: RAG", "Experience") */
  section: string;
  /** the fragment on that page, when one exists */
  anchor?: string;
  /** the place in the painting: its stretch, the passage's own stretch-local u (null: the page's own view, so a
   *  focused result does not move the painting) and the place's name */
  stretch: number;
  u: number | null;
  place: string;
  /** the content file and the first 8 hex digits of its sha256 */
  file: string;
  hash: string;
}

export interface SourceFile {
  file: string;
  hash: string;
  bytes: number;
}

export const PLACE_NAMES = [
  'his mountain',
  'the river town',
  'the lake',
  'the terraces',
  'the crossing',
  'the lone peak',
];

const ROOT = process.cwd();
const sha8 = (buf: Buffer | string) => createHash('sha256').update(buf).digest('hex').slice(0, 8);

const text = (s: string) => plain(s).replace(/\s+/g, ' ').trim();
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** A content file's bytes, its hash and size (the lineage's file nodes). */
function source(rel: string): SourceFile {
  const buf = readFileSync(path.join(/*turbopackIgnore: true*/ ROOT, rel));
  return { file: rel, hash: sha8(buf), bytes: buf.length };
}

// ---------------------------------------------------------------------------------------------- MDX, as text
/** The front matter of a content MDX file: the small YAML the files use (scalars, one level of maps, lists of
 *  scalars or of flat maps), read here so the corpus has one code path at build and in the tests. */
export function frontMatter(src: string): { data: Record<string, unknown>; body: string } {
  const m = src.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error('no front matter');
  const lines = m[1]!.split('\n');
  const scalar = (v: string): unknown => {
    const s = v.trim();
    if (/^'.*'$/.test(s)) return s.slice(1, -1).replace(/''/g, "'");
    if (/^".*"$/.test(s)) return s.slice(1, -1);
    if (/^\d+$/.test(s)) return Number(s);
    return s;
  };
  let i = 0;
  const indentOf = (l: string) => l.search(/\S/);
  const skip = () => {
    while (i < lines.length && (!lines[i]!.trim() || lines[i]!.trim().startsWith('#'))) i += 1;
  };
  function block(indent: number): unknown {
    skip();
    if (i >= lines.length) return {};
    const list = lines[i]!.trim().startsWith('- ');
    const arr: unknown[] = [];
    const obj: Record<string, unknown> = {};
    for (;;) {
      skip();
      if (i >= lines.length) break;
      const raw = lines[i]!;
      const ind = indentOf(raw);
      if (ind < indent) break;
      if (ind > indent) throw new Error(`front matter: unexpected indent at line ${i + 1}`);
      const line = raw.slice(ind);
      if (list) {
        if (!line.startsWith('- ')) break;
        const rest = line.slice(2);
        const kv = rest.match(/^([A-Za-z_][\w-]*):(?:\s+(.*))?$/);
        if (kv && !/^['"]/.test(rest)) {
          const item: Record<string, unknown> = { [kv[1]!]: kv[2] === undefined ? '' : scalar(kv[2]) };
          i += 1;
          for (;;) {
            skip();
            if (i >= lines.length) break;
            const r2 = lines[i]!;
            if (indentOf(r2) !== ind + 2) break;
            const kv2 = r2.trim().match(/^([A-Za-z_][\w-]*):\s+(.*)$/);
            if (!kv2) throw new Error(`front matter: bad list item at line ${i + 1}`);
            item[kv2[1]!] = scalar(kv2[2]!);
            i += 1;
          }
          arr.push(item);
        } else {
          arr.push(scalar(rest));
          i += 1;
        }
        continue;
      }
      const kv = line.match(/^([A-Za-z_][\w-]*):(?:\s+(.*))?$/);
      if (!kv) throw new Error(`front matter: bad line ${i + 1}: ${line}`);
      i += 1;
      if (kv[2] === undefined || kv[2] === '') {
        skip();
        obj[kv[1]!] = i < lines.length && indentOf(lines[i]!) > indent ? block(indentOf(lines[i]!)) : '';
      } else obj[kv[1]!] = scalar(kv[2]);
    }
    return list ? arr : obj;
  }
  return { data: block(0) as Record<string, unknown>, body: m[2]! };
}

const stripInline = (s: string) =>
  s
    .replace(/<time[^>]*>([^<]*)<\/time>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

interface BodyUnit {
  section: string;
  anchor: string;
  text: string;
}

/** An MDX body as sentence units: paragraphs, list items and glossary notes under their "## Heading". */
export function bodyUnits(body: string): BodyUnit[] {
  const out: BodyUnit[] = [];
  let section = '';
  let anchor = '';
  const push = (t: string, sec = section) => {
    const s = stripInline(t);
    if (s && /[A-Za-z]/.test(s)) out.push({ section: sec, anchor, text: s });
  };
  const paras = body.split(/\n\s*\n/);
  for (const p of paras) {
    const t = p.trim();
    if (!t) continue;
    const h = t.match(/^## (.+)$/m);
    if (h) {
      section = h[1]!.trim();
      anchor = slug(section);
      const rest = t.replace(/^## .+$/m, '').trim();
      if (!rest) continue;
      return out.concat(bodyUnitsFrom(rest, section, anchor));
    }
    for (const u of unitsOf(t, section, anchor)) out.push(u);
  }
  return out;

  function bodyUnitsFrom(rest: string, sec: string, anc: string): BodyUnit[] {
    const acc: BodyUnit[] = [];
    for (const u of unitsOf(rest, sec, anc)) acc.push(u);
    const after = body.slice(body.indexOf(rest) + rest.length);
    return acc.concat(bodyUnits(after).map((u) => (u.section ? u : { ...u, section: sec, anchor: anc })));
  }
  function unitsOf(t: string, sec: string, anc: string): BodyUnit[] {
    const acc: BodyUnit[] = [];
    const add = (s: string, label = sec) => {
      const x = stripInline(s);
      if (x && /[A-Za-z]/.test(x)) acc.push({ section: label, anchor: anc, text: x });
    };
    if (t.startsWith('|')) return acc; // a table: its prose says the same
    if (/^<Note\b/.test(t)) {
      const m = t.match(/^<Note term="([^"]+)">([\s\S]*?)<\/Note>$/);
      if (m) add(m[2]!, `Note: ${m[1]}`);
      return acc;
    }
    if (/^<Quote\b/.test(t)) {
      add(t.replace(/^<Quote[^>]*>/, '').replace(/<\/Quote>$/, ''), `${sec || 'Quotation'}`);
      return acc;
    }
    if (/^- /m.test(t)) {
      for (const item of t.split(/\n(?=- )/)) add(item.replace(/^- /, ''));
      return acc;
    }
    if (/^\*\*[^*]+\*\*:\s*$/.test(t)) return acc; // a list's label line
    add(t);
    return acc;
  }
  void push;
}

interface CaseFM {
  title: string;
  summary: string;
  outcome: string;
  figure: { lead?: string; value: string; note: string };
  years: string;
  role: string;
  org: string;
  diagram?: { steps: string[]; caption: string };
}

function mdxFiles(dir: string) {
  return readdirSync(path.join(/*turbopackIgnore: true*/ ROOT, dir))
    .filter((f) => f.endsWith('.mdx'))
    .sort()
    .map((f) => {
      const rel = `${dir}/${f}`;
      const src = readFileSync(path.join(/*turbopackIgnore: true*/ ROOT, rel), 'utf8');
      return { slug: f.slice(0, -4), rel, ...frontMatter(src), source: source(rel) };
    });
}

// ---------------------------------------------------------------------------------------------- the corpus
/** A passage at build: its text is its parts (each a verbatim unit of a content string) joined by one space. */
export interface BuiltChunk extends Chunk {
  parts: string[];
}

export interface Corpus {
  chunks: BuiltChunk[];
  files: SourceFile[];
  /** the sha256 (8 hex) of every passage's text in order: the index's identity */
  hash: string;
}

/** A passage is at least this many words (A4: section-sized, never a single short sentence). */
export const MIN_WORDS = 40;
const wordsOf = (t: string) => t.split(/\s+/).filter(Boolean).length;

interface Unit {
  section: string;
  anchor?: string;
  text: string;
  file: string;
  /** the unit's stretch-local position (null: the page's own view) */
  u: number | null;
}

/** Units run together, in order, into passages of at least MIN_WORDS; a short tail joins the passage before it. */
export function passages(units: Unit[], min = MIN_WORDS): Array<Unit & { parts: string[]; sections: string[] }> {
  const out: Array<Unit & { parts: string[]; sections: string[] }> = [];
  let cur: (Unit & { parts: string[]; sections: string[] }) | null = null;
  const words = (c: { parts: string[] }) => wordsOf(c.parts.join(' '));
  for (const u of units) {
    if (!u.text) continue;
    if (cur && words(cur) >= min) {
      out.push(cur);
      cur = null;
    }
    if (!cur) cur = { ...u, parts: [u.text], sections: [u.section] };
    else {
      cur.parts.push(u.text);
      if (!cur.sections.includes(u.section)) cur.sections.push(u.section);
    }
  }
  if (cur) {
    const last = out[out.length - 1];
    if (last && words(cur) < min / 2) {
      last.parts.push(...cur.parts);
      for (const s of cur.sections) if (!last.sections.includes(s)) last.sections.push(s);
    } else out.push(cur);
  }
  return out;
}

/** Spread n positions evenly over [a, b] (the sub-anchors along a place). */
const spread = (i: number, n: number, a: number, b: number) =>
  Math.round((n <= 1 ? (a + b) / 2 : a + ((b - a) * i) / (n - 1)) * 1000) / 1000;

export function buildCorpus(): Corpus {
  const chunks: BuiltChunk[] = [];
  const files = new Map<string, SourceFile>();
  const fileOf = (rel: string) => {
    const f = files.get(rel) ?? source(rel);
    files.set(rel, f);
    return f;
  };
  const unit = (file: string, section: string, raw: string, u: number | null, anchor?: string): Unit => ({
    file,
    section,
    text: text(raw),
    u,
    ...(anchor ? { anchor } : {}),
  });
  const emit = (key: string, href: string, page: string, units: Unit[]) => {
    const stretch = placeForPath(href).stretch;
    passages(units).forEach((p, n) => {
      const src = fileOf(p.file);
      chunks.push({
        id: `${key}:${n}`,
        text: p.parts.join(' '),
        parts: p.parts,
        href,
        page,
        section: p.sections.join(' · '),
        ...(p.anchor ? { anchor: p.anchor } : {}),
        stretch,
        u: p.u,
        place: PLACE_NAMES[stretch] ?? '',
        file: p.file,
        hash: src.hash,
      });
    });
  };

  // Home: its sections across the mountain, in the page's order
  const h = home;
  const hf = 'content/pages/home.ts';
  const mountain = (i: number) => spread(i, 5, 0.3, 0.9);
  emit('home', '/', 'Home', [
    ...h.hero.lead.map((t) => unit(hf, 'First screen', t, mountain(0))),
    ...h.about.paragraphs.map((t) => unit(hf, 'About me', t, mountain(1), 'about-title')),
    unit('content/site.ts', 'About me', site.bio, mountain(1), 'about-title'),
    ...h.workOn.rows.flatMap((r) =>
      [r.title, r.line].map((t) => unit(hf, 'What I work on', t, mountain(2), 'work-on-title')),
    ),
    ...h.now.lines.map((l) => unit(hf, 'Now', `${l.label}: ${l.text}`, mountain(3), 'now-title')),
    unit(hf, 'Say hello', h.hello.line, mountain(4), 'say-hello-title'),
  ]);

  // Work: the index's own words, at the town's own view
  const wf = 'content/pages/work.ts';
  emit('work', '/work/', 'Work', [
    unit(wf, 'Work', work.intro, null),
    unit(wf, 'How I build', work.build.statement, null, 'build-title'),
    unit(wf, 'How I build', work.build.line, null, 'build-title'),
    ...work.build.diagram.steps.map((t) => unit(wf, 'How I build', t, null, 'build-title')),
    unit(wf, 'In the open', work.open.intro, null, 'open'),
  ]);

  // the six cases: each its own quay along the town, by its order in the index
  const cases = mdxFiles('content/work')
    .map((c) => ({ ...c, fm: c.data as unknown as CaseFM & { order: number } }))
    .sort((a, b) => a.fm.order - b.fm.order);
  cases.forEach((c, i) => {
    const u = spread(i, cases.length, 0.4, 0.9);
    const fm = c.fm;
    emit(`case.${c.slug}`, `/work/${c.slug}/`, text(fm.title), [
      unit(c.rel, 'Summary', fm.summary, u),
      unit(c.rel, 'The figure', `${fm.figure.lead ? `${fm.figure.lead} ` : ''}${fm.figure.value} ${fm.figure.note}`, u),
      ...(fm.diagram ? fm.diagram.steps.map((t) => unit(c.rel, 'The diagram, as steps', t, u)) : []),
      ...bodyUnits(c.body).map((b) => unit(c.rel, b.section || 'Summary', b.text, u, b.anchor || undefined)),
    ]);
  });

  // each note on the lake (Writing's own intro is one short sentence, so it is not a passage: A4)
  for (const n of mdxFiles('content/writing'))
    emit(
      `note.${n.slug}`,
      `/writing/${n.slug}/`,
      String(n.data.title ?? n.slug),
      bodyUnits(n.body).map((b) => unit(n.rel, b.section || 'The note', b.text, 0.84, b.anchor || undefined)),
    );

  // the Résumé (content/resume.json, the single source): each role its own terrace, in the page's order
  const r = resume;
  const rf = 'content/resume.json';
  r.work.forEach((w, i) =>
    emit(`resume.role${i}`, '/resume/', 'Résumé', [
      unit(rf, `Experience: ${w.position}`, w.position, spread(i, r.work.length, 0.3, 0.9), 'cv-exp-title'),
      ...w.highlights.map((t) =>
        unit(rf, `Experience: ${w.position}`, t, spread(i, r.work.length, 0.3, 0.9), 'cv-exp-title'),
      ),
    ]),
  );
  emit('resume', '/resume/', 'Résumé', [
    unit(rf, 'Summary', r.basics.summary, null, 'cv-summary-title'),
    ...r.skills.map((s) => unit(rf, 'Skills', s.keywords.join(', '), null, 'cv-skills-title')),
    ...r.education.flatMap((e) =>
      [e.degree, e.institution, ...(e.honors ?? [])].map((t) => unit(rf, 'Education', t, null, 'cv-edu-title')),
    ),
    ...[...r.awards.map((a) => a.summary ?? a.title), ...r.certificates.map((c) => c.name)].map((t) =>
      unit(rf, 'Awards and certifications', t, null, 'cv-certs-title'),
    ),
  ]);

  // Contact, at the ferry (the crossing's own view)
  const cf = 'content/pages/contact.ts';
  emit('contact', '/contact/', 'Contact', [unit(cf, 'Contact', contact.intro, null)]);

  const hash = sha8(chunks.map((c) => c.text).join('\n'));
  return { chunks, files: [...files.values()], hash };
}
