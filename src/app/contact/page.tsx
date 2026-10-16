import type { Metadata } from 'next';
import { contact } from '@content/pages/contact';
import { ContactPage } from '@/features/contact/ContactPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(contact.meta, '/contact/');

export default function Page() {
  return <ContactPage />;
}
