'use client';

import type { List, ShowTracking } from '@marutime/db';
import { Button, Dialog, Field, Input, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Switch, cn, springs, useToast } from '@marutime/ui';
import { Bookmark, BookmarkCheck, Check, ChevronDown, ListPlus, Plus, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { quickCreateListAction, toggleListItemAction } from '@/actions/lists';
import { bulkMarkAction, setTrackingStatusAction, toggleFavoriteShowAction, toggleWatchlistAction, trackShowAction, untrackShowAction } from '@/actions/tracking';

const STATUS_LABEL: Record<ShowTracking['status'], string> = { watching: 'Following', on_hold: 'On hold', dropped: 'Dropped', completed: 'Completed' };

export function TrackButton({ mediaId, tracking, signedIn, className }: { mediaId: number; tracking: ShowTracking | null; signedIn: boolean; className?: string }) {
  const [state, setState] = useState(tracking);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const go = (fn: () => Promise<{ ok: boolean; error?: string }>, optimistic: ShowTracking | null) => {
    const prev = state;
    setState(optimistic);
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        setState(prev);
        toast({ tone: 'error', title: r.error ?? 'Something went wrong' });
      }
      router.refresh();
    });
  };

  if (!signedIn) {
    return (
      <Button className={className} onClick={() => router.push(`/login?next=${encodeURIComponent(location.pathname)}`)}>
        <Plus className="size-4" /> Follow
      </Button>
    );
  }

  if (!state) {
    return (
      <Button className={className} loading={pending} onClick={() => go(() => trackShowAction(mediaId), { userId: '', mediaId, status: 'watching', isFavorite: false, lastWatchedAt: null, createdAt: new Date(), updatedAt: new Date() })}>
        <Plus className="size-4" /> Follow
      </Button>
    );
  }

  return (
    <Menu className={className}>
      <MenuTrigger>
        {(props) => (
          <Button variant="accent-soft" {...props} loading={pending}>
            <Check className="size-4" /> {STATUS_LABEL[state.status]}
            {state.isFavorite ? <Star className="size-3.5 fill-current" /> : null}
            <ChevronDown className="size-3.5 opacity-70" />
          </Button>
        )}
      </MenuTrigger>
      <MenuContent>
        {(['watching', 'on_hold', 'completed', 'dropped'] as const).map((s) => (
          <MenuItem key={s} onSelect={() => go(() => setTrackingStatusAction(mediaId, s), { ...state, status: s })} className={cn(state.status === s && 'text-accent')}>
            {STATUS_LABEL[s]}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem icon={<Star />} onSelect={() => go(() => toggleFavoriteShowAction(mediaId), { ...state, isFavorite: !state.isFavorite })}>
          {state.isFavorite ? 'Remove from favourites' : 'Mark as favourite'}
        </MenuItem>
        <MenuItem destructive onSelect={() => go(() => untrackShowAction(mediaId), null)}>
          Unfollow
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

export function WatchlistButton({ mediaId, inList, signedIn, size = 'md', className }: { mediaId: number; inList: boolean; signedIn: boolean; size?: 'sm' | 'md' | 'lg' | 'icon'; className?: string }) {
  const [on, setOn] = useState(inList);
  const [, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const toggle = () => {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    const prev = on;
    setOn(!on);
    start(async () => {
      const r = await toggleWatchlistAction(mediaId, prev);
      if (!r.ok) {
        setOn(prev);
        toast({ tone: 'error', title: r.error });
      } else router.refresh();
    });
  };
  return (
    <Button variant={on ? 'accent-soft' : 'secondary'} size={size} onClick={toggle} className={className} aria-pressed={on} aria-label={on ? 'Remove from watchlist' : 'Add to watchlist'}>
      <motion.span key={String(on)} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={springs.pop} className="inline-flex">
        {on ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
      </motion.span>
      {size !== 'icon' ? (on ? 'In watchlist' : 'Watchlist') : null}
    </Button>
  );
}

export function AddToListButton({ mediaId, lists, signedIn, className }: { mediaId: number; lists: Array<{ list: List; contains: boolean }>; signedIn: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(lists);
  const [title, setTitle] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const toggle = (listId: string, contains: boolean) => {
    setItems((x) => x.map((i) => (i.list.id === listId ? { ...i, contains: !contains } : i)));
    start(async () => {
      const r = await toggleListItemAction(listId, mediaId, contains);
      if (!r.ok) {
        setItems((x) => x.map((i) => (i.list.id === listId ? { ...i, contains } : i)));
        toast({ tone: 'error', title: r.error });
      }
    });
  };

  const create = () => {
    if (!title.trim()) return;
    start(async () => {
      const r = await quickCreateListAction(title.trim(), mediaId, isPublic ? 'public' : 'private');
      if (!r.ok) {
        toast({ tone: 'error', title: r.error });
        return;
      }
      toast({ tone: 'success', title: 'List created', action: { label: 'Open', onClick: () => router.push(r.data.href) } });
      setTitle('');
      setItems((x) => [{ list: { id: r.data.id, title: title.trim(), visibility: isPublic ? 'public' : 'private' } as List, contains: true }, ...x]);
    });
  };

  return (
    <>
      <Button variant="secondary" className={className} onClick={() => (signedIn ? setOpen(true) : router.push(`/login?next=${encodeURIComponent(location.pathname)}`))}>
        <ListPlus className="size-4" /> Save to list
      </Button>
      <Dialog open={open} onClose={() => { setOpen(false); router.refresh(); }} title="Save to a list" size="sm">
        <div className="flex flex-col gap-4">
          {items.length === 0 ? <p className="text-sm text-fg-muted">You have no lists yet. Create one below.</p> : null}
          <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {items.map(({ list, contains }) => (
              <li key={list.id}>
                <button type="button" onClick={() => toggle(list.id, contains)} className={cn('flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-2', contains && 'bg-accent-soft')} aria-pressed={contains}>
                  <span className={cn('flex size-5 items-center justify-center rounded-md border', contains ? 'border-accent bg-accent text-on-accent' : 'border-border-strong')}>{contains ? <Check className="size-3.5" /> : null}</span>
                  <span className="flex-1 truncate font-medium text-fg">{list.title}</span>
                  <span className="text-xs text-fg-subtle capitalize">{list.visibility}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-border pt-4">
            <Field label="New list">{(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Comfort rewatches" onKeyDown={(e) => e.key === 'Enter' && create()} />}</Field>
            <div className="mt-3 flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-fg-muted">
                <Switch checked={isPublic} onCheckedChange={setIsPublic} label="Public list" /> {isPublic ? 'Public' : 'Private'}
              </label>
              <Button size="sm" onClick={create} loading={pending} disabled={!title.trim()}>
                Create & add
              </Button>
            </div>
          </div>
        </div>
      </Dialog>
    </>
  );
}

export function BulkMarkMenu({ mediaId, seasons, className }: { mediaId: number; seasons: number[]; className?: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const mark = (input: { seasonNumber?: number }) => {
    start(async () => {
      const r = await bulkMarkAction(mediaId, input);
      if (!r.ok) toast({ tone: 'error', title: r.error });
      else {
        toast({ tone: 'success', title: r.data.marked ? `Marked ${r.data.marked} episodes watched` : 'Already up to date' });
        router.refresh();
      }
    });
  };
  return (
    <Menu className={className}>
      <MenuTrigger>
        {(props) => (
          <Button variant="ghost" {...props} loading={pending}>
            Mark watched <ChevronDown className="size-3.5 opacity-70" />
          </Button>
        )}
      </MenuTrigger>
      <MenuContent>
        <MenuItem onSelect={() => mark({})}>Everything aired so far</MenuItem>
        <MenuSeparator />
        {seasons.map((s) => (
          <MenuItem key={s} onSelect={() => mark({ seasonNumber: s })}>
            Season {s}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
