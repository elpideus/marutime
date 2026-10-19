import { enabledOAuthProviders } from '@marutime/config';
import { getSettings } from '@marutime/core';
import { getDb } from '@marutime/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/auth/auth-card';
import { RegisterForm } from '@/components/auth/forms';
import { getCurrentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Create account' };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  if (await getCurrentUser()) redirect('/');
  const next = sp.next?.startsWith('/') ? sp.next : '/';
  const settings = await getSettings(getDb());
  return (
    <AuthCard
      title="Join MaruTime"
      description="Track every episode, remember every movie, share what you love."
      footer={
        <>
          Already have an account?{' '}
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {settings['site.registrationOpen'] ? (
        <RegisterForm next={next} providers={enabledOAuthProviders()} />
      ) : (
        <p className="text-sm text-fg-muted">Registration is closed for now. Check back soon.</p>
      )}
    </AuthCard>
  );
}
