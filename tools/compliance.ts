/**
 * The hard-rule sweep (DESIGN.md §2), run in CI after the build and before any commit:
 *   no phone number anywhere (site, PDF, JSON, comments) · no street address · no project-management credential ·
 *   never the old résumé PDF (not served, not linked; only its 301 to /resume/) · no Chinese characters at all in
 *   text (the seal's glyph is an outline) · no file name with CJK.
 * It reads the sources (content/, src/, public/), the built pages (.next/server/app: what visitors get, HTML and
 * RSC payloads) and the PDF's own text.
 *
 *   npm run check:compliance            (after npm run build; without a build it checks the sources only)
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { extractText, getDocumentProxy } from 'unpdf';
import { CJK, findBreaches, type Finding } from '../src/lib/compliance.ts';

const ROOT = process.cwd();
const TEXT = /\.(ts|tsx|js|mjs|cjs|css|json|mdx|md|svg|txt|xml|html|rsc|webmanifest)$/;
/** Files that must name a rule to enforce it: the patterns themselves, the redirect, the tests. */
const ALLOW: Record<Finding['rule'], RegExp> = {
  phone: /^(src\/lib\/compliance\.ts|tools\/(compliance|build-pdf|linkcheck)\.ts|tests\/)/,
  cjk: /^(src\/lib\/compliance\.ts|tests\/)/,
  pmp: /^(src\/lib\/compliance\.ts|tools\/compliance\.ts|tests\/)/,
  'old-pdf':
    /^(src\/lib\/redirects\.ts|src\/lib\/compliance\.ts|tools\/compliance\.ts|tests\/|\.next\/server\/.*(routes-manifest|redirects).*)/,
  street: /^(src\/lib\/compliance\.ts|tests\/)/,
};

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

const problems: string[] = [];
let files = 0;

const sources = ['content', 'src', 'public', 'tools', 'tests', '.github'].flatMap((d) => walk(path.join(ROOT, d)));
const built = walk(path.join(ROOT, '.next', 'server', 'app')).filter((f) => /\.(html|rsc|body|json)$/.test(f));
for (const file of [...sources, ...built, path.join(ROOT, 'next.config.ts'), path.join(ROOT, 'package.json')]) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  if (CJK.test(path.basename(file))) problems.push(`${rel}: a file name with a CJK character`);
  if (!TEXT.test(file) || !existsSync(file)) continue;
  files += 1;
  const code = /\.(ts|tsx|js|mjs|cjs)$/.test(file);
  for (const f of findBreaches(readFileSync(file, 'utf8'), { code })) {
    if (!ALLOW[f.rule].test(rel)) problems.push(`${rel}: ${f.rule} (${JSON.stringify(f.match)})`);
  }
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
  if (/tel:/i.test(readFileSync(pdfPath, 'latin1'))) problems.push('public/resume.pdf: a tel: link');
} else problems.push('public/resume.pdf is missing (npm run build:pdf)');

if (problems.length) {
  console.error(`compliance: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(
  `compliance: ${files} files clean (no phone, address, project-management credential, old PDF or CJK)${built.length ? '' : '; no build found, sources only'}`,
);
