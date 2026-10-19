'use client';

import { Dialog, Kbd } from '@marutime/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { setThemeAction } from '@/actions/preferences';
import { eventToCombo, isApple, sequenceKeys, worksInTextFields } from '@/lib/keys';
import { SHORTCUTS, SHORTCUT_GROUPS, resolveBindings } from '@/lib/shortcuts';
import { flipTheme } from '@/lib/theme';

type Handler = () => void;

type ShortcutContextValue = {
  bindings: Record<string, string | null>;
  /** Replace the viewer's custom bindings (after saving them). */
  setCustom: (custom: Record<string, string | null>) => void;
  register: (id: string, handler: Handler) => () => void;
  /** Pause dispatch while a binding is being recorded. */
  setRecording: (v: boolean) => void;
  openHelp: () => void;
};

const ShortcutContext = createContext<ShortcutContextValue | null>(null);

export function useShortcuts(): ShortcutContextValue | null {
  return useContext(ShortcutContext);
}

/**
 * Bind a handler to an action while the component is mounted. The most
 * recently mounted handler wins, so a page can override a global default.
 */
export function useShortcut(id: string, handler: Handler | null | undefined): void {
  const ctx = useContext(ShortcutContext);
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  const enabled = Boolean(handler);
  useEffect(() => {
    if (!ctx || !enabled) return;
    return ctx.register(id, () => ref.current?.());
  }, [ctx, id, enabled]);
}

const noop = () => () => {};

/** Platform for key labels: Ctrl on the server and during hydration, the real one after. */
function useApple(): boolean {
  return useSyncExternalStore(noop, isApple, () => false);
}

/** Key caps for an action's current binding, for tooltips and menus. */
export function useShortcutKeys(id: string): string[] | undefined {
  const ctx = useContext(ShortcutContext);
  const apple = useApple();
  const binding = ctx?.bindings[id];
  return useMemo(() => (binding ? sequenceKeys(binding, apple).flat() : undefined), [binding, apple]);
}

function visible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
}

/** Move focus through the page's main items (cards, rows) in reading order. */
function moveFocus(dir: 1 | -1): void {
  const items = Array.from(document.querySelectorAll<HTMLElement>('main [data-nav-item]')).filter(visible);
  if (items.length === 0) return;
  const active = document.activeElement as HTMLElement | null;
  let idx = items.findIndex((el) => el === active || el.contains(active));
  if (idx === -1) {
    // Start from whatever is on screen rather than the top of the page.
    const first = items.findIndex((el) => el.getBoundingClientRect().top >= 72);
    idx = first === -1 ? (dir > 0 ? -1 : items.length) : dir > 0 ? first - 1 : first;
  }
  const next = items[Math.min(items.length - 1, Math.max(0, idx + dir))];
  if (!next) return;
  next.focus({ preventScroll: true });
  next.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
}

const NAV: Record<string, (username: string | null) => string> = {
  'nav.home': () => '/',
  'nav.discover': () => '/discover',
  'nav.shows': () => '/shows',
  'nav.watchlist': () => '/watchlist',
  'nav.lists': () => '/lists',
  'nav.friends': () => '/feed',
  'nav.notifications': () => '/notifications',
  'nav.profile': (u) => (u ? `/u/${u}` : '/login'),
  'nav.settings': () => '/settings',
};

