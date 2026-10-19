import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'danger' | 'info' | 'outline';

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-3 text-fg-muted',
  accent: 'bg-accent-soft text-accent',
  success: 'bg-success/15 text-success',
  danger: 'bg-danger/15 text-danger',
  info: 'bg-info/15 text-info',
  outline: 'border border-border text-fg-muted',
};

export function Badge({ tone = 'neutral', className, children, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={cn('inline-flex h-6 items-center gap-1 rounded-pill px-2 text-[11px] font-semibold tracking-wide uppercase', tones[tone], className)} {...rest}>
      {children}
    </span>
  );
}
