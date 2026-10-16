'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Before the cases had pages of their own they were anchors on /work/ (/work/#rag-assistant: Home linked them,
 * and so may others). A hash names no server route, so it cannot be a 301: an arrival with an old case anchor
 * goes on to the case's own page. (Without JS the anchor lands on the case's row in the index.)
 */
export function OldAnchors({ slugs }: { slugs: string[] }) {
  const router = useRouter();
  useEffect(() => {
    const slug = decodeURIComponent(location.hash.slice(1));
    if (slugs.includes(slug)) router.replace(`/work/${slug}/`);
  }, [router, slugs]);
  return null;
}
