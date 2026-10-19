export function slugify(input: string): string {
  const base = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || 'untitled';
}

/** Anime heuristic shared by providers: animated and of Japanese origin. */
export function classifyAnime(input: {
  genreIds: number[];
  originCountries: string[];
  originalLanguage: string | null;
  keywordIds?: number[];
}): boolean {
  const ANIMATION_GENRE = 16;
  const ANIME_KEYWORD = 210024;
  if (input.keywordIds?.includes(ANIME_KEYWORD)) return true;
  const animated = input.genreIds.includes(ANIMATION_GENRE);
  const japanese = input.originCountries.includes('JP') || input.originalLanguage === 'ja';
  return animated && japanese;
}

export function emptyPage<T>(page = 1): { page: number; totalPages: number; totalResults: number; results: T[] } {
  return { page, totalPages: 0, totalResults: 0, results: [] };
}
