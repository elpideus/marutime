import { getDonationConfig } from '@marutime/core';
import { getDb } from '@marutime/db';
import { Button, Island } from '@marutime/ui';
import { Coffee } from 'lucide-react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = { title: 'Support MaruTime' };

export default async function DonatePage() {
  const donation = await getDonationConfig(getDb());
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader title={donation.title} description="MaruTime has no ads, no premium tier and no investors. It runs on free tiers and spare time." />
      <Island padding="lg" className="flex flex-col items-center gap-5 text-center">
        <span className="flex size-16 items-center justify-center rounded-[22px] bg-accent text-on-accent shadow-[0_12px_30px_-10px_var(--mt-accent-glow)]">
          <Coffee className="size-8" />
        </span>
        <p className="max-w-md text-sm leading-relaxed text-fg-muted">{donation.message}</p>
        {donation.enabled ? (
          <a href={donation.url} target="_blank" rel="noopener noreferrer">
            <Button size="lg" tabIndex={-1}>
              Donate via {donation.provider === 'revolut' ? 'Revolut' : donation.provider} {donation.handle ? `(@${donation.handle})` : ''}
            </Button>
          </a>
        ) : (
          <p className="text-sm text-fg-muted">Donations are currently paused. Thank you for thinking of it.</p>
        )}
        <p className="text-xs text-fg-subtle">Donations are voluntary gifts and never unlock features. Everyone gets the same MaruTime.</p>
      </Island>
    </div>
  );
}
