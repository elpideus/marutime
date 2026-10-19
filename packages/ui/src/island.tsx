'use client';

import { motion, type HTMLMotionProps } from 'motion/react';
import { forwardRef, type ElementType, type ReactNode } from 'react';
import { cn } from './cn';
import { hoverLift, springs } from './motion';

export type IslandProps = HTMLMotionProps<'div'> & {
  /** Hover lift + stronger border for clickable islands. */
  interactive?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  tone?: 'default' | 'elevated' | 'accent' | 'transparent';
  as?: ElementType;
  children?: ReactNode;
};

const paddings = { none: '', sm: 'p-3 sm:p-4', md: 'p-4 sm:p-5', lg: 'p-5 sm:p-7' } as const;
const tones = {
  default: 'bg-surface border-border',
  elevated: 'bg-surface-2 border-border',
  accent: 'bg-accent-soft border-accent/20',
  transparent: 'bg-transparent border-transparent',
} as const;

/**
 * The bento "island": a rounded surface with a hairline border. Everything on
 * MaruTime sits on islands so pages read as a calm grid.
 */
export const Island = forwardRef<HTMLDivElement, IslandProps>(function Island(
  { interactive = false, padding = 'md', tone = 'default', className, children, as, ...rest },
  ref,
) {
  const Comp = (as ? motion.create(as) : motion.div) as typeof motion.div;
  return (
    <Comp
      ref={ref}
      whileHover={interactive ? hoverLift : undefined}
      transition={springs.gentle}
      className={cn(
        'relative rounded-island border shadow-island',
        tones[tone],
        paddings[padding],
        interactive && 'cursor-pointer transition-colors hover:border-border-strong hover:bg-surface-2',
        className,
      )}
      {...rest}
    >
      {children}
    </Comp>
  );
});

export function IslandHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight text-fg sm:text-lg">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-fg-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
