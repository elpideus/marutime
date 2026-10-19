import { animeDetails, eq, inArray, media, type DbExecutor } from '@marutime/db';
import { img, type AniListMediaRef, type PersonCredit } from '@marutime/metadata';
import { mediaHref } from '../hrefs';
import { getAniListCharacter, getAniListStaff, getProvider } from '../media/provider';

/**
 * People and characters, normalised for the cast modals regardless of where
 * the data comes from (TMDB people, AniList characters and staff).
 */

export type PeopleSource = 'tmdb' | 'anilist';

export type WorkView = {
  key: string;
  title: string;
  /** Role or job, e.g. "Monkey D. Luffy" or "Director". */
  role: string | null;
  image: string | null;
  href: string;
  kind: 'show' | 'movie' | 'anime' | 'manga';
  year: string | null;
  /** Main/supporting for AniList roles, episode count for TV. */
  note: string | null;
};

export type Fact = { label: string; value: string };
export type ExternalLink = { label: string; href: string };

export type PersonView = {
  source: PeopleSource;
  id: number;
  name: string;
  nativeName: string | null;
  image: string | null;
  knownFor: string | null;
  bio: string | null;
  facts: Fact[];
  links: ExternalLink[];
  works: WorkView[];
};

export type VoiceActorView = { id: number; name: string; nativeName: string | null; image: string | null; language: string | null };

export type CharacterView = {
  id: number;
  name: string;
  nativeName: string | null;
  alternativeNames: string[];
  image: string | null;
  bio: string | null;
  facts: Fact[];
  links: ExternalLink[];
  /** Voice actors for the requested anime first, by language. */
  voiceActors: VoiceActorView[];
  appearances: WorkView[];
};

function age(birthday: string | null, deathday: string | null): number | null {
  if (!birthday) return null;
  const b = new Date(birthday);
  const end = deathday ? new Date(deathday) : new Date();
  if (Number.isNaN(b.getTime())) return null;
  let a = end.getFullYear() - b.getFullYear();
  if (end.getMonth() < b.getMonth() || (end.getMonth() === b.getMonth() && end.getDate() < b.getDate())) a--;
  return a;
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

function creditToWork(c: PersonCredit): WorkView {
  const kind = c.isAnime ? 'anime' : c.type;
  return {
    key: `${c.type}:${c.externalId}`,
    title: c.title,
    role: c.role,
    image: img.poster(c.posterPath, 'w185'),
    href: mediaHref({ type: c.type, externalId: c.externalId, title: c.title }),
    kind,
    year: c.releaseDate?.slice(0, 4) ?? null,
    note: c.type === 'show' && c.episodeCount ? `${c.episodeCount} ${c.episodeCount === 1 ? 'episode' : 'episodes'}` : null,
  };
}

/** Link AniList entries to our own pages when we have them, otherwise to search. */
async function resolveAniList(db: DbExecutor, refs: AniListMediaRef[]): Promise<Map<number, string>> {
  const ids = Array.from(new Set(refs.filter((r) => r.type === 'ANIME').map((r) => r.anilistId)));
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ anilistId: animeDetails.anilistId, type: media.type, externalId: media.externalId, title: media.title })
    .from(animeDetails)
    .innerJoin(media, eq(media.id, animeDetails.mediaId))
    .where(inArray(animeDetails.anilistId, ids));
  return new Map(rows.map((r) => [r.anilistId, mediaHref(r)]));
}

function aniListWork(ref: AniListMediaRef, local: Map<number, string>, role: string | null, note: string | null): WorkView {
  return {
    key: `al:${ref.anilistId}`,
    title: ref.title,
    role,
    image: ref.coverImageUrl,
    href: local.get(ref.anilistId) ?? `/search?q=${encodeURIComponent(ref.title)}&type=${ref.type === 'ANIME' ? 'anime' : 'all'}`,
    kind: ref.type === 'MANGA' ? 'manga' : 'anime',
    year: ref.year ? String(ref.year) : null,
    note,
  };
}

const ROLE: Record<string, string> = { MAIN: 'Main', SUPPORTING: 'Supporting', BACKGROUND: 'Background' };

