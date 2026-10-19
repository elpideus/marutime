import { getLibrary, getUpcoming, getWatchNext } from '@marutime/core';
import { getDb } from '@marutime/db';
import { apiError, apiJson, authenticateApi } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { user } = await authenticateApi(request, 'read');
    const db = getDb();
    const include = new URL(request.url).searchParams.get('include') ?? 'next,upcoming';
    const [watchNext, upcoming, library] = await Promise.all([
      include.includes('next') ? getWatchNext(db, user.id) : Promise.resolve([]),
      include.includes('upcoming') ? getUpcoming(db, user.id) : Promise.resolve([]),
      include.includes('library') ? getLibrary(db, user.id) : Promise.resolve([]),
    ]);
    return apiJson({ watchNext, upcoming, library });
  } catch (err) {
    return apiError(err);
  }
}
