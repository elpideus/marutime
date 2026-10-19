import {
  TMDB_BACKDROP_SIZES,
  TMDB_IMAGE_BASE,
  TMDB_POSTER_SIZES,
  TMDB_PROFILE_SIZES,
  TMDB_STILL_SIZES,
} from '@marutime/config';

type PosterSize = (typeof TMDB_POSTER_SIZES)[number];
type BackdropSize = (typeof TMDB_BACKDROP_SIZES)[number];
type StillSize = (typeof TMDB_STILL_SIZES)[number];
type ProfileSize = (typeof TMDB_PROFILE_SIZES)[number];

function build(path: string | null | undefined, size: string): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export const img = {
  poster: (path: string | null | undefined, size: PosterSize = 'w342') => build(path, size),
  backdrop: (path: string | null | undefined, size: BackdropSize = 'w1280') => build(path, size),
  still: (path: string | null | undefined, size: StillSize = 'w300') => build(path, size),
  profile: (path: string | null | undefined, size: ProfileSize = 'w185') => build(path, size),
  /** srcset helper for responsive posters. */
  posterSet: (path: string | null | undefined) =>
    path ? (['w185', 'w342', 'w500', 'w780'] as const).map((s) => `${build(path, s)} ${s.slice(1)}w`).join(', ') : undefined,
};
