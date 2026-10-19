import { getEnv } from '@marutime/config';
import type { MetadataRoute } from 'next';
import { BLOCKED_CRAWLERS } from '@/lib/bots';

/**
 * Search engines may index titles, lists and profiles, but not the parts of
 * the site that are endless for a crawler (every episode of every show, every
 * filter combination, search results), which would only burn database
 * transfer. Content harvesters are kept out altogether.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: [...BLOCKED_CRAWLERS], disallow: '/' },
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin', '/settings', '/notifications', '/feed', '/lists/s/', '/show/*/s/', '/search', '/u/*/followers', '/u/*/following', '/*?'],
        crawlDelay: 5,
      },
    ],
    sitemap: `${getEnv().APP_URL}/sitemap.xml`,
  };
}
