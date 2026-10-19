'use client';

import type { ApiToken, Session } from '@marutime/db';
import { Button, Field, Input, useToast } from '@marutime/ui';
import { Copy, KeyRound, Laptop, LogOut, Trash } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { changePasswordAction, createApiTokenAction, deleteAccountAction, requestEmailChangeAction, revokeApiTokenAction, revokeSessionAction, signOutEverywhereAction, unlinkAccountAction, type FormState } from '@/actions/profile';
import { formatDateTime, formatRelative } from '@/lib/format';

function Notice({ state }: { state: FormState }) {
  if (!state?.error && !state?.success) return null;
  return (
    <div role={state.error ? 'alert' : 'status'} className={state.error ? 'rounded-control border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger' : 'rounded-control border border-success/30 bg-success/10 px-3.5 py-2.5 text-sm text-success'}>
      {state.error ?? state.success}
    </div>
  );
}

export function ChangePasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(changePasswordAction, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Notice state={state} />
      {hasPassword ? <Field label="Current password" error={state?.details?.currentPassword?.[0]}>{(p) => <Input {...p} name="currentPassword" type="password" autoComplete="current-password" required />}</Field> : <input type="hidden" name="currentPassword" value="" />}
      <Field label={hasPassword ? 'New password' : 'Set a password'} hint="At least 10 characters. Other devices will be signed out." error={state?.details?.newPassword?.[0] ?? state?.details?._?.[0]}>
        {(p) => <Input {...p} name="newPassword" type="password" autoComplete="new-password" minLength={10} required />}
      </Field>
      <div className="flex justify-end">
        <Button type="submit" variant="secondary" loading={pending}>
          <KeyRound className="size-4" /> {hasPassword ? 'Change password' : 'Set password'}
        </Button>
      </div>
    </form>
  );
}

