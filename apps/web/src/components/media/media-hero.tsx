import type { AnimeDetails, Media } from '@marutime/db';
import { img } from '@marutime/metadata/images';
import { Badge } from '@marutime/ui';
import { ExternalLink, Star } from 'lucide-react';
import type { ReactNode } from 'react';
import { Backdrop, Poster } from '@/components/media/poster';
import { formatRuntime, yearOf } from '@/lib/format';
import { TrailerBackdrop, TrailerButtons, TrailerCover, TrailerProvider } from './hero-trailer';
import { TypeBadge } from './type-badge';

export function MediaHero({ media, anime, actions, meta, autoplayTrailer = true }: { media: Media; anime: AnimeDetails | null; actions: ReactNode; meta?: ReactNode; autoplayTrailer?: boolean }) {
  const backdrop = anime?.bannerImageUrl ?? img.backdrop(media.backdropPath, 'w1280');
  const hero = (
    <section className="relative -mx-4 -mt-6 overflow-hidden sm:-mx-6 sm:rounded-b-island">
      <div className="absolute inset-0">
        {media.trailerKey ? <TrailerBackdrop /> : null}
        {/* Above the trailer: fades out completely once the trailer is playing. */}
        <TrailerCover>{backdrop ? <img src={backdrop} alt="" className="size-full object-cover opacity-60" loading="eager" decoding="async" /> : <Backdrop path={null} className="size-full" />}</TrailerCover>
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/85 to-bg/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg/70 to-transparent" />
      </div>
      <div className="relative px-4 pt-20 pb-6 sm:px-6 sm:pt-28 sm:pb-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:gap-7">
          <div className="w-32 shrink-0 self-start overflow-hidden rounded-card shadow-float ring-1 ring-white/10 sm:w-44 sm:self-auto">
            <Poster path={media.posterPath} title={media.title} size="w500" priority src={!media.posterPath ? anime?.coverImageUrl : undefined} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <TypeBadge type={media.type} isAnime={media.isAnime} />
              {media.status ? <Badge tone="outline">{media.status}</Badge> : null}
              {media.certification ? <Badge tone="outline">{media.certification}</Badge> : null}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-fg text-balance sm:text-5xl">{media.title}</h1>
            {media.originalTitle && media.originalTitle !== media.title ? <p className="mt-1 text-sm text-fg-muted">{media.originalTitle}</p> : null}
            {media.tagline ? <p className="mt-2 text-sm italic text-fg-muted">“{media.tagline}”</p> : null}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-muted">
              {media.releaseDate ? <span>{yearOf(media.releaseDate)}{media.type === 'show' && media.lastAirDate && yearOf(media.lastAirDate) !== yearOf(media.releaseDate) ? `–${media.status === 'Ended' || media.status === 'Canceled' ? yearOf(media.lastAirDate) : ''}` : ''}</span> : null}
              {media.type === 'show' && media.seasonCount ? <span>{media.seasonCount} {media.seasonCount === 1 ? 'season' : 'seasons'}</span> : null}
              {media.type === 'show' && media.episodeCount ? <span>{media.episodeCount} episodes</span> : null}
              {media.runtime ? <span>{formatRuntime(media.runtime)}{media.type === 'show' ? ' / ep' : ''}</span> : null}
              {media.voteAverage > 0 ? (
                <span className="inline-flex items-center gap-1 text-fg">
                  <Star className="size-3.5 fill-accent text-accent" /> {media.voteAverage.toFixed(1)}
                  <span className="text-fg-subtle">TMDB</span>
                </span>
              ) : null}
              {anime?.averageScore ? (
                <a href={anime.siteUrl ?? '#'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-fg hover:text-accent">
                  <span className="font-semibold">{anime.averageScore}%</span> <span className="text-fg-subtle">AniList</span> <ExternalLink className="size-3" />
                </a>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {media.genres.slice(0, 6).map((g) => (
                <span key={g.id} className="rounded-pill border border-border bg-surface/60 px-2.5 py-0.5 text-xs text-fg-muted backdrop-blur">
                  {g.name}
                </span>
              ))}
              {anime?.studios.filter((s) => s.isMain).map((s) => (
                <span key={s.name} className="rounded-pill border border-accent/30 bg-accent-soft px-2.5 py-0.5 text-xs text-accent">
                  {s.name}
                </span>
              ))}
            </div>
            {meta}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {actions}
              {media.trailerKey ? <TrailerButtons /> : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
  return media.trailerKey ? (
    <TrailerProvider trailerKey={media.trailerKey} title={media.title} autoplay={autoplayTrailer}>
      {hero}
    </TrailerProvider>
  ) : (
    hero
  );
}
