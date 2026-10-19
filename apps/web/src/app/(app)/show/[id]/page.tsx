import { getActiveDevices, getActiveServices, getAnimeDetails, getCharactersForMedia, getComments, getEpisodesForMedia, getListsContainingMedia, getSeasons, getShowProgress, getShowStats, getTracking, getUserEpisodeWatchMap, toPublicUser } from '@marutime/core';
import { episodeHref, mediaHref } from '@marutime/core/media';
import { getDb, type Watch } from '@marutime/db';
import { Button, Island, IslandHeader, ProgressRing } from '@marutime/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CommentFeed } from '@/components/comments/comment-feed';
import { ListCard } from '@/components/lists/list-card';
import { CastStrip } from '@/components/media/cast-strip';
import { AddToListButton, BulkMarkMenu, TrackButton, WatchlistButton } from '@/components/media/media-actions';
import { MediaHero } from '@/components/media/media-hero';
import { SeasonBrowser } from '@/components/media/season-browser';
import { StatsIsland } from '@/components/tracking/stats-island';
import { WatchedButton } from '@/components/tracking/watched-button';
import { episodeCode, formatDate } from '@/lib/format';
import { loadMedia, loadViewerMediaState } from '@/lib/media-page';
import { getCurrentUser, isStaff } from '@/lib/session';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ season?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const media = await loadMedia('show', (await params).id);
  return { title: media.title, description: media.overview ?? undefined, alternates: { canonical: mediaHref(media) } };
}

