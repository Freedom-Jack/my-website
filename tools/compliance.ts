/**
 * The hard-rule sweep (CLAUDE.md), run in CI after the build and before any commit:
 *   no phone number anywhere (site, PDF, JSON, comments) · no street address · no project-management credential ·
 *   never the old résumé PDF (not served, not linked; only its 301 to /resume/) · no Chinese characters at all in
 *   text (the seal's glyph is an outline) · no file name with CJK · the visible name never carries "(Jack)" (that
 *   form is for titles and search data) · no link to this site's own repository while content/site.ts
 *   showSourceCode is false (the launch gate).
 * It reads
 *   - the sources: content/, src/, public/, tools/, tests/, .github/, next.config.ts, package.json;
 *   - the build, which is what visitors and machines get (<dist>/server/app): every page's HTML and RSC payload, and
 *     every prerendered route's body (/llms.txt, /resume.json, /craft/*.json, the feed, the sitemap, robots.txt, the
 *     web manifest, the icon);
 *   - the one PDF's own text.
 * The name rule reads each built page's visible text (the body's words and its alt, aria-label, title and
 * placeholder attributes: never the <head>, JSON-LD or the framework's payload) and the PDF's text. The repository
 * rule reads everything built, public/ and the PDF. Client chunks (<dist>/static) are not read: they carry
 * content/site.ts whole, the repository's address included, as data and not as a link (check:links reads every
 * link a served page holds).
 *
 *   npm run check:compliance                          after npm run build; with no build it checks the sources only
 *   npm run check:compliance -- --dist .next-tools    another build folder (default: NEXT_DIST_DIR, else .next)
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { extractText, getDocumentProxy } from 'unpdf';
import { site } from '../content/site.ts';
import {
  CJK,
  findBreaches,
  NAME_IN_PARENS,
  repositoryPattern,
  visibleText,
  type Finding,
} from '../src/lib/compliance.ts';
import { opt } from './lib.ts';

const ROOT = process.cwd();
const DIST = opt('--dist', process.env.NEXT_DIST_DIR || '.next');
const TEXT = /\.(ts|tsx|js|mjs|cjs|css|json|mdx|md|svg|txt|xml|html|rsc|webmanifest)$/;
/** A prerendered route's body is text when its own headers say so (<route>.meta beside <route>.body). */
const TEXT_TYPE = /^text\/|[/+](json|xml)\b|javascript/i;
/** Files that must name a rule to enforce it: the patterns themselves, the redirect, the tests. */
const ALLOW: Record<Finding['rule'], RegExp> = {
  // (public/models: a language model's vocabulary lists numbers one to a line; three of them in a row are no phone)
  phone: /^(src\/lib\/compliance\.ts|tools\/(compliance|build-pdf|linkcheck)\.ts|tests\/|public\/models\/)/,
  cjk: /^(src\/lib\/compliance\.ts|tests\/)/,
  pmp: /^(src\/lib\/compliance\.ts|tools\/compliance\.ts|tests\/)/,
  'old-pdf': /^(src\/lib\/redirects\.ts|src\/lib\/compliance\.ts|tools\/compliance\.ts|tests\/)/,
  street: /^(src\/lib\/compliance\.ts|tests\/)/,
};
/** The site's own repository: no page, file or machine-readable route names it before the launch gate. */
const REPO = site.showSourceCode ? null : repositoryPattern(site.sourceCodeUrl);

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    if (f === 'node_modules' || f === 'cache' || f === 'dev') continue;
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** Whether a built route body is text, by the content type the route answered with. */
function textBody(file: string): boolean {
  const meta = file.replace(/\.body$/, '.meta');
  if (!existsSync(meta)) return false;
  try {
    const { headers } = JSON.parse(readFileSync(meta, 'utf8')) as { headers?: Record<string, string> };
    return TEXT_TYPE.test(headers?.['content-type'] ?? '');
  } catch {
    return false;
  }
}

const problems: string[] = [];
let files = 0;
let pages = 0;
let bodies = 0;

const relOf = (file: string) => path.relative(ROOT, file).split(path.sep).join('/');
const repoIn = (rel: string, text: string) => {
  const m = REPO && text.match(REPO);
  if (m)
    problems.push(
      `${rel}: names this site's repository (${JSON.stringify(m[0])}) while content/site.ts showSourceCode is false`,
    );
};

const sources = ['content', 'src', 'public', 'tools', 'tests', '.github'].flatMap((d) => walk(path.join(ROOT, d)));
const built = walk(path.resolve(ROOT, DIST, 'server', 'app')).filter((f) => /\.(html|rsc|body|json)$/.test(f));
const isBuilt = new Set(built);
for (const file of [...sources, ...built, path.join(ROOT, 'next.config.ts'), path.join(ROOT, 'package.json')]) {
  const rel = relOf(file);
  if (CJK.test(path.basename(file))) problems.push(`${rel}: a file name with a CJK character`);
  if (!existsSync(file)) continue;
  const body = file.endsWith('.body');
  if (body ? !textBody(file) : !TEXT.test(file)) continue;
  files += 1;
  const text = readFileSync(file, 'utf8');
  const code = /\.(ts|tsx|js|mjs|cjs)$/.test(file);
  for (const f of findBreaches(text, { code })) {
    if (!ALLOW[f.rule].test(rel)) problems.push(`${rel}: ${f.rule} (${JSON.stringify(f.match)})`);
  }
  if (isBuilt.has(file)) {
    if (body) bodies += 1;
    repoIn(rel, text);
    if (file.endsWith('.html')) {
      pages += 1;
      const m = visibleText(text).match(NAME_IN_PARENS);
      if (m)
        problems.push(
          `${rel}: "${m[0]}" in the page's visible text (the visible name is "${site.name}"; the form with "(Jack)" is for titles and search data)`,
        );
    }
  } else if (rel.startsWith('public/')) repoIn(rel, text);
}

// the old résumé is never served
for (const p of ['public/documents/QijinXu_Resume.pdf', 'public/QijinXu_Resume.pdf']) {
  if (existsSync(path.join(ROOT, p))) problems.push(`${p}: the old résumé (it has a phone number) must not be served`);
}

// the one public PDF: its own text
const pdfPath = path.join(ROOT, 'public', 'resume.pdf');
if (existsSync(pdfPath)) {
  const doc = await getDocumentProxy(new Uint8Array(readFileSync(pdfPath)));
  const { text } = await extractText(doc, { mergePages: true });
  for (const f of findBreaches(String(text)))
    problems.push(`public/resume.pdf (its text): ${f.rule} (${JSON.stringify(f.match)})`);
  const raw = readFileSync(pdfPath, 'latin1');
  if (/tel:/i.test(raw)) problems.push('public/resume.pdf: a tel: link');
  if (NAME_IN_PARENS.test(String(text))) problems.push('public/resume.pdf (its text): the name with "(Jack)"');
  repoIn('public/resume.pdf (its text)', String(text));
  repoIn('public/resume.pdf (its links)', raw);
} else problems.push('public/resume.pdf is missing (npm run build:pdf)');

if (problems.length) {
  console.error(`compliance: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(
  `compliance: ${files} files clean (no phone, address, project-management credential, old PDF, CJK` +
    (built.length
      ? `; ${pages} built pages with no "(Jack)" in their visible text; ${bodies} route outputs read; ` +
        (REPO ? 'no link to the repository' : 'the repository may be linked: showSourceCode is on') +
        `) · build: ${DIST}`
      : `) · no build found in ${DIST}: sources only, so the visible-name and repository rules covered public/ and the PDF alone`),
);
