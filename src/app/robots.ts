import type { MetadataRoute } from 'next';
import { absolute } from '@/lib/seo';

/** /robots.txt: everything may be read; the sitemap says where everything is. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/' }, sitemap: absolute('/sitemap.xml') };
}
