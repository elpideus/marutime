'use client';

import type { ListCard as ListCardData } from '@marutime/core';
import { listHref } from '@marutime/core/hrefs';
import { img } from '@marutime/metadata/images';
import { Avatar, Badge, Island, cn, springs, useToast } from '@marutime/ui';
import { Lock, Link2, Users } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toggleListLikeAction } from '@/actions/lists';
import { LikeHeart } from '@/components/like-heart';

const VIS_ICON = { private: <Lock className="size-3" />, unlisted: <Link2 className="size-3" />, followers: <Users className="size-3" /> } as const;

export function ListCard({ card, signedIn, className }: { card: ListCardData; signedIn: boolean; className?: string }) {
  const [liked, setLiked] = useState(card.likedByViewer);
  const [count, setCount] = useState(card.list.likeCount);
  const [, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const href = listHref(card.owner, card.list);
  const like = () => {
    if (!signedIn) {
      router.push('/login');
      return;
    }
    const prev = { liked, count };
    setLiked(!liked);
    setCount((c) => c + (liked ? -1 : 1));
    start(async () => {
      const r = await toggleListLikeAction(card.list.id);
      if (r.ok) {
        setLiked(r.data.liked);
        setCount(r.data.likeCount);
      } else {
        setLiked(prev.liked);
        setCount(prev.count);
        toast({ tone: 'error', title: r.error });
      }
    });
  };
  const posters = card.previewPosters;
  return (
    <Island padding="none" interactive className={cn('overflow-hidden', className)}>
      <Link href={href} data-nav-item className="block rounded-card outline-none focus-visible:ring-2 focus-visible:ring-accent/70">
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface-3">
          {card.list.coverUrl ? (
            <img src={card.list.coverUrl} alt="" className="size-full object-cover" loading="lazy" />
          ) : posters.length > 0 ? (
            <div className={cn('grid h-full', posters.length >= 4 ? 'grid-cols-4' : posters.length === 3 ? 'grid-cols-3' : posters.length === 2 ? 'grid-cols-2' : 'grid-cols-1')}>
              {posters.map((p, i) => (
                <img key={p} src={img.poster(p, 'w342')!} alt="" className={cn('size-full object-cover', i > 0 && '-ml-px')} loading="lazy" />
              ))}
            </div>
          ) : (
            <div className="flex size-full items-center justify-center text-fg-subtle">Empty list</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
            <h3 className="line-clamp-2 text-base font-semibold text-white drop-shadow">{card.list.title}</h3>
            <Badge tone="neutral" className="shrink-0 bg-black/50 text-white backdrop-blur">
              {card.list.itemCount} {card.list.itemCount === 1 ? 'title' : 'titles'}
            </Badge>
          </div>
        </div>
      </Link>
      <div className="flex items-center gap-2 p-3">
        <Link href={`/u/${card.owner.username}`} className="flex min-w-0 flex-1 items-center gap-2">
          <Avatar src={card.owner.avatarUrl} name={card.owner.displayName} size="xs" />
          <span className="truncate text-xs text-fg-muted">{card.owner.displayName}</span>
        </Link>
        {card.list.visibility !== 'public' ? <span className="flex items-center gap-1 text-[11px] text-fg-subtle capitalize">{VIS_ICON[card.list.visibility]} {card.list.visibility}</span> : null}
        <Badge tone="outline" className="capitalize">{card.list.category}</Badge>
        <motion.button type="button" whileTap={{ scale: 0.85 }} transition={springs.pop} onClick={like} aria-pressed={liked} className={cn('flex items-center gap-1 rounded-pill px-2 py-1 text-xs text-fg-muted hover:bg-surface-2', liked && 'text-danger')}>
          <LikeHeart liked={liked} count={count} />
        </motion.button>
      </div>
    </Island>
  );
}
