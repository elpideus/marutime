import { csvRecords } from './csv';
import type { ImportItemInput, ImportList, ImportMovie, ImportShow } from './schema';

/**
 * TV Time's GDPR export (a zip of CSVs, sent by their support after the
 * shutdown). Shows and episodes carry TheTVDB ids; movies only carry a name,
 * release date and runtime, so they are matched by title later.
 *
 * Files used (older exports have only some of them):
 * - tracking-prod-records-v2.csv: episode watches, rewatches, followed shows
 *   with their "watch later" and "archived" flags
 * - tracking-prod-records.csv: movie watches/rewatches/watch-later, plus
 *   older episode watches
 * - seen_episode.csv / watched_on_episode.csv: episode watches in older exports
 * - followed_tv_show.csv, user_tv_show_data.csv, user_show_special_status.csv:
 *   follows, favourites, watch-later
 * - lists-prod-lists.csv: custom lists and favourites
 */
export const TVTIME_FILES = [
  'tracking-prod-records-v2.csv',
  'tracking-prod-records.csv',
  'seen_episode.csv',
  'watched_on_episode.csv',
  'followed_tv_show.csv',
  'user_tv_show_data.csv',
  'user_show_special_status.csv',
  'lists-prod-lists.csv',
] as const;

/** True when a zip entry name is one of the files the importer reads. */
export function isTvTimeFile(name: string): boolean {
  const base = name.split('/').pop() ?? name;
  return (TVTIME_FILES as readonly string[]).includes(base);
}

const int = (v: string | undefined): number | null => {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
};

/** "2019-05-07 21:58:06" (UTC) or epoch seconds/microseconds → epoch seconds. */
function toEpoch(v: string | undefined): number | null {
  if (!v) return null;
  if (/^\d+$/.test(v)) {
    const n = Number(v);
    const s = n > 1e14 ? n / 1e6 : n > 1e11 ? n / 1e3 : n;
    return s > 0 ? Math.trunc(s) : null;
  }
  const t = Date.parse(v.includes('T') ? v : `${v.replace(' ', 'T')}Z`);
  return Number.isFinite(t) && t > 0 ? Math.trunc(t / 1000) : null;
}

function yearOf(v: string | undefined): number | undefined {
  const y = v ? Number(v.slice(0, 4)) : NaN;
  return y > 1870 && y < 2200 ? y : undefined;
}

const truthy = (v: string | undefined) => v === 'true' || v === '1';

type ShowAcc = Omit<ImportShow, 'episodes' | 'progress' | 'altTitles'> & { episodes: [number, number, number | null, number | null][]; seen: Set<number> };
type MovieAcc = Omit<ImportMovie, 'watches' | 'altTitles'> & { watches: (number | null)[]; watched: boolean; rewatches: (number | null)[] };

/** Go's `fmt` rendering of a slice of maps ("[map[a:1 b:x] map[...]]") → one string per map. */
function goMaps(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith('map[', i)) {
      if (depth === 0) start = i + 4;
      depth++;
      i += 3;
    } else if (text[i] === '[') depth += depth > 0 ? 1 : 0;
    else if (text[i] === ']' && depth > 0) {
      depth--;
      if (depth === 0 && start >= 0) out.push(text.slice(start, i));
    }
  }
  return out;
}

/** A field from a Go map rendering; keys come out alphabetically, so a value runs until the next known key. */
function goField(map: string, name: string, next: string[]): string | null {
  const at = map.indexOf(`${name}:`);
  if (at < 0) return null;
  const from = at + name.length + 1;
  let end = map.length;
  for (const n of next) {
    const j = map.indexOf(` ${n}:`, from);
    if (j >= 0 && j < end) end = j;
  }
  const v = map.slice(from, end).trim();
  return v === '<nil>' ? null : v;
}

