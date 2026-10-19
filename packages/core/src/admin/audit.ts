import { hashIp } from '@marutime/auth';
import { auditLogs, type DbExecutor } from '@marutime/db';

export type AuditInput = {
  actorId: string | null;
  action: string;
  targetType?: string;
  targetId?: string | number;
  meta?: Record<string, unknown>;
  ip?: string | null;
};

export async function logAudit(db: DbExecutor, input: AuditInput): Promise<void> {
  await db.insert(auditLogs).values({
    actorId: input.actorId,
    action: input.action,
    targetType: input.targetType ?? null,
    targetId: input.targetId !== undefined ? String(input.targetId) : null,
    meta: input.meta ?? {},
    ipHash: hashIp(input.ip),
  });
}
