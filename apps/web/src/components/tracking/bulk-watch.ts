'use client';

import type { RestorableWatch } from '@marutime/core';
import { useToast } from '@marutime/ui';
import { useCallback } from 'react';
import { bulkMarkAction, restoreWatchesAction, undoBulkMarkAction, unwatchSeasonAction } from '@/actions/tracking';
import { useCheckIn } from './check-in-provider';
import { resolveWatch, watchStore, type WatchState } from './watch-store';

type Media = { id: number; title: string };
type Ep = { id: number; seasonNumber: number };

const key = (id: number) => `e:${id}`;

/**
 * Bulk marking with the same feel as single episodes: rows flip at once where
 * we already know them, the server confirms the full set, and every bulk
 * change comes with an Undo.
 */
export function useBulkWatch(media: Media) {
  const { toast } = useToast();
  const { refresh, signedIn } = useCheckIn();

  const set = useCallback((eps: Ep[], count: number): Array<[string, WatchState]> => eps.map((e) => [key(e.id), { count, mediaId: media.id, season: e.seasonNumber }]), [media.id]);

  /** Put viewings removed by an unmark back (Undo). */
  const restore = useCallback(
    async (eps: Ep[], removed: RestorableWatch[]) => {
      const before = watchStore.snapshot(eps.map((e) => key(e.id)));
      const perEpisode = (id: number) => removed.filter((w) => w.episodeId === id).length || 1;
      watchStore.begin(eps.map((e) => [key(e.id), { count: perEpisode(e.id), mediaId: media.id, season: e.seasonNumber }]));
      const r = await restoreWatchesAction(removed);
      if (!r.ok) {
        watchStore.rollback(before);
        toast({ tone: 'error', title: 'Could not undo', description: r.error });
        return;
      }
      watchStore.commit(eps.map((e) => [key(e.id), { count: perEpisode(e.id), mediaId: media.id, season: e.seasonNumber }]), r.at);
      refresh();
    },
    [media.id, toast, refresh],
  );

  /**
   * Mark aired episodes watched: a season, everything, or everything up to an
   * episode. `optimistic` are episodes on screen to flip before the answer.
   */
  const mark = useCallback(
    async (input: { seasonNumber?: number; upToEpisodeId?: number }, label: string, optimistic: Ep[] = []): Promise<boolean> => {
      if (!signedIn) return false;
      const fresh = optimistic.filter((e) => resolveWatch(key(e.id), { count: 0 }, 0).count === 0);
      const previous = watchStore.snapshot(fresh.map((e) => key(e.id)));
      watchStore.begin(set(fresh, 1));
      const r = await bulkMarkAction(media.id, input);
      if (!r.ok) {
        watchStore.rollback(previous);
        toast({ tone: 'error', title: `Could not mark ${label}`, description: r.error });
        return false;
      }
      const marked = new Set(r.data.episodes.map((e) => e.id));
      watchStore.rollback(previous.filter(([k]) => !marked.has(Number(k.slice(2)))));
      watchStore.commit(set(r.data.episodes, 1), r.at);
      refresh();
      if (r.data.marked === 0) {
        toast({ tone: 'info', title: `${label} is already up to date` });
        return true;
      }
      toast({
        tone: 'success',
        title: `${label} marked watched`,
        description: `${r.data.marked} ${r.data.marked === 1 ? 'episode' : 'episodes'}`,
        duration: 7000,
        action: {
          label: 'Undo',
          onClick: async () => {
            const before = watchStore.snapshot(r.data.episodes.map((e) => key(e.id)));
            watchStore.begin(set(r.data.episodes, 0));
            const u = await undoBulkMarkAction(r.data.watchIds);
            if (!u.ok) {
              watchStore.rollback(before);
              toast({ tone: 'error', title: 'Could not undo', description: u.error });
              return;
            }
            watchStore.commit(set(r.data.episodes, 0), u.at);
            refresh();
          },
        },
      });
      return true;
    },
    [signedIn, media.id, set, toast, refresh],
  );

  /** Mark every episode of a season unwatched. `known` are episodes we know are watched. */
  const unmarkSeason = useCallback(
    async (seasonNumber: number, label: string, known: Ep[] = []): Promise<boolean> => {
      if (!signedIn) return false;
      const previous = watchStore.snapshot(known.map((e) => key(e.id)));
      watchStore.begin(set(known, 0));
      const r = await unwatchSeasonAction(media.id, seasonNumber);
      if (!r.ok) {
        watchStore.rollback(previous);
        toast({ tone: 'error', title: `Could not unmark ${label}`, description: r.error });
        return false;
      }
      const all = [...known, ...r.data.episodes.filter((e) => !known.some((k) => k.id === e.id))];
      watchStore.commit(set(all, 0), r.at);
      refresh();
      if (r.data.removed.length === 0) return true;
      toast({
        tone: 'info',
        title: `${label} marked unwatched`,
        description: `${r.data.episodes.length} ${r.data.episodes.length === 1 ? 'episode' : 'episodes'}`,
        duration: 7000,
        action: { label: 'Undo', onClick: () => void restore(r.data.episodes, r.data.removed) },
      });
      return true;
    },
    [signedIn, media.id, set, toast, refresh, restore],
  );

  return { mark, unmarkSeason };
}

export function seasonLabel(seasonNumber: number, name?: string | null): string {
  if (seasonNumber === 0) return 'Specials';
  return name && !/^Season \d+$/i.test(name) ? `Season ${seasonNumber} (${name})` : `Season ${seasonNumber}`;
}
