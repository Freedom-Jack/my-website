import type { Metadata } from 'next';
import { writing } from '@content/pages/writing';
import { WritingIndex } from '@/features/writing/WritingIndex';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(writing.meta, '/writing/', {
  alternates: { types: { 'application/rss+xml': [{ url: '/writing/feed.xml', title: writing.feed.title }] } },
});

export default function Page() {
  return <WritingIndex />;
}
