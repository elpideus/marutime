'use client';

import { cn, springs } from '@marutime/ui';
import { Heart } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

/** Heart that pops when liked, with a count that rolls up or down in place. */
export function LikeHeart({ liked, count, hideZero, size = 'sm' }: { liked: boolean; count: number; hideZero?: boolean; size?: 'sm' | 'md' }) {
  return (
    <>
      <motion.span key={String(liked)} initial={liked ? { scale: 0.4, rotate: -12 } : false} animate={{ scale: 1, rotate: 0 }} transition={springs.pop} className="inline-flex">
        <Heart className={cn(size === 'md' ? 'size-4' : 'size-3.5', liked && 'fill-current')} />
      </motion.span>
      <span className="relative inline-flex overflow-hidden tabular-nums">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span key={count} initial={{ y: liked ? 10 : -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: liked ? -10 : 10, opacity: 0, transition: { duration: 0.12 } }} transition={springs.snappy}>
            {hideZero && !count ? '' : count}
          </motion.span>
        </AnimatePresence>
      </span>
    </>
  );
}
