'use client';

import { useSyncExternalStore } from 'react';

const EVENT = 'mt:client-store';

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

export function notifyClientStore(): void {
  window.dispatchEvent(new Event(EVENT));
}

/** Read a cookie's presence without hydration mismatches (server snapshot = present). */
export function useHasCookie(name: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => document.cookie.split('; ').some((c) => c.startsWith(`${name}=`)),
    () => true,
  );
}

/** Read a localStorage value safely; server snapshot = fallback. */
export function useLocalStorageValue(key: string, fallback: string | null = null): string | null {
  return useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key) ?? fallback;
      } catch {
        return fallback;
      }
    },
    () => fallback,
  );
}
