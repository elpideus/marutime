import type { Metadata } from 'next';
import Link from 'next/link';
import { verifyEmailAction } from '@/actions/auth';
import { AuthCard } from '@/components/auth/auth-card';

export const metadata: Metadata = { title: 'Verify email' };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string; change?: string }> }) {
  const { token, change } = await searchParams;
  const result = token ? await verifyEmailAction(token, change === '1') : { error: 'Missing token.' };
  return (
    <AuthCard title={result?.success ? 'All set' : 'Hmm'} footer={<Link href="/" className="text-accent hover:underline">Continue to MaruTime</Link>}>
      <p className={result?.success ? 'text-sm text-success' : 'text-sm text-danger'}>{result?.success ?? result?.error}</p>
    </AuthCard>
  );
}
