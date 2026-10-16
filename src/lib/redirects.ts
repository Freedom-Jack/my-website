/**
 * The old site's URLs and where they go now (DESIGN §5, COPY §8.9). Served as 301s by next.config.ts.
 *
 * The old résumé PDF (it carried a phone number) goes to the résumé PAGE, never to the new /resume.pdf:
 * an old link should land on the page, not silently on a different file.
 */
export interface Redirect {
  from: string;
  to: string;
}

export const redirects: readonly Redirect[] = [
  { from: '/about', to: '/' },
  { from: '/projects', to: '/work/' },
  { from: '/blog', to: '/writing/' },
  { from: '/blog/Building-Autonomous-AI-Agents', to: '/writing/what-is-an-ai-agent/' },
  { from: '/writing/building-modular-ai-agents', to: '/writing/what-is-an-ai-agent/' },
  { from: '/blog/welcome-to-my-first-blog', to: '/writing/' },
  { from: '/blog/welcome-to-my-second-blog', to: '/writing/' },
  { from: '/documents/QijinXu_Resume.pdf', to: '/resume/' },
];
