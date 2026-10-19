import { getActiveDevices, getActiveServices, getAdjacentEpisodes, getCharactersForEpisode, getComments, getEpisode, getEpisodeStats, getUserWatchesForMedia, toPublicUser } from '@marutime/core';
import { episodeHref, mediaHref } from '@marutime/core/media';
import { getDb } from '@marutime/db';
import { img } from '@marutime/metadata/images';
import { Badge, Island, IslandHeader } from '@marutime/ui';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CommentFeed } from '@/components/comments/comment-feed';
import { StatsIsland } from '@/components/tracking/stats-island';
import { WatchedButton } from '@/components/tracking/watched-button';
import { episodeCode, formatDate, formatRuntime } from '@/lib/format';
import { loadMedia } from '@/lib/media-page';
import { getCurrentUser, isStaff } from '@/lib/session';

type Props = { params: Promise<{ id: string; season: string; episode: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await params;
  const media = await loadMedia('show', p.id);
  const ep = await getEpisode(getDb(), media.id, Number(p.season), Number(p.episode));
  return { title: ep ? `${media.title} ${episodeCode(ep.seasonNumber, ep.episodeNumber)}${ep.name ? ` · ${ep.name}` : ''}` : media.title, description: ep?.overview ?? undefined };
}

export default async function EpisodePage({ params }: Props) {
  const p = await params;
  const media = await loadMedia('show', p.id);
  const db = getDb();
  const episode = await getEpisode(db, media.id, Number(p.season), Number(p.episode));
  if (!episode) notFound();
  const user = await getCurrentUser();
  const [chars, stats, comments, adjacent, devices, services, myWatches] = await Promise.all([
    getCharactersForEpisode(db, media.id, episode.id),
    getEpisodeStats(db, episode.id),
    getComments(db, { episodeId: episode.id }, { viewer: user, limit: 30 }),
    getAdjacentEpisodes(db, episode),
    getActiveDevices(db),
    getActiveServices(db),
    user ? getUserWatchesForMedia(db, user.id, media.id) : Promise.resolve([]),
  ]);
  const watches = myWatches.filter((w) => w.episodeId === episode.id);
  const last = watches[0];
  const today = new Date().toISOString().slice(0, 10);
  const unaired = !episode.airDate || episode.airDate > today;
  const still = img.still(episode.stillPath, 'original') ?? img.backdrop(media.backdropPath, 'w1280');
  const defaults = user ? { deviceId: user.preferences.defaultDeviceId ?? null, serviceId: user.preferences.defaultServiceId ?? null } : undefined;
  const label = `${media.title} · ${episodeCode(episode.seasonNumber, episode.episodeNumber)}`;

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-2 text-sm text-fg-muted" aria-label="Breadcrumb">
        <Link href={mediaHref(media)} className="hover:text-fg">{media.title}</Link>
        <span>/</span>
        <Link href={`${mediaHref(media)}?season=${episode.seasonNumber}`} className="hover:text-fg">Season {episode.seasonNumber}</Link>
      </nav>
      <section className="grid gap-6 lg:grid-cols-5">
        <div className="relative overflow-hidden rounded-island border border-border bg-surface-3 lg:col-span-3">
          {still ? <img src={still} alt="" className="aspect-video w-full object-cover" loading="eager" /> : <div className="aspect-video w-full" />}
          {watches.length > 0 ? <Badge tone="accent" className="absolute top-3 left-3 backdrop-blur">Watched{watches.length > 1 ? ` ×${watches.length}` : ''}</Badge> : null}
        </div>
        <div className="flex flex-col justify-center gap-4 lg:col-span-2">
          <div>
            <p className="text-sm font-semibold text-accent">{episodeCode(episode.seasonNumber, episode.episodeNumber)}</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-fg text-balance">{episode.name ?? 'Untitled episode'}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-muted">
              <span>{unaired ? `Airs ${formatDate(episode.airDate)}` : formatDate(episode.airDate)}</span>
              {episode.runtime ? <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> {formatRuntime(episode.runtime)}</span> : null}
              {episode.voteAverage > 0 ? <span>★ {episode.voteAverage.toFixed(1)}</span> : null}
            </p>
          </div>
          {!unaired ? (
            <WatchedButton
              target={{ kind: 'episode', episodeId: episode.id, label }}
              watched={watches.length > 0}
              watchCount={watches.length}
              lastWatch={last ? { watchId: last.id, deviceId: last.deviceId, serviceId: last.serviceId, emotions: last.emotions, favoriteCharacterId: last.favoriteCharacterId, note: last.note } : null}
              devices={devices}
              services={services}
              characters={chars.main}
              guestCharacters={chars.guests}
              defaults={defaults}
              signedIn={Boolean(user)}
              size="lg"
            />
          ) : (
            <Badge tone="outline" className="w-fit">Not aired yet</Badge>
          )}
          <div className="flex items-center justify-between gap-2 text-sm">
            {adjacent.prev ? (
              <Link href={episodeHref(media, adjacent.prev.seasonNumber, adjacent.prev.episodeNumber)} className="inline-flex items-center gap-1 text-fg-muted hover:text-fg">
                <ChevronLeft className="size-4" /> {episodeCode(adjacent.prev.seasonNumber, adjacent.prev.episodeNumber)}
              </Link>
            ) : <span />}
            {adjacent.next ? (
              <Link href={episodeHref(media, adjacent.next.seasonNumber, adjacent.next.episodeNumber)} className="inline-flex items-center gap-1 text-fg-muted hover:text-fg">
                {episodeCode(adjacent.next.seasonNumber, adjacent.next.episodeNumber)} <ChevronRight className="size-4" />
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {episode.overview ? (
            <Island>
              <IslandHeader title="Synopsis" />
              <p className="text-sm leading-relaxed text-fg-muted">{episode.overview}</p>
            </Island>
          ) : null}
          <CommentFeed target={{ episodeId: episode.id }} initial={comments.items} total={comments.total} viewer={user ? toPublicUser(user) : null} viewerIsStaff={isStaff(user)} hideSpoilersByDefault={user?.preferences.hideSpoilersByDefault ?? true} />
        </div>
        <div className="flex flex-col gap-6">
          <StatsIsland stats={stats} title="How viewers felt" />
          {chars.guests.length > 0 ? (
            <Island>
              <IslandHeader title="Guest stars" />
              <ul className="flex flex-col gap-2">
                {chars.guests.slice(0, 8).map((c) => (
                  <li key={c.id} className="flex items-center gap-3 text-sm">
                    <span className="size-8 overflow-hidden rounded-full bg-surface-3">{c.profilePath ? <img src={img.profile(c.profilePath, 'w185')!} alt="" className="size-full object-cover" /> : null}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-fg">{c.name}</span>
                      <span className="block truncate text-xs text-fg-subtle">{c.actorName}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Island>
          ) : null}
        </div>
      </div>
    </div>
  );
}
