'use server';

import {
  addListItem,
  createList,
  deleteList,
  errors,
  getListRow,
  isAppError,
  listHref,
  regenerateShareToken,
  removeListItem,
  reorderListItems,
  toggleListLike,
  updateList,
  updateListItemNote,
  type ListInput,
} from '@marutime/core';
import { getDb } from '@marutime/db';
import { redirect, unstable_rethrow } from 'next/navigation';
import { run, type ActionResult } from '@/lib/action';
import { getCurrentUser } from '@/lib/session';

async function me() {
  const user = await getCurrentUser();
  if (!user) throw errors.unauthorized();
  return user;
}

export type ListFormState = { error?: string; details?: Record<string, string[]> } | null;

function parseListForm(formData: FormData): ListInput {
  return {
    title: String(formData.get('title') ?? ''),
    description: String(formData.get('description') ?? '') || null,
    visibility: (String(formData.get('visibility') ?? 'public') as ListInput['visibility']) ?? 'public',
    isRanked: formData.get('isRanked') === 'true' || formData.get('isRanked') === 'on',
  };
}

export async function createListAction(_prev: ListFormState, formData: FormData): Promise<ListFormState> {
  let href = '/lists';
  try {
    const user = await me();
    const list = await createList(getDb(), user, parseListForm(formData));
    const mediaId = Number(formData.get('mediaId'));
    if (mediaId) await addListItem(getDb(), user, list.id, mediaId);
    href = listHref(user, list);
  } catch (err) {
    unstable_rethrow(err);
    if (isAppError(err)) return { error: err.message, details: err.details };
    console.error(err);
    return { error: 'Could not create the list.' };
  }
  redirect(href);
}

export async function updateListAction(listId: string, _prev: ListFormState, formData: FormData): Promise<ListFormState> {
  let href = '/lists';
  try {
    const user = await me();
    const list = await updateList(getDb(), user, listId, parseListForm(formData));
    href = listHref(user.id === list.ownerId ? user : { username: String(formData.get('ownerUsername') ?? user.username) }, list);
  } catch (err) {
    unstable_rethrow(err);
    if (isAppError(err)) return { error: err.message, details: err.details };
    console.error(err);
    return { error: 'Could not save the list.' };
  }
  redirect(href);
}

export async function deleteListAction(listId: string): Promise<void> {
  const user = await me();
  await deleteList(getDb(), user, listId);
  redirect(`/u/${user.username}/lists`);
}

export async function quickCreateListAction(title: string, mediaId: number | null, visibility: ListInput['visibility'] = 'public'): Promise<ActionResult<{ id: string; href: string }>> {
  return run(async () => {
    const user = await me();
    const list = await createList(getDb(), user, { title, visibility });
    if (mediaId) await addListItem(getDb(), user, list.id, mediaId);
    return { id: list.id, href: listHref(user, list) };
  });
}

export async function toggleListItemAction(listId: string, mediaId: number, contains: boolean): Promise<ActionResult<{ contains: boolean }>> {
  return run(async () => {
    const user = await me();
    if (contains) await removeListItem(getDb(), user, listId, mediaId);
    else await addListItem(getDb(), user, listId, mediaId);
    return { contains: !contains };
  });
}

export async function removeListItemAction(listId: string, mediaId: number): Promise<ActionResult> {
  return run(async () => {
    const user = await me();
    await removeListItem(getDb(), user, listId, mediaId);
  });
}

export async function reorderListAction(listId: string, orderedMediaIds: number[]): Promise<ActionResult> {
  return run(async () => {
    const user = await me();
    await reorderListItems(getDb(), user, listId, orderedMediaIds);
  });
}

export async function updateListItemNoteAction(listId: string, mediaId: number, note: string | null): Promise<ActionResult> {
  return run(async () => {
    const user = await me();
    await updateListItemNote(getDb(), user, listId, mediaId, note);
  });
}

export async function toggleListLikeAction(listId: string): Promise<ActionResult<{ liked: boolean; likeCount: number }>> {
  return run(async () => {
    const user = await me();
    return toggleListLike(getDb(), user.id, listId);
  });
}

export async function regenerateShareTokenAction(listId: string): Promise<ActionResult<{ token: string }>> {
  return run(async () => {
    const user = await me();
    const list = await getListRow(getDb(), listId);
    if (!list) throw errors.notFound('List');
    return { token: await regenerateShareToken(getDb(), user, listId) };
  });
}
