'use client';

import type { UserRole } from '@marutime/config';
import type { AdminUserRow } from '@marutime/core';
import { Button, Dialog, Field, Input, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, Select, useToast } from '@marutime/ui';
import { Ellipsis } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { adminDeleteUserAction, adminSetPasswordAction, adminSetRoleAction, adminSuspendAction, adminUnsuspendAction, adminVerifyEmailAction } from '@/actions/admin';

export function UserActions({ user, actorRole, actorId }: { user: AdminUserRow; actorRole: UserRole; actorId: string }) {
  const [dialog, setDialog] = useState<null | 'suspend' | 'password' | 'delete' | 'role'>(null);
  const [value, setValue] = useState('');
  const [role, setRole] = useState<UserRole>(user.role);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const isAdmin = actorRole === 'admin';
  const self = user.id === actorId;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    start(async () => {
      const r = await fn();
      if (!r.ok) toast({ tone: 'error', title: r.error ?? 'Failed' });
      else {
        toast({ tone: 'success', title: success });
        setDialog(null);
        setValue('');
        router.refresh();
      }
    });
  };

  return (
    <>
      <Menu>
        <MenuTrigger>
          {(props) => (
            <Button variant="ghost" size="icon-sm" {...props} aria-label="User actions" tooltip="Role, suspension, password, export, delete">
              <Ellipsis className="size-4" />
            </Button>
          )}
        </MenuTrigger>
        <MenuContent>
          <MenuLabel>@{user.username}</MenuLabel>
          <MenuItem onSelect={() => router.push(`/u/${user.username}`)}>View profile</MenuItem>
          <MenuItem onSelect={() => window.open(`/api/admin/users/${user.id}/export`, '_blank')}>Export data (JSON)</MenuItem>
          {isAdmin ? <MenuItem onSelect={() => setDialog('role')}>Change role</MenuItem> : null}
          {isAdmin && !user.emailVerifiedAt ? <MenuItem onSelect={() => run(() => adminVerifyEmailAction(user.id), 'Email marked verified')}>Mark email verified</MenuItem> : null}
          {isAdmin ? <MenuItem onSelect={() => setDialog('password')}>Set temporary password</MenuItem> : null}
          <MenuSeparator />
          {!self ? (
            user.status === 'suspended' ? (
              <MenuItem onSelect={() => run(() => adminUnsuspendAction(user.id), 'Account reinstated')}>Reinstate</MenuItem>
            ) : (
              <MenuItem destructive onSelect={() => setDialog('suspend')}>Suspend</MenuItem>
            )
          ) : null}
          {isAdmin && !self ? <MenuItem destructive onSelect={() => setDialog('delete')}>Delete account</MenuItem> : null}
        </MenuContent>
      </Menu>

      <Dialog open={dialog === 'suspend'} onClose={() => setDialog(null)} title={`Suspend @${user.username}`} size="sm" footer={<><Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button><Button variant="danger" loading={pending} onClick={() => run(() => adminSuspendAction(user.id, value || null), 'Account suspended')}>Suspend</Button></>}>
        <Field label="Reason shown to the user" hint="Optional.">{(p) => <Input {...p} value={value} onChange={(e) => setValue(e.target.value)} />}</Field>
      </Dialog>
      <Dialog open={dialog === 'password'} onClose={() => setDialog(null)} title="Set a temporary password" description="Share it with the user through a channel you trust. All their sessions will be signed out." size="sm" footer={<><Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button><Button loading={pending} onClick={() => run(() => adminSetPasswordAction(user.id, value), 'Password set')}>Set password</Button></>}>
        <Field label="New password" hint="At least 10 characters.">{(p) => <Input {...p} value={value} onChange={(e) => setValue(e.target.value)} type="text" autoComplete="off" />}</Field>
      </Dialog>
      <Dialog open={dialog === 'role'} onClose={() => setDialog(null)} title="Change role" size="sm" footer={<><Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button><Button loading={pending} onClick={() => run(() => adminSetRoleAction(user.id, role), 'Role updated')}>Save</Button></>}>
        <Field label="Role">{(p) => (<Select {...p} value={role} onChange={(e) => setRole(e.target.value as UserRole)}><option value="user">User</option><option value="moderator">Moderator</option><option value="admin">Admin</option></Select>)}</Field>
      </Dialog>
      <Dialog open={dialog === 'delete'} onClose={() => setDialog(null)} title={`Delete @${user.username}`} description="Permanent. Everything they created is erased." size="sm" footer={<><Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button><Button variant="danger" loading={pending} disabled={value.trim().length < 3} onClick={() => run(() => adminDeleteUserAction(user.id, value), 'Account deleted')}>Delete forever</Button></>}>
        <Field label="Reason (recorded in the audit log)">{(p) => <Input {...p} value={value} onChange={(e) => setValue(e.target.value)} />}</Field>
      </Dialog>
    </>
  );
}
