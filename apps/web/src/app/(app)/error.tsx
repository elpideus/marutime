'use client';

import { Button, EmptyState } from '@marutime/ui';
import { TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-lg py-16">
      <EmptyState
        icon={<TriangleAlert />}
        title="Something went sideways"
        description={error.digest ? `Error reference: ${error.digest}` : 'Please try again in a moment.'}
        action={<Button onClick={reset}>Try again</Button>}
      />
    </div>
  );
}
