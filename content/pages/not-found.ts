import type { PageWords } from './types';

/** The 404 (COPY.md §7): the lone peak, the path running into mist. noindex. */
export const notFoundPage = {
  meta: {
    title: 'Qijin (Jack) Xu · Page not found',
    description: 'This page doesn’t exist. Head back to the home page of Qijin (Jack) Xu.',
  },
  title: 'Page not found',
  line: 'This path fades into the mist.',
  primary: { label: 'Back to home', href: '/' },
  secondary: { label: 'See the work', href: '/work/' },
} satisfies PageWords & Record<string, unknown>;