export function ShortcutProvider({ custom, username, theme, children }: { custom?: Record<string, string | null>; username: string | null; theme: 'dark' | 'light'; children: ReactNode }) {
  const router = useRouter();
  const [overrides, setCustom] = useState(custom);
  const bindings = useMemo(() => resolveBindings(overrides), [overrides]);
  const handlers = useRef(new Map<string, Handler[]>());
  const recording = useRef(false);
  const [help, setHelp] = useState(false);

  const register = useCallback((id: string, handler: Handler) => {
    const list = handlers.current.get(id) ?? [];
    list.push(handler);
    handlers.current.set(id, list);
    return () => {
      const l = handlers.current.get(id) ?? [];
      const i = l.lastIndexOf(handler);
      if (i >= 0) l.splice(i, 1);
    };
  }, []);

  // Built-in actions; pages and components register the rest.
  useEffect(() => {
    const offs = [
      ...Object.entries(NAV).map(([id, to]) => register(id, () => router.push(to(username)))),
      register('help.shortcuts', () => setHelp(true)),
      register('focus.next', () => moveFocus(1)),
      register('focus.prev', () => moveFocus(-1)),
      register('page.top', () => window.scrollTo({ top: 0, behavior: 'smooth' })),
      register('search.focus', () => {
        const input = document.querySelector<HTMLInputElement>('header input[role="combobox"]');
        if (input && visible(input)) input.focus();
        else router.push('/search');
      }),
      register('theme.toggle', () => void setThemeAction(flipTheme()).then(() => router.refresh())),
    ];
    return () => offs.forEach((off) => off());
  }, [register, router, username, theme]);

  // Dispatch: sequences up to three steps ("g h"), with a short wait when a
  // match is also the start of a longer binding.
  useEffect(() => {
    const byKeys = new Map<string, string>();
    for (const [id, keys] of Object.entries(bindings)) if (keys) byKeys.set(keys, id);
    const prefixes = new Set<string>();
    for (const keys of byKeys.keys()) {
      const steps = keys.split(' ');
      for (let i = 1; i < steps.length; i++) prefixes.add(steps.slice(0, i).join(' '));
    }
    let buffer: string[] = [];
    let reset: ReturnType<typeof setTimeout> | null = null;
    let pending: ReturnType<typeof setTimeout> | null = null;

    const fire = (id: string): boolean => {
      const list = handlers.current.get(id);
      const handler = list?.[list.length - 1];
      if (!handler) return false;
      handler();
      return true;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (recording.current || e.isComposing || e.repeat) return;
      const combo = eventToCombo(e);
      if (!combo) return;
      const target = e.target as HTMLElement | null;
      const typing = Boolean(target?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));
      // While a modal is open only global combos (⌘/Ctrl+…) work, so its own keys stay its own.
      const modal = Boolean(document.querySelector('[role="dialog"][aria-modal="true"]'));
      if ((typing || modal) && !worksInTextFields(combo)) {
        buffer = [];
        return;
      }
      if (pending) {
        clearTimeout(pending);
        pending = null;
      }
      buffer = [...buffer, combo].slice(-3);
      if (reset) clearTimeout(reset);
      reset = setTimeout(() => (buffer = []), 1000);
      for (let len = buffer.length; len >= 1; len--) {
        const seq = buffer.slice(-len).join(' ');
        const id = byKeys.get(seq);
        if (id) {
          if (!handlers.current.get(id)?.length) continue;
          e.preventDefault();
          if (prefixes.has(seq)) {
            // e.g. "g" alone is bound but so is "g h": give the second key a moment.
            pending = setTimeout(() => {
              buffer = [];
              fire(id);
            }, 450);
            return;
          }
          buffer = [];
          fire(id);
          return;
        }
        if (prefixes.has(seq)) return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (reset) clearTimeout(reset);
      if (pending) clearTimeout(pending);
    };
  }, [bindings]);

  const value = useMemo<ShortcutContextValue>(
    () => ({
      bindings,
      setCustom,
      register,
      setRecording: (v) => {
        recording.current = v;
      },
      openHelp: () => setHelp(true),
    }),
    [bindings, register],
  );

  return (
    <ShortcutContext.Provider value={value}>
      {children}
      <Dialog open={help} onClose={() => setHelp(false)} title="Keyboard shortcuts" description="Most pages can be driven without a mouse." size="lg">
        <ShortcutList bindings={bindings} />
        <p className="mt-6 text-xs text-fg-muted">
          {username ? (
            <>
              Change any of these in{' '}
              <Link href="/settings/keyboard" onClick={() => setHelp(false)} className="text-accent hover:underline">
                Settings → Keyboard
              </Link>
              .
            </>
          ) : (
            'Sign in to customise these shortcuts.'
          )}
        </p>
      </Dialog>
    </ShortcutContext.Provider>
  );
}

export function KeyCaps({ binding }: { binding: string }) {
  const apple = useApple();
  const steps = sequenceKeys(binding, apple);
  return (
    <span className="inline-flex items-center gap-1">
      {steps.map((caps, i) => (
        <span key={i} className="inline-flex items-center gap-0.5">
          {i > 0 ? <span className="px-0.5 text-[10px] text-fg-subtle">then</span> : null}
          {caps.map((c) => (
            <Kbd key={c}>{c}</Kbd>
          ))}
        </span>
      ))}
    </span>
  );
}

function ShortcutList({ bindings }: { bindings: Record<string, string | null> }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {SHORTCUT_GROUPS.map((group) => (
        <section key={group}>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-fg-subtle uppercase">{group}</h3>
          <ul className="flex flex-col gap-1.5">
            {SHORTCUTS.filter((s) => s.group === group).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-fg">{s.label}</span>
                {bindings[s.id] ? <KeyCaps binding={bindings[s.id]!} /> : <span className="text-xs text-fg-subtle">Off</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
