'use client';

import { motion, type HTMLMotionProps } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from './cn';
import { springs, tap } from './motion';

export type ChipProps = Omit<HTMLMotionProps<'button'>, 'children'> & {
  selected?: boolean;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'neutral' | 'accent';
  children?: ReactNode;
};

const sizes = { sm: 'h-8 px-3 text-xs gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-5 text-base gap-2.5' } as const;

/** Selectable pill used for emotions, devices, services and filters. */
export function Chip({ selected = false, size = 'md', tone = 'accent', className, children, type = 'button', ...rest }: ChipProps) {
  return (
    <motion.button
      type={type}
      whileTap={tap}
      transition={springs.snappy}
      aria-pressed={selected}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-pill border font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        sizes[size],
        selected
          ? tone === 'accent'
            ? 'border-accent/60 bg-accent text-on-accent'
            : 'border-fg bg-fg text-bg'
          : 'border-border bg-surface-2 text-fg-muted hover:border-border-strong hover:text-fg',
        className,
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
