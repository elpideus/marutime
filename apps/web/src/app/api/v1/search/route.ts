import { searchMedia } from '@marutime/core';
import { apiError, apiJson, authenticateApi } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await authenticateApi(request, 'read');
    const url = new URL(request.url);
    const q = url.searchParams.get('q') ?? '';
    const type = url.searchParams.get('type');
    const page = Number(url.searchParams.get('page') ?? 1);
    const res = await searchMedia(q, { type: type === 'show' || type === 'movie' ? type : 'all', page });
    return apiJson(res);
  } catch (err) {
    return apiError(err);
  }
}
