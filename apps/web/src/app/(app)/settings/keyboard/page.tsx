import type { Metadata } from 'next';
import { KeybindingsForm } from '@/components/settings/keybindings-form';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Keyboard shortcuts' };

export default async function KeyboardSettingsPage() {
  const user = await requireUser('/settings/keyboard');
  return <KeybindingsForm initial={user.preferences.keybindings ?? {}} />;
}
