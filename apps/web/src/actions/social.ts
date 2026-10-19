'use server';

import { errors, followUser, markNotificationsRead, unfollowUser } from '@marutime/core';
import { getDb } from '@marutime/db';
import { run, type ActionResult } from '@/lib/action';
import { getCurrentUser } from '@/lib/session';

async function me() {
  const user = await getCurrentUser();
  if (!user) throw errors.unauthorized();
  return user;
}

export async function toggleFollowAction(userId: string, following: boolean): Promise<ActionResult<{ following: boolean }>> {
  return run(async () => {
    const user = await me();
    if (following) await unfollowUser(getDb(), user.id, userId);
    else await followUser(getDb(), user.id, userId);
    return { following: !following };
  });
}

export async function markNotificationsReadAction(ids?: string[]): Promise<ActionResult> {
  return run(async () => {
    const user = await me();
    await markNotificationsRead(getDb(), user.id, ids);
  });
}
