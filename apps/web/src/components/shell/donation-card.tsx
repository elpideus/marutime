'use client';

import { Button, Island, Tooltip, cn } from '@marutime/ui';
import { Coffee, X } from 'lucide-react';
import { notifyClientStore, useLocalStorageValue } from '@/lib/client-store';

type Donation = { enabled: boolean; url: string; title: string; message: string };

const KEY = 'mt:donation-dismissed';

/** Quiet, dismissible call to action. Dismissal lasts 14 days, stored locally. */
export function DonationCard({ donation, compact = false, className }: { donation: Donation; compact?: boolean; className?: string }) {
  const dismissedUntil = Number(useLocalStorageValue(KEY, '0'));
  const hidden = dismissedUntil > 0 && dismissedUntil > new Date().getTime();
  if (!donation.enabled || hidden) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(KEY, String(Date.now() + 14 * 86_400_000));
    } catch {
      /* ignore */
    }
    notifyClientStore();
  };
  return (
    <Island tone="accent" padding={compact ? 'sm' : 'md'} className={cn('relative', className)}>
      <Tooltip content="Hide for two weeks" className="absolute top-2 right-2">
        <button type="button" onClick={dismiss} aria-label="Hide for two weeks" className="rounded-md p-1 text-fg-subtle transition-colors hover:text-fg">
          <X className="size-3.5" />
        </button>
      </Tooltip>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-accent text-on-accent">
          <Coffee className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg">{donation.title}</p>
          {!compact ? <p className="mt-0.5 text-xs text-fg-muted">{donation.message}</p> : <p className="mt-0.5 line-clamp-2 text-xs text-fg-muted">{donation.message}</p>}
          <a href={donation.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block">
            <Button size="xs" variant="primary" tabIndex={-1}>
              Buy me a coffee
            </Button>
          </a>
        </div>
      </div>
    </Island>
  );
}
