/**
 * Platform-wide constants shared by every package and app.
 * Keep this file free of runtime dependencies so clients can import it too.
 */

export const APP_NAME = 'MaruTime';
export const APP_TAGLINE = 'Track what you watch. Share what you love.';

/** The six reactions a viewer can attach to an episode or movie (TVTime-style). */
export const EMOTIONS = [
  { id: 'good', label: 'Good', emoji: '😊', description: 'Solid, enjoyable' },
  { id: 'fun', label: 'Fun', emoji: '😂', description: 'Made me laugh' },
  { id: 'wow', label: 'Wow', emoji: '🤯', description: 'Blew my mind' },
  { id: 'sad', label: 'Sad', emoji: '😢', description: 'Hit me in the feels' },
  { id: 'soso', label: 'So-so', emoji: '😐', description: 'Meh' },
  { id: 'bad', label: 'Bad', emoji: '👎', description: 'Not for me' },
] as const;

export type EmotionId = (typeof EMOTIONS)[number]['id'];
export const EMOTION_IDS = EMOTIONS.map((e) => e.id) as readonly EmotionId[];

export function isEmotionId(value: unknown): value is EmotionId {
  return typeof value === 'string' && (EMOTION_IDS as readonly string[]).includes(value);
}

/** Seeded devices. Admins can edit the list; slugs are stable identifiers. */
export const DEFAULT_DEVICES = [
  { slug: 'tv', name: 'TV', icon: 'tv' },
  { slug: 'phone', name: 'Phone', icon: 'smartphone' },
  { slug: 'tablet', name: 'Tablet', icon: 'tablet' },
  { slug: 'laptop', name: 'Laptop', icon: 'laptop' },
  { slug: 'desktop', name: 'Desktop', icon: 'monitor' },
  { slug: 'cinema', name: 'Cinema', icon: 'clapperboard' },
  { slug: 'projector', name: 'Projector', icon: 'projector' },
  { slug: 'console', name: 'Game console', icon: 'gamepad-2' },
  { slug: 'vr', name: 'VR headset', icon: 'glasses' },
  { slug: 'other', name: 'Other', icon: 'circle-ellipsis' },
] as const;

/** Seeded streaming services / sources. Admins can edit the list. */
export const DEFAULT_SERVICES = [
  { slug: 'netflix', name: 'Netflix', color: '#E50914' },
  { slug: 'prime-video', name: 'Prime Video', color: '#00A8E1' },
  { slug: 'disney-plus', name: 'Disney+', color: '#113CCF' },
  { slug: 'max', name: 'Max', color: '#002BE7' },
  { slug: 'apple-tv-plus', name: 'Apple TV+', color: '#A2AAAD' },
  { slug: 'hulu', name: 'Hulu', color: '#1CE783' },
  { slug: 'paramount-plus', name: 'Paramount+', color: '#0064FF' },
  { slug: 'peacock', name: 'Peacock', color: '#FFCF00' },
  { slug: 'crunchyroll', name: 'Crunchyroll', color: '#F47521' },
  { slug: 'youtube', name: 'YouTube', color: '#FF0000' },
  { slug: 'cinema', name: 'Cinema', color: '#C9A227' },
  { slug: 'live-tv', name: 'Live TV / Broadcast', color: '#8E8E93' },
  { slug: 'physical', name: 'Physical media', color: '#5E5CE6' },
  { slug: 'other', name: 'Other', color: '#636366' },
] as const;

export const LIST_VISIBILITIES = ['public', 'unlisted', 'followers', 'private'] as const;
export type ListVisibility = (typeof LIST_VISIBILITIES)[number];

export const MEDIA_CATEGORIES = ['shows', 'movies', 'anime'] as const;
export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];

export const LIST_CATEGORIES = [...MEDIA_CATEGORIES, 'mixed'] as const;
export type ListCategory = (typeof LIST_CATEGORIES)[number];

