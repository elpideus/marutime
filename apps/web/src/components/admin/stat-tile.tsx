import { Island, cn } from '@marutime/ui';
import type { ReactNode } from 'react';

export function StatTile({ label, value, hint, tone = 'default' }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'default' | 'accent' | 'danger' }) {
  return (
    <Island padding="sm" tone={tone === 'accent' ? 'accent' : 'default'} className={cn(tone === 'danger' && 'border-danger/40')}>
      <p className="text-[11px] font-semibold tracking-wide text-fg-subtle uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-fg tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-fg-muted">{hint}</p> : null}
    </Island>
  );
}

/** Dependency-free bar chart for small daily series (data already filled per day). */
export function SparkBars({ data, label }: { data: Array<{ day: string; count: number }>; label: string }) {
  const days = data;
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <div role="img" aria-label={`${label}: ${days.map((d) => `${d.day} ${d.count}`).join(', ')}`} className="flex h-24 items-end gap-1">
      {days.map((d) => (
        <div key={d.day} className="group relative flex-1">
          <div className="w-full rounded-t-[4px] bg-accent/80 transition-colors group-hover:bg-accent" style={{ height: `${Math.max(4, (d.count / max) * 88)}px` }} />
          <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-surface-3 px-1.5 py-0.5 text-[10px] text-fg opacity-0 group-hover:opacity-100">{d.count}</span>
        </div>
      ))}
    </div>
  );
}
