'use client';

import { springs } from '@marutime/ui';
import { AnimatePresence, motion } from 'motion/react';
import { useWatchState } from './watch-store';

/** "Watched ×2" on the episode still, live with the watch store. */
export function EpisodeWatchBadge({ watchKey, serverCount, serverAt }: { watchKey: string; serverCount: number; serverAt: number }) {
  const { count } = useWatchState(watchKey, { count: serverCount }, serverAt);
  return (
    <AnimatePresence>
      {count > 0 ? (
        <motion.span
          key="badge"
          initial={{ opacity: 0, scale: 0.6, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.14 } }}
          transition={springs.pop}
          className="absolute top-3 left-3 inline-flex h-7 items-center gap-1 rounded-pill bg-black/55 px-2.5 text-xs font-semibold text-white backdrop-blur-md"
        >
          ✓ Watched
          {count > 1 ? (
            <motion.span key={count} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={springs.pop} className="tabular-nums text-accent">
              ×{count}
            </motion.span>
          ) : null}
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}
