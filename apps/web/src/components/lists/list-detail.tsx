'use client';

import type { ListView } from '@marutime/core';
import { listShareHref } from '@marutime/core/hrefs';
import { mediaHref } from '@marutime/core/hrefs';
import { Avatar, Badge, Button, Island, fadeUp, springs, stagger, useToast, Tooltip } from '@marutime/ui';
import { ArrowDown, ArrowUp, Copy, Link2, Lock, Pencil, Share2, Trash, Users } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteListAction, regenerateShareTokenAction, removeListItemAction, reorderListAction, toggleListLikeAction } from '@/actions/lists';
import { LikeHeart } from '@/components/like-heart';
import { TypeLabel } from '@/components/media/type-badge';
import { Poster } from '@/components/media/poster';
import { formatRelative, yearOf } from '@/lib/format';

export function ListDetail({ view, signedIn, appUrl }: { view: ListView; signedIn: boolean; appUrl: string }) {
  const { list, owner } = view;
  const [items, setItems] = useState(view.items);
  const [liked, setLiked] = useState(view.likedByViewer);
  const [likeCount, setLikeCount] = useState(list.likeCount);
  const [editing, setEditing] = useState(false);
  const [shareToken, setShareToken] = useState(list.shareToken);
  const [, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const like = () => {
    if (!signedIn) {
      router.push('/login');
      return;
    }
    const prev = { liked, likeCount };
    setLiked(!liked);
    setLikeCount((c) => c + (liked ? -1 : 1));
    start(async () => {
      const r = await toggleListLikeAction(list.id);
      if (r.ok) {
        setLiked(r.data.liked);
        setLikeCount(r.data.likeCount);
      } else {
        setLiked(prev.liked);
        setLikeCount(prev.likeCount);
        toast({ tone: 'error', title: r.error });
      }
    });
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = [...items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setItems(next);
    start(async () => {
      await reorderListAction(list.id, next.map((i) => i.media.id));
    });
  };

  const remove = (mediaId: number) => {
    setItems((x) => x.filter((i) => i.media.id !== mediaId));
    start(async () => {
      const r = await removeListItemAction(list.id, mediaId);
      if (!r.ok) toast({ tone: 'error', title: r.error });
      router.refresh();
    });
  };

  const copyLink = async (unlisted = false) => {
    const url = unlisted ? `${appUrl}${listShareHref({ shareToken })}` : `${appUrl}/u/${owner.username}/lists/${list.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ tone: 'success', title: 'Link copied' });
    } catch {
      toast({ tone: 'info', title: url });
    }
  };

  const rotateLink = () => {
    start(async () => {
      const r = await regenerateShareTokenAction(list.id);
      if (r.ok) {
        setShareToken(r.data.token);
        toast({ tone: 'success', title: 'New secret link generated. The old one stopped working.' });
      } else toast({ tone: 'error', title: r.error });
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Island className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone="outline" className="capitalize">{list.category}</Badge>
            {list.visibility !== 'public' ? (
              <Badge tone="neutral" className="capitalize">
                {list.visibility === 'private' ? <Lock className="size-3" /> : list.visibility === 'unlisted' ? <Link2 className="size-3" /> : <Users className="size-3" />} {list.visibility}
              </Badge>
            ) : null}
            {list.isRanked ? <Badge tone="accent">Ranked</Badge> : null}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-fg text-balance">{list.title}</h1>
          {list.description ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted whitespace-pre-line">{list.description}</p> : null}
          <Link href={`/u/${owner.username}`} className="mt-4 inline-flex items-center gap-2 text-sm text-fg-muted hover:text-fg">
            <Avatar src={owner.avatarUrl} name={owner.displayName} size="sm" />
            <span>
              <span className="font-medium text-fg">{owner.displayName}</span> · {items.length} {items.length === 1 ? 'title' : 'titles'} · updated {formatRelative(list.updatedAt)}
            </span>
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <motion.div whileTap={{ scale: 0.9 }} transition={springs.pop}>
            <Button variant={liked ? 'accent-soft' : 'secondary'} onClick={like} aria-pressed={liked} tooltip={liked ? 'Unlike this list' : 'Like this list'}>
              <LikeHeart liked={liked} count={likeCount} size="md" />
            </Button>
          </motion.div>
          <Button variant="secondary" onClick={() => copyLink(false)} aria-label="Copy link" tooltip="Copy a link to this list">
            <Share2 className="size-4" /> Share
          </Button>
          {view.canEdit ? (
            <>
              {list.visibility === 'unlisted' ? (
                <Button variant="ghost" onClick={() => copyLink(true)} tooltip="Copy the secret link: anyone with it can view this unlisted list">
                  <Copy className="size-4" /> Secret link
                </Button>
              ) : null}
              <Button variant={editing ? 'accent-soft' : 'ghost'} onClick={() => setEditing((e) => !e)}>
                <Pencil className="size-4" /> {editing ? 'Done' : 'Edit'}
              </Button>
            </>
          ) : null}
        </div>
      </Island>

      {editing ? (
        <Island tone="elevated" padding="sm" className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-fg-muted">Reorder with the arrows, remove with the bin.</span>
          <span className="ml-auto flex gap-2">
            <Link href={`/u/${owner.username}/lists/${list.slug}/edit`}>
              <Button size="sm" variant="secondary" tabIndex={-1}>Edit details</Button>
            </Link>
            {list.visibility === 'unlisted' ? (
              <Button size="sm" variant="ghost" onClick={rotateLink}>Regenerate secret link</Button>
            ) : null}
            <form action={deleteListAction.bind(null, list.id)} onSubmit={(e) => { if (!confirm('Delete this list? This cannot be undone.')) e.preventDefault(); }}>
              <Button size="sm" variant="danger" type="submit">
                <Trash className="size-4" /> Delete list
              </Button>
            </form>
          </span>
        </Island>
      ) : null}

      {items.length === 0 ? (
        <Island className="py-12 text-center text-sm text-fg-muted">
          This list is empty. {view.canEdit ? 'Open any show or movie and use “Save to list”.' : ''}
        </Island>
      ) : (
        <motion.ol variants={stagger(0.02)} initial="hidden" animate="show" className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-4 sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]">
          {items.map((it, i) => (
            <motion.li key={it.item.id} layout variants={fadeUp} className="group relative">
              <Link href={mediaHref(it.media)} className="block overflow-hidden rounded-card">
                <Poster path={it.media.posterPath} title={it.media.title} className="transition-transform duration-500 group-hover:scale-[1.03]" />
              </Link>
              {list.isRanked ? <span className="absolute -top-2 -left-2 flex size-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-on-accent shadow-lg">{i + 1}</span> : null}
              <div className="mt-2 px-0.5">
                <Link href={mediaHref(it.media)} className="block truncate text-sm font-medium text-fg hover:text-accent">
                  {it.media.title}
                </Link>
                <p className="flex items-center gap-1.5 truncate text-xs text-fg-muted">
                  {yearOf(it.media.releaseDate) ? <span>{yearOf(it.media.releaseDate)}</span> : null}
                  <TypeLabel type={it.media.type} isAnime={it.media.isAnime} />
                </p>
                {it.item.note ? <p className="mt-1 line-clamp-3 text-xs text-fg-muted italic">“{it.item.note}”</p> : null}
              </div>
              {editing ? (
                <div className="absolute top-2 right-2 flex flex-col gap-1 rounded-control bg-black/70 p-1 backdrop-blur">
                  <Tooltip content="Move up" side="left">
                    <button type="button" onClick={() => move(i, -1)} className="rounded p-1 text-white hover:bg-white/20" aria-label="Move up"><ArrowUp className="size-4" /></button>
                  </Tooltip>
                  <Tooltip content="Move down" side="left">
                    <button type="button" onClick={() => move(i, 1)} className="rounded p-1 text-white hover:bg-white/20" aria-label="Move down"><ArrowDown className="size-4" /></button>
                  </Tooltip>
                  <Tooltip content="Remove from list" side="left">
                    <button type="button" onClick={() => remove(it.media.id)} className="rounded p-1 text-danger hover:bg-white/20" aria-label="Remove"><Trash className="size-4" /></button>
                  </Tooltip>
                </div>
              ) : null}
            </motion.li>
          ))}
        </motion.ol>
      )}
    </div>
  );
}
