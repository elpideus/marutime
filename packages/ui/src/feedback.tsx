'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from './cn';
import { springs } from './motion';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-card bg-surface-3', className)} aria-hidden />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span className={cn('inline-block size-5 animate-spin rounded-full border-2 border-fg-subtle/40 border-t-accent', className)} role="status" aria-label="Loading" />
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.gentle}
      className={cn('flex flex-col items-center justify-center gap-3 rounded-island border border-dashed border-border px-6 py-12 text-center', className)}
    >
      {icon ? <div className="flex size-14 items-center justify-center rounded-[20px] bg-accent-soft text-accent [&>svg]:size-7">{icon}</div> : null}
      <div className="max-w-sm">
        <h3 className="text-base font-semibold text-fg">{title}</h3>
        {description ? <p className="mt-1 text-sm text-fg-muted">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </motion.div>
  );
}

export function ProgressBar({ value, className, tone = 'accent', size = 'md', label }: { value: number; className?: string; tone?: 'accent' | 'success' | 'neutral'; size?: 'sm' | 'md'; label?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('w-full overflow-hidden rounded-pill bg-surface-3', size === 'sm' ? 'h-1.5' : 'h-2.5', className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={springs.gentle}
        className={cn('h-full rounded-pill', tone === 'accent' ? 'bg-accent' : tone === 'success' ? 'bg-success' : 'bg-fg-muted')}
      />
    </div>
  );
}

export function ProgressRing({ value, size = 44, stroke = 4, className, children }: { value: number; size?: number; stroke?: number; className?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--mt-surface-3)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--mt-accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (pct / 100) * c }}
          transition={springs.gentle}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums">{children ?? `${Math.round(pct)}%`}</span>
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-border bg-surface-3 px-1.5 py-0.5 font-mono text-[11px] text-fg-muted">{children}</kbd>;
}

/** Animated check used after a successful check-in. */
export function CheckBurst({ className }: { className?: string }) {
  return (
    <motion.svg viewBox="0 0 48 48" className={cn('size-12 text-accent', className)} initial="hidden" animate="show" aria-hidden>
      <motion.circle cx="24" cy="24" r="22" fill="currentColor" variants={{ hidden: { scale: 0.4, opacity: 0 }, show: { scale: 1, opacity: 1, transition: springs.pop } }} style={{ originX: '50%', originY: '50%' }} />
      <motion.path
        d="M15 24.5l6 6 12-13"
        fill="none"
        stroke="var(--mt-on-accent)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={{ hidden: { pathLength: 0, opacity: 0 }, show: { pathLength: 1, opacity: 1, transition: { delay: 0.12, duration: 0.3, ease: 'easeOut' } } }}
      />
    </motion.svg>
  );
}
