'use client';

import type { PlatformSettings } from '@marutime/config';
import { Button, Field, Input, Island, IslandHeader, Switch, Textarea } from '@marutime/ui';
import { useActionState, useEffect, useState } from 'react';
import { adminUpdateSettingsAction, type AdminFormState } from '@/actions/admin';
import { useToast } from '@marutime/ui';

const PLACEMENTS = [
  { id: 'sidebar', label: 'Sidebar card' },
  { id: 'profile', label: 'Profile pages' },
  { id: 'footer', label: 'Footer link' },
  { id: 'settings', label: 'Settings page' },
];

export function SettingsForm({ settings }: { settings: PlatformSettings }) {
  const [state, action, pending] = useActionState<AdminFormState, FormData>(adminUpdateSettingsAction, null);
  const { toast } = useToast();
  useEffect(() => {
    if (state?.success) toast({ tone: 'success', title: state.success });
    if (state?.error) toast({ tone: 'error', title: state.error });
  }, [state, toast]);
  const [reg, setReg] = useState(settings['site.registrationOpen']);
  const [verify, setVerify] = useState(settings['site.requireEmailVerification']);
  const [donate, setDonate] = useState(settings['donation.enabled']);
  const [backup, setBackup] = useState(settings['backup.enabled']);
  return (
    <form action={action} className="flex flex-col gap-6">
      <Island>
        <IslandHeader title="Site" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">{(p) => <Input {...p} name="site.name" defaultValue={settings['site.name']} />}</Field>
          <Field label="Tagline">{(p) => <Input {...p} name="site.tagline" defaultValue={settings['site.tagline']} />}</Field>
          <label className="flex items-center justify-between gap-3 rounded-card border border-border p-3 text-sm">
            <span><span className="block font-medium text-fg">Registration open</span><span className="text-xs text-fg-muted">Allow new accounts.</span></span>
            <Switch checked={reg} onCheckedChange={setReg} name="site.registrationOpen" label="Registration open" />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-card border border-border p-3 text-sm">
            <span><span className="block font-medium text-fg">Require email verification</span><span className="text-xs text-fg-muted">Needs an email provider configured.</span></span>
            <Switch checked={verify} onCheckedChange={setVerify} name="site.requireEmailVerification" label="Require email verification" />
          </label>
        </div>
      </Island>
      <Island>
        <IslandHeader title="Donation call to action" description="Kept deliberately quiet. Shown only where you allow it." />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-3 rounded-card border border-border p-3 text-sm sm:col-span-2">
            <span><span className="block font-medium text-fg">Enabled</span></span>
            <Switch checked={donate} onCheckedChange={setDonate} name="donation.enabled" label="Donations enabled" />
          </label>
          <Field label="Provider">{(p) => <Input {...p} name="donation.provider" defaultValue={settings['donation.provider']} />}</Field>
          <Field label="Handle">{(p) => <Input {...p} name="donation.handle" defaultValue={settings['donation.handle']} />}</Field>
          <Field label="Link (https)" className="sm:col-span-2">{(p) => <Input {...p} name="donation.url" type="url" defaultValue={settings['donation.url']} />}</Field>
          <Field label="Title">{(p) => <Input {...p} name="donation.title" defaultValue={settings['donation.title']} />}</Field>
          <Field label="Frequency hint">{(p) => <Input {...p} name="donation.frequency" defaultValue={settings['donation.frequency']} />}</Field>
          <Field label="Message" className="sm:col-span-2">{(p) => <Textarea {...p} name="donation.message" defaultValue={settings['donation.message']} rows={2} />}</Field>
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm font-medium text-fg">Placements</legend>
            <div className="flex flex-wrap gap-3">
              {PLACEMENTS.map((pl) => (
                <label key={pl.id} className="flex items-center gap-2 text-sm text-fg-muted">
                  <input type="checkbox" name="donation.placements" value={pl.id} defaultChecked={settings['donation.placements'].includes(pl.id)} className="size-4 accent-accent" /> {pl.label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </Island>
      <Island>
        <IslandHeader title="Legal identity" description="Shown on the privacy policy, terms and imprint pages." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Controller / operator name">{(p) => <Input {...p} name="legal.controllerName" defaultValue={settings['legal.controllerName']} />}</Field>
          <Field label="Contact email">{(p) => <Input {...p} name="legal.controllerEmail" type="email" defaultValue={settings['legal.controllerEmail']} />}</Field>
          <Field label="Address (optional)">{(p) => <Input {...p} name="legal.controllerAddress" defaultValue={settings['legal.controllerAddress']} />}</Field>
          <Field label="Country">{(p) => <Input {...p} name="legal.country" defaultValue={settings['legal.country']} />}</Field>
        </div>
      </Island>
      <Island>
        <IslandHeader title="Backups & moderation" />
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex items-center justify-between gap-3 rounded-card border border-border p-3 text-sm">
            <span><span className="block font-medium text-fg">Scheduled backups</span></span>
            <Switch checked={backup} onCheckedChange={setBackup} name="backup.enabled" label="Backups enabled" />
          </label>
          <Field label="Retention (days)">{(p) => <Input {...p} name="backup.retentionDays" type="number" min={1} defaultValue={settings['backup.retentionDays']} />}</Field>
          <Field label="Auto-hide after N reports">{(p) => <Input {...p} name="moderation.autoHideReports" type="number" min={1} defaultValue={settings['moderation.autoHideReports']} />}</Field>
        </div>
      </Island>
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>Save settings</Button>
      </div>
    </form>
  );
}
