import { emailEnabled } from '@marutime/core';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/auth-card';
import { ForgotPasswordForm } from '@/components/auth/forms';

export const metadata: Metadata = { title: 'Reset password' };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Reset your password" description="We will email you a link that works for one hour." footer={<Link href="/login" className="text-accent hover:underline">Back to sign in</Link>}>
      <ForgotPasswordForm emailEnabled={emailEnabled()} />
    </AuthCard>
  );
}
