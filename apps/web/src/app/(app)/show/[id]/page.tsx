import { getComments, getEpisodeWatchCounts, getListsContainingMedia, getShowProgress, getShowStats, getTracking, toPublicUser } from '@marutime/core';
import { mediaHref } from '@marutime/core/media';
import { getDb } from '@marutime/db';
import { Button, Island, IslandHeader } from '@marutime/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CommentFeed } from '@/components/comments/comment-feed';
import { RememberTitle } from '@/components/keyboard/command-palette';
import { ListCard } from '@/components/lists/list-card';
import { CastStrip } from '@/components/media/cast-strip';
import { toCastMember } from '@/lib/cast';
import { AddToListButton, BulkMarkMenu, TrackButton, WatchlistButton } from '@/components/media/media-actions';
import { MediaHero } from '@/components/media/media-hero';
import { SeasonBrowser, type SeasonTab } from '@/components/media/season-browser';
import { ShowProgressCard } from '@/components/media/show-progress';
import { StatsIsland } from '@/components/tracking/stats-island';
import { formatDate } from '@/lib/format';
import { loadAnime, loadCharacters, loadEpisodesPage, loadMedia, loadSeasonCounts, loadSeasons, loadViewerMediaState } from '@/lib/media-page';
import { renderedAt } from '@/lib/clock';
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
  const serverAt = renderedAt();
  const [seasons, seasonCounts, characters, anime, stats, comments, lists, progress, tracking, viewerState, watched] = await Promise.all([
    loadSeasons(media),
    loadSeasonCounts(media),
    loadCharacters(media, 40),
    loadAnime(media),
    getShowStats(db, media.id),
    getComments(db, { mediaId: media.id }, { viewer: user, limit: 20 }),
    getListsContainingMedia(db, media.id, user?.id ?? null),
    getShowProgress(db, user?.id ?? null, media.id),
    user ? getTracking(db, user.id, media.id) : Promise.resolve(null),
    loadViewerMediaState(user, media.id),
    user ? getEpisodeWatchCounts(db, user.id, media.id) : Promise.resolve([]),
  ]);
  const counts = new Map(seasonCounts.map((c) => [c.seasonNumber, c]));
  const tabs: SeasonTab[] = seasons
    .map((s) => ({ seasonNumber: s.seasonNumber, name: s.name, total: counts.get(s.seasonNumber)?.total ?? s.episodeCount, aired: counts.get(s.seasonNumber)?.aired ?? 0 }))
    .filter((s) => s.total > 0 || s.seasonNumber > 0);
  const regularSeasons = tabs.filter((s) => s.seasonNumber > 0).map((s) => s.seasonNumber);
  const requestedSeason = Number(sp.season);
  const initialSeason = tabs.some((s) => s.seasonNumber === requestedSeason) ? requestedSeason : progress.nextEpisode?.seasonNumber ?? regularSeasons[0] ?? tabs[0]?.seasonNumber ?? 1;
  const firstPage = await loadEpisodesPage(media, initialSeason, 0, 40);
  const pick = (e: { id: number; seasonNumber: number; episodeNumber: number; name: string | null; airDate: string | null }) => ({ id: e.id, seasonNumber: e.seasonNumber, episodeNumber: e.episodeNumber, name: e.name, airDate: e.airDate });
  const checkInCharacters = characters.map((c) => ({ id: c.id, name: c.name, imageUrl: c.imageUrl, profilePath: c.profilePath }));
  const totalEpisodes = tabs.filter((s) => s.seasonNumber > 0).reduce((n, s) => n + s.total, 0);

  return (
    <div className="flex flex-col gap-6">
      <RememberTitle href={mediaHref(media)} title={media.title} posterPath={media.posterPath} type={media.type} isAnime={media.isAnime} />
      <MediaHero
        media={media}
        anime={anime}
        autoplayTrailer={user?.preferences.autoplayTrailers !== false}
        actions={
          <>
            <TrackButton mediaId={media.id} tracking={tracking} signedIn={Boolean(user)} />
            <WatchlistButton mediaId={media.id} inList={viewerState.inWatchlist} signedIn={Boolean(user)} primary />
            <AddToListButton mediaId={media.id} lists={viewerState.lists} signedIn={Boolean(user)} />
            {user && regularSeasons.length ? <BulkMarkMenu media={{ id: media.id, title: media.title }} seasons={regularSeasons} /> : null}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {user ? (
            <ShowProgressCard
              media={{ id: media.id, externalId: media.externalId, slug: media.slug, title: media.title }}
              aired={progress.airedEpisodes}
              tracked={progress.isTracked}
              watched={watched}
              serverAt={serverAt}
              next={progress.nextEpisode ? pick(progress.nextEpisode) : null}
              upcoming={progress.upcomingEpisode ? pick(progress.upcomingEpisode) : null}
              characters={checkInCharacters}
            />
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
            <IslandHeader title="Episodes" description={`${totalEpisodes || media.episodeCount || 0} episodes across ${regularSeasons.length} ${regularSeasons.length === 1 ? 'season' : 'seasons'}`} />
            <SeasonBrowser
              media={{ id: media.id, externalId: media.externalId, slug: media.slug, title: media.title }}
              seasons={tabs}
              initialSeason={initialSeason}
              initialEpisodes={firstPage.items.map((e) => ({ id: e.id, seasonNumber: e.seasonNumber, episodeNumber: e.episodeNumber, name: e.name, overview: e.overview, stillPath: e.stillPath, airDate: e.airDate, runtime: e.runtime, voteAverage: e.voteAverage }))}
              initialTotal={firstPage.total}
              watched={watched}
              serverAt={serverAt}
              signedIn={Boolean(user)}
              characters={checkInCharacters}
            />
          </Island>

          <CommentFeed target={{ mediaId: media.id }} initial={comments.items} total={comments.total} viewer={user ? toPublicUser(user) : null} viewerIsStaff={isStaff(user)} hideSpoilersByDefault={user?.preferences.hideSpoilersByDefault ?? true} />
        </div>

        <div className="flex flex-col gap-6">
          <StatsIsland stats={stats} title="How viewers felt" />
          <CastStrip members={characters.map(toCastMember)} title={media.isAnime ? 'Characters' : 'Cast'} mediaAnilistId={anime?.anilistId} />
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
