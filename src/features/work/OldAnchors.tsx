'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * A link to a case's anchor on the index (/work/#rag-assistant) goes on to the case's own page. A hash names no
 * server route, so it cannot be a redirect in src/lib/redirects.ts. (Without JS the anchor lands on the case's row.)
 */
export function OldAnchors({ slugs }: { slugs: string[] }) {
  const router = useRouter();
  useEffect(() => {
    const slug = decodeURIComponent(location.hash.slice(1));
    if (slugs.includes(slug)) router.replace(`/work/${slug}/`);
  }, [router, slugs]);
  return null;
}
