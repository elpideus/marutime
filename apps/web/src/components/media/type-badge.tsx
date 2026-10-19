import { Badge, cn } from '@marutime/ui';

export type MediaKind = 'show' | 'movie' | 'anime';

export function mediaKind(m: { type: 'show' | 'movie'; isAnime: boolean }): MediaKind {
  return m.isAnime ? 'anime' : m.type;
}

const LABEL: Record<MediaKind, string> = { show: 'Show', movie: 'Movie', anime: 'Anime' };
const TEXT: Record<MediaKind, string> = { show: 'text-show', movie: 'text-movie', anime: 'text-anime' };
const DOT: Record<MediaKind, string> = { show: 'bg-show', movie: 'bg-movie', anime: 'bg-anime' };

/** Colour-coded Show / Movie / Anime pill: blue, violet and amber everywhere. */
export function TypeBadge({ type, isAnime, className }: { type: 'show' | 'movie'; isAnime: boolean; className?: string }) {
  const kind = mediaKind({ type, isAnime });
  return (
    <Badge tone={kind} className={className}>
      {LABEL[kind]}
    </Badge>
  );
}

/** Inline "• Anime" style label for subtitles. */
export function TypeLabel({ type, isAnime, className }: { type: 'show' | 'movie'; isAnime: boolean; className?: string }) {
  const kind = mediaKind({ type, isAnime });
  return (
    <span className={cn('inline-flex items-center gap-1 font-medium', TEXT[kind], className)}>
      <span className={cn('size-1.5 rounded-full', DOT[kind])} aria-hidden />
      {LABEL[kind]}
    </span>
  );
}

export function typeLabel(m: { type: 'show' | 'movie'; isAnime: boolean }): string {
  return LABEL[mediaKind(m)];
}
