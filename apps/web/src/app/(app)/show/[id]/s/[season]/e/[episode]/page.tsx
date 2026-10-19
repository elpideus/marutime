import { getAdjacentEpisodes, getCharactersForEpisode, getComments, getEpisode, getEpisodeStats, getUserWatchesForEpisode, toPublicUser } from '@marutime/core';
import { episodeHref, mediaHref } from '@marutime/core/media';
import { getDb, type Episode, type Media } from '@marutime/db';
import { img } from '@marutime/metadata/images';
import { Badge, Island, IslandHeader } from '@marutime/ui';
import { Clock, Star } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CommentFeed } from '@/components/comments/comment-feed';
import { CastList } from '@/components/media/cast-list';
import { EpisodeContentTransition, EpisodeStage, EpisodeStepper, type StageEpisode } from '@/components/media/episode-stage';
import { EpisodeWatchBadge } from '@/components/tracking/episode-watch-badge';
import { StatsIsland } from '@/components/tracking/stats-island';
import { WatchedButton } from '@/components/tracking/watched-button';
import { toCastMember } from '@/lib/cast';
import { episodeCode, formatDate, formatRuntime } from '@/lib/format';
import { loadMedia } from '@/lib/media-page';
import { renderedAt } from '@/lib/clock';
import { getCurrentUser, isStaff } from '@/lib/session';

type Props = { params: Promise<{ id: string; season: string; episode: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await params;
  const media = await loadMedia('show', p.id);
  const ep = await getEpisode(getDb(), media.id, Number(p.season), Number(p.episode));
  return { title: ep ? `${media.title} ${episodeCode(ep.seasonNumber, ep.episodeNumber)}${ep.name ? ` · ${ep.name}` : ''}` : media.title, description: ep?.overview ?? undefined };
}

function stillOf(e: Episode, media: Media): string | null {
  return img.still(e.stillPath, 'original') ?? img.backdrop(media.backdropPath, 'w1280');
}

function stage(e: Episode, media: Media): StageEpisode {
  return { id: e.id, code: episodeCode(e.seasonNumber, e.episodeNumber), name: e.name, still: stillOf(e, media), href: episodeHref(media, e.seasonNumber, e.episodeNumber) };
}

export default async function EpisodePage({ params }: Props) {
  const p = await params;
  const media = await loadMedia('show', p.id);
  const db = getDb();
  const episode = await getEpisode(db, media.id, Number(p.season), Number(p.episode));
  if (!episode) notFound();
  const user = await getCurrentUser();
  const serverAt = renderedAt();
  const [chars, stats, comments, adjacent, watches] = await Promise.all([
    getCharactersForEpisode(db, media.id, episode.id),
    getEpisodeStats(db, episode.id),
    getComments(db, { episodeId: episode.id }, { viewer: user, limit: 30 }),
    getAdjacentEpisodes(db, episode),
    user ? getUserWatchesForEpisode(db, user.id, episode.id) : Promise.resolve([]),
  ]);
  const last = watches[0];
  const today = new Date().toISOString().slice(0, 10);
  const unaired = !episode.airDate || episode.airDate > today;
  const still = stillOf(episode, media);
  const label = `${media.title} · ${episodeCode(episode.seasonNumber, episode.episodeNumber)}`;
  const pick = (c: { id: number; name: string; imageUrl: string | null; profilePath: string | null }) => ({ id: c.id, name: c.name, imageUrl: c.imageUrl, profilePath: c.profilePath });
  const target = { kind: 'episode' as const, episodeId: episode.id, mediaId: media.id, seasonNumber: episode.seasonNumber, label };
  const prev = adjacent.prev ? stage(adjacent.prev, media) : null;
  const next = adjacent.next ? stage(adjacent.next, media) : null;

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-2 text-sm text-fg-muted" aria-label="Breadcrumb">
        <Link href={mediaHref(media)} className="transition-colors hover:text-fg">{media.title}</Link>
        <span aria-hidden>/</span>
        <Link href={`${mediaHref(media)}?season=${episode.seasonNumber}`} className="transition-colors hover:text-fg">{episode.seasonNumber === 0 ? 'Specials' : `Season ${episode.seasonNumber}`}</Link>
      </nav>

      <EpisodeStage
        current={stage(episode, media)}
        prev={prev}
        next={next}
        still={
          <>
            {still ? <img src={still} alt="" className="aspect-video w-full object-cover" loading="eager" decoding="async" /> : <div className="aspect-video w-full" />}
            <EpisodeWatchBadge watchKey={`e:${episode.id}`} serverCount={watches.length} serverAt={serverAt} />
          </>
        }
        info={
          <>
            <div>
              <p className="text-sm font-semibold text-accent">{episodeCode(episode.seasonNumber, episode.episodeNumber)}</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-fg text-balance">{episode.name ?? 'Untitled episode'}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-muted">
                <span>{unaired ? `Airs ${formatDate(episode.airDate)}` : formatDate(episode.airDate)}</span>
                {episode.runtime ? (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" /> {formatRuntime(episode.runtime)}
                  </span>
                ) : null}
                {episode.voteAverage > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <Star className="size-3.5 fill-accent text-accent" /> {episode.voteAverage.toFixed(1)}
                  </span>
                ) : null}
              </p>
            </div>
            {!unaired ? (
              <WatchedButton
                target={target}
                watched={watches.length > 0}
                watchCount={watches.length}
                serverAt={serverAt}
                lastWatch={last ? { watchId: last.id, deviceId: last.deviceId, serviceId: last.serviceId, emotions: last.emotions, favoriteCharacterId: last.favoriteCharacterId, rating: last.rating, note: last.note } : null}
                characters={chars.main.map(pick)}
                guestCharacters={chars.guests.map(pick)}
                size="lg"
              />
            ) : (
              <Badge tone="outline" className="w-fit">Not aired yet</Badge>
            )}
            <EpisodeStepper prev={prev} next={next} />
          </>
        }
      />

      <EpisodeContentTransition episodeId={episode.id}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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
            <CastList title="Guest stars" members={chars.guests.map(toCastMember)} />
          </div>
        </div>
      </EpisodeContentTransition>
    </div>
  );
}
