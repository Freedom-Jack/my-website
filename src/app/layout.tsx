import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { site } from '@content/site';
import { Band } from '@/components/layout/Band';
import { BootScript } from '@/components/layout/BootScript';
import { InkDefs } from '@/components/layout/InkDefs';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { Tail } from '@/components/layout/Tail';
import { AskHost } from '@/features/ask/AskHost';
import { elementClasses } from '@/features/landscape/elements';
import { Navigation } from '@/features/navigation/Navigation';
import { Switches } from '@/features/qa/Switches';
import { JsonLd, personLd } from '@/lib/jsonld';
import { fontClasses } from './fonts';
// The design system, in order (each feature's CSS Module adds its own layout after these).
import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/band.css'; // the painting: the band at every page's top, a ribbon under the header as it is read
import '@/styles/shell.css'; // the header's bar, the page's frame and head, the tail
import '@/styles/prose.css'; // the two voices and the pieces set in them
import '@/styles/leaves.css'; // the body's shared language: leaves, covers, figures, buttons

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: site.searchName,
  applicationName: site.name,
  authors: [{ name: site.name, url: `${site.url}/` }],
  formatDetection: { telephone: false, address: false, email: false },
  appleWebApp: { title: site.name }, // the home-screen label (else the full title, cut short)
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#EFF1EE',
  colorScheme: 'only light', // cool paper by design (base.css too): never auto-darkened
};

/**
 * Every page: the paper; the band (the one painting, fixed across the top, persistent across pages); the header on
 * its sky; the page's <main>, whose words rise under the band; the tail (the scroll in miniature with the five
 * places' names, the colophon, the build stamp, "Still the landscape", the email, the seal, the route announcer);
 * and the Person JSON-LD. Only <main> changes between pages (features/navigation).
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-CA" className={`${elementClasses()} ${fontClasses}`} suppressHydrationWarning>
      <head>
        <BootScript />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Band />
        <InkDefs />
        <SiteHeader />
        {children}
        <Tail />
        <AskHost />
        <JsonLd data={personLd()} />
        <Navigation />
        {/* the preview's switch panel: QA builds only (never in the production site) */}
        {process.env.NEXT_PUBLIC_INK_QA === '1' ? <Switches /> : null}
      </body>
    </html>
  );
}
