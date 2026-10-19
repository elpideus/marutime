'use client';

import { LayoutGroup, motion } from 'motion/react';
import { useId, type ReactNode } from 'react';
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

/** Pill-style segmented control with a sliding highlight. */
export function Segmented<T extends string>({ items, value, onChange, size = 'md', className, ...rest }: SegmentedProps<T>) {
  const id = useId();
  return (
    <LayoutGroup id={id}>
      <div role="tablist" aria-label={rest['aria-label']} className={cn('inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-pill border border-border bg-surface p-1 no-scrollbar', className)}>
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
                'relative inline-flex shrink-0 items-center gap-1.5 rounded-pill font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/70',
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
      </div>
    </LayoutGroup>
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
