import type { Metadata } from 'next';
import { notFoundPage } from '@content/pages/not-found';
import { Inscription } from '@/components/page/Inscription';
import { PageMain } from '@/components/page/PageMain';
import { Go } from '@/components/ui/Go';
import { LostMark } from '@/features/chrome/current';
import { InlineLink } from '@/lib/inline';
import styles from './not-found.module.css';

export const metadata: Metadata = {
  title: notFoundPage.meta.title,
  description: notFoundPage.meta.description,
};

/**
 * The 404: off the map, a lone peak and a path into mist. Its title and one line on the paper, then the way back and
 * one other way (a lost page's whole purpose is the way out). Nothing else, and no place is marked "you are here"
 * (LostMark).
 */
export default function NotFound() {
  const t = notFoundPage;
  return (
    <PageMain page="not-found">
      <Inscription>
        <h1 className="title title--long" id="lost-title">
          {t.title}
        </h1>
        <p className="title__under">{t.line}</p>
      </Inscription>
      <section className="row sec sec--first" aria-labelledby="lost-title">
        <p className={styles.ways}>
          <Go href={t.primary.href}>{t.primary.label}</Go>
          <InlineLink href={t.secondary.href} className={styles.other}>
            {t.secondary.label}
          </InlineLink>
        </p>
      </section>
      <LostMark />
    </PageMain>
  );
}
