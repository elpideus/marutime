'use server';

import {
  allowedImagePrefixes,
  createComment,
  deleteComment,
  editComment,
  errors,
  reportContent,
  setCommentHidden,
  toggleCommentLike,
  type CommentTarget,
  type CommentView,
  type CreateCommentInput,
  type ReportInput,
} from '@marutime/core';
import { getDb } from '@marutime/db';
import { getStorage } from '@marutime/storage';
import { run, type ActionResult } from '@/lib/action';
import { getCurrentUser } from '@/lib/session';

async function me() {
  const user = await getCurrentUser();
  if (!user) throw errors.unauthorized();
  return user;
}

export async function createCommentAction(target: CommentTarget, input: CreateCommentInput): Promise<ActionResult<CommentView>> {
  return run(async () => {
    const user = await me();
    return createComment(getDb(), user, target, input, { allowedImagePrefixes: allowedImagePrefixes(getStorage()) });
  });
}

export async function toggleCommentLikeAction(commentId: string): Promise<ActionResult<{ liked: boolean; likeCount: number }>> {
  return run(async () => {
    const user = await me();
    return toggleCommentLike(getDb(), user.id, commentId);
  });
}

export async function editCommentAction(commentId: string, input: { body: string; isSpoiler?: boolean }): Promise<ActionResult> {
  return run(async () => {
    const user = await me();
    await editComment(getDb(), user.id, commentId, input);
  });
}

export async function deleteCommentAction(commentId: string): Promise<ActionResult> {
  return run(async () => {
    const user = await me();
    await deleteComment(getDb(), user, commentId);
  });
}

export async function hideCommentAction(commentId: string, hidden: boolean, reason?: string): Promise<ActionResult> {
  return run(async () => {
    const user = await me();
    await setCommentHidden(getDb(), user, commentId, hidden, reason);
  });
}

export async function reportContentAction(input: ReportInput): Promise<ActionResult> {
  return run(async () => {
    const user = await me();
    await reportContent(getDb(), user, input);
  });
}
