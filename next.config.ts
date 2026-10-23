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
        // the résumé opens in the tab (DESIGN §5) and saves under his name, not as "resume.pdf"
        source: '/resume.pdf',
        headers: [{ key: 'Content-Disposition', value: 'inline; filename="Qijin-Xu-Resume.pdf"' }],
      },
      {
        // the stills, the photo and the link-preview cards: a day in the browser, refreshed behind the scenes
        source: '/:dir(scenes|images|og)/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
          },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
        ],
      },
    ];
  },
};

export default withMDX(config);
