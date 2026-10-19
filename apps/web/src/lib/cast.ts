import type { Character } from '@marutime/db';
import { img } from '@marutime/metadata/images';

/** A cast entry as the client needs it: who the character is and who plays them. */
export type CastMember = {
  id: number;
  name: string;
  image: string | null;
  /** Where the character row came from: AniList characters have their own page. */
  source: 'tmdb' | 'anilist';
  characterId: number | null;
  actorName: string | null;
  actorId: number | null;
  actorSource: 'tmdb' | 'anilist' | null;
  actorImage: string | null;
  role: string | null;
  episodeCount: number | null;
  guest: boolean;
};

export function toCastMember(c: Character): CastMember {
  const anilist = c.source === 'anilist';
  return {
    id: c.id,
    name: c.name,
    image: c.imageUrl ?? img.profile(c.profilePath, 'w185'),
    source: anilist ? 'anilist' : 'tmdb',
    characterId: anilist ? c.externalCharacterId : null,
    actorName: c.actorName,
    actorId: anilist ? c.voiceActorId : c.externalPersonId,
    actorSource: anilist ? (c.voiceActorId ? 'anilist' : null) : c.externalPersonId ? 'tmdb' : null,
    actorImage: anilist ? c.voiceActorImageUrl : img.profile(c.profilePath, 'w185'),
    role: c.role,
    episodeCount: c.episodeCount,
    guest: c.kind === 'guest',
  };
}
