import { loadDotenv } from '@marutime/config/dotenv';
loadDotenv();

import { closeDb, getDb } from '@marutime/db';
import { checkInEpisode, ensureMedia, getAnimeDetails, getCharactersForMedia, getEpisode, getEpisodeStats, getShowProgress, getUpcoming, getWatchNext, findUserByEmail, markEpisodesWatched, getUserStats } from '../index';

/** Developer smoke test: exercises the import → check-in → progress pipeline. */
async function main(): Promise<void> {
  const db = getDb();
  const admin = await findUserByEmail(db, process.env.ADMIN_EMAIL ?? 'admin@example.com');
  if (!admin) throw new Error('Run the seed first');

  const t0 = Date.now();
  const bb = await ensureMedia(db, 'show', 1396);
  console.log(`✔ imported "${bb.title}" (${bb.status}, ${bb.seasonCount} seasons, ${bb.episodeCount} eps) in ${Date.now() - t0}ms`);
  const t1 = Date.now();
  const jjk = await ensureMedia(db, 'show', 95479);
  const anime = await getAnimeDetails(db, jjk.id);
  console.log(`✔ imported "${jjk.title}" isAnime=${jjk.isAnime} anilist=${anime?.anilistId ?? 'none'} (${anime?.titleRomaji}) studios=${anime?.studios.map((s) => s.name).join('/')} in ${Date.now() - t1}ms`);
  const chars = await getCharactersForMedia(db, jjk.id);
  console.log(`✔ ${chars.length} characters; first: ${chars.slice(0, 4).map((c) => `${c.name} [${c.source}]`).join(', ')}`);
  const movie = await ensureMedia(db, 'movie', 129);
  console.log(`✔ imported movie "${movie.title}" isAnime=${movie.isAnime} runtime=${movie.runtime}`);

  const s1e1 = await getEpisode(db, bb.id, 1, 1);
  const s1e2 = await getEpisode(db, bb.id, 1, 2);
  if (!s1e1 || !s1e2) throw new Error('episodes missing');
  const r1 = await checkInEpisode(db, admin.id, s1e1.id, { emotions: ['wow', 'good'], deviceId: 1, serviceId: 1 });
  console.log(`✔ check-in S1E1 created=${r1.created} startedShow=${r1.startedShow}`);
  const r2 = await checkInEpisode(db, admin.id, s1e1.id, { emotions: ['fun'] });
  console.log(`✔ re-check-in S1E1 created=${r2.created} emotions=${JSON.stringify(r2.watch.emotions)}`);
  const progress = await getShowProgress(db, admin.id, bb.id);
  console.log(`✔ progress ${progress.watchedEpisodes}/${progress.airedEpisodes} next=S${progress.nextEpisode?.seasonNumber}E${progress.nextEpisode?.episodeNumber} tracked=${progress.isTracked}`);
  const next = await getWatchNext(db, admin.id);
  console.log(`✔ watch next: ${next.map((n) => `${n.media.title} S${n.episode.seasonNumber}E${n.episode.episodeNumber} (${n.remaining} left)`).join('; ')}`);
  const bulk = await markEpisodesWatched(db, admin.id, bb.id, { seasonNumber: 1 });
  console.log(`✔ bulk marked season 1: ${bulk.marked}`);
  const progress2 = await getShowProgress(db, admin.id, bb.id);
  console.log(`✔ progress after bulk ${progress2.watchedEpisodes}/${progress2.airedEpisodes} next=S${progress2.nextEpisode?.seasonNumber}E${progress2.nextEpisode?.episodeNumber}`);
  const stats = await getEpisodeStats(db, s1e1.id);
  console.log(`✔ episode stats watches=${stats.watches} viewers=${stats.viewers} hidden=${stats.hidden}`);
  const upcoming = await getUpcoming(db, admin.id);
  console.log(`✔ upcoming: ${upcoming.length}`);
  const mine = await getUserStats(db, admin.id);
  console.log(`✔ my stats episodes=${mine.episodes} minutes=${mine.minutes} topShows=${mine.topShows.map((t) => t.title).join(',')} emotions=${mine.emotions.map((e) => `${e.item.id}:${e.count}`).join(',')}`);
  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
