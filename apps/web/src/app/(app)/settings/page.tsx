import { Island, IslandHeader } from '@marutime/ui';
import type { Metadata } from 'next';
import { ImageUploader } from '@/components/settings/image-uploader';
import { ProfileForm } from '@/components/settings/profile-form';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Profile settings' };

export default async function ProfileSettingsPage() {
  const user = await requireUser('/settings');
  return (
    <div className="flex flex-col gap-6">
      <Island>
        <IslandHeader title="Images" description="Your cover and profile picture. We strip location data from every upload." />
        <div className="flex flex-col gap-5">
          <ImageUploader kind="cover" current={user.coverUrl} name={user.displayName} />
          <ImageUploader kind="avatar" current={user.avatarUrl} name={user.displayName} />
        </div>
      </Island>
      <Island>
        <IslandHeader title="Profile" />
        <ProfileForm user={user} />
      </Island>
    </div>
  );
}
