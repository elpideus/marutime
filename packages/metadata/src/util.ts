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

/** Countries and languages whose animation AniList and fans file under anime (incl. donghua). */
const ANIME_COUNTRIES = new Set(['JP', 'CN', 'TW', 'HK', 'KR']);
const ANIME_LANGUAGES = new Set(['ja', 'zh', 'cn', 'ko']);

/**
 * Anime heuristic shared by providers: animated and of East Asian origin
 * (Japanese anime plus Chinese donghua such as Link Click), or explicitly
 * tagged "anime" on TMDB.
 */
export function classifyAnime(input: {
  genreIds: number[];
  originCountries: string[];
  originalLanguage: string | null;
  keywordIds?: number[];
}): boolean {
  const ANIMATION_GENRE = 16;
  const ANIME_KEYWORD = 210024;
  if (input.keywordIds?.includes(ANIME_KEYWORD)) return true;
  if (!input.genreIds.includes(ANIMATION_GENRE)) return false;
  return input.originCountries.some((c) => ANIME_COUNTRIES.has(c)) || (input.originalLanguage !== null && ANIME_LANGUAGES.has(input.originalLanguage));
}

export function emptyPage<T>(page = 1): { page: number; totalPages: number; totalResults: number; results: T[] } {
  return { page, totalPages: 0, totalResults: 0, results: [] };
}
