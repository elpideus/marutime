/**
 * Pure URL and category helpers with zero runtime dependencies.
 * Safe to import from client components (no database, no Node built-ins).
 */

export type MediaCategory = 'shows' | 'movies' | 'anime';

export function mediaCategory(m: { type: 'show' | 'movie'; isAnime: boolean }): MediaCategory {
  if (m.isAnime) return 'anime';
  return m.type === 'show' ? 'shows' : 'movies';
}

function slugFromTitle(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Public URL for a media row or summary. Uses the provider id (TMDB), like TVTime used TVDB ids. */
export function mediaHref(m: { type: 'show' | 'movie'; externalId: number; slug?: string | null; title?: string }): string {
  const base = m.type === 'show' ? '/show' : '/movie';
  const slug = m.slug ?? (m.title ? slugFromTitle(m.title) : '');
  return slug ? `${base}/${m.externalId}-${slug}` : `${base}/${m.externalId}`;
}

export function episodeHref(m: { externalId: number; slug?: string | null }, seasonNumber: number, episodeNumber: number): string {
  return `${mediaHref({ type: 'show', externalId: m.externalId, slug: m.slug })}/s/${seasonNumber}/e/${episodeNumber}`;
}

export function seasonHref(m: { externalId: number; slug?: string | null }, seasonNumber: number): string {
  return `${mediaHref({ type: 'show', externalId: m.externalId, slug: m.slug })}/s/${seasonNumber}`;
}

/** Parse "1399-game-of-thrones" or "1399" into the numeric external id. */
export function parseMediaParam(param: string): number | null {
  const m = /^(\d+)(?:-.*)?$/.exec(param);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export function listHref(owner: { username: string }, list: { slug: string }): string {
  return `/u/${owner.username}/lists/${list.slug}`;
}

export function listShareHref(list: { shareToken: string }): string {
  return `/lists/s/${list.shareToken}`;
}
