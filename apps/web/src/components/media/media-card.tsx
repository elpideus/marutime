'use client';

import { Badge, cn, springs } from '@marutime/ui';
import { motion } from 'motion/react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { MediaCardData } from '@/lib/media-card';
import { Poster } from './poster';

export type MediaCardProps = {
  item: MediaCardData;
  subtitle?: ReactNode;
  footer?: ReactNode;
  overlay?: ReactNode;
  className?: string;
  priority?: boolean;
  size?: 'sm' | 'md';
};

export function MediaCard({ item, subtitle, footer, overlay, className, priority, size = 'md' }: MediaCardProps) {
  return (
    <motion.div whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }} transition={springs.bouncy} className={cn('group relative flex flex-col gap-2', size === 'sm' ? 'w-28 sm:w-32' : 'w-36 sm:w-40', className)}>
      <Link href={item.href} className="relative block overflow-hidden rounded-card outline-none ring-offset-2 ring-offset-bg focus-visible:ring-2 focus-visible:ring-accent/70" aria-label={item.title}>
        <Poster path={item.posterPath} title={item.title} priority={priority} className="transition-transform duration-500 group-hover:scale-[1.03]" />
        <div className="pointer-events-none absolute inset-0 rounded-card ring-1 ring-inset ring-white/10" />
        {item.isAnime ? (
          <Badge tone="accent" className="absolute top-2 left-2 h-5 px-1.5 text-[10px] backdrop-blur">
            Anime
          </Badge>
        ) : null}
        {overlay}
      </Link>
      <div className="min-w-0 px-0.5">
        <Link href={item.href} className="block truncate text-sm font-medium text-fg hover:text-accent" tabIndex={-1}>
          {item.title}
        </Link>
        <div className="truncate text-xs text-fg-muted">{subtitle ?? [item.year, item.type === 'show' ? 'Show' : 'Movie'].filter(Boolean).join(' · ')}</div>
        {footer}
      </div>
    </motion.div>
  );
}
