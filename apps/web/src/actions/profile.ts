'use server';

import { createApiToken, invalidateSessionById, invalidateAllUserSessions, revokeApiToken, verifyPassword, type ApiScope } from '@marutime/auth';
import { SOCIAL_PLATFORMS } from '@marutime/config';
import { changePassword, deleteAccount, deleteUserFiles, errors, isAppError, removeUserImage, requestEmailChange, updatePreferences, updateProfile, unlinkAccount, type UpdateProfileInput } from '@marutime/core';
import { getDb } from '@marutime/db';
import { getStorage } from '@marutime/storage';
import { redirect, unstable_rethrow } from 'next/navigation';
import { run, type ActionResult } from '@/lib/action';
import { getClientIp } from '@/lib/request';
import { clearSessionCookie, getCurrentSession, getCurrentUser } from '@/lib/session';

async function me() {
  const user = await getCurrentUser();
  if (!user) throw errors.unauthorized();
  return user;
}

export type FormState = { error?: string; details?: Record<string, string[]>; success?: string; token?: string } | null;

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await me();
    const socialLinks: UpdateProfileInput['socialLinks'] = [];
    for (const p of SOCIAL_PLATFORMS) {
      const url = String(formData.get(`social.${p.id}`) ?? '').trim();
      if (url) socialLinks.push({ platform: p.id, url: url.startsWith('http') ? url : `https://${url}` });
    }
    const favMedia = Number(formData.get('favoriteCharacterMediaId'));
    await updateProfile(getDb(), user.id, {
      username: String(formData.get('username') ?? user.username),
      displayName: String(formData.get('displayName') ?? ''),
      bio: String(formData.get('bio') ?? '') || null,
      favoriteCharacterName: String(formData.get('favoriteCharacterName') ?? '') || null,
      favoriteCharacterMediaId: Number.isFinite(favMedia) && favMedia > 0 ? favMedia : null,
      favoriteCharacterImageUrl: String(formData.get('favoriteCharacterImageUrl') ?? '') || null,
      socialLinks,
    });
    return { success: 'Profile saved' };
  } catch (err) {
    unstable_rethrow(err);
    if (isAppError(err)) return { error: err.message, details: err.details };
    console.error(err);
    return { error: 'Could not save your profile.' };
  }
}

export async function updatePreferencesAction(patch: Record<string, unknown>): Promise<ActionResult> {
  return run(async () => {
    const user = await me();
    await updatePreferences(getDb(), user.id, patch);
  });
}

export async function removeImageAction(kind: 'avatar' | 'cover'): Promise<ActionResult> {
  return run(async () => {
    const user = await me();
    await removeUserImage(getDb(), getStorage(), user, kind);
  });
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const session = await getCurrentSession();
    if (!session) throw errors.unauthorized();
    await changePassword(getDb(), session.user, String(formData.get('currentPassword') ?? ''), String(formData.get('newPassword') ?? ''), session.session.id);
    return { success: 'Password updated. Other devices were signed out.' };
  } catch (err) {
    unstable_rethrow(err);
    if (isAppError(err)) return { error: err.message, details: err.details };
    return { error: 'Could not change your password.' };
  }
}

export async function requestEmailChangeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await me();
    await requestEmailChange(getDb(), user, String(formData.get('email') ?? ''), String(formData.get('currentPassword') ?? ''));
    return { success: 'Check your new inbox for a confirmation link.' };
  } catch (err) {
    unstable_rethrow(err);
    if (isAppError(err)) return { error: err.message, details: err.details };
    return { error: 'Could not start the email change.' };
  }
}

export async function revokeSessionAction(sessionId: string): Promise<ActionResult> {
  return run(async () => {
    const user = await me();
    await invalidateSessionById(getDb(), sessionId, user.id);
  });
}

export async function signOutEverywhereAction(): Promise<ActionResult> {
  return run(async () => {
    const s = await getCurrentSession();
    if (!s) throw errors.unauthorized();
    await invalidateAllUserSessions(getDb(), s.user.id, s.session.id);
  });
}

export async function createApiTokenAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await me();
    const scopes = formData.getAll('scopes').map(String).filter(Boolean) as ApiScope[];
    const name = String(formData.get('name') ?? '').trim();
    if (!name) return { error: 'Give the token a name', details: { name: ['Required'] } };
    const { token } = await createApiToken(getDb(), { userId: user.id, name, scopes: scopes.length ? scopes : ['read'] });
    return { success: 'Token created. Copy it now; it will not be shown again.', token };
  } catch (err) {
    unstable_rethrow(err);
    if (isAppError(err)) return { error: err.message };
    return { error: 'Could not create the token.' };
  }
}

export async function revokeApiTokenAction(tokenId: string): Promise<ActionResult> {
  return run(async () => {
    const user = await me();
    await revokeApiToken(getDb(), user.id, tokenId);
  });
}

export async function unlinkAccountAction(provider: string): Promise<ActionResult> {
  return run(async () => {
    const user = await me();
    await unlinkAccount(getDb(), user.id, provider);
  });
}

export async function deleteAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await me();
    const confirm = String(formData.get('confirm') ?? '');
    if (confirm !== user.username) return { error: 'Type your username exactly to confirm.' };
    if (user.passwordHash && !(await verifyPassword(String(formData.get('password') ?? ''), user.passwordHash))) {
      return { error: 'Incorrect password.' };
    }
    const storage = getStorage();
    await deleteAccount(getDb(), user.id, { actorId: user.id, reason: 'self-service', ip: await getClientIp() });
    await deleteUserFiles(storage, user.id).catch(() => {});
    await clearSessionCookie();
  } catch (err) {
    unstable_rethrow(err);
    if (isAppError(err)) return { error: err.message };
    console.error(err);
    return { error: 'Could not delete your account. Please contact support.' };
  }
  redirect('/?deleted=1');
}
