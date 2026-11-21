import type { Metadata } from 'next';
import { about } from '@content/pages/about';
import { AboutPage } from '@/features/about/AboutPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(about.meta, '/about/', { type: 'profile' });

export default function Page() {
  return <AboutPage />;
}
