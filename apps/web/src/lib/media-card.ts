import type { Media } from '@marutime/db';
import type { MediaSummary } from '@marutime/metadata/types';
import { mediaHref } from '@marutime/core/media';

export type MediaCardData = {
  key: string;
  href: string;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  year: string;
  type: 'show' | 'movie';
  isAnime: boolean;
  voteAverage: number;
  overview: string | null;
};

export function cardFromMedia(m: Media): MediaCardData {
  return {
    key: `m-${m.id}`,
    href: mediaHref(m),
    title: m.title,
    posterPath: m.posterPath,
    backdropPath: m.backdropPath,
    year: m.releaseDate?.slice(0, 4) ?? '',
    type: m.type,
    isAnime: m.isAnime,
    voteAverage: m.voteAverage,
    overview: m.overview,
  };
}

export function cardFromSummary(s: MediaSummary & { href?: string }): MediaCardData {
  return {
    key: `s-${s.type}-${s.externalId}`,
    href: s.href ?? mediaHref({ type: s.type, externalId: s.externalId, title: s.title }),
    title: s.title,
    posterPath: s.posterPath,
    backdropPath: s.backdropPath,
    year: s.releaseDate?.slice(0, 4) ?? '',
    type: s.type,
    isAnime: s.isAnime,
    voteAverage: s.voteAverage,
    overview: s.overview,
  };
}
