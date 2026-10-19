'use client';

import type { UserPreferences } from '@marutime/db';
import { img } from '@marutime/metadata/images';
import { Kbd, Spinner, cn, exitFast, springs, useIsClient, useToast } from '@marutime/ui';
import {
  Bell,
  Bookmark,
  CheckCircle2,
  Clapperboard,
  Clock,
  Compass,
  Database,
  Eye,
  House,
  Keyboard,
  ListVideo,
  Lock,
  Moon,
  Search,
  Settings,
  Shield,
  Sparkles,
  Tv,
  User,
  Users,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { setThemeAction } from '@/actions/preferences';
import { updatePreferencesAction } from '@/actions/profile';
import { TypeBadge } from '@/components/media/type-badge';
import { useOptionalCheckIn } from '@/components/tracking/check-in-provider';
import type { CheckInTarget } from '@/lib/check-in';
import { flipTheme } from '@/lib/theme';
import { KeyCaps, useShortcut, useShortcuts } from './shortcut-provider';

export type Command = {
  id: string;
  title: string;
  subtitle?: string;
  group: string;
  icon?: ReactNode;
  keywords?: string;
  /** Show this action's keyboard shortcut next to it. */
  shortcutId?: string;
  perform: () => void | Promise<void>;
};

type Registry = { register: (commands: Command[]) => () => void };
const RegistryContext = createContext<Registry | null>(null);

/** Offer commands in the bar while the component is mounted (e.g. actions for the current page). */
export function useCommands(commands: Command[] | null): void {
  const registry = useContext(RegistryContext);
  const ref = useRef(commands);
  useEffect(() => {
    ref.current = commands;
  });
  const signature = commands?.map((c) => `${c.id}:${c.title}`).join('|') ?? '';
  useEffect(() => {
    if (!registry || !signature) return;
    return registry.register((ref.current ?? []).map((c) => ({ ...c, perform: () => ref.current?.find((x) => x.id === c.id)?.perform() })));
  }, [registry, signature]);
}

type TitleResult = { href: string; title: string; posterPath: string | null; year: string; type: 'show' | 'movie'; isAnime: boolean };
type RecentTitle = { href: string; title: string; posterPath: string | null; type: 'show' | 'movie'; isAnime: boolean };

const RECENT_KEY = 'mt:recent-titles';

/** Remember a visited title for the command bar's "Recent" group. */
export function rememberTitle(t: RecentTitle): void {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as RecentTitle[];
    const next = [t, ...list.filter((x) => x.href !== t.href)].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
}

function readRecent(): RecentTitle[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as RecentTitle[];
  } catch {
    return [];
  }
}

/** Fuzzy score: contiguous and word-start matches rank highest; 0 means no match. */
function score(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 1;
  const at = t.indexOf(q);
  if (at >= 0) return 1000 - at * 2 + (at === 0 || t[at - 1] === ' ' ? 200 : 0);
  let s = 0;
  let ti = 0;
  let streak = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found < 0) return 0;
    streak = found === ti ? streak + 1 : 0;
    s += 10 + streak * 6 + (found === 0 || t[found - 1] === ' ' ? 15 : 0) - Math.min(found - ti, 10);
    ti = found + 1;
  }
  return Math.max(1, s);
}

type Item = { key: string; group: string; title: string; subtitle?: string; icon?: ReactNode; shortcutId?: string; title_?: TitleResult; run: (mode: 'open' | 'watch' | 'watchlist') => void };

