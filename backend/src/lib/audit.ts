import type { Request } from 'express';
import { prisma } from './prisma';

export async function audit(
  req: Request | null,
  action: string,
  entityType: string,
  entityId?: string | null,
  meta?: Record<string, unknown>,
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: req?.user?.id ?? null,
        action,
        entityType,
        entityId: entityId ?? null,
        meta: (meta ?? undefined) as any,
        ip: req?.ip ?? null,
      },
    });
  } catch (e) {
    console.error('audit failed', e);
  }
}
