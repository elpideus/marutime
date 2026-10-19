'use client';

import { cn, springs } from '@marutime/ui';
import { Star } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, type KeyboardEvent } from 'react';

const WORDS = ['', 'Awful', 'Awful', 'Bad', 'Bad', 'Okay', 'Okay', 'Good', 'Good', 'Great', 'Masterpiece'];

/**
 * Five stars in half steps, stored as 1–10. Hover previews, click sets,
 * clicking the current value clears. Works as a slider from the keyboard.
 */
export function RatingStars({ value, onChange, size = 'md', className }: { value: number | null; onChange: (v: number | null) => void; size?: 'sm' | 'md'; className?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  const px = size === 'sm' ? 'size-5' : 'size-8';

  const fromPointer = (e: { currentTarget: Element; clientX: number }, star: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return star * 2 - (e.clientX - rect.left < rect.width / 2 ? 1 : 0);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const current = value ?? 0;
    let next: number | null | undefined;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(10, current + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = current <= 1 ? null : current - 1;
    else if (e.key === 'Home') next = 1;
    else if (e.key === 'End') next = 10;
    else if (e.key === 'Delete' || e.key === 'Backspace' || e.key === '0') next = null;
    else if (/^[1-5]$/.test(e.key)) next = Number(e.key) * 2;
    if (next !== undefined) {
      e.preventDefault();
      onChange(next);
    }
  };

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Your rating"
        aria-valuemin={0}
        aria-valuemax={10}
        aria-valuenow={value ?? 0}
        aria-valuetext={value ? `${value / 2} out of 5 stars` : 'Not rated'}
        onKeyDown={onKeyDown}
        onPointerLeave={() => setHover(null)}
        className="flex items-center gap-1 rounded-control outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-4 focus-visible:ring-offset-surface"
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const fill = shown >= star * 2 ? 1 : shown === star * 2 - 1 ? 0.5 : 0;
          return (
            <motion.span
              key={star}
              data-clickable
              className="relative inline-flex"
              onPointerMove={(e) => e.pointerType !== 'touch' && setHover(fromPointer(e, star))}
              onClick={(e) => {
                const v = fromPointer(e, star);
                onChange(v === value ? null : v);
                setHover(null);
              }}
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.82 }}
              transition={springs.snappy}
            >
              <Star className={cn(px, 'text-fg-subtle/60')} strokeWidth={1.6} aria-hidden />
              {/* Re-keyed on every committed value so the fill pops in, star by star. */}
              <motion.span
                key={`${value ?? 0}`}
                initial={hover === null && fill > 0 ? { scale: 0.4, opacity: 0.4 } : false}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ ...springs.pop, delay: (star - 1) * 0.03 }}
                className="absolute inset-0 overflow-hidden transition-[width] duration-150 ease-out"
                style={{ width: `${fill * 100}%` }}
                aria-hidden
              >
                <Star className={cn(px, 'fill-accent text-accent')} strokeWidth={1.6} />
              </motion.span>
            </motion.span>
          );
        })}
      </div>
      <span className="min-w-24 text-sm tabular-nums text-fg-muted" aria-hidden>
        {shown ? (
          <>
            <span className="font-semibold text-fg">{(shown / 2).toFixed(1).replace(/\.0$/, '')}</span> · {WORDS[shown]}
          </>
        ) : (
          'Tap to rate'
        )}
      </span>
    </div>
  );
}
