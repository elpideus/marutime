'use server';

import { createSession, invalidateSession } from '@marutime/auth';
import { authenticateWithPassword, isAppError, registerUser, requestPasswordReset, resetPassword, sendEmailVerification, verifyEmail, confirmEmailChange, getSettings } from '@marutime/core';
import { getDb } from '@marutime/db';
import { redirect } from 'next/navigation';
import { unstable_rethrow } from 'next/navigation';
import { getClientIp, getUserAgent } from '@/lib/request';
import { clearSessionCookie, currentSessionToken, setSessionCookie } from '@/lib/session';

export type AuthFormState = { error?: string; details?: Record<string, string[]>; success?: string } | null;

function safeNext(value: FormDataEntryValue | null): string {
  const v = typeof value === 'string' ? value : '';
  return v.startsWith('/') && !v.startsWith('//') ? v : '/';
}

async function startSession(userId: string): Promise<void> {
  const { token } = await createSession(getDb(), userId, { userAgent: await getUserAgent(), ip: await getClientIp() });
  await setSessionCookie(token);
}

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const next = safeNext(formData.get('next'));
  try {
    const user = await authenticateWithPassword(getDb(), {
      identifier: String(formData.get('identifier') ?? ''),
      password: String(formData.get('password') ?? ''),
      ip: await getClientIp(),
    });
    await startSession(user.id);
  } catch (err) {
    unstable_rethrow(err);
    if (isAppError(err)) return { error: err.message, details: err.details };
    console.error(err);
    return { error: 'Could not sign you in right now.' };
  }
  redirect(next);
}

export async function registerAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const next = safeNext(formData.get('next'));
  try {
    const db = getDb();
    const user = await registerUser(db, {
      email: String(formData.get('email') ?? ''),
      username: String(formData.get('username') ?? ''),
      password: String(formData.get('password') ?? ''),
      displayName: String(formData.get('displayName') ?? '') || undefined,
      ageConfirmed: formData.get('ageConfirmed') === 'on' ? true : (false as unknown as true),
      termsAccepted: formData.get('termsAccepted') === 'on' ? true : (false as unknown as true),
    });
    const settings = await getSettings(db);
    if (settings['site.requireEmailVerification']) await sendEmailVerification(db, user).catch((e) => console.error('[email]', e));
    await startSession(user.id);
  } catch (err) {
    unstable_rethrow(err);
    if (isAppError(err)) return { error: err.message, details: err.details };
    console.error(err);
    return { error: 'Could not create your account right now.' };
  }
  redirect(next === '/' ? '/?welcome=1' : next);
}

export async function logoutAction(): Promise<void> {
  const token = await currentSessionToken();
  if (token) await invalidateSession(getDb(), token).catch(() => {});
  await clearSessionCookie();
  redirect('/');
}

export async function forgotPasswordAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  try {
    await requestPasswordReset(getDb(), String(formData.get('email') ?? ''));
  } catch (err) {
    unstable_rethrow(err);
    if (isAppError(err)) return { error: err.message };
    console.error(err);
  }
  return { success: 'If an account exists for that email, a reset link is on its way.' };
}

export async function resetPasswordAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  try {
    const user = await resetPassword(getDb(), String(formData.get('token') ?? ''), String(formData.get('password') ?? ''));
    await startSession(user.id);
  } catch (err) {
    unstable_rethrow(err);
    if (isAppError(err)) return { error: err.message, details: err.details };
    console.error(err);
    return { error: 'Could not reset your password.' };
  }
  redirect('/?reset=1');
}

export async function verifyEmailAction(token: string, change: boolean): Promise<AuthFormState> {
  try {
    if (change) await confirmEmailChange(getDb(), token);
    else await verifyEmail(getDb(), token);
    return { success: change ? 'Your email address was updated.' : 'Your email is verified. Welcome aboard!' };
  } catch (err) {
    unstable_rethrow(err);
    if (isAppError(err)) return { error: err.message };
    return { error: 'This link is invalid or has expired.' };
  }
}
