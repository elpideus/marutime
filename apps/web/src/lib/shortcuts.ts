/** Every rebindable action. Ids are stable: they are stored in user preferences. */
export type ShortcutGroup = 'General' | 'Go to' | 'Title pages' | 'Lists and pages';

export type ShortcutDef = { id: string; label: string; group: ShortcutGroup; keys: string };

export const SHORTCUTS: ShortcutDef[] = [
  { id: 'palette.open', label: 'Open the command bar', group: 'General', keys: 'mod+k' },
  { id: 'search.focus', label: 'Search titles', group: 'General', keys: '/' },
  { id: 'help.shortcuts', label: 'Show keyboard shortcuts', group: 'General', keys: '?' },
  { id: 'theme.toggle', label: 'Switch light / dark theme', group: 'General', keys: 'shift+l' },

  { id: 'nav.home', label: 'Home', group: 'Go to', keys: 'g h' },
  { id: 'nav.discover', label: 'Discover', group: 'Go to', keys: 'g d' },
  { id: 'nav.shows', label: 'My shows', group: 'Go to', keys: 'g s' },
  { id: 'nav.watchlist', label: 'Watchlist', group: 'Go to', keys: 'g w' },
  { id: 'nav.lists', label: 'Lists', group: 'Go to', keys: 'g l' },
  { id: 'nav.friends', label: 'Friends', group: 'Go to', keys: 'g f' },
  { id: 'nav.notifications', label: 'Notifications', group: 'Go to', keys: 'g n' },
  { id: 'nav.profile', label: 'Your profile', group: 'Go to', keys: 'g p' },
  { id: 'nav.settings', label: 'Settings', group: 'Go to', keys: 'g ,' },

  { id: 'title.watched', label: 'Mark watched / unwatched', group: 'Title pages', keys: 'w' },
  { id: 'title.edit', label: 'Edit your check-in', group: 'Title pages', keys: 'e' },
  { id: 'title.rewatch', label: 'Log a rewatch', group: 'Title pages', keys: 'shift+r' },
  { id: 'title.watchlist', label: 'Add to / remove from watchlist', group: 'Title pages', keys: 'b' },
  { id: 'title.follow', label: 'Follow / unfollow the show', group: 'Title pages', keys: 'f' },
  { id: 'title.trailer', label: 'Play the trailer', group: 'Title pages', keys: 't' },
  { id: 'episode.next', label: 'Next episode', group: 'Title pages', keys: ']' },
  { id: 'episode.prev', label: 'Previous episode', group: 'Title pages', keys: '[' },

  { id: 'focus.next', label: 'Focus the next item', group: 'Lists and pages', keys: 'j' },
  { id: 'focus.prev', label: 'Focus the previous item', group: 'Lists and pages', keys: 'k' },
  { id: 'page.top', label: 'Scroll to top', group: 'Lists and pages', keys: 'g g' },
];

export const SHORTCUT_GROUPS: ShortcutGroup[] = ['General', 'Go to', 'Title pages', 'Lists and pages'];

/** Defaults overlaid with the viewer's own bindings (null = disabled). */
export function resolveBindings(custom: Record<string, string | null> | undefined): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const s of SHORTCUTS) out[s.id] = custom && s.id in custom ? (custom[s.id] ?? null) : s.keys;
  return out;
}
