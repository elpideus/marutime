'use client';

import type { Device, Service } from '@marutime/db';
import { Button, Field, Input, Island, IslandHeader, Switch, useToast } from '@marutime/ui';
import { Plus, Trash } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { adminDeleteDeviceAction, adminDeleteServiceAction, adminUpsertDeviceAction, adminUpsertServiceAction } from '@/actions/admin';
import { DeviceIcon } from '@/components/tracking/device-icon';

type Kind = 'device' | 'service';

export function CatalogEditor({ kind, items }: { kind: Kind; items: Array<Device | Service> }) {
  const [draft, setDraft] = useState<{ id?: number; slug: string; name: string; extra: string; sortOrder: number; isActive: boolean }>({ slug: '', name: '', extra: '', sortOrder: items.length, isActive: true });
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const isDevice = kind === 'device';

  const save = () => {
    start(async () => {
      const payload = isDevice
        ? { id: draft.id, slug: draft.slug, name: draft.name, icon: draft.extra || null, sortOrder: draft.sortOrder, isActive: draft.isActive }
        : { id: draft.id, slug: draft.slug, name: draft.name, color: draft.extra || null, sortOrder: draft.sortOrder, isActive: draft.isActive };
      const r = isDevice ? await adminUpsertDeviceAction(payload) : await adminUpsertServiceAction(payload);
      if (!r.ok) toast({ tone: 'error', title: r.error });
      else {
        toast({ tone: 'success', title: 'Saved' });
        setDraft({ slug: '', name: '', extra: '', sortOrder: items.length + 1, isActive: true });
        router.refresh();
      }
    });
  };

  const remove = (id: number) => {
    if (!confirm('Delete? If it is already used in check-ins it will be deactivated instead.')) return;
    start(async () => {
      const r = isDevice ? await adminDeleteDeviceAction(id) : await adminDeleteServiceAction(id);
      toast(r.ok ? { tone: 'success', title: 'Done' } : { tone: 'error', title: r.error });
      router.refresh();
    });
  };

  const edit = (item: Device | Service) =>
    setDraft({ id: item.id, slug: item.slug, name: item.name, extra: isDevice ? ((item as Device).icon ?? '') : ((item as Service).color ?? ''), sortOrder: item.sortOrder, isActive: item.isActive });

  return (
    <Island>
      <IslandHeader title={isDevice ? 'Devices' : 'Services'} description={isDevice ? 'Icon names come from Lucide (tv, smartphone, tablet, laptop, monitor, clapperboard, projector, gamepad-2, glasses, circle-ellipsis).' : 'Brand colour is used for the dot next to the service name.'} />
      <ul className="mb-5 divide-y divide-border">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 py-2 text-sm">
            {isDevice ? <DeviceIcon icon={(item as Device).icon} className="size-4 text-fg-muted" /> : <span className="size-3 rounded-full" style={{ backgroundColor: (item as Service).color ?? '#666' }} />}
            <span className="flex-1 truncate text-fg">
              {item.name} <span className="font-mono text-xs text-fg-subtle">{item.slug}</span>
              {!item.isActive ? <span className="ml-2 rounded-pill bg-surface-3 px-1.5 text-[10px] text-fg-muted uppercase">inactive</span> : null}
            </span>
            <Button size="xs" variant="ghost" onClick={() => edit(item)}>Edit</Button>
            <Button size="icon-sm" variant="ghost" onClick={() => remove(item.id)} aria-label="Delete" tooltip="Delete (deactivated instead if anyone used it)"><Trash className="size-4" /></Button>
          </li>
        ))}
      </ul>
      <div className="grid gap-3 rounded-card border border-border bg-surface-2 p-4 sm:grid-cols-5">
        <Field label="Name">{(p) => <Input {...p} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value, slug: d.id ? d.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }))} />}</Field>
        <Field label="Slug">{(p) => <Input {...p} value={draft.slug} onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))} />}</Field>
        <Field label={isDevice ? 'Icon' : 'Colour'}>{(p) => <Input {...p} value={draft.extra} onChange={(e) => setDraft((d) => ({ ...d, extra: e.target.value }))} placeholder={isDevice ? 'tv' : '#E50914'} />}</Field>
        <Field label="Order">{(p) => <Input {...p} type="number" value={draft.sortOrder} onChange={(e) => setDraft((d) => ({ ...d, sortOrder: Number(e.target.value) }))} />}</Field>
        <div className="flex items-end gap-2 pb-0.5">
          <label className="flex h-11 items-center gap-2 text-xs text-fg-muted"><Switch checked={draft.isActive} onCheckedChange={(v) => setDraft((d) => ({ ...d, isActive: v }))} label="Active" /> Active</label>
          <Button size="md" onClick={save} loading={pending} disabled={!draft.name || !draft.slug}>
            {draft.id ? 'Save' : <><Plus className="size-4" /> Add</>}
          </Button>
        </div>
      </div>
    </Island>
  );
}
