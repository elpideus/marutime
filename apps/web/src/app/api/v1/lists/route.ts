import { getUserLists } from '@marutime/core';
import { getDb } from '@marutime/db';
import { apiError, apiJson, authenticateApi } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { user } = await authenticateApi(request, 'read');
    return apiJson({ items: await getUserLists(getDb(), user.id, user) });
  } catch (err) {
    return apiError(err);
  }
}
