import { Button, EmptyState } from '@marutime/ui';
import { Compass } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-16">
      <EmptyState
        icon={<Compass />}
        title="Nothing to see here"
        description="That page does not exist, or it was removed. The remote is in the couch somewhere."
        action={
          <Link href="/">
            <Button tabIndex={-1}>Back home</Button>
          </Link>
        }
      />
    </div>
  );
}
