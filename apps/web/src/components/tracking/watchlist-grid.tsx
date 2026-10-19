'use client';

import { WatchlistButton } from '@/components/media/media-actions';
import { MediaCard } from '@/components/media/media-card';
import { MediaGrid } from '@/components/media/media-row';
import type { MediaCardData } from '@/lib/media-card';

export function WatchlistGrid({ items }: { items: Array<{ card: MediaCardData; mediaId: number }> }) {
  const byKey = new Map(items.map((i) => [i.card.key, i.mediaId]));
  return (
    <MediaGrid
      items={items.map((i) => i.card)}
      renderCard={(card) => (
        <MediaCard
          item={card}
          className="w-full sm:w-full"
          footer={
            <div className="mt-2">
              <WatchlistButton mediaId={byKey.get(card.key)!} inList signedIn size="sm" className="w-full" />
            </div>
          }
        />
      )}
    />
  );
}
