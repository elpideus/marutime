'use client';

import { cn, springs } from '@marutime/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';

export type ScrollRowHandle = { scrollBy: (dir: 1 | -1) => void; element: HTMLDivElement | null };

/**
 * Horizontal scroller with arrow buttons that appear only when there is more
 * to see in that direction, plus soft edge fades. Arrows are hidden on touch
 * screens, where swiping is the natural gesture.
 */
export const ScrollRow = forwardRef<ScrollRowHandle, { children: ReactNode; className?: string; innerClassName?: string; label?: string; arrows?: 'overlay' | 'none'; step?: number }>(function ScrollRow(
  { children, className, innerClassName, label = 'items', arrows = 'overlay', step = 0.8 },
  ref,
) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const start = el.scrollLeft > 4;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => {
      el.removeEventListener('scroll', measure);
      ro.disconnect();
    };
  }, [measure]);

  const scrollBy = useCallback(
    (dir: 1 | -1) => {
      const el = scroller.current;
      if (!el) return;
      el.scrollBy({ left: dir * Math.max(160, el.clientWidth * step), behavior: 'smooth' });
    },
    [step],
  );

  useImperativeHandle(ref, () => ({ scrollBy, element: scroller.current }), [scrollBy]);

  const mask = edges.start && edges.end ? 'linear-gradient(to right, transparent, black 32px, black calc(100% - 32px), transparent)' : edges.start ? 'linear-gradient(to right, transparent, black 32px)' : edges.end ? 'linear-gradient(to right, black calc(100% - 32px), transparent)' : undefined;

  return (
    <div className={cn('group/scroll relative', className)}>
      <div
        ref={scroller}
        role="region"
        aria-label={`Scrollable ${label}`}
        tabIndex={-1}
        className={cn('flex snap-x snap-proximity gap-3 overflow-x-auto overscroll-x-contain scroll-smooth no-scrollbar', innerClassName)}
        style={{ maskImage: mask, WebkitMaskImage: mask }}
      >
        {children}
      </div>
      {arrows === 'overlay' ? (
        <>
          <ArrowButton side="left" show={edges.start} onClick={() => scrollBy(-1)} label={`Scroll ${label} left`} />
          <ArrowButton side="right" show={edges.end} onClick={() => scrollBy(1)} label={`Scroll ${label} right`} />
        </>
      ) : null}
    </div>
  );
});

function ArrowButton({ side, show, onClick, label }: { side: 'left' | 'right'; show: boolean; onClick: () => void; label: string }) {
  return (
    <AnimatePresence>
      {show ? (
        <motion.button
          type="button"
          onClick={onClick}
          aria-label={label}
          initial={{ opacity: 0, scale: 0.7, x: side === 'left' ? -6 : 6 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.12 } }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.9 }}
          transition={springs.bouncy}
          className={cn(
            'absolute top-1/2 z-10 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border-strong bg-surface-2/90 text-fg shadow-float backdrop-blur-xl outline-none focus-visible:ring-2 focus-visible:ring-accent/70 [@media(hover:hover)]:flex',
            side === 'left' ? 'left-1' : 'right-1',
          )}
        >
          {side === 'left' ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}
