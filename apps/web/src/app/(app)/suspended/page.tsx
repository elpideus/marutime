import { EmptyState } from '@marutime/ui';
import { Ban } from 'lucide-react';
import { logoutAction } from '@/actions/auth';
import { getCurrentUser } from '@/lib/session';

export default async function SuspendedPage() {
  const user = await getCurrentUser();
  return (
    <div className="mx-auto max-w-lg py-16">
      <EmptyState
        icon={<Ban />}
        title="This account is suspended"
        description={user?.suspendedReason ? `Reason: ${user.suspendedReason}` : 'Contact the administrators if you believe this is a mistake.'}
        action={
          <form action={logoutAction}>
            <button type="submit" className="text-sm font-medium text-accent hover:underline">Sign out</button>
          </form>
        }
      />
    </div>
  );
}
