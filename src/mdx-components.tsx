import type { MDXComponents } from 'mdx/types';
import { InlineLink } from '@/lib/inline';

/**
 * The MDX elements every content file shares (@next/mdx reads this file). Each page that renders MDX adds its own
 * (features/writing, features/work): a link is the site's brush link and navigates inside the painting.
 */
const base: MDXComponents = {
  a: ({ href = '', children }) => <InlineLink href={href}>{children}</InlineLink>,
};

export function useMDXComponents(components: MDXComponents = {}): MDXComponents {
  return { ...base, ...components };
}