export function parseTvTime(files: Record<string, string>): ImportItemInput[] {
  const shows = new Map<string, ShowAcc>();
  const movies = new Map<string, MovieAcc>();
  const seenEpisodes = new Set<number>();

  const show = (tvdb: number | null, name: string): ShowAcc | null => {
    const key = tvdb ? `tvtime:s:${tvdb}` : name ? `tvtime:n:${name.toLowerCase()}` : null;
    if (!key) return null;
    let s = shows.get(key);
    if (!s && !tvdb) {
      // Older files name the show but carry no id: join the id-carrying entry of the same name.
      for (const other of shows.values()) if (other.title.toLowerCase() === name.toLowerCase()) return other;
    }
    if (!s) {
      s = { kind: 'show', key, title: name || `TheTVDB #${tvdb}`, ids: tvdb ? { tvdb } : {}, follow: false, watchlist: false, favorite: false, episodes: [], seen: new Set() };
      shows.set(key, s);
    } else if (name && s.title.startsWith('TheTVDB #')) s.title = name;
    return s;
  };

  const addViewing = (s: ShowAcc, season: number, episode: number, at: number | null, tvdbEpisode: number | null, rewatch = false) => {
    if (!rewatch && tvdbEpisode) {
      if (seenEpisodes.has(tvdbEpisode)) return;
      seenEpisodes.add(tvdbEpisode);
    }
    s.episodes.push([season, episode, at, tvdbEpisode]);
  };

  // --- Episodes and followed shows (current format) ---
  const v2 = csvRecords(files['tracking-prod-records-v2.csv']);
  for (const r of v2) {
    const kind = r.key ?? '';
    if (kind.startsWith('watch-episode') || kind.startsWith('rewatch-episode')) {
      const s = show(int(r.s_id), r.series_name ?? '');
      const season = Number(r.season_number || r.s_no);
      const episode = Number(r.episode_number || r.ep_no);
      if (!s || !Number.isFinite(season) || !Number.isFinite(episode)) continue;
      addViewing(s, season, episode, toEpoch(r.created_at), int(r.ep_id), kind.startsWith('rewatch'));
    } else if (kind.startsWith('user-series')) {
      const s = show(int(r.s_id), r.series_name ?? '');
      if (!s) continue;
      s.follow ||= truthy(r.is_followed);
      s.watchlist ||= truthy(r.is_for_later);
      if (truthy(r.is_archived)) s.status = 'dropped';
      s.addedAt ??= toEpoch(r.followed_at) ?? toEpoch(r.created_at);
    }
  }

  // --- Movies, plus episode watches from the previous format ---
  const v1 = csvRecords(files['tracking-prod-records.csv']);
  for (const r of v1) {
    if (r.entity_type === 'episode' && r.type === 'watch') {
      const s = show(int(r.series_id), r.series_name ?? '');
      if (!s) continue;
      addViewing(s, Number(r.season_number), Number(r.episode_number), toEpoch(r.watch_date) ?? toEpoch(r.created_at), int(r.episode_id));
    } else if (r.entity_type === 'movie' && r.uuid) {
      let m = movies.get(r.uuid);
      if (!m) {
        m = { kind: 'movie', key: `tvtime:m:${r.uuid}`, title: r.movie_name || 'Untitled', ids: {}, watchlist: false, watches: [], watched: false, rewatches: [] };
        movies.set(r.uuid, m);
      }
      if (r.movie_name) m.title = r.movie_name;
      m.year ??= r.release_date && !r.release_date.startsWith('0001') ? yearOf(r.release_date) : undefined;
      const runtime = int(r.runtime);
      if (runtime) m.runtime = Math.max(1, Math.round(runtime / 60));
      if (r.type === 'watch') {
        m.watched = true;
        m.watches.push(toEpoch(r.watch_date) ?? toEpoch(r.created_at));
      } else if (r.type === 'rewatch') m.rewatches.push(toEpoch(r.created_at));
      else if (r.type === 'towatch') m.watchlist = true;
    }
  }

  // --- Older exports: watches identified by show name only ---
  for (const file of ['seen_episode.csv', 'watched_on_episode.csv'] as const) {
    for (const r of csvRecords(files[file])) {
      const s = show(int(r.tv_show_id), r.tv_show_name ?? '');
      const season = Number(r.episode_season_number);
      const episode = Number(r.episode_number);
      if (!s || !Number.isFinite(season) || !Number.isFinite(episode)) continue;
      addViewing(s, season, episode, toEpoch(r.created_at), int(r.episode_id));
    }
  }

  // --- Follows, favourites and watch-later from the older tables ---
  for (const r of csvRecords(files['followed_tv_show.csv'])) {
    const s = show(int(r.tv_show_id), r.tv_show_name ?? '');
    if (!s) continue;
    if (truthy(r.active) || r.active === undefined) s.follow = true;
    if (truthy(r.archived)) s.status ??= 'dropped';
    s.addedAt ??= toEpoch(r.created_at);
  }
  for (const r of csvRecords(files['user_tv_show_data.csv'])) {
    const s = show(int(r.tv_show_id), r.tv_show_name ?? '');
    if (!s) continue;
    if (truthy(r.is_favorited)) s.favorite = true;
    if (truthy(r.is_followed)) s.follow = true;
  }
  for (const r of csvRecords(files['user_show_special_status.csv'])) {
    const s = show(int(r.tv_show_id), r.tv_show_name ?? '');
    if (!s) continue;
    if (r.status === 'for_later') s.watchlist = true;
    if (r.status === 'favorite') s.favorite = true;
  }

  // --- Lists ---
  const lists: ImportList[] = [];
  /** Shows that are only in a list still need importing, so the list can point at them. */
  const listed = new Set<string>();
  const listRows = csvRecords(files['lists-prod-lists.csv']);
  const meta = new Map<string, { name: string | null; description: string | null }>();
  for (const r of listRows) {
    if (r.s_key !== 'collection' || !r.lists) continue;
    for (const m of goMaps(r.lists)) {
      const sKey = goField(m, 's_key', ['type']);
      if (sKey) meta.set(sKey, { name: goField(m, 'name', ['order']), description: goField(m, 'description', ['fanart', 'is_public']) });
    }
  }
  for (const r of listRows) {
    if (r.type !== 'list' || !r.objects) continue;
    const refs = goMaps(r.objects).map((m) => ({ type: goField(m, 'type', ['uuid']), id: int(goField(m, 'id', ['meta', 'sorting', 'type']) ?? undefined), uuid: goField(m, 'uuid', []) }));
    if (r.s_key === 'favorite-series') {
      for (const ref of refs) if (ref.type === 'series' && ref.id) show(ref.id, '')!.favorite = true;
      continue;
    }
    const items: string[] = [];
    for (const ref of refs) {
      if (ref.type === 'series' && ref.id) {
        const s = show(ref.id, '')!;
        listed.add(s.key);
        items.push(s.key);
      }
      else if (ref.type === 'movie' && ref.uuid && movies.has(ref.uuid)) items.push(movies.get(ref.uuid)!.key);
    }
    if (!items.length) continue;
    const info = meta.get(r.s_key ?? '');
    const title = (r.name || info?.name || (r.s_key === 'favorite-movies' ? 'Favorite Movies' : 'Imported list')).slice(0, 120);
    lists.push({ kind: 'list', key: `tvtime:l:${r.s_key}`, title, description: (r.description || info?.description || undefined)?.slice(0, 2000), items: [...new Set(items)].slice(0, 1000) });
  }

  const showItems: ImportItemInput[] = [...shows.values()]
    .filter((s) => s.follow || s.watchlist || s.favorite || s.episodes.length > 0 || listed.has(s.key))
    .map(({ seen: _seen, ...s }) => ({ ...s, episodes: s.episodes.slice(0, 6000) }));
  const movieItems: ImportItemInput[] = [...movies.values()]
    .filter((m) => m.watched || m.watchlist)
    .map(({ watched, rewatches, ...m }) => ({ ...m, watches: watched ? [...m.watches, ...rewatches].slice(0, 200) : [], watchlist: m.watchlist && !watched }));
  const keys = new Set([...showItems, ...movieItems].map((i) => i.key));
  const listItems = lists.map((l) => ({ ...l, items: l.items.filter((k) => keys.has(k)) })).filter((l) => l.items.length > 0);
  // Lists last: they point at titles imported before them.
  return [...showItems, ...movieItems, ...listItems];
}
