import { getEnv } from '@marutime/config';
import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getEnv().APP_URL;
  return ['', '/discover', '/lists', '/about', '/legal/privacy', '/legal/terms', '/legal/cookies', '/legal/imprint'].map((p) => ({ url: `${base}${p}`, changeFrequency: p === '' ? 'daily' : 'weekly', priority: p === '' ? 1 : 0.6 }));
}
