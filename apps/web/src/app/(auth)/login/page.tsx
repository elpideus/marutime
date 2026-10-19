import { enabledOAuthProviders } from '@marutime/config';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/auth/auth-card';
import { LoginForm } from '@/components/auth/forms';
import { getCurrentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Sign in' };

const ERRORS: Record<string, string> = {
  provider: 'That sign-in provider is not available.',
  state: 'The sign-in attempt expired. Please try again.',
  oauth: 'We could not complete the sign-in with that provider.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; message?: string }> }) {
  const sp = await searchParams;
  if (await getCurrentUser()) redirect(sp.next?.startsWith('/') ? sp.next : '/');
  const next = sp.next?.startsWith('/') ? sp.next : '/';
  const error = sp.error ? sp.message || ERRORS[sp.error] : undefined;
  return (
    <AuthCard
      title="Welcome back"
      description="Pick up where you left off."
      footer={
        <>
          New here?{' '}
          <Link href={`/register?next=${encodeURIComponent(next)}`} className="font-medium text-accent hover:underline">
            Create a free account
          </Link>
        </>
      }
    >
      <LoginForm next={next} providers={enabledOAuthProviders()} initialError={error} />
    </AuthCard>
  );
}
