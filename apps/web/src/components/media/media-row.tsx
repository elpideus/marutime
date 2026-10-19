'use client';

import { cn, fadeUp, springs, stagger } from '@marutime/ui';
import { ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ScrollRow } from '@/components/scroll-row';
import type { MediaCardData } from '@/lib/media-card';
import { MediaCard } from './media-card';

export type MediaRowProps = {
  title: ReactNode;
  description?: ReactNode;
  items: MediaCardData[];
  href?: string;
  hrefLabel?: string;
  renderCard?: (item: MediaCardData, index: number) => ReactNode;
  className?: string;
  emptyText?: string;
};

/** Horizontally scrolling shelf with snap points; arrows appear only when there is more to see. */
export function MediaRow({ title, description, items, href, hrefLabel = 'See all', renderCard, className, emptyText }: MediaRowProps) {
  return (
    <section className={cn('relative', className)}>
      <div className="mb-3 flex items-end justify-between gap-4 px-0.5">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-fg">{title}</h2>
          {description ? <p className="text-sm text-fg-muted">{description}</p> : null}
        </div>
        {href ? (
          <Link href={href} className="cta-arrow inline-flex shrink-0 items-center gap-0.5 text-sm font-medium text-accent">
            {hrefLabel} <ChevronRight className="size-4" />
          </Link>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="rounded-island border border-dashed border-border px-4 py-8 text-center text-sm text-fg-muted">{emptyText ?? 'Nothing here yet.'}</p>
      ) : (
        <ScrollRow label={typeof title === 'string' ? title : 'titles'} className="-mx-4 sm:-mx-6" innerClassName="snap-mandatory px-4 pt-1 pb-3 sm:px-6 [scroll-padding-inline:1rem]">
          {items.map((item, i) => (
            <motion.div key={item.key} initial={{ opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...springs.bouncy, delay: Math.min(i, 10) * 0.035 }} className="snap-start">
              {renderCard ? renderCard(item, i) : <MediaCard item={item} priority={i < 4} />}
            </motion.div>
          ))}
        </ScrollRow>
      )}
    </section>
  );
}

export function MediaGrid({ items, renderCard, className }: { items: MediaCardData[]; renderCard?: (item: MediaCardData, index: number) => ReactNode; className?: string }) {
  return (
    <motion.div variants={stagger(0.02)} initial="hidden" animate="show" className={cn('grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-4 sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]', className)}>
      {items.map((item, i) => (
        <motion.div key={item.key} variants={fadeUp}>
          {renderCard ? renderCard(item, i) : <MediaCard item={item} className="w-full sm:w-full" priority={i < 8} />}
        </motion.div>
      ))}
    </motion.div>
  );
}
