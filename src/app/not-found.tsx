import type { Metadata } from 'next';
import { notFoundPage } from '@content/pages/not-found';
import { PageMain } from '@/components/page/PageMain';
import { Strip } from '@/components/page/Strip';
import { InkButton } from '@/components/ui/InkButton';
import { LostMark } from '@/features/chrome/current';
import { InlineLink } from '@/lib/inline';

export const metadata: Metadata = {
  title: notFoundPage.meta.title,
  description: notFoundPage.meta.description,
};

/**
 * The 404: the lone peak's strip with the title, its one line and the way back in its mist (wide), on paper below
 * it on narrower screens. No closing scene: the path ends in mist, and the footer's story map is the way back.
 */
export default function NotFound() {
  const t = notFoundPage;
  return (
    <PageMain page="not-found">
      <Strip variant="sub" labelledBy="lost-title">
        <h1 className="page-title" id="lost-title">
          {t.title}
        </h1>
        <p className="lead">{t.line}</p>
        <p className="actions">
          <InkButton href={t.primary.href}>{t.primary.label}</InkButton>
          <InlineLink href={t.secondary.href}>{t.secondary.label}</InlineLink>
        </p>
      </Strip>
      <LostMark />
    </PageMain>
  );
}
