'use client';

import { LIMITS, LIST_VISIBILITIES } from '@marutime/config';
import type { List } from '@marutime/db';
import { Button, Field, Input, Switch, Textarea, cn } from '@marutime/ui';
import { Globe, Link2, Lock, Users } from 'lucide-react';
import { useActionState, useState } from 'react';
import { createListAction, updateListAction, type ListFormState } from '@/actions/lists';

const VIS: Record<(typeof LIST_VISIBILITIES)[number], { label: string; text: string; icon: React.ReactNode }> = {
  public: { label: 'Public', text: 'Anyone can find it in the lists feed and on your profile.', icon: <Globe className="size-4" /> },
  followers: { label: 'Followers only', text: 'Only people who follow you can open it.', icon: <Users className="size-4" /> },
  unlisted: { label: 'Unlisted', text: 'Hidden everywhere, but anyone with the secret link can view it.', icon: <Link2 className="size-4" /> },
  private: { label: 'Private', text: 'Just for you.', icon: <Lock className="size-4" /> },
};

export function ListForm({ list, ownerUsername, mediaId }: { list?: List; ownerUsername?: string; mediaId?: number }) {
  const action = list ? updateListAction.bind(null, list.id) : createListAction;
  const [state, formAction, pending] = useActionState<ListFormState, FormData>(action, null);
  const [visibility, setVisibility] = useState<(typeof LIST_VISIBILITIES)[number]>(list?.visibility ?? 'public');
  const [ranked, setRanked] = useState(list?.isRanked ?? false);
  return (
    <form action={formAction} className="flex flex-col gap-6">
      {mediaId ? <input type="hidden" name="mediaId" value={mediaId} /> : null}
      {ownerUsername ? <input type="hidden" name="ownerUsername" value={ownerUsername} /> : null}
      <input type="hidden" name="visibility" value={visibility} />
      <input type="hidden" name="isRanked" value={ranked ? 'true' : 'false'} />
      {state?.error ? <div role="alert" className="rounded-control border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{state.error}</div> : null}
      <Field label="Title" required error={state?.details?.title?.[0]}>
        {(p) => <Input {...p} name="title" defaultValue={list?.title} maxLength={LIMITS.listTitleMax} placeholder="Shows that made me cry on public transport" required autoFocus />}
      </Field>
      <Field label="Description" hint="Optional. Markdown is not rendered, plain text only." error={state?.details?.description?.[0]}>
        {(p) => <Textarea {...p} name="description" defaultValue={list?.description ?? ''} maxLength={LIMITS.listDescriptionMax} rows={3} />}
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-fg">Who can see it</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {LIST_VISIBILITIES.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVisibility(v)}
              aria-pressed={visibility === v}
              className={cn('flex items-start gap-3 rounded-card border p-3 text-left transition-colors', visibility === v ? 'border-accent/60 bg-accent-soft' : 'border-border bg-surface-2 hover:border-border-strong')}
            >
              <span className={cn('mt-0.5', visibility === v ? 'text-accent' : 'text-fg-muted')}>{VIS[v].icon}</span>
              <span>
                <span className="block text-sm font-medium text-fg">{VIS[v].label}</span>
                <span className="block text-xs text-fg-muted">{VIS[v].text}</span>
              </span>
            </button>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center justify-between gap-4 rounded-card border border-border bg-surface-2 p-3">
        <span>
          <span className="block text-sm font-medium text-fg">Ranked list</span>
          <span className="block text-xs text-fg-muted">Show position numbers (your #1, #2, …).</span>
        </span>
        <Switch checked={ranked} onCheckedChange={setRanked} label="Ranked" />
      </label>
      <div className="flex justify-end gap-2">
        <Button type="submit" loading={pending}>
          {list ? 'Save changes' : 'Create list'}
        </Button>
      </div>
    </form>
  );
}
