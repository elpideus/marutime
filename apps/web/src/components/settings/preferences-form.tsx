'use client';

import type { Device, Service, UserPreferences } from '@marutime/db';
import { Field, Select, Switch, useToast } from '@marutime/ui';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { updatePreferencesAction } from '@/actions/profile';
import { setThemeAction } from '@/actions/preferences';

function Row({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-fg">{title}</p>
        <p className="text-xs text-fg-muted">{text}</p>
      </div>
      {children}
    </div>
  );
}

export function PreferencesForm({ preferences, devices, services }: { preferences: UserPreferences; devices: Device[]; services: Service[] }) {
  const [prefs, setPrefs] = useState<UserPreferences>(preferences);
  const [, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const update = (patch: UserPreferences) => {
    setPrefs((p) => ({ ...p, ...patch }));
    start(async () => {
      const r = await updatePreferencesAction(patch);
      if (!r.ok) toast({ tone: 'error', title: r.error });
      if (patch.theme) {
        const resolved = patch.theme === 'system' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : patch.theme;
        document.documentElement.dataset.theme = resolved;
        await setThemeAction(resolved);
      }
      router.refresh();
    });
  };
  return (
    <div className="divide-y divide-border">
      <Row title="Profile visibility" text="Who can see your activity, lists and stats.">
        <Select value={prefs.profileVisibility ?? 'public'} onChange={(e) => update({ profileVisibility: e.target.value as UserPreferences['profileVisibility'] })} className="w-40">
          <option value="public">Everyone</option>
          <option value="followers">Followers only</option>
          <option value="private">Only me</option>
        </Select>
      </Row>
      <Row title="Share activity" text="Let followers see what you watch in their feed.">
        <Switch checked={prefs.showActivity !== false} onCheckedChange={(v) => update({ showActivity: v })} label="Share activity" />
      </Row>
      <Row title="Hide spoilers by default" text="Blur spoiler-marked comments until you tap them.">
        <Switch checked={prefs.hideSpoilersByDefault !== false} onCheckedChange={(v) => update({ hideSpoilersByDefault: v })} label="Hide spoilers" />
      </Row>
      <Row title="Theme" text="Dark is the default. Light is here if you insist.">
        <Select value={prefs.theme ?? 'dark'} onChange={(e) => update({ theme: e.target.value as UserPreferences['theme'] })} className="w-40">
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="system">System</option>
        </Select>
      </Row>
      <Row title="Default device" text="Pre-selected when you check in. Always private.">
        <Select value={prefs.defaultDeviceId ?? ''} onChange={(e) => update({ defaultDeviceId: e.target.value ? Number(e.target.value) : null })} className="w-40">
          <option value="">None</option>
          {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
      </Row>
      <Row title="Default service" text="Pre-selected when you check in. Always private.">
        <Select value={prefs.defaultServiceId ?? ''} onChange={(e) => update({ defaultServiceId: e.target.value ? Number(e.target.value) : null })} className="w-40">
          <option value="">None</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </Row>
      <Row title="Email notifications" text="Only for things that matter (export ready, security).">
        <Switch checked={prefs.emailNotifications !== false} onCheckedChange={(v) => update({ emailNotifications: v })} label="Email notifications" />
      </Row>
      <Field className="pt-3" label="Default lists category" hint="The feed opens on this category.">
        {(p) => (
          <Select {...p} value={prefs.listsCategory ?? 'shows'} onChange={(e) => update({ listsCategory: e.target.value as UserPreferences['listsCategory'] })} className="w-40">
            <option value="shows">Shows</option>
            <option value="movies">Movies</option>
            <option value="anime">Anime</option>
          </Select>
        )}
      </Field>
    </div>
  );
}
