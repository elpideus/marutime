import { AniListClient, type AniListListEntry, type AniListListStatus } from '@marutime/metadata';
import { errors } from '../errors';
import type { ImportItemInput, ImportMovie, ImportShow } from '../import-format';

/**
 * AniList tracks each season or cour as its own title; TMDB groups them into
 * one show with seasons. The community-maintained Fribb/anime-lists dataset
 * maps AniList ids to TMDB ids and seasons (and episode offsets for split
 * cours). Titles it does not cover fall back to a title search.
 */
const MAPPING_URL = 'https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-mini.json';

type Mapping = { tv?: number; movie?: number; season?: number; offset?: number; type?: string };
type MappingIndex = { byAniList: Map<number, Mapping>; byShowSeason: Map<string, number[]> };

let mappingCache: { at: number; index: MappingIndex } | null = null;

async function loadMapping(): Promise<MappingIndex | null> {
  if (mappingCache && Date.now() - mappingCache.at < 24 * 60 * 60 * 1000) return mappingCache.index;
  try {
    const res = await fetch(MAPPING_URL, { cache: 'no-store', signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return mappingCache?.index ?? null;
    type Raw = { anilist_id?: number; type?: string; themoviedb_id?: { tv?: number; movie?: number | number[] }; season?: { tmdb?: number; tvdb?: number }; episode_offset?: { tmdb?: number; tvdb?: number } };
    const raw = (await res.json()) as Raw[];
    const byAniList = new Map<number, Mapping>();
    const byShowSeason = new Map<string, number[]>();
    for (const r of raw) {
      if (!r.anilist_id || !r.themoviedb_id) continue;
      const movie = Array.isArray(r.themoviedb_id.movie) ? r.themoviedb_id.movie[0] : r.themoviedb_id.movie;
      const season = r.season?.tmdb ?? r.season?.tvdb;
      const m: Mapping = { tv: r.themoviedb_id.tv, movie, season, offset: r.episode_offset?.tmdb ?? r.episode_offset?.tvdb, type: r.type };
      byAniList.set(r.anilist_id, m);
      if (m.tv && season !== undefined) {
        const k = `${m.tv}:${season}`;
        byShowSeason.set(k, [...(byShowSeason.get(k) ?? []), r.anilist_id]);
      }
    }
    mappingCache = { at: Date.now(), index: { byAniList, byShowSeason } };
    return mappingCache.index;
  } catch {
    return mappingCache?.index ?? null;
  }
}

const isoToEpoch = (iso: string | null) => (iso ? Math.trunc(Date.parse(`${iso}T12:00:00Z`) / 1000) : null);

function watchedAt(e: AniListListEntry): number | null {
  return isoToEpoch(e.completedAt) ?? e.updatedAt ?? isoToEpoch(e.startedAt) ?? e.createdAt;
}

function titlesOf(e: AniListListEntry): string[] {
  return [...new Set([e.media.titleEnglish, e.media.titleRomaji, e.media.titleNative].filter((t): t is string => Boolean(t)))];
}

/** One status for a show made of several AniList entries: anything in progress wins. */
function combinedStatus(statuses: AniListListStatus[]): ImportShow['status'] {
  const active = statuses.filter((s) => s !== 'PLANNING');
  if (active.some((s) => s === 'CURRENT' || s === 'REPEATING')) return 'watching';
  if (active.some((s) => s === 'PAUSED')) return 'on_hold';
  if (active.length && active.every((s) => s === 'DROPPED')) return 'dropped';
  if (active.length && active.every((s) => s === 'COMPLETED')) return 'completed';
  return undefined;
}

/** Episodes before this part when AniList splits one TMDB season (e.g. "Part 2" starts at episode 13). */
async function splitOffsets(client: AniListClient, entries: AniListListEntry[], index: MappingIndex): Promise<Map<number, number>> {
  const offsets = new Map<number, number>();
  const groups = new Map<string, number[]>();
  for (const e of entries) {
    const m = index.byAniList.get(e.media.id);
    if (!m?.tv || m.season === undefined || m.offset !== undefined) continue;
    const siblings = (index.byShowSeason.get(`${m.tv}:${m.season}`) ?? []).filter((id) => index.byAniList.get(id)?.type === m.type);
    if (siblings.length > 1) groups.set(`${m.tv}:${m.season}:${m.type}`, siblings);
  }
  if (!groups.size) return offsets;
  const info = await client.getEpisodeCounts([...groups.values()].flat()).catch(() => null);
  if (!info) return offsets;
  for (const siblings of groups.values()) {
    const ordered = siblings.filter((id) => info.has(id)).sort((a, b) => (info.get(a)!.startDate ?? '9999').localeCompare(info.get(b)!.startDate ?? '9999'));
    let before = 0;
    for (const id of ordered) {
      offsets.set(id, before);
      before += info.get(id)!.episodes ?? 0;
    }
  }
  return offsets;
}

export async function buildAniListImport(userName: string): Promise<{ label: string; items: ImportItemInput[] }> {
  const name = userName.trim().replace(/^@/, '').replace(/^https?:\/\/anilist\.co\/user\//i, '').replace(/\/.*$/, '');
  if (!/^[\w-]{2,40}$/.test(name)) throw errors.validation('That does not look like an AniList username');
  const client = new AniListClient();
  const list = await client.getUserAnimeList(name).catch((err: Error) => {
    if (/private/i.test(err.message)) throw errors.validation(`${name}'s AniList profile is private. Make it public in AniList's settings while you import, then switch it back.`);
    throw errors.unavailable('AniList did not answer. Try again in a minute.');
  });
  if (!list) throw errors.validation(`There is no AniList user called "${name}".`);
  if (!list.entries.length) throw errors.validation(`${list.user.name}'s anime list is empty`);

  const index = await loadMapping();
  const offsets = index ? await splitOffsets(client, list.entries, index) : new Map<number, number>();

  const shows = new Map<number, ImportShow & { statuses: AniListListStatus[] }>();
  const items: ImportItemInput[] = [];
  for (const e of list.entries) {
    const m = index?.byAniList.get(e.media.id);
    const titles = titlesOf(e);
    const year = e.media.startDate ? Number(e.media.startDate.slice(0, 4)) : undefined;
    const planning = e.status === 'PLANNING';
    const at = watchedAt(e);
    // Progress is free-form on AniList (people type 9001); never count past the title's real length.
    const progress = Math.min(e.progress, e.media.episodes ?? e.progress, 3000);

    if (e.media.format === 'MOVIE' || (m?.movie && !m.tv)) {
      const watched = !planning && (e.status === 'COMPLETED' || e.status === 'REPEATING' || progress > 0);
      const movie: ImportMovie = {
        kind: 'movie',
        key: `anilist:${e.media.id}`,
        title: titles[0] ?? `AniList #${e.media.id}`,
        altTitles: titles.slice(1, 6),
        year,
        ids: { anilist: e.media.id, ...(m?.movie ? { tmdb: m.movie } : {}) },
        watches: watched ? Array.from({ length: 1 + Math.min(e.repeat, 20) }, () => at) : [],
        watchlist: planning,
        ...(e.score > 0 ? { rating: e.score } : {}),
      };
      items.push(movie);
      continue;
    }

    if (m?.tv) {
      let show = shows.get(m.tv);
      if (!show) {
        show = { kind: 'show', key: `anilist:tv:${m.tv}`, title: titles[0] ?? `AniList #${e.media.id}`, altTitles: titles.slice(1, 6), ids: { tmdb: m.tv, anilist: e.media.id }, follow: false, watchlist: false, favorite: false, episodes: [], progress: [], statuses: [] };
        shows.set(m.tv, show);
      }
      show.statuses.push(e.status);
      if (!planning) show.follow = true;
      // Season 0 means specials/OVAs, which TMDB numbers its own way: follow the show, but don't guess episodes.
      if (!planning && progress > 0 && m.season !== 0) {
        show.progress.push({ season: m.season ?? null, offset: m.offset ?? offsets.get(e.media.id) ?? 0, count: progress, watchedAt: at });
      }
      continue;
    }

    // Not in the mapping: match by title, and only place episodes if this is the show's first season (same start year).
    items.push({
      kind: 'show',
      key: `anilist:${e.media.id}`,
      title: titles[0] ?? `AniList #${e.media.id}`,
      altTitles: titles.slice(1, 6),
      year,
      ids: { anilist: e.media.id },
      status: combinedStatus([e.status]),
      follow: !planning,
      watchlist: planning,
      progress: !planning && progress > 0 ? [{ season: null, offset: 0, count: progress, watchedAt: at, year }] : [],
    });
  }
  for (const { statuses, ...show } of shows.values()) {
    const onlyPlanning = statuses.every((s) => s === 'PLANNING');
    items.unshift({ ...show, status: combinedStatus(statuses), watchlist: onlyPlanning });
  }
  return { label: `AniList · ${list.user.name}`, items };
}
