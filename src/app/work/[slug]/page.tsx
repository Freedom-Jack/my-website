import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { site } from '@content/site';
import { CasePage } from '@/features/work/CasePage';
import { caseSlugs, loadCase } from '@/features/work/cases';
import { plain } from '@/lib/markup';
import { pageMetadata } from '@/lib/seo';

/** One page per case: content/work/<slug>.mdx. Every case is built ahead; an unknown slug is the 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return caseSlugs().map((slug) => ({ slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!caseSlugs().includes(slug)) return {};
  const { meta } = await loadCase(slug);
  return pageMetadata(
    { title: `${site.searchName} · ${plain(meta.title)}`, description: plain(meta.metaDescription ?? meta.summary) },
    meta.href,
  );
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  if (!caseSlugs().includes(slug)) notFound();
  return <CasePage c={await loadCase(slug)} />;
}
