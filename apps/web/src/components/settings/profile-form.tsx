'use client';

import { LIMITS, SOCIAL_PLATFORMS } from '@marutime/config';
import type { User } from '@marutime/db';
import { Button, Field, Input, Textarea } from '@marutime/ui';
import { useActionState, useEffect } from 'react';
import { updateProfileAction, type FormState } from '@/actions/profile';
import { useToast } from '@marutime/ui';

export function ProfileForm({ user }: { user: User }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfileAction, null);
  const { toast } = useToast();
  useEffect(() => {
    if (state?.success) toast({ tone: 'success', title: state.success });
  }, [state, toast]);
  const err = (f: string) => state?.details?.[f]?.[0];
  const link = (id: string) => user.socialLinks.find((l) => l.platform === id)?.url ?? '';
  return (
    <form action={action} className="flex flex-col gap-5">
      {state?.error && !state.details ? <div role="alert" className="rounded-control border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{state.error}</div> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Display name" required error={err('displayName')}>{(p) => <Input {...p} name="displayName" defaultValue={user.displayName} maxLength={LIMITS.displayNameMax} required />}</Field>
        <Field label="Username" hint="Changing it changes your profile URL." error={err('username')}>{(p) => <Input {...p} name="username" defaultValue={user.username} pattern="[a-zA-Z0-9_]{3,24}" required />}</Field>
      </div>
      <Field label="Bio" hint={`${LIMITS.bioMax} characters max.`} error={err('bio')}>{(p) => <Textarea {...p} name="bio" defaultValue={user.bio ?? ''} maxLength={LIMITS.bioMax} rows={3} />}</Field>
      <fieldset className="rounded-card border border-border p-4">
        <legend className="px-1 text-sm font-medium text-fg">Favorite character ever</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" error={err('favoriteCharacterName')}>{(p) => <Input {...p} name="favoriteCharacterName" defaultValue={user.favoriteCharacterName ?? ''} maxLength={LIMITS.favoriteCharacterMax} placeholder="e.g. Kaz Brekker" />}</Field>
          <Field label="Image URL" hint="Optional. A TMDB or AniList character image works great.">{(p) => <Input {...p} name="favoriteCharacterImageUrl" type="url" defaultValue={user.favoriteCharacterImageUrl ?? ''} placeholder="https://…" />}</Field>
        </div>
        <input type="hidden" name="favoriteCharacterMediaId" value={user.favoriteCharacterMediaId ?? ''} />
      </fieldset>
      <fieldset className="rounded-card border border-border p-4">
        <legend className="px-1 text-sm font-medium text-fg">Social links</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {SOCIAL_PLATFORMS.map((p) => (
            <Field key={p.id} label={p.label}>{(fp) => <Input {...fp} name={`social.${p.id}`} defaultValue={link(p.id)} placeholder={p.hosts[0] ? `${p.hosts[0]}/you` : 'https://…'} />}</Field>
          ))}
        </div>
        {err('socialLinks') ? <p className="mt-2 text-xs text-danger">{err('socialLinks')}</p> : null}
      </fieldset>
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>Save profile</Button>
      </div>
    </form>
  );
}
