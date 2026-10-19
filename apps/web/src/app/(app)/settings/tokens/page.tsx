import { listApiTokens } from '@marutime/auth';
import { isApiAvailable } from '@marutime/core';
import { getDb } from '@marutime/db';
import { Island, IslandHeader } from '@marutime/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApiTokensPanel } from '@/components/settings/account-forms';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'API tokens' };

export default async function TokensPage() {
  const user = await requireUser('/settings/tokens');
  if (!(await isApiAvailable(getDb(), user))) notFound();
  const tokens = await listApiTokens(getDb(), user.id);
  return (
    <Island>
      <IslandHeader
        title="API tokens"
        description={
          <>
            For mobile apps, media-player plugins and scripts. Send them as <code className="font-mono text-xs">Authorization: Bearer mtk_…</code>. See the{' '}
            <Link href="/api/v1/openapi.json" className="text-accent hover:underline">OpenAPI description</Link>.
          </>
        }
      />
      <ApiTokensPanel tokens={tokens} />
    </Island>
  );
}
