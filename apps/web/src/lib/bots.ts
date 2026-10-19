/**
 * Crawlers that harvest content (AI training, SEO link indexes) rather than
 * send visitors. Each page they fetch costs database transfer, and some walk
 * every episode of every show, so they are kept out entirely.
 */
export const BLOCKED_CRAWLERS = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'CCBot',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'Google-Extended',
  'Applebot-Extended',
  'Bytespider',
  'Amazonbot',
  'PerplexityBot',
  'meta-externalagent',
  'FacebookBot',
  'Diffbot',
  'cohere-ai',
  'ImagesiftBot',
  'Omgilibot',
  'Timpibot',
  'YouBot',
  'AhrefsBot',
  'SemrushBot',
  'MJ12bot',
  'DotBot',
  'DataForSeoBot',
  'PetalBot',
  'BLEXBot',
] as const;

const pattern = new RegExp(BLOCKED_CRAWLERS.map((b) => b.replace(/[-]/g, '\\-')).join('|'), 'i');

export function isBlockedCrawler(userAgent: string | null): boolean {
  return Boolean(userAgent && pattern.test(userAgent));
}
