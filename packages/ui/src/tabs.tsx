'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { LayoutGroup, motion } from 'motion/react';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from './cn';
import { springs } from './motion';

export type TabItem<T extends string = string> = { value: T; label: ReactNode; count?: number; icon?: ReactNode };

export type SegmentedProps<T extends string> = {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
  'aria-label'?: string;
};

/** Pill-style segmented control with a sliding highlight. Scrolls (with arrows, fades and the wheel) when it overflows. */
export function Segmented<T extends string>({ items, value, onChange, size = 'md', className, ...rest }: SegmentedProps<T>) {
  const id = useId();
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  const overflowing = edges.start || edges.end;

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const start = el.scrollLeft > 2;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // A vertical wheel scrolls the row sideways, but only while it can still move, so the page keeps scrolling at the ends.
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0 || (e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max - 1)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('scroll', measure);
      el.removeEventListener('wheel', onWheel);
      ro.disconnect();
    };
  }, [measure]);

  // Keep the selected item in view, centred when the row overflows.
  const first = useRef(true);
  useEffect(() => {
    const el = scroller.current;
    const active = el?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!el || !active || el.scrollWidth <= el.clientWidth) return;
    el.scrollTo({ left: active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2, behavior: first.current ? 'instant' : 'smooth' });
    first.current = false;
  }, [value]);

  const page = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.7, behavior: 'smooth' });
  const mask = edges.start && edges.end ? 'linear-gradient(to right, transparent, black 28px, black calc(100% - 28px), transparent)' : edges.start ? 'linear-gradient(to right, transparent, black 28px)' : edges.end ? 'linear-gradient(to right, black calc(100% - 28px), transparent)' : undefined;

  return (
    <LayoutGroup id={id}>
      <div className={cn('inline-flex max-w-full items-center gap-0.5 rounded-pill border border-border bg-surface p-1', className)}>
        {overflowing ? <PageArrow dir={-1} size={size} enabled={edges.start} onClick={() => page(-1)} /> : null}
        <motion.div ref={scroller} layoutScroll role="tablist" aria-label={rest['aria-label']} className="relative flex min-w-0 items-center gap-1 overflow-x-auto overscroll-x-contain no-scrollbar" style={{ maskImage: mask, WebkitMaskImage: mask }}>
          {items.map((item) => {
            const active = item.value === value;
            return (
              <button
                key={item.value}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => onChange(item.value)}
                className={cn(
                  'relative inline-flex shrink-0 items-center gap-1.5 rounded-pill font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-inset',
                  size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-4 text-sm',
                  active ? 'text-on-accent' : 'text-fg-muted hover:text-fg',
                )}
              >
                {active ? <motion.span layoutId="segmented-pill" transition={springs.bouncy} className="absolute inset-0 rounded-pill bg-accent" /> : null}
                <span className="relative z-10 inline-flex items-center gap-1.5">
                  {item.icon}
                  {item.label}
                  {item.count !== undefined ? <span className={cn('rounded-pill px-1.5 text-[11px] tabular-nums', active ? 'bg-on-accent/15' : 'bg-surface-3')}>{item.count}</span> : null}
                </span>
              </button>
            );
          })}
        </motion.div>
        {overflowing ? <PageArrow dir={1} size={size} enabled={edges.end} onClick={() => page(1)} /> : null}
      </div>
    </LayoutGroup>
  );
}

function PageArrow({ dir, size, enabled, onClick }: { dir: 1 | -1; size: 'sm' | 'md'; enabled: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      tabIndex={-1}
      aria-label={dir < 0 ? 'Scroll back' : 'Scroll forward'}
      onClick={onClick}
      disabled={!enabled}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: enabled ? 1 : 0.3, scale: 1 }}
      whileTap={enabled ? { scale: 0.85 } : undefined}
      transition={springs.bouncy}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full text-fg-muted transition-colors enabled:hover:bg-surface-3 enabled:hover:text-fg disabled:cursor-default', size === 'sm' ? 'size-8' : 'size-9')}
    >
      {dir < 0 ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
    </motion.button>
  );
}

export type TabsProps<T extends string> = SegmentedProps<T>;

/** Underline tabs for page sections. */
export function Tabs<T extends string>({ items, value, onChange, className, ...rest }: TabsProps<T>) {
  const id = useId();
  return (
    <LayoutGroup id={id}>
      <div role="tablist" aria-label={rest['aria-label']} className={cn('flex items-center gap-1 overflow-x-auto border-b border-border no-scrollbar', className)}>
        {items.map((item) => {
          const active = item.value === value;
          return (
            <button
              key={item.value}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => onChange(item.value)}
              className={cn('relative -mb-px inline-flex h-11 shrink-0 items-center gap-2 px-3 text-sm font-medium outline-none transition-colors focus-visible:text-accent', active ? 'text-fg' : 'text-fg-muted hover:text-fg')}
            >
              {item.icon}
              {item.label}
              {item.count !== undefined ? <span className="rounded-pill bg-surface-3 px-1.5 text-[11px] tabular-nums text-fg-muted">{item.count}</span> : null}
              {active ? <motion.span layoutId="tabs-underline" transition={springs.bouncy} className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" /> : null}
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
