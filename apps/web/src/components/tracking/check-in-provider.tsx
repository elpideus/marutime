'use client';

import type { Device, Service } from '@marutime/db';
import type { RestorableWatch } from '@marutime/core';
import { useToast } from '@marutime/ui';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { checkInEpisodeAction, checkInMovieAction, getCheckInContextAction, restoreWatchesAction, unwatchEpisodeAction, unwatchMovieAction, updateWatchAction } from '@/actions/tracking';
import { watchKey, type CheckInCharacter, type CheckInInitial, type CheckInTarget, type CheckInValues } from '@/lib/check-in';
import { CheckInDialog, type CheckInMode } from './check-in-dialog';
import { watchStore, type WatchState } from './watch-store';

export type CheckInSheetOptions = {
  characters?: CheckInCharacter[];
  guestCharacters?: CheckInCharacter[];
  /** Latest check-in to edit, if the page already has it. */
  initial?: CheckInInitial | null;
};

export type CheckInApi = {
  signedIn: boolean;
  devices: Device[];
  services: Service[];
  /** Mark watched now (optimistically) and open the details sheet. */
  markWatched: (target: CheckInTarget, opts?: CheckInSheetOptions & { sheet?: boolean }) => void;
  /** Remove every viewing, with an Undo toast. `count` is the current number of viewings. */
  unwatch: (target: CheckInTarget, count: number) => void;
  /** Edit the latest check-in's details. */
  edit: (target: CheckInTarget, count: number, opts?: CheckInSheetOptions) => void;
  /** Log another viewing. */
  rewatch: (target: CheckInTarget, count: number, opts?: CheckInSheetOptions) => void;
  /** Re-render server data soon (debounced across many quick changes). */
  refresh: () => void;
};

const CheckInContext = createContext<CheckInApi | null>(null);

export function useCheckIn(): CheckInApi {
  const ctx = useContext(CheckInContext);
  if (!ctx) throw new Error('useCheckIn must be used inside <CheckInProvider>');
  return ctx;
}

/** Same as useCheckIn, but null outside the provider (e.g. auth pages). */
export function useOptionalCheckIn(): CheckInApi | null {
  return useContext(CheckInContext);
}

type Sheet = {
  open: boolean;
  target: CheckInTarget;
  mode: CheckInMode;
  count: number;
  characters: CheckInCharacter[];
  guestCharacters: CheckInCharacter[];
  initial: CheckInInitial | null;
  loading: boolean;
};

function group(target: CheckInTarget): Pick<WatchState, 'mediaId' | 'season'> {
  return target.kind === 'episode' ? { mediaId: target.mediaId, season: target.seasonNumber } : { mediaId: target.mediaId };
}

/**
 * One check-in sheet for the whole app, plus the optimistic logic every
 * "watched" control shares: the UI flips at once, the server catches up in
 * the background, and only failures interrupt with a toast. Operations on the
 * same episode/movie run strictly in order so a quick mark → edit → unmark
 * sequence can never race.
 */
