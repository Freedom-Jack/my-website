import type { Metadata } from 'next';
import { work } from '@content/pages/work';
import { WorkIndex } from '@/features/work/WorkIndex';
import { pageMetadata } from '@/lib/seo';

/** "In the open" is read from GitHub on the server: at build time, then at most once a day. */
export const revalidate = 86400;

export const metadata: Metadata = pageMetadata(work.meta, '/work/');

export default function Page() {
  return <WorkIndex />;
}
