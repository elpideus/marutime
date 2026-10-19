'use server';

import type { PlatformSettings, UserRole } from '@marutime/config';
import {
  adminSetPassword,
  deleteAccount,
  deleteBackup,
  deleteDevice,
  deleteService,
  deleteUserFiles,
  errors,
  isAppError,
  logAudit,
  pruneBackups,
  resolveReport,
  resyncMedia,
  runBackup,
  setSettings,
  setUserRole,
  suspendUser,
  unsuspendUser,
  upsertDevice,
  upsertService,
  verifyUserEmailAdmin,
} from '@marutime/core';
import { getDb } from '@marutime/db';
import { getStorage } from '@marutime/storage';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { run, type ActionResult } from '@/lib/action';
import { getClientIp } from '@/lib/request';
import { getCurrentUser, isStaff } from '@/lib/session';

async function staff() {
  const user = await getCurrentUser();
  if (!user) throw errors.unauthorized();
  if (!isStaff(user)) throw errors.forbidden();
  return user;
}

async function admin() {
  const user = await staff();
  if (user.role !== 'admin') throw errors.forbidden('Admin access required');
  return user;
}

export type AdminFormState = { error?: string; details?: Record<string, string[]>; success?: string } | null;

export async function adminUpdateSettingsAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  try {
    const user = await admin();
    const bool = (k: string) => formData.get(k) === 'on' || formData.get(k) === 'true';
    const str = (k: string) => String(formData.get(k) ?? '').trim();
    const placements = formData.getAll('donation.placements').map(String);
    const patch: Partial<PlatformSettings> = {
      'site.name': str('site.name') || 'MaruTime',
      'site.tagline': str('site.tagline'),
      'site.registrationOpen': bool('site.registrationOpen'),
      'site.requireEmailVerification': bool('site.requireEmailVerification'),
      'donation.enabled': bool('donation.enabled'),
      'donation.provider': str('donation.provider') || 'revolut',
      'donation.handle': str('donation.handle'),
      'donation.url': str('donation.url'),
      'donation.title': str('donation.title'),
      'donation.message': str('donation.message'),
      'donation.placements': placements,
      'donation.frequency': str('donation.frequency') || 'subtle',
      'legal.controllerName': str('legal.controllerName'),
      'legal.controllerEmail': str('legal.controllerEmail'),
      'legal.controllerAddress': str('legal.controllerAddress'),
      'legal.country': str('legal.country'),
      'api.public': bool('api.public'),
      'backup.enabled': bool('backup.enabled'),
      'backup.retentionDays': Math.max(1, Number(formData.get('backup.retentionDays') || 30)),
      'moderation.autoHideReports': Math.max(1, Number(formData.get('moderation.autoHideReports') || 5)),
    };
    if (patch['donation.url'] && !/^https:\/\//.test(patch['donation.url'])) return { error: 'Donation URL must start with https://' };
    await setSettings(getDb(), patch, user.id);
    await logAudit(getDb(), { actorId: user.id, action: 'settings.update', meta: { keys: Object.keys(patch) }, ip: await getClientIp() });
    revalidatePath('/', 'layout');
    return { success: 'Settings saved' };
  } catch (err) {
    unstable_rethrow(err);
    if (isAppError(err)) return { error: err.message };
    console.error(err);
    return { error: 'Could not save settings.' };
  }
}

export async function adminSetRoleAction(userId: string, role: UserRole): Promise<ActionResult> {
  return run(async () => {
    const actor = await admin();
    await setUserRole(getDb(), actor, userId, role, await getClientIp());
  });
}

export async function adminSuspendAction(userId: string, reason: string | null): Promise<ActionResult> {
  return run(async () => {
    const actor = await staff();
    await suspendUser(getDb(), actor, userId, reason, await getClientIp());
  });
}

export async function adminUnsuspendAction(userId: string): Promise<ActionResult> {
  return run(async () => {
    const actor = await staff();
    await unsuspendUser(getDb(), actor, userId, await getClientIp());
  });
}

export async function adminSetPasswordAction(userId: string, password: string): Promise<ActionResult> {
  return run(async () => {
    const actor = await admin();
    await adminSetPassword(getDb(), actor, userId, password, await getClientIp());
  });
}

export async function adminVerifyEmailAction(userId: string): Promise<ActionResult> {
  return run(async () => {
    const actor = await admin();
    await verifyUserEmailAdmin(getDb(), actor, userId);
  });
}

export async function adminDeleteUserAction(userId: string, reason: string): Promise<ActionResult> {
  return run(async () => {
    const actor = await admin();
    if (actor.id === userId) throw errors.validation('Delete your own account from settings instead');
    await deleteAccount(getDb(), userId, { actorId: actor.id, reason, ip: await getClientIp() });
    await deleteUserFiles(getStorage(), userId).catch(() => {});
  });
}

export async function adminResolveReportAction(reportId: string, status: 'resolved' | 'dismissed', note?: string): Promise<ActionResult> {
  return run(async () => {
    const actor = await staff();
    await resolveReport(getDb(), actor, reportId, status, note);
  });
}

export async function adminUpsertDeviceAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await staff();
    await upsertDevice(getDb(), actor, input);
  });
}

export async function adminDeleteDeviceAction(id: number): Promise<ActionResult> {
  return run(async () => {
    const actor = await staff();
    await deleteDevice(getDb(), actor, id);
  });
}

export async function adminUpsertServiceAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await staff();
    await upsertService(getDb(), actor, input);
  });
}

export async function adminDeleteServiceAction(id: number): Promise<ActionResult> {
  return run(async () => {
    const actor = await staff();
    await deleteService(getDb(), actor, id);
  });
}

export async function adminRunBackupAction(): Promise<ActionResult<{ id: string; status: string; error: string | null }>> {
  return run(async () => {
    const actor = await admin();
    const db = getDb();
    const result = await runBackup(db, getStorage(), { kind: 'manual', actorId: actor.id });
    if (result.status === 'completed') await pruneBackups(db, getStorage()).catch(() => 0);
    return { id: result.id, status: result.status, error: result.error };
  });
}

export async function adminDeleteBackupAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const actor = await admin();
    await deleteBackup(getDb(), getStorage(), id, actor.id);
  });
}

export async function adminResyncMediaAction(mediaId: number): Promise<ActionResult> {
  return run(async () => {
    const actor = await staff();
    await resyncMedia(getDb(), actor, mediaId);
  });
}
