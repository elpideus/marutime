import type { EmotionId } from '@marutime/config';

/** What a check-in is about. `mediaId` on episodes lets bulk views group by show. */
export type CheckInTarget =
  | { kind: 'episode'; episodeId: number; mediaId?: number; seasonNumber?: number; label: string }
  | { kind: 'movie'; mediaId: number; label: string };

export type CheckInCharacter = { id: number; name: string; imageUrl: string | null; profilePath: string | null };

export type CheckInInitial = {
  watchId?: string;
  deviceId?: number | null;
  serviceId?: number | null;
  emotions?: string[];
  favoriteCharacterId?: number | null;
  rating?: number | null;
  note?: string | null;
};

export type CheckInValues = {
  deviceId: number | null;
  serviceId: number | null;
  emotions: EmotionId[];
  favoriteCharacterId: number | null;
  /** 1–10, shown as five half-steppable stars. */
  rating: number | null;
  note: string | null;
};

/**
 * Picking a service that implies a device pre-selects that device, unless the
 * viewer already chose one by hand in this sheet. Keys and values are slugs.
 */
export const SERVICE_DEVICE_HINTS: Record<string, string> = {
  'live-tv': 'tv',
  cinema: 'cinema',
};

export function watchKey(target: CheckInTarget): string {
  return target.kind === 'episode' ? `e:${target.episodeId}` : `m:${target.mediaId}`;
}