export function ChangeEmailForm({ currentEmail, emailEnabled }: { currentEmail: string; emailEnabled: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(requestEmailChangeAction, null);
  if (!emailEnabled) return <p className="text-sm text-fg-muted">Email changes need email delivery, which is not configured on this instance yet. Ask an administrator.</p>;
  return (
    <form action={action} className="flex flex-col gap-4">
      <Notice state={state} />
      <Field label="New email" hint={`Currently ${currentEmail}. We will send a confirmation link to the new address.`} error={state?.details?.email?.[0]}>{(p) => <Input {...p} name="email" type="email" required />}</Field>
      <Field label="Current password">{(p) => <Input {...p} name="currentPassword" type="password" autoComplete="current-password" />}</Field>
      <div className="flex justify-end">
        <Button type="submit" variant="secondary" loading={pending}>Send confirmation</Button>
      </div>
    </form>
  );
}

export function SessionsList({ sessions, currentId }: { sessions: Session[]; currentId: string }) {
  const [items, setItems] = useState(sessions);
  const [, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y divide-border">
        {items.map((s) => (
          <li key={s.id} className="flex items-center gap-3 py-2.5 text-sm">
            <Laptop className="size-4 shrink-0 text-fg-subtle" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-fg">{s.userAgent ?? 'Unknown device'}{s.id === currentId ? <span className="ml-2 rounded-pill bg-accent-soft px-1.5 text-[10px] font-semibold text-accent uppercase">This device</span> : null}</p>
              <p className="text-xs text-fg-subtle">Last active {formatRelative(s.lastUsedAt)} · signed in {formatDateTime(s.createdAt)}</p>
            </div>
            {s.id !== currentId ? (
              <Button size="xs" variant="ghost" onClick={() => start(async () => { const r = await revokeSessionAction(s.id); if (r.ok) setItems((x) => x.filter((y) => y.id !== s.id)); else toast({ tone: 'error', title: r.error }); })}>
                Sign out
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {items.length > 1 ? (
        <Button variant="secondary" size="sm" className="self-start" onClick={() => start(async () => { const r = await signOutEverywhereAction(); if (r.ok) { setItems((x) => x.filter((y) => y.id === currentId)); toast({ tone: 'success', title: 'Signed out everywhere else' }); router.refresh(); } })}>
          <LogOut className="size-4" /> Sign out of all other devices
        </Button>
      ) : null}
    </div>
  );
}

export function LinkedAccounts({ linked, available }: { linked: Array<{ provider: string; email: string | null }>; available: string[] }) {
  const [items, setItems] = useState(linked);
  const [, start] = useTransition();
  const { toast } = useToast();
  const labels: Record<string, string> = { google: 'Google', github: 'GitHub', discord: 'Discord' };
  if (available.length === 0 && items.length === 0) return <p className="text-sm text-fg-muted">No sign-in providers are configured on this instance.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {available.map((p) => {
        const l = items.find((x) => x.provider === p);
        return (
          <li key={p} className="flex items-center justify-between gap-3 rounded-card border border-border px-3 py-2.5 text-sm">
            <span>
              <span className="font-medium text-fg">{labels[p] ?? p}</span>
              {l ? <span className="ml-2 text-xs text-fg-muted">{l.email ?? 'linked'}</span> : null}
            </span>
            {l ? (
              <Button size="xs" variant="ghost" onClick={() => start(async () => { const r = await unlinkAccountAction(p); if (r.ok) setItems((x) => x.filter((y) => y.provider !== p)); else toast({ tone: 'error', title: r.error }); })}>Unlink</Button>
            ) : (
              <a href={`/auth/${p}`}><Button size="xs" variant="secondary" tabIndex={-1}>Link</Button></a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function DeleteAccountForm({ username, hasPassword }: { username: string; hasPassword: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(deleteAccountAction, null);
  return (
    <form action={action} className="flex flex-col gap-4" onSubmit={(e) => { if (!confirm('This permanently deletes your account and all your data. Continue?')) e.preventDefault(); }}>
      <Notice state={state} />
      <Field label={`Type your username (${username}) to confirm`}>{(p) => <Input {...p} name="confirm" autoComplete="off" required />}</Field>
      {hasPassword ? <Field label="Password">{(p) => <Input {...p} name="password" type="password" autoComplete="current-password" required />}</Field> : null}
      <div className="flex justify-end">
        <Button type="submit" variant="danger" loading={pending}>
          <Trash className="size-4" /> Delete my account forever
        </Button>
      </div>
    </form>
  );
}

const SCOPES = [
  { id: 'read', label: 'Read', text: 'Progress, watchlist, lists, search' },
  { id: 'watch:write', label: 'Scrobble', text: 'Mark episodes and movies watched' },
  { id: 'write', label: 'Write', text: 'Everything, including watchlist and lists' },
  { id: 'profile:read', label: 'Profile', text: 'Read your profile and email' },
];

export function ApiTokensPanel({ tokens }: { tokens: ApiToken[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createApiTokenAction, null);
  const [items, setItems] = useState(tokens);
  const [, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  useEffect(() => {
    if (state?.token) router.refresh();
  }, [state, router]);
  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-4">
        <Notice state={state} />
        {state?.token ? (
          <div className="flex items-center gap-2 rounded-card border border-accent/40 bg-accent-soft p-3">
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-fg">{state.token}</code>
            <Button size="xs" variant="secondary" onClick={() => navigator.clipboard.writeText(state.token!).then(() => toast({ tone: 'success', title: 'Copied' }))}>
              <Copy className="size-3.5" /> Copy
            </Button>
          </div>
        ) : null}
        <Field label="Token name" hint="Something like “Living room Plex plugin”." error={state?.details?.name?.[0]}>{(p) => <Input {...p} name="name" maxLength={60} required />}</Field>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-fg">Scopes</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {SCOPES.map((s) => (
              <label key={s.id} className="flex items-start gap-3 rounded-card border border-border bg-surface-2 p-3 text-sm">
                <input type="checkbox" name="scopes" value={s.id} defaultChecked={s.id === 'read' || s.id === 'watch:write'} className="mt-0.5 size-4 accent-accent" />
                <span>
                  <span className="block font-medium text-fg">{s.label}</span>
                  <span className="block text-xs text-fg-muted">{s.text}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex justify-end">
          <Button type="submit" loading={pending}>Create token</Button>
        </div>
      </form>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-fg">Active tokens</h3>
        {items.length === 0 ? <p className="text-sm text-fg-muted">No tokens yet.</p> : (
          <ul className="divide-y divide-border">
            {items.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-fg">{t.name} <code className="ml-1 font-mono text-xs text-fg-subtle">mtk_{t.prefix}_…</code></p>
                  <p className="text-xs text-fg-subtle">{(t.scopes as string[]).join(', ')} · created {formatDateTime(t.createdAt)}{t.lastUsedAt ? ` · last used ${formatRelative(t.lastUsedAt)}` : ' · never used'}</p>
                </div>
                <Button size="xs" variant="ghost" onClick={() => start(async () => { const r = await revokeApiTokenAction(t.id); if (r.ok) setItems((x) => x.filter((y) => y.id !== t.id)); })}>Revoke</Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