export const USER_ROLES = ['user', 'moderator', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PROFILE_VISIBILITIES = ['public', 'followers', 'private'] as const;
export type ProfileVisibility = (typeof PROFILE_VISIBILITIES)[number];

export const SOCIAL_PLATFORMS = [
  { id: 'website', label: 'Website', hosts: [] },
  { id: 'x', label: 'X / Twitter', hosts: ['x.com', 'twitter.com'] },
  { id: 'instagram', label: 'Instagram', hosts: ['instagram.com'] },
  { id: 'tiktok', label: 'TikTok', hosts: ['tiktok.com'] },
  { id: 'youtube', label: 'YouTube', hosts: ['youtube.com', 'youtu.be'] },
  { id: 'letterboxd', label: 'Letterboxd', hosts: ['letterboxd.com'] },
  { id: 'mastodon', label: 'Mastodon', hosts: [] },
  { id: 'bluesky', label: 'Bluesky', hosts: ['bsky.app'] },
  { id: 'discord', label: 'Discord', hosts: ['discord.gg', 'discord.com'] },
  { id: 'github', label: 'GitHub', hosts: ['github.com'] },
  { id: 'anilist', label: 'AniList', hosts: ['anilist.co'] },
  { id: 'mal', label: 'MyAnimeList', hosts: ['myanimelist.net'] },
] as const;
export type SocialPlatformId = (typeof SOCIAL_PLATFORMS)[number]['id'];

export const LIMITS = {
  usernameMin: 3,
  usernameMax: 24,
  displayNameMax: 40,
  bioMax: 300,
  favoriteCharacterMax: 80,
  socialLinksMax: 8,
  commentMax: 2000,
  commentImagesMax: 4,
  commentImageBytesMax: 5 * 1024 * 1024,
  avatarBytesMax: 4 * 1024 * 1024,
  coverBytesMax: 8 * 1024 * 1024,
  listTitleMax: 80,
  listDescriptionMax: 1000,
  listItemsMax: 500,
  listNoteMax: 280,
  watchNoteMax: 500,
  apiTokensPerUser: 10,
  minimumAge: 16,
} as const;

export const USERNAME_REGEX = /^[a-z0-9_]{3,24}$/;

export const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'marutime',
  'root',
  'system',
  'support',
  'help',
  'api',
  'www',
  'mail',
  'me',
  'settings',
  'login',
  'logout',
  'register',
  'signup',
  'signin',
  'u',
  'user',
  'users',
  'lists',
  'list',
  'show',
  'shows',
  'movie',
  'movies',
  'anime',
  'discover',
  'search',
  'watchlist',
  'legal',
  'privacy',
  'terms',
  'about',
  'donate',
  'null',
  'undefined',
]);

/** Keys of platform settings stored in the database, with defaults. */
export const DEFAULT_PLATFORM_SETTINGS = {
  'site.name': APP_NAME,
  'site.tagline': APP_TAGLINE,
  'site.registrationOpen': true,
  'site.requireEmailVerification': false,
  'donation.enabled': true,
  'donation.provider': 'revolut',
  'donation.handle': 'elpideus',
  'donation.url': 'https://revolut.me/elpideus',
  'donation.title': 'Keep MaruTime free',
  'donation.message':
    'MaruTime is built by one person and runs on free tiers. If it brings you joy, a coffee helps keep the lights on.',
  'donation.placements': ['sidebar', 'profile', 'footer', 'settings'],
  'donation.frequency': 'subtle',
  'legal.controllerName': '',
  'legal.controllerEmail': '',
  'legal.controllerAddress': '',
  'legal.country': '',
  'backup.enabled': true,
  'backup.retentionDays': 30,
  'moderation.autoHideReports': 5,
} as const;

export type PlatformSettingKey = keyof typeof DEFAULT_PLATFORM_SETTINGS;
export type PlatformSettings = {
  -readonly [K in PlatformSettingKey]: (typeof DEFAULT_PLATFORM_SETTINGS)[K] extends readonly (infer U)[]
    ? (U extends string ? string[] : U[])
    : (typeof DEFAULT_PLATFORM_SETTINGS)[K] extends boolean
      ? boolean
      : (typeof DEFAULT_PLATFORM_SETTINGS)[K] extends number
        ? number
        : string;
};

export const SESSION_COOKIE = 'mt_session';
export const SESSION_TTL_DAYS = 30;
export const THEME_COOKIE = 'mt_theme';
export const CONSENT_COOKIE = 'mt_consent';
export const LISTS_CATEGORY_COOKIE = 'mt_lists_category';

/** TMDB image CDN helpers (sizes documented at developer.themoviedb.org). */
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
export const TMDB_POSTER_SIZES = ['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original'] as const;
export const TMDB_BACKDROP_SIZES = ['w300', 'w780', 'w1280', 'original'] as const;
export const TMDB_STILL_SIZES = ['w92', 'w185', 'w300', 'original'] as const;
export const TMDB_PROFILE_SIZES = ['w45', 'w185', 'h632', 'original'] as const;