export function CheckInProvider({ children, signedIn, devices, services, defaults }: { children: ReactNode; signedIn: boolean; devices: Device[]; services: Service[]; defaults?: { deviceId?: number | null; serviceId?: number | null } }) {
  const router = useRouter();
  const { toast } = useToast();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const queues = useRef(new Map<string, Promise<unknown>>());
  const creating = useRef(new Map<string, Promise<string | null>>());
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), 450);
  }, [router]);

  /** Run `fn` after every earlier operation on the same key has settled. */
  const enqueue = useCallback(<T,>(key: string, fn: () => Promise<T>): Promise<T> => {
    const prev = queues.current.get(key) ?? Promise.resolve();
    const next = prev.catch(() => {}).then(fn);
    queues.current.set(key, next);
    void next.finally(() => {
      if (queues.current.get(key) === next) queues.current.delete(key);
    });
    return next;
  }, []);

  const toLogin = useCallback(() => router.push(`/login?next=${encodeURIComponent(location.pathname)}`), [router]);

  const openSheet = useCallback(
    (target: CheckInTarget, mode: CheckInMode, count: number, opts: CheckInSheetOptions = {}) => {
      const needsContext = !opts.characters || (mode === 'edit' && opts.initial === undefined);
      setSheet({ open: true, target, mode, count, characters: opts.characters ?? [], guestCharacters: opts.guestCharacters ?? [], initial: opts.initial ?? null, loading: needsContext });
      if (!needsContext) return;
      void getCheckInContextAction(target.kind === 'episode' ? { episodeId: target.episodeId } : { mediaId: target.mediaId }).then((r) => {
        setSheet((s) => {
          if (!s || watchKey(s.target) !== watchKey(target)) return s;
          if (!r.ok) return { ...s, loading: false };
          return {
            ...s,
            loading: false,
            characters: opts.characters ?? r.data.characters,
            guestCharacters: opts.guestCharacters ?? r.data.guestCharacters,
            initial: opts.initial !== undefined ? opts.initial : r.data.latest,
          };
        });
      });
    },
    [],
  );

  const checkIn = useCallback(
    (target: CheckInTarget, input: Partial<CheckInValues> & { rewatch?: boolean }) =>
      target.kind === 'episode' ? checkInEpisodeAction(target.episodeId, input) : checkInMovieAction(target.mediaId, input),
    [],
  );

  const markWatched = useCallback<CheckInApi['markWatched']>(
    (target, opts = {}) => {
      if (!signedIn) return toLogin();
      const key = watchKey(target);
      const previous = watchStore.snapshot([key]);
      watchStore.begin([[key, { count: 1, ...group(target) }]]);
      const created = enqueue(key, async () => {
        const r = await checkIn(target, { ...defaults });
        if (!r.ok) {
          watchStore.rollback(previous);
          toast({ tone: 'error', title: 'Could not mark as watched', description: r.error });
          return null;
        }
        watchStore.commit([[key, { count: 1, ...group(target) }]], r.at);
        if ('finishedShow' in r.data && r.data.finishedShow) toast({ tone: 'success', title: 'Show complete! 🎉', description: 'You watched every aired episode.' });
        refresh();
        return r.data.watchId;
      });
      creating.current.set(key, created);
      if (opts.sheet !== false) openSheet(target, 'new', 1, opts);
    },
    [signedIn, toLogin, enqueue, checkIn, defaults, toast, refresh, openSheet],
  );

  const restore = useCallback(
    (target: CheckInTarget, rows: RestorableWatch[]) => {
      const key = watchKey(target);
      const previous = watchStore.snapshot([key]);
      watchStore.begin([[key, { count: rows.length, ...group(target) }]]);
      void enqueue(key, async () => {
        const r = await restoreWatchesAction(rows);
        if (!r.ok) {
          watchStore.rollback(previous);
          toast({ tone: 'error', title: 'Could not undo', description: r.error });
          return;
        }
        watchStore.commit([[key, { count: r.data.restored, ...group(target) }]], r.at);
        refresh();
      });
    },
    [enqueue, toast, refresh],
  );

  const unwatch = useCallback<CheckInApi['unwatch']>(
    (target, count) => {
      if (!signedIn) return toLogin();
      const key = watchKey(target);
      const previous = watchStore.snapshot([key]);
      watchStore.begin([[key, { count: 0, ...group(target) }]]);
      void enqueue(key, async () => {
        const r = target.kind === 'episode' ? await unwatchEpisodeAction(target.episodeId) : await unwatchMovieAction(target.mediaId);
        if (!r.ok) {
          watchStore.rollback(previous);
          toast({ tone: 'error', title: 'Could not remove from watched', description: r.error });
          return;
        }
        watchStore.commit([[key, { count: 0, ...group(target) }]], r.at);
        refresh();
        const removed = r.data.removed;
        if (removed.length > 0) {
          toast({
            tone: 'info',
            title: count > 1 ? `Removed ${count} viewings` : 'Marked as unwatched',
            description: target.label,
            duration: 6000,
            action: { label: 'Undo', onClick: () => restore(target, removed) },
          });
        }
      });
    },
    [signedIn, toLogin, enqueue, toast, refresh, restore],
  );

  const edit = useCallback<CheckInApi['edit']>(
    (target, count, opts = {}) => {
      if (!signedIn) return toLogin();
      openSheet(target, 'edit', count, opts);
    },
    [signedIn, toLogin, openSheet],
  );

  const rewatch = useCallback<CheckInApi['rewatch']>(
    (target, count, opts = {}) => {
      if (!signedIn) return toLogin();
      openSheet(target, 'rewatch', count, { ...opts, initial: null });
    },
    [signedIn, toLogin, openSheet],
  );

  /** Save the sheet in the background; the button shows progress, errors toast. */
  const submit = useCallback(
    (s: Sheet, values: CheckInValues) => {
      const key = watchKey(s.target);
      const count = s.mode === 'rewatch' ? s.count + 1 : Math.max(1, s.count);
      const previous = watchStore.snapshot([key]);
      watchStore.begin([[key, { count, ...group(s.target) }]]);
      void enqueue(key, async () => {
        let r: { ok: true; at: number } | { ok: false; error: string };
        if (s.mode === 'new') {
          const watchId = await (creating.current.get(key) ?? Promise.resolve(null));
          if (!watchId) {
            watchStore.rollback(previous);
            return;
          }
          r = await updateWatchAction(watchId, values);
        } else if (s.mode === 'edit' && s.initial?.watchId) {
          r = await updateWatchAction(s.initial.watchId, values);
        } else {
          r = await checkIn(s.target, { ...values, rewatch: s.mode === 'rewatch' });
        }
        if (!r.ok) {
          watchStore.rollback(previous);
          toast({ tone: 'error', title: 'Could not save your check-in', description: r.error });
          return;
        }
        watchStore.commit([[key, { count, ...group(s.target) }]], r.at);
        refresh();
      });
    },
    [enqueue, checkIn, toast, refresh],
  );

  const api = useMemo<CheckInApi>(() => ({ signedIn, devices, services, markWatched, unwatch, edit, rewatch, refresh }), [signedIn, devices, services, markWatched, unwatch, edit, rewatch, refresh]);

  return (
    <CheckInContext.Provider value={api}>
      {children}
      {sheet ? (
        <CheckInDialog
          open={sheet.open}
          onClose={() => setSheet((s) => (s ? { ...s, open: false } : s))}
          onSubmit={(values) => submit(sheet, values)}
          mode={sheet.mode}
          label={sheet.target.label}
          kind={sheet.target.kind}
          devices={devices}
          services={services}
          characters={sheet.characters}
          guestCharacters={sheet.guestCharacters}
          initial={sheet.initial}
          defaults={defaults}
          loading={sheet.loading}
        />
      ) : null}
    </CheckInContext.Provider>
  );
}