export async function getPersonView(db: DbExecutor, source: PeopleSource, id: number): Promise<PersonView | null> {
  if (source === 'tmdb') {
    const p = await getProvider().getPerson(id);
    if (!p) return null;
    const years = age(p.birthday, p.deathday);
    const facts: Fact[] = [];
    if (p.birthday) facts.push({ label: 'Born', value: `${formatDay(p.birthday)}${!p.deathday && years !== null ? ` (age ${years})` : ''}` });
    if (p.deathday) facts.push({ label: 'Died', value: `${formatDay(p.deathday)}${years !== null ? ` (age ${years})` : ''}` });
    if (p.placeOfBirth) facts.push({ label: 'From', value: p.placeOfBirth });
    if (p.alsoKnownAs.length) facts.push({ label: 'Also known as', value: p.alsoKnownAs.slice(0, 3).join(', ') });
    const links: ExternalLink[] = [{ label: 'TMDB', href: `https://www.themoviedb.org/person/${p.externalId}` }];
    if (p.imdbId) links.push({ label: 'IMDb', href: `https://www.imdb.com/name/${p.imdbId}` });
    if (p.homepage) links.push({ label: 'Website', href: p.homepage });
    return {
      source,
      id,
      name: p.name,
      nativeName: null,
      image: img.profile(p.profilePath, 'h632'),
      knownFor: p.knownForDepartment,
      bio: p.biography,
      facts,
      links: p.provider === 'tmdb' ? links : [],
      works: p.credits.map(creditToWork),
    };
  }
  const s = await getAniListStaff(id);
  if (!s) return null;
  const facts: Fact[] = [];
  if (s.dateOfBirth) facts.push({ label: 'Born', value: `${s.dateOfBirth}${s.age && !s.dateOfDeath ? ` (age ${s.age})` : ''}` });
  if (s.dateOfDeath) facts.push({ label: 'Died', value: s.dateOfDeath });
  if (s.homeTown) facts.push({ label: 'From', value: s.homeTown });
  if (s.yearsActive.length) facts.push({ label: 'Active', value: s.yearsActive.length > 1 ? `${s.yearsActive[0]}–${s.yearsActive[1]}` : `${s.yearsActive[0]}–present` });
  if (s.language) facts.push({ label: 'Language', value: s.language });
  const local = await resolveAniList(db, s.roles.map((r) => r.media));
  return {
    source,
    id,
    name: s.name,
    nativeName: s.nativeName,
    image: s.imageUrl,
    knownFor: s.occupations.join(', ') || null,
    bio: s.description,
    facts,
    links: s.siteUrl ? [{ label: 'AniList', href: s.siteUrl }] : [],
    works: s.roles.map((r) => ({ ...aniListWork(r.media, local, r.character.name, r.role ? (ROLE[r.role] ?? null) : null), key: `al:${r.media.anilistId}:${r.character.anilistId}`, image: r.character.imageUrl ?? r.media.coverImageUrl })),
  };
}

export async function getCharacterView(db: DbExecutor, id: number, mediaAnilistId?: number | null): Promise<CharacterView | null> {
  const c = await getAniListCharacter(id);
  if (!c) return null;
  const facts: Fact[] = [];
  if (c.age) facts.push({ label: 'Age', value: c.age });
  if (c.gender) facts.push({ label: 'Gender', value: c.gender });
  if (c.dateOfBirth) facts.push({ label: 'Birthday', value: c.dateOfBirth });
  if (c.bloodType) facts.push({ label: 'Blood type', value: c.bloodType });
  // Voice actors of this show first, then everyone else who voiced the character.
  const ordered = [...c.appearances].sort((a, b) => Number(b.anilistId === mediaAnilistId) - Number(a.anilistId === mediaAnilistId));
  const seen = new Set<number>();
  const voiceActors: VoiceActorView[] = [];
  for (const a of ordered) {
    for (const v of a.voiceActors) {
      if (seen.has(v.anilistId)) continue;
      seen.add(v.anilistId);
      voiceActors.push({ id: v.anilistId, name: v.name, nativeName: v.nativeName, image: v.imageUrl, language: v.language });
    }
  }
  const langOrder = (l: string | null) => (l === 'Japanese' ? 0 : l === 'English' ? 1 : 2);
  voiceActors.sort((a, b) => langOrder(a.language) - langOrder(b.language));
  const local = await resolveAniList(db, c.appearances);
  return {
    id: c.anilistId,
    name: c.name,
    nativeName: c.nativeName,
    alternativeNames: c.alternativeNames,
    image: c.imageUrl,
    bio: c.description,
    facts,
    links: c.siteUrl ? [{ label: 'AniList', href: c.siteUrl }] : [],
    voiceActors: voiceActors.slice(0, 24),
    appearances: c.appearances.map((a) => aniListWork(a, local, a.role ? (ROLE[a.role] ?? null) : null, null)),
  };
}
