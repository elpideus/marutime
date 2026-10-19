import { getSettings } from '@marutime/core';
import { getDb } from '@marutime/db';
import { SettingsForm } from '@/components/admin/settings-form';
import { requireAdmin } from '@/lib/session';

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getSettings(getDb(), { fresh: true });
  return <SettingsForm settings={settings} />;
}
