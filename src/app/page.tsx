import type { Metadata } from 'next';
import { home } from '@content/pages/home';
import { HomePage } from '@/features/home/HomePage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(home.meta, '/', { type: 'profile' });

export default function Page() {
  return <HomePage />;
}