export function CommandPaletteProvider({ children, signedIn, staff, username, preferences, apiTokens }: { children: ReactNode; signedIn: boolean; staff: boolean; username: string | null; preferences: UserPreferences | null; apiTokens: boolean }) {
  // `session` changes on every opening so the bar always starts fresh.
  const [state, setState] = useState({ open: false, session: 0 });
  const [registered, setRegistered] = useState<Array<{ id: number; commands: Command[] }>>([]);
  const seq = useRef(0);

  const registry = useMemo<Registry>(
    () => ({
      register: (commands) => {
        const id = ++seq.current;
        setRegistered((r) => [...r, { id, commands }]);
        return () => setRegistered((r) => r.filter((x) => x.id !== id));
      },
    }),
    [],
  );

  const show = useCallback(() => setState((s) => (s.open ? s : { open: true, session: s.session + 1 })), []);
  useShortcut('palette.open', () => setState((s) => (s.open ? { ...s, open: false } : { open: true, session: s.session + 1 })));

  // Other parts of the app (the header button) open it with an event.
  useEffect(() => {
    window.addEventListener('mt:command-palette', show);
    return () => window.removeEventListener('mt:command-palette', show);
  }, [show]);

  const pageCommands = useMemo(() => registered.flatMap((r) => r.commands), [registered]);

  return (
    <RegistryContext.Provider value={registry}>
      {children}
      <Palette key={state.session} open={state.open} onClose={() => setState((s) => ({ ...s, open: false }))} pageCommands={pageCommands} signedIn={signedIn} staff={staff} username={username} preferences={preferences} apiTokens={apiTokens} />
    </RegistryContext.Provider>
  );
}

export function openCommandPalette(): void {
  window.dispatchEvent(new Event('mt:command-palette'));
}

