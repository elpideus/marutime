import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/auth-card';
import { ResetPasswordForm } from '@/components/auth/forms';

export const metadata: Metadata = { title: 'Choose a new password' };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthCard title="Choose a new password" footer={<Link href="/login" className="text-accent hover:underline">Back to sign in</Link>}>
      {token ? <ResetPasswordForm token={token} /> : <p className="text-sm text-danger">This link is missing its token. Request a new one.</p>}
    </AuthCard>
  );
}