export default async function ShowPage({ params, searchParams }: Props) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const media = await loadMedia('show', id);
  const db = getDb();
  const user = await getCurrentUser();
  const [seasons, episodes, characters, anime, stats, comments, lists, devices, services, progress, tracking, viewerState] = await Promise.all([
    getSeasons(db, media.id),
    getEpisodesForMedia(db, media.id),
    getCharactersForMedia(db, media.id, { limit: 40 }),
    media.isAnime ? getAnimeDetails(db, media.id) : Promise.resolve(null),
    getShowStats(db, media.id),
    getComments(db, { mediaId: media.id }, { viewer: user, limit: 20 }),
    getListsContainingMedia(db, media.id, user?.id ?? null),
    getActiveDevices(db),
    getActiveServices(db),
    getShowProgress(db, user?.id ?? null, media.id),
    user ? getTracking(db, user.id, media.id) : Promise.resolve(null),
    loadViewerMediaState(user, media.id),
  ]);
  const watchMapEntries = user ? await getUserEpisodeWatchMap(db, user.id, media.id) : new Map<number, Watch[]>();
  const watchMap: Record<number, Array<{ id: string; deviceId: number | null; serviceId: number | null; emotions: string[]; favoriteCharacterId: number | null; note: string | null }>> = {};
  for (const [episodeId, watches] of watchMapEntries) {
    watchMap[episodeId] = watches.map((w) => ({ id: w.id, deviceId: w.deviceId, serviceId: w.serviceId, emotions: w.emotions, favoriteCharacterId: w.favoriteCharacterId, note: w.note }));
  }
  const regularSeasons = seasons.filter((s) => s.seasonNumber > 0).map((s) => s.seasonNumber);
  const requestedSeason = Number(sp.season);
  const initialSeason = seasons.some((s) => s.seasonNumber === requestedSeason) ? requestedSeason : progress.nextEpisode?.seasonNumber ?? regularSeasons[0] ?? seasons[0]?.seasonNumber ?? 1;
  const defaults = user ? { deviceId: user.preferences.defaultDeviceId ?? null, serviceId: user.preferences.defaultServiceId ?? null } : undefined;
  const next = progress.nextEpisode;

  return (
    <div className="flex flex-col gap-6">
      <MediaHero
        media={media}
        anime={anime}
        actions={
          <>
            <TrackButton mediaId={media.id} tracking={tracking} signedIn={Boolean(user)} />
            <WatchlistButton mediaId={media.id} inList={viewerState.inWatchlist} signedIn={Boolean(user)} />
            <AddToListButton mediaId={media.id} lists={viewerState.lists} signedIn={Boolean(user)} />
            {user && regularSeasons.length ? <BulkMarkMenu mediaId={media.id} seasons={regularSeasons} /> : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {user ? (
            <Island className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <ProgressRing value={progress.percent} size={64} stroke={6} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-fg-muted">
                  {progress.watchedEpisodes} of {progress.airedEpisodes} aired episodes
                  {progress.remaining > 0 ? ` · ${progress.remaining} to go` : progress.isTracked ? ' · you are up to date' : ''}
                </p>
                {next ? (
                  <Link href={episodeHref(media, next.seasonNumber, next.episodeNumber)} className="mt-0.5 block truncate text-lg font-semibold text-fg hover:text-accent">
                    Next up: <span className="text-accent">{episodeCode(next.seasonNumber, next.episodeNumber)}</span> {next.name ?? ''}
                  </Link>
                ) : progress.upcomingEpisode ? (
                  <p className="mt-0.5 text-lg font-semibold text-fg">
                    {episodeCode(progress.upcomingEpisode.seasonNumber, progress.upcomingEpisode.episodeNumber)} airs {formatDate(progress.upcomingEpisode.airDate)}
                  </p>
                ) : (
                  <p className="mt-0.5 text-lg font-semibold text-fg">All caught up</p>
                )}
              </div>
              {next ? (
                <WatchedButton
                  target={{ kind: 'episode', episodeId: next.id, label: `${media.title} · ${episodeCode(next.seasonNumber, next.episodeNumber)}` }}
                  watched={false}
                  devices={devices}
                  services={services}
                  characters={characters}
                  defaults={defaults}
                  signedIn
                  variant="compact"
                />
              ) : null}
            </Island>
          ) : null}

          {media.overview || anime?.description ? (
            <Island>
              <IslandHeader title="About" />
              <p className="text-sm leading-relaxed text-fg-muted whitespace-pre-line">{media.overview ?? anime?.description}</p>
              {anime?.tags?.length ? (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {anime.tags.filter((t) => !t.isSpoiler).slice(0, 10).map((t) => (
                    <span key={t.name} className="rounded-pill bg-surface-3 px-2 py-0.5 text-[11px] text-fg-muted">
                      {t.name}
                    </span>
                  ))}
                </div>
              ) : null}
              {media.networks.length ? <p className="mt-4 text-xs text-fg-subtle">On {media.networks.map((n) => n.name).join(', ')}</p> : null}
            </Island>
          ) : null}

          <Island>
            <IslandHeader title="Episodes" description={`${media.episodeCount ?? episodes.length} episodes across ${regularSeasons.length} ${regularSeasons.length === 1 ? 'season' : 'seasons'}`} />
            <SeasonBrowser media={media} seasons={seasons} episodes={episodes} watchMap={watchMap} initialSeason={initialSeason} devices={devices} services={services} characters={characters} signedIn={Boolean(user)} defaults={defaults} />
          </Island>

          <CommentFeed target={{ mediaId: media.id }} initial={comments.items} total={comments.total} viewer={user ? toPublicUser(user) : null} viewerIsStaff={isStaff(user)} hideSpoilersByDefault={user?.preferences.hideSpoilersByDefault ?? true} />
        </div>

        <div className="flex flex-col gap-6">
          <StatsIsland stats={stats} title="How viewers felt" />
          <CastStrip characters={characters} />
          {lists.length > 0 ? (
            <Island>
              <IslandHeader title="Appears in lists" action={<Link href="/lists" className="text-sm text-accent hover:underline">Browse</Link>} />
              <div className="flex flex-col gap-3">
                {lists.slice(0, 3).map((l) => (
                  <ListCard key={l.list.id} card={l} signedIn={Boolean(user)} />
                ))}
              </div>
            </Island>
          ) : null}
          <Island tone="transparent" padding="sm" className="text-xs text-fg-subtle">
            <p>
              Data from{' '}
              <a href={`https://www.themoviedb.org/tv/${media.externalId}`} target="_blank" rel="noopener noreferrer" className="hover:text-fg">
                TMDB
              </a>
              {anime?.siteUrl ? (
                <>
                  {' '}and{' '}
                  <a href={anime.siteUrl} target="_blank" rel="noopener noreferrer" className="hover:text-fg">
                    AniList
                  </a>
                </>
              ) : null}
              . Last synced {formatDate(media.syncedAt)}.
            </p>
            {!user ? (
              <Link href={`/login?next=${encodeURIComponent(mediaHref(media))}`} className="mt-2 inline-block">
                <Button size="sm" variant="secondary" tabIndex={-1}>Sign in to track this show</Button>
              </Link>
            ) : null}
          </Island>
        </div>
      </div>
    </div>
  );
}
