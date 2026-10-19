import { buildUserExport, logAudit, recordExportRequest } from '@marutime/core';
import { getDb } from '@marutime/db';
import { NextResponse } from 'next/server';
import { getCurrentUser, isStaff } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Staff export of a user's data, e.g. to answer a data subject request by email. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUser();
  if (!actor || !isStaff(actor)) return NextResponse.json({ error: 'Staff only' }, { status: 403 });
  const { id } = await ctx.params;
  const db = getDb();
  try {
    const data = await buildUserExport(db, id);
    const body = JSON.stringify(data, null, 2);
    await recordExportRequest(db, id, actor.id, Buffer.byteLength(body));
    await logAudit(db, { actorId: actor.id, action: 'user.export', targetType: 'user', targetId: id });
    return new NextResponse(body, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="marutime-user-${id}.json"`, 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
}
