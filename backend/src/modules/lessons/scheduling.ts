import { Prisma } from '@prisma/client';
import type { Tx } from '../../lib/prisma';
import { conflict } from '../../common/errors';

/**
 * O'qituvchi uchun sessiya yaratish — double booking'ning 3 qatlamli himoyasi:
 *  1) pg_advisory_xact_lock — bitta o'qituvchi uchun parallel tranzaksiyalar navbatga turadi
 *  2) kesishmani SELECT orqali tekshirish (aniq xato xabari uchun)
 *  3) DB'dagi EXCLUDE USING gist cheklovi (constraints.sql) — oxirgi kafolat
 */
export async function lockTeacher(tx: Tx, teacherId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${teacherId}))`;
}

export async function assertFree(tx: Tx, teacherId: string, startAt: Date, endAt: Date, exceptSessionId?: string) {
  const clash = await tx.lessonSession.findFirst({
    where: {
      teacherId,
      status: { in: ['scheduled', 'in_progress'] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
      ...(exceptSessionId ? { NOT: { id: exceptSessionId } } : {}),
    },
    select: { id: true },
  });
  if (clash) throw conflict('SLOT_TAKEN', 'Bu vaqt allaqachon band');
}

export async function createSessionSafe(
  tx: Tx,
  data: { teacherId: string; lessonId: string; startAt: Date; endAt: Date; capacity: number },
) {
  await lockTeacher(tx, data.teacherId);
  await assertFree(tx, data.teacherId, data.startAt, data.endAt);
  return tx.lessonSession.create({ data });
}

export const TX_OPTS = { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000 };
