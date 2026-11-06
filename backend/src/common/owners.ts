import { prisma } from '../lib/prisma';
import { forbidden } from './errors';

/** Joriy foydalanuvchining TeacherProfile id'si */
export async function getTeacherId(userId: string) {
  const t = await prisma.teacherProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!t) throw forbidden('NOT_TEACHER');
  return t.id;
}

/** Tasdiqlangan o'qituvchi bo'lishi shart bo'lgan amallar uchun */
export async function getApprovedTeacherId(userId: string) {
  const t = await prisma.teacherProfile.findUnique({ where: { userId }, select: { id: true, verification: true } });
  if (!t) throw forbidden('NOT_TEACHER');
  if (t.verification !== 'APPROVED') throw forbidden('TEACHER_NOT_VERIFIED', 'Profilingiz hali tasdiqlanmagan');
  return t.id;
}
