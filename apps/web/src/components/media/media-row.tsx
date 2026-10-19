'use client';

import { Button, cn, fadeUp, stagger } from '@marutime/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useRef, type ReactNode } from 'react';
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

/** Horizontally scrolling shelf with snap points and arrow buttons on desktop. */
export function MediaRow({ title, description, items, href, hrefLabel = 'See all', renderCard, className, emptyText }: MediaRowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const scrollBy = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * (ref.current.clientWidth - 120), behavior: 'smooth' });
  return (
    <section className={cn('relative', className)}>
      <div className="mb-3 flex items-end justify-between gap-4 px-0.5">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-fg">{title}</h2>
          {description ? <p className="text-sm text-fg-muted">{description}</p> : null}
        </div>
        <div className="flex items-center gap-1">
          {href ? (
            <Link href={href} className="text-sm font-medium text-accent hover:underline">
              {hrefLabel}
            </Link>
          ) : null}
          <div className="hidden gap-1 lg:flex">
            <Button variant="ghost" size="icon-sm" onClick={() => scrollBy(-1)} aria-label="Scroll left">
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => scrollBy(1)} aria-label="Scroll right">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="rounded-island border border-dashed border-border px-4 py-8 text-center text-sm text-fg-muted">{emptyText ?? 'Nothing here yet.'}</p>
      ) : (
        <motion.div
          ref={ref}
          variants={stagger(0.03)}
          initial="hidden"
          animate="show"
          className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 no-scrollbar sm:-mx-6 sm:px-6 [scroll-padding-inline:1rem]"
        >
          {items.map((item, i) => (
            <motion.div key={item.key} variants={fadeUp} className="snap-start">
              {renderCard ? renderCard(item, i) : <MediaCard item={item} priority={i < 4} />}
            </motion.div>
          ))}
        </motion.div>
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
