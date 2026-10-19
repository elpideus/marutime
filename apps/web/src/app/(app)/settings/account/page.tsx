import { listUserSessions } from '@marutime/auth';
import { enabledOAuthProviders } from '@marutime/config';
import { emailEnabled, listLinkedAccounts } from '@marutime/core';
import { getDb } from '@marutime/db';
import { Island, IslandHeader } from '@marutime/ui';
import type { Metadata } from 'next';
import { ChangeEmailForm, ChangePasswordForm, LinkedAccounts, SessionsList } from '@/components/settings/account-forms';
import { getCurrentSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Account settings' };

export default async function AccountSettingsPage() {
  const current = (await getCurrentSession())!;
  const db = getDb();
  const [sessions, linked] = await Promise.all([listUserSessions(db, current.user.id), listLinkedAccounts(db, current.user.id)]);
  return (
    <div className="flex flex-col gap-6">
      <Island>
        <IslandHeader title="Email" description={current.user.emailVerifiedAt ? 'Verified' : 'Not verified yet'} />
        <ChangeEmailForm currentEmail={current.user.email} emailEnabled={emailEnabled()} />
      </Island>
      <Island>
        <IslandHeader title="Password" />
        <ChangePasswordForm hasPassword={Boolean(current.user.passwordHash)} />
      </Island>
      <Island>
        <IslandHeader title="Linked sign-ins" description="Use another provider to sign in to this account." />
        <LinkedAccounts linked={linked.map((l) => ({ provider: l.provider, email: l.email }))} available={enabledOAuthProviders()} />
      </Island>
      <Island>
        <IslandHeader title="Devices" description="Everywhere you are currently signed in." />
        <SessionsList sessions={sessions} currentId={current.session.id} />
      </Island>
    </div>
  );
}
