import { getActiveDevices, getActiveServices, getAnimeDetails, getCharactersForMedia, getComments, getListsContainingMedia, getMovieStats, getUserWatchesForMedia, toPublicUser } from '@marutime/core';
import { mediaHref } from '@marutime/core/media';
import { getDb } from '@marutime/db';
import { Island, IslandHeader } from '@marutime/ui';
import type { Metadata } from 'next';
import { CommentFeed } from '@/components/comments/comment-feed';
import { ListCard } from '@/components/lists/list-card';
import { CastStrip } from '@/components/media/cast-strip';
import { AddToListButton, WatchlistButton } from '@/components/media/media-actions';
import { MediaHero } from '@/components/media/media-hero';
import { StatsIsland } from '@/components/tracking/stats-island';
import { WatchedButton } from '@/components/tracking/watched-button';
import { formatDate } from '@/lib/format';
import { loadMedia, loadViewerMediaState } from '@/lib/media-page';
import { getCurrentUser, isStaff } from '@/lib/session';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const media = await loadMedia('movie', (await params).id);
  return { title: media.title, description: media.overview ?? undefined, alternates: { canonical: mediaHref(media) } };
}

export default async function MoviePage({ params }: Props) {
  const media = await loadMedia('movie', (await params).id);
  const db = getDb();
  const user = await getCurrentUser();
  const [characters, anime, stats, comments, lists, devices, services, myWatches, viewerState] = await Promise.all([
    getCharactersForMedia(db, media.id, { limit: 40 }),
    media.isAnime ? getAnimeDetails(db, media.id) : Promise.resolve(null),
    getMovieStats(db, media.id),
    getComments(db, { mediaId: media.id }, { viewer: user, limit: 30 }),
    getListsContainingMedia(db, media.id, user?.id ?? null),
    getActiveDevices(db),
    getActiveServices(db),
    user ? getUserWatchesForMedia(db, user.id, media.id) : Promise.resolve([]),
    loadViewerMediaState(user, media.id),
  ]);
  const last = myWatches[0];
  const defaults = user ? { deviceId: user.preferences.defaultDeviceId ?? null, serviceId: user.preferences.defaultServiceId ?? null } : undefined;
  const today = new Date().toISOString().slice(0, 10);
  const unreleased = media.releaseDate ? media.releaseDate > today : false;

  return (
    <div className="flex flex-col gap-6">
      <MediaHero
        media={media}
        anime={anime}
        actions={
          <>
            {!unreleased ? (
              <WatchedButton
                target={{ kind: 'movie', mediaId: media.id, label: media.title }}
                watched={myWatches.length > 0}
                watchCount={myWatches.length}
                lastWatch={last ? { watchId: last.id, deviceId: last.deviceId, serviceId: last.serviceId, emotions: last.emotions, favoriteCharacterId: last.favoriteCharacterId, note: last.note } : null}
                devices={devices}
                services={services}
                characters={characters}
                defaults={defaults}
                signedIn={Boolean(user)}
              />
            ) : null}
            <WatchlistButton mediaId={media.id} inList={viewerState.inWatchlist} signedIn={Boolean(user)} />
            <AddToListButton mediaId={media.id} lists={viewerState.lists} signedIn={Boolean(user)} />
          </>
        }
        meta={unreleased ? <p className="mt-3 text-sm text-accent">Releases {formatDate(media.releaseDate)}</p> : null}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {media.overview || anime?.description ? (
            <Island>
              <IslandHeader title="About" />
              <p className="text-sm leading-relaxed text-fg-muted whitespace-pre-line">{media.overview ?? anime?.description}</p>
              {media.homepage ? (
                <a href={media.homepage} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-xs text-accent hover:underline">
                  Official site
                </a>
              ) : null}
            </Island>
          ) : null}
          <CommentFeed target={{ mediaId: media.id }} initial={comments.items} total={comments.total} viewer={user ? toPublicUser(user) : null} viewerIsStaff={isStaff(user)} hideSpoilersByDefault={user?.preferences.hideSpoilersByDefault ?? true} />
        </div>
        <div className="flex flex-col gap-6">
          <StatsIsland stats={stats} />
          <CastStrip characters={characters} title="Cast" />
          {lists.length > 0 ? (
            <Island>
              <IslandHeader title="Appears in lists" />
              <div className="flex flex-col gap-3">
                {lists.slice(0, 3).map((l) => (
                  <ListCard key={l.list.id} card={l} signedIn={Boolean(user)} />
                ))}
              </div>
            </Island>
          ) : null}
          <p className="px-1 text-xs text-fg-subtle">
            Data from <a href={`https://www.themoviedb.org/movie/${media.externalId}`} target="_blank" rel="noopener noreferrer" className="hover:text-fg">TMDB</a>. Last synced {formatDate(media.syncedAt)}.
          </p>
        </div>
      </div>
    </div>
  );
}
