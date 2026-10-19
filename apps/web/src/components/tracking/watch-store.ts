'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Client-side truth for "is this watched?" shared by every button on the
 * page (and across pages in the session): marking a season updates each
 * episode row, the progress card, the episode page and the watch-next cards
 * at once, before the server answers.
 *
 * Server-rendered props stay the base. A local override wins while its
 * operation is pending, or when it is newer than the server render that
 * produced the props (both stamped with the server clock), so a stale cached
 * page can never undo a change the viewer just made.
 */
export type WatchState = {
  /** Number of viewings; 0 means unwatched. */
  count: number;
  /** An optimistic change is waiting for the server. */
  pending?: boolean;
  /** Grouping, so season and show summaries can be derived. */
  mediaId?: number;
  season?: number;
};

type Override = WatchState & { at: number };

const overrides = new Map<string, Override>();
const listeners = new Set<() => void>();
let version = 0;

function emit(): void {
  version++;
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const watchStore = {
  get(key: string): Override | undefined {
    return overrides.get(key);
  },
  /** Optimistic update: wins until settled. */
  begin(entries: Array<[string, WatchState]>): void {
    for (const [key, state] of entries) overrides.set(key, { ...state, pending: true, at: Number.POSITIVE_INFINITY });
    emit();
  },
  /** The server accepted the change at server time `at`. */
  commit(entries: Array<[string, WatchState]>, at: number): void {
    for (const [key, state] of entries) overrides.set(key, { ...state, pending: false, at });
    emit();
  },
  /** The server rejected the change: go back to what was there before. */
  rollback(previous: Array<[string, Override | undefined]>): void {
    for (const [key, prev] of previous) {
      if (prev) overrides.set(key, prev);
      else overrides.delete(key);
    }
    emit();
  },
  snapshot(keys: string[]): Array<[string, Override | undefined]> {
    return keys.map((k) => [k, overrides.get(k)]);
  },
  entries(): IterableIterator<[string, Override]> {
    return overrides.entries();
  },
  subscribe,
};

export function resolveWatch(key: string, server: WatchState, serverAt: number): WatchState {
  const o = overrides.get(key);
  if (o && (o.pending || o.at >= serverAt)) return o;
  return server;
}

/** Live watch state for one episode or movie. */
export function useWatchState(key: string, server: WatchState, serverAt: number): WatchState {
  const override = useSyncExternalStore(
    subscribe,
    () => overrides.get(key),
    () => undefined,
  );
  if (override && (override.pending || override.at >= serverAt)) return override;
  return server;
}

/**
 * Derive a number from the whole store (e.g. watched episodes in a season).
 * `compute` must be stable or memoised by the caller.
 */
export function useWatchDerived(compute: () => number): number {
  const getSnapshot = useCallback(() => compute(), [compute]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function storeVersion(): number {
  return version;
}
