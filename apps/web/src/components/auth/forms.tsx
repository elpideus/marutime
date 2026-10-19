'use client';

import { LIMITS } from '@marutime/config';
import { Button, Field, Input } from '@marutime/ui';
import Link from 'next/link';
import { useActionState } from 'react';
import { forgotPasswordAction, loginAction, registerAction, resetPasswordAction, type AuthFormState } from '@/actions/auth';

function FormError({ state }: { state: AuthFormState }) {
  if (!state?.error) return null;
  return (
    <div role="alert" className="rounded-control border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
      {state.error}
    </div>
  );
}

function FormSuccess({ state }: { state: AuthFormState }) {
  if (!state?.success) return null;
  return (
    <div role="status" className="rounded-control border border-success/30 bg-success/10 px-3.5 py-2.5 text-sm text-success">
      {state.success}
    </div>
  );
}

export function OAuthButtons({ providers, next }: { providers: string[]; next: string }) {
  if (providers.length === 0) return null;
  const labels: Record<string, string> = { google: 'Google', github: 'GitHub', discord: 'Discord' };
  return (
    <div className="mt-5">
      <div className="relative my-4 text-center text-xs text-fg-subtle before:absolute before:inset-x-0 before:top-1/2 before:h-px before:bg-border">
        <span className="relative bg-surface px-2">or continue with</span>
      </div>
      <div className="grid gap-2">
        {providers.map((p) => (
          <a key={p} href={`/auth/${p}?next=${encodeURIComponent(next)}`}>
            <Button variant="secondary" className="w-full" tabIndex={-1}>
              {labels[p] ?? p}
            </Button>
          </a>
        ))}
      </div>
    </div>
  );
}

export function LoginForm({ next, providers, initialError }: { next: string; providers: string[]; initialError?: string }) {
  const [state, action, pending] = useActionState(loginAction, initialError ? { error: initialError } : null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <FormError state={state} />
      <Field label="Email or username">{(p) => <Input {...p} name="identifier" autoComplete="username" required autoFocus />}</Field>
      <Field label="Password">{(p) => <Input {...p} name="password" type="password" autoComplete="current-password" required />}</Field>
      <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">
        Sign in
      </Button>
      <div className="text-center text-sm">
        <Link href="/forgot-password" className="text-fg-muted hover:text-fg">
          Forgot your password?
        </Link>
      </div>
      <OAuthButtons providers={providers} next={next} />
    </form>
  );
}

export function RegisterForm({ next, providers }: { next: string; providers: string[] }) {
  const [state, action, pending] = useActionState(registerAction, null);
  const err = (f: string) => state?.details?.[f]?.[0];
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <FormError state={state} />
      <Field label="Email" error={err('email')}>{(p) => <Input {...p} name="email" type="email" autoComplete="email" required autoFocus />}</Field>
      <Field label="Username" hint="3–24 lowercase letters, numbers or underscores. This is your public handle." error={err('username')}>
        {(p) => <Input {...p} name="username" autoComplete="username" required pattern="[a-zA-Z0-9_]{3,24}" />}
      </Field>
      <Field label="Password" hint="At least 10 characters." error={err('password')}>{(p) => <Input {...p} name="password" type="password" autoComplete="new-password" required minLength={10} />}</Field>
      <label className="flex items-start gap-3 text-sm text-fg-muted">
        <input type="checkbox" name="ageConfirmed" required className="mt-1 size-4 accent-accent" />
        <span>I am at least {LIMITS.minimumAge} years old.</span>
      </label>
      <label className="flex items-start gap-3 text-sm text-fg-muted">
        <input type="checkbox" name="termsAccepted" required className="mt-1 size-4 accent-accent" />
        <span>
          I agree to the{' '}
          <Link href="/legal/terms" className="text-fg underline-offset-2 hover:underline">terms</Link> and have read the{' '}
          <Link href="/legal/privacy" className="text-fg underline-offset-2 hover:underline">privacy policy</Link>.
        </span>
      </label>
      <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">
        Create account
      </Button>
      <OAuthButtons providers={providers} next={next} />
    </form>
  );
}

export function ForgotPasswordForm({ emailEnabled }: { emailEnabled: boolean }) {
  const [state, action, pending] = useActionState(forgotPasswordAction, null);
  if (!emailEnabled) {
    return (
      <div className="text-sm text-fg-muted">
        Email delivery is not set up on this instance yet. Ask an administrator to reset your password for you.
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError state={state} />
      <FormSuccess state={state} />
      <Field label="Email">{(p) => <Input {...p} name="email" type="email" autoComplete="email" required autoFocus />}</Field>
      <Button type="submit" size="lg" loading={pending} className="w-full">
        Send reset link
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <FormError state={state} />
      <Field label="New password" hint="At least 10 characters." error={state?.details?.password?.[0]}>
        {(p) => <Input {...p} name="password" type="password" autoComplete="new-password" required minLength={10} autoFocus />}
      </Field>
      <Button type="submit" size="lg" loading={pending} className="w-full">
        Set new password
      </Button>
    </form>
  );
}
