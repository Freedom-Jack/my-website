import path from 'node:path';
import createMDX from '@next/mdx';
import type { NextConfig } from 'next';
import { redirects } from './src/lib/redirects.ts';

// MDX (one file per writing note and per Work case, under content/). Turbopack needs the plugins by name (or by
// absolute path for the site's own: src/lib/mdx/rehype-site.mjs).
const withMDX = createMDX({
  options: {
    remarkPlugins: ['remark-gfm', 'remark-frontmatter', ['remark-mdx-frontmatter', { name: 'frontmatter' }]],
    rehypePlugins: ['rehype-slug', path.join(process.cwd(), 'src/lib/mdx/rehype-site.mjs')],
  },
});

const config: NextConfig = {
  // This project's own folder is the root (never a parent folder that happens to hold another lockfile).
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
  // The pages read content/ at build time; the Work page (revalidated daily) reads it again on the server.
  outputFileTracingIncludes: { '/work': ['./content/**/*'], '/work/[slug]': ['./content/**/*'] },
  // Every page's canonical URL ends with a slash (/work/, /resume/); files (/resume.pdf) never do.
  trailingSlash: true,
  poweredByHeader: false,
  reactStrictMode: true,
  // The old site's URLs, as permanent 301s (DESIGN §5).
  async redirects() {
    return redirects.map((r) => ({ source: r.from, destination: r.to, statusCode: 301 as const }));
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
        ],
      },
    ];
  },
};

export default withMDX(config);
