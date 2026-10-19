import { getEnv } from '@marutime/config';
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/admin', '/settings', '/notifications', '/feed', '/lists/s/'] }],
    sitemap: `${getEnv().APP_URL}/sitemap.xml`,
  };
}
