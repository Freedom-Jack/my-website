import type { Metadata } from 'next';
import { resumePage } from '@content/pages/resume';
import { ResumePage } from '@/features/resume/ResumePage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata(resumePage.meta, '/resume/', {
  alternates: {
    types: {
      'application/pdf': [{ url: '/resume.pdf', title: 'Résumé (PDF)' }],
      'application/json': [{ url: '/resume.json', title: 'JSON Resume' }],
    },
  },
});

export default function Page() {
  return <ResumePage />;
}
