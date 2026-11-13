import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { site } from '@content/site';
import { BootScript } from '@/components/layout/BootScript';
import { InkDefs } from '@/components/layout/InkDefs';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { Tail } from '@/components/layout/Tail';
import { Effects } from '@/features/effects/Effects';
import { elementClasses } from '@/features/landscape/elements';
import { Landscape } from '@/features/landscape/Landscape';
import { Navigation } from '@/features/navigation/Navigation';
import { JsonLd, personLd } from '@/lib/jsonld';
import { fontFaces } from './fonts';
// The design system, in order (each feature's CSS Module adds its own layout after these).
import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/layout.css';
import '@/styles/effects.css'; // the ink in the UI (links, the action, focus, the row rule, the flow dot: each element behind its el-* class)
import '@/styles/components.css';

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
 * Every page: the paper, the one persistent landscape canvas behind everything, the header with its river line, the
 * page's <main>, the tail (the colophon, the build stamp, "Still the landscape", the five names, the email, the seal,
 * the route announcer), and the Person JSON-LD.
 * The canvas and the chrome persist across pages; only <main> changes (features/navigation).
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-CA" className={elementClasses()} style={fontFaces} suppressHydrationWarning>
      <head>
        <BootScript />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Landscape />
        <InkDefs />
        <SiteHeader />
        {children}
        <Tail />
        <JsonLd data={personLd()} />
        <Navigation />
        <Effects />
      </body>
    </html>
  );
}
