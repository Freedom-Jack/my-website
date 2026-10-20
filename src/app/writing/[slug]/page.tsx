import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { site } from '@content/site';
import { NotePage } from '@/features/writing/NotePage';
import { loadNote, noteSlugs } from '@/features/writing/notes';
import { pageMetadata } from '@/lib/seo';

/** One page per piece: content/writing/<slug>.mdx. Every piece is built ahead; an unknown slug is the 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return noteSlugs().map((slug) => ({ slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!noteSlugs().includes(slug)) return {};
  const { meta } = await loadNote(slug);
  return pageMetadata({ title: `${site.searchName} · ${meta.title}`, description: meta.metaDescription }, meta.href, {
    type: 'article',
  });
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  if (!noteSlugs().includes(slug)) notFound();
  return <NotePage note={await loadNote(slug)} />;
}