function Palette({ open, onClose, pageCommands, signedIn, staff, username, preferences, apiTokens }: { open: boolean; onClose: () => void; pageCommands: Command[]; signedIn: boolean; staff: boolean; username: string | null; preferences: UserPreferences | null; apiTokens: boolean }) {
  const isClient = useIsClient();
  const router = useRouter();
  const { toast } = useToast();
  const checkIn = useOptionalCheckIn();
  const shortcuts = useShortcuts();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const restore = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [results, setResults] = useState<{ term: string; titles: TitleResult[] }>({ term: '', titles: [] });
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [recent] = useState<RecentTitle[]>(() => (typeof window === 'undefined' ? [] : readRecent()));
  const term = query.trim();
  const titles = useMemo(() => (term.length >= 2 && results.term === term ? results.titles : []), [term, results]);
  const searching = open && term.length >= 2 && results.term !== term;

  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
      restore.current?.focus?.();
    };
  }, [open]);

  // Live title search (debounced, aborts stale requests).
  useEffect(() => {
    if (!open || term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}&limit=6`, { signal: ctrl.signal });
        const found = res.ok ? ((await res.json()) as { results: TitleResult[] }).results : [];
        setResults({ term, titles: found });
        setActive(0);
      } catch {
        /* aborted */
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [term, open]);

  const go = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router],
  );

  const setPref = useCallback(
    async (patch: UserPreferences, done: string) => {
      onClose();
      const r = await updatePreferencesAction(patch);
      if (!r.ok) toast({ tone: 'error', title: r.error });
      else {
        toast({ tone: 'success', title: done });
        router.refresh();
      }
    },
    [onClose, router, toast],
  );

  const markTitle = useCallback(
    async (t: TitleResult, key: string) => {
      if (!checkIn || !signedIn) return go(`/login?next=${encodeURIComponent(t.href)}`);
      const m = /^\/(show|movie)\/(\d+)/.exec(t.href);
      if (!m) return;
      setBusyKey(key);
      try {
        const res = await fetch(`/api/palette/target?type=${m[1]}&tmdbId=${m[2]}`);
        const data = (await res.json()) as { target: CheckInTarget | null; count?: number; reason?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? 'Unavailable');
        onClose();
        if (!data.target) {
          toast({ tone: 'info', title: t.title, description: data.reason });
          return;
        }
        // Movies already watched get a rewatch; everything else a fresh check-in.
        if (data.target.kind === 'movie' && (data.count ?? 0) > 0) checkIn.rewatch(data.target, data.count ?? 1);
        else checkIn.markWatched(data.target);
      } catch (err) {
        toast({ tone: 'error', title: 'Could not do that right now', description: (err as Error).message });
      } finally {
        setBusyKey(null);
      }
    },
    [checkIn, signedIn, go, onClose, toast],
  );

  const items = useMemo<Item[]>(() => {
    const nav: Command[] = [
      { id: 'n-home', title: 'Home', group: 'Go to', icon: <House />, shortcutId: 'nav.home', perform: () => go('/') },
      { id: 'n-discover', title: 'Discover', group: 'Go to', icon: <Compass />, keywords: 'browse trending genres', shortcutId: 'nav.discover', perform: () => go('/discover') },
      { id: 'n-anime', title: 'Discover anime', group: 'Go to', icon: <Sparkles />, perform: () => go('/discover?c=anime') },
      { id: 'n-movies', title: 'Discover movies', group: 'Go to', icon: <Clapperboard />, perform: () => go('/discover?c=movies') },
      { id: 'n-lists', title: 'Lists', group: 'Go to', icon: <ListVideo />, shortcutId: 'nav.lists', perform: () => go('/lists') },
      { id: 'n-search', title: query.trim() ? `Search for “${query.trim()}”` : 'Search page', group: 'Go to', icon: <Search />, perform: () => go(query.trim() ? `/search?q=${encodeURIComponent(query.trim())}` : '/search') },
      ...(signedIn
        ? [
            { id: 'n-shows', title: 'My shows', group: 'Go to', icon: <Tv />, shortcutId: 'nav.shows', perform: () => go('/shows') },
            { id: 'n-watchlist', title: 'Watchlist', group: 'Go to', icon: <Bookmark />, shortcutId: 'nav.watchlist', perform: () => go('/watchlist') },
            { id: 'n-friends', title: 'Friends', group: 'Go to', icon: <Users />, keywords: 'feed activity', shortcutId: 'nav.friends', perform: () => go('/feed') },
            { id: 'n-notifications', title: 'Notifications', group: 'Go to', icon: <Bell />, shortcutId: 'nav.notifications', perform: () => go('/notifications') },
            { id: 'n-profile', title: 'Your profile', group: 'Go to', icon: <User />, shortcutId: 'nav.profile', perform: () => go(`/u/${username}`) },
            { id: 's-profile', title: 'Settings: Profile', group: 'Settings', icon: <Settings />, keywords: 'avatar cover bio', shortcutId: 'nav.settings', perform: () => go('/settings') },
            { id: 's-account', title: 'Settings: Account', group: 'Settings', icon: <Lock />, keywords: 'password email sessions', perform: () => go('/settings/account') },
            { id: 's-privacy', title: 'Settings: Privacy & preferences', group: 'Settings', icon: <Eye />, keywords: 'theme defaults device service spoilers', perform: () => go('/settings/privacy') },
            { id: 's-keyboard', title: 'Settings: Keyboard shortcuts', group: 'Settings', icon: <Keyboard />, keywords: 'keybindings hotkeys', perform: () => go('/settings/keyboard') },
            { id: 's-data', title: 'Settings: Your data', group: 'Settings', icon: <Database />, keywords: 'export download delete account gdpr', perform: () => go('/settings/data') },
            ...(apiTokens ? [{ id: 's-tokens', title: 'Settings: API tokens', group: 'Settings', icon: <Keyboard />, perform: () => go('/settings/tokens') }] : []),
            {
              id: 'p-trailers',
              title: preferences?.autoplayTrailers === false ? 'Turn on background trailers' : 'Turn off background trailers',
              group: 'Settings',
              icon: <Clapperboard />,
              perform: () => setPref({ autoplayTrailers: preferences?.autoplayTrailers === false }, preferences?.autoplayTrailers === false ? 'Background trailers on' : 'Background trailers off'),
            },
            {
              id: 'p-spoilers',
              title: preferences?.hideSpoilersByDefault === false ? 'Hide spoilers by default' : 'Show spoilers by default',
              group: 'Settings',
              icon: <Eye />,
              perform: () => setPref({ hideSpoilersByDefault: preferences?.hideSpoilersByDefault === false }, 'Spoiler setting saved'),
            },
            {
              id: 'p-activity',
              title: preferences?.showActivity === false ? 'Share my activity with followers' : 'Stop sharing my activity',
              group: 'Settings',
              icon: <Users />,
              perform: () => setPref({ showActivity: preferences?.showActivity === false }, 'Activity sharing saved'),
            },
          ]
        : [{ id: 'n-login', title: 'Sign in', group: 'Go to', icon: <User />, perform: () => go('/login') }]),
      ...(staff ? [{ id: 'n-admin', title: 'Admin dashboard', group: 'Go to', icon: <Shield />, perform: () => go('/admin') }] : []),
      {
        id: 'p-theme',
        title: 'Switch light / dark theme',
        group: 'Settings',
        icon: <Moon />,
        shortcutId: 'theme.toggle',
        perform: () => {
          onClose();
          void setThemeAction(flipTheme()).then(() => router.refresh());
        },
      },
      {
        id: 'k-help',
        title: 'Keyboard shortcuts',
        group: 'Settings',
        icon: <Keyboard />,
        keywords: 'help hotkeys',
        shortcutId: 'help.shortcuts',
        perform: () => {
          onClose();
          shortcuts?.openHelp();
        },
      },
    ];
    const commands = [...pageCommands.map((c) => ({ ...c, group: c.group || 'This page' })), ...nav];
    const fromCommands: Item[] = commands
      .map((c) => ({ c, s: term ? Math.max(score(term, c.title), c.keywords ? score(term, c.keywords) * 0.8 : 0, c.subtitle ? score(term, c.subtitle) * 0.6 : 0) : 1 }))
      .filter((x) => x.s > 0)
      .sort((a, b) => (term ? b.s - a.s : 0))
      .slice(0, term ? 8 : 40)
      .map(({ c }) => ({ key: `c:${c.id}`, group: term ? (c.group === 'This page' ? 'This page' : 'Commands') : c.group, title: c.title, subtitle: c.subtitle, icon: c.icon, shortcutId: c.shortcutId, run: () => void c.perform() }));
    const titleItems: Item[] = titles.map((t) => ({
      key: `t:${t.href}`,
      group: 'Titles',
      title: t.title,
      subtitle: t.year,
      title_: t,
      run: (mode) => {
        if (mode === 'watch') void markTitle(t, `t:${t.href}`);
        else go(t.href);
      },
    }));
    const recentItems: Item[] = term
      ? []
      : recent.map((t) => ({ key: `r:${t.href}`, group: 'Recent', title: t.title, title_: { ...t, year: '' }, icon: <Clock />, run: (mode) => (mode === 'watch' ? void markTitle({ ...t, year: '' }, `r:${t.href}`) : go(t.href)) }));
    // Page actions first when idle; titles first once a real query is typed.
    const pageFirst = fromCommands.filter((i) => i.group === 'This page');
    const rest = fromCommands.filter((i) => i.group !== 'This page');
    return term ? [...pageFirst, ...titleItems, ...rest] : [...pageFirst, ...recentItems, ...rest];
  }, [query, term, titles, recent, pageCommands, signedIn, staff, username, preferences, apiTokens, go, setPref, onClose, router, shortcuts, markTitle]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey) || (e.ctrlKey && e.key === 'n')) {
      e.preventDefault();
      setActive((a) => (items.length ? (a + 1) % items.length : 0));
    } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey) || (e.ctrlKey && e.key === 'p')) {
      e.preventDefault();
      setActive((a) => (items.length ? (a - 1 + items.length) % items.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = items[active];
      if (!item) return;
      item.run(item.title_ && (e.metaKey || e.ctrlKey) ? 'watch' : 'open');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  if (!isClient) return null;
  const selected = items[active];

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[75] flex items-start justify-center px-3 pt-[12vh] sm:px-6" role="presentation">
          <motion.div className="absolute inset-0 bg-black/45 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }} transition={{ duration: 0.22 }} onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command bar"
            initial={{ opacity: 0, scale: 0.94, y: -14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -6, transition: exitFast }}
            transition={springs.bouncy}
            onKeyDown={onKeyDown}
            className="relative z-10 flex max-h-[min(640px,76vh)] w-full max-w-2xl flex-col overflow-hidden rounded-island border border-border-strong bg-surface/95 shadow-float backdrop-blur-2xl"
          >
            <div className="flex items-center gap-3 border-b border-border px-5">
              {searching ? <Spinner className="size-5" /> : <Search className="size-5 shrink-0 text-fg-subtle" aria-hidden />}
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                placeholder="Search titles, pages, settings…"
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-activedescendant={selected ? `${listId}-${active}` : undefined}
                aria-autocomplete="list"
                className="h-16 w-full bg-transparent text-lg text-fg placeholder:text-fg-subtle outline-none"
              />
              <Kbd>Esc</Kbd>
            </div>
            <div ref={listRef} id={listId} role="listbox" className="min-h-0 flex-1 overflow-y-auto p-2">
              {items.length === 0 ? <p className="px-3 py-10 text-center text-sm text-fg-muted">{searching ? 'Searching…' : `Nothing for “${term}”.`}</p> : null}
              {items.map((item, i) => {
                const header = i === 0 || items[i - 1]!.group !== item.group ? item.group : null;
                const on = i === active;
                return (
                  <div key={item.key}>
                    {header ? <div className="px-3 pt-3 pb-1.5 text-[11px] font-semibold tracking-wide text-fg-subtle uppercase">{header}</div> : null}
                    <div
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={on}
                      data-index={i}
                      onMouseMove={() => active !== i && setActive(i)}
                      onClick={(e) => item.run(item.title_ && (e.metaKey || e.ctrlKey) ? 'watch' : 'open')}
                      className={cn('relative flex cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2 text-sm', on ? 'text-fg' : 'text-fg-muted')}
                    >
                      {on ? <motion.span layoutId="palette-active" transition={springs.snappy} className="absolute inset-0 rounded-[12px] bg-surface-3" /> : null}
                      {item.title_ ? (
                        <span className="relative h-11 w-8 shrink-0 overflow-hidden rounded-[6px] bg-surface-3">{item.title_.posterPath ? <img src={img.poster(item.title_.posterPath, 'w92')!} alt="" className="size-full object-cover" /> : null}</span>
                      ) : (
                        <span className="relative flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-surface-2 text-fg-muted [&>svg]:size-4">{item.icon}</span>
                      )}
                      <span className="relative min-w-0 flex-1">
                        <span className="block truncate font-medium text-fg">{item.title}</span>
                        {item.subtitle ? <span className="block truncate text-xs text-fg-subtle">{item.subtitle}</span> : null}
                      </span>
                      {item.title_ ? <TypeBadge type={item.title_.type} isAnime={item.title_.isAnime} className="relative" /> : null}
                      {busyKey === item.key ? <Spinner className="relative size-4" /> : null}
                      {item.title_ && signedIn && on ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            item.run('watch');
                          }}
                          className="relative inline-flex h-7 items-center gap-1 rounded-pill bg-accent-soft px-2.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/25"
                        >
                          <CheckCircle2 className="size-3.5" /> {item.title_.type === 'show' ? 'Next ep.' : 'Watched'}
                        </button>
                      ) : null}
                      {!item.title_ && item.shortcutId && shortcuts?.bindings[item.shortcutId] ? (
                        <span className="relative hidden sm:inline-flex">
                          <KeyCaps binding={shortcuts.bindings[item.shortcutId]!} />
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-surface-2/60 px-4 py-2 text-[11px] text-fg-subtle">
              <span className="inline-flex items-center gap-1">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> move
              </span>
              <span className="inline-flex items-center gap-1">
                <Kbd>↵</Kbd> open
              </span>
              {selected?.title_ && signedIn ? (
                <span className="inline-flex items-center gap-1">
                  <KeyCaps binding="mod+enter" /> {selected.title_.type === 'show' ? 'mark next episode watched' : 'mark watched'}
                </span>
              ) : null}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

/** Records a visit to a title page for the command bar's "Recent" group. */
export function RememberTitle(props: RecentTitle) {
  const { href } = props;
  const ref = useRef(props);
  useEffect(() => {
    rememberTitle(ref.current);
  }, [href]);
  return null;
}
