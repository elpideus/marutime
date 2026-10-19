import { getActiveDevices } from '@marutime/core';
import { getDb } from '@marutime/db';
import { apiError, apiJson, assertPublicApi } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await assertPublicApi(request);
    return apiJson({ items: await getActiveDevices(getDb()) });
  } catch (err) {
    return apiError(err);
  }
}
