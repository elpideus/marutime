import { cn } from '@marutime/ui';
import Link from 'next/link';

export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn('relative inline-flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-accent text-on-accent shadow-[0_8px_20px_-8px_var(--mt-accent-glow)]', className)} aria-hidden>
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5v4.8l3.2 1.9" />
      </svg>
    </span>
  );
}

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link href="/" className={cn('group inline-flex items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-accent/60 rounded-control', className)} aria-label="MaruTime home">
      <LogoMark />
      {!compact ? (
        <span className="text-[17px] font-semibold tracking-tight text-fg">
          Maru<span className="text-accent">Time</span>
        </span>
      ) : null}
    </Link>
  );
}
