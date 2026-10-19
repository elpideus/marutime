import { and, eq, getDb, media, type DbExecutor } from '@marutime/db';
import type { MediaSummary, MetadataProvider } from '@marutime/metadata';
import type { ImportMovie, ImportShow } from '../import-format';

/** Lower-case, accents and punctuation stripped, "&" spelled out: titles compared loosely. */
export function normalizeTitle(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\b(the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleScore(wanted: string[], candidate: MediaSummary): number {
  const have = [candidate.title, candidate.originalTitle ?? ''].map(normalizeTitle).filter(Boolean);
  let best = 0;
  for (const w of wanted.map(normalizeTitle).filter(Boolean)) {
    for (const h of have) {
      if (h === w) best = Math.max(best, 1);
      else if (h.startsWith(w) || w.startsWith(h)) best = Math.max(best, 0.7);
      else if (h.includes(w) || w.includes(h)) best = Math.max(best, 0.55);
    }
  }
  return best;
}

/**
 * Pick the search result that best fits: title first, then year, then
 * popularity as a tie-breaker. Returns null rather than guessing when nothing
 * fits well enough.
 */
export function pickBest(results: MediaSummary[], titles: string[], year: number | undefined): MediaSummary | null {
  let best: { r: MediaSummary; score: number } | null = null;
  for (const [i, r] of results.entries()) {
    const t = titleScore(titles, r);
    if (t === 0) continue;
    const ry = r.releaseDate ? Number(r.releaseDate.slice(0, 4)) : null;
    const y = !year || !ry ? 0 : ry === year ? 0.5 : Math.abs(ry - year) === 1 ? 0.25 : -0.4;
    const score = t + y - i * 0.02 + Math.min(0.1, Math.log10(1 + r.popularity) / 40);
    if (!best || score > best.score) best = { r, score };
  }
  return best && best.score >= 0.8 ? best.r : null;
}

async function search(provider: MetadataProvider, type: 'show' | 'movie', titles: string[], year: number | undefined): Promise<number | null> {
  for (const title of titles.filter(Boolean).slice(0, 3)) {
    const withYear = year ? (await provider.search(title, { type, year })).results : [];
    const hit = pickBest(withYear, titles, year) ?? pickBest((await provider.search(title, { type })).results, titles, year);
    if (hit) return hit.externalId;
  }
  return null;
}

/** TMDB id of a show: given directly, through TheTVDB (ours or TMDB's mapping), or by title. */
export async function resolveShow(provider: MetadataProvider, item: ImportShow, db: DbExecutor = getDb()): Promise<number | null> {
  if (item.ids.tmdb) return item.ids.tmdb;
  if (item.ids.tvdb) {
    const [local] = await db
      .select({ externalId: media.externalId })
      .from(media)
      .where(and(eq(media.provider, provider.id), eq(media.type, 'show'), eq(media.tvdbId, item.ids.tvdb)))
      .limit(1);
    if (local) return local.externalId;
    const found = await provider.findByExternalId('tvdb', item.ids.tvdb);
    if (found.shows[0]) return found.shows[0];
  }
  // No show id at all: any of its TheTVDB episode ids leads to the show.
  for (const [, , , tvdbEpisode] of item.episodes.slice(0, 3)) {
    if (!tvdbEpisode) continue;
    const found = await provider.findByExternalId('tvdb', tvdbEpisode);
    if (found.episodes[0]) return found.episodes[0].showId;
  }
  if (item.title.startsWith('TheTVDB #')) return null;
  return search(provider, 'show', [item.title, ...item.altTitles], item.year);
}

/** TMDB id of a movie: given directly, through IMDb, or by title, year and runtime. */
export async function resolveMovie(provider: MetadataProvider, item: ImportMovie): Promise<number | null> {
  if (item.ids.tmdb) return item.ids.tmdb;
  if (item.ids.imdb) {
    const found = await provider.findByExternalId('imdb', item.ids.imdb);
    if (found.movies[0]) return found.movies[0];
  }
  return search(provider, 'movie', [item.title, ...item.altTitles], item.year);
}
