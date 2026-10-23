import type { MetadataRoute } from 'next';
import { site } from '@content/site';

/** /manifest.webmanifest: the home-screen shortcut's name and icon (Android, Chrome); the site stays a site. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: site.name,
    description: site.seo.description,
    start_url: '/',
    display: 'browser',
    background_color: '#EFF1EE',
    theme_color: '#EFF1EE',
    icons: [
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
}
