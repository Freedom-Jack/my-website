import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

/** A content folder's MDX files and their front matter (as remark-mdx-frontmatter reads it at build time). */
export function mdxFiles(dir: string): Array<{ slug: string; file: string; data: unknown; body: string }> {
  const root = path.join(process.cwd(), dir);
  return readdirSync(root)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => {
      const text = readFileSync(path.join(root, f), 'utf8');
      const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (!m) throw new Error(`${dir}/${f}: no front matter`);
      return { slug: f.slice(0, -4), file: `${dir}/${f}`, data: parse(m[1]!), body: m[2]! };
    });
}
