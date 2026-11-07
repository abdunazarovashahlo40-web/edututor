import { prisma } from './prisma';
import { emitToUser } from './realtime';

/**
 * Bildirishnoma yaratish: in-app (DB + Socket.IO realtime).
 * Email/SMS/Push kanallari uchun `channels` kengaytiriladi (SMS-ready, Push-ready arxitektura).
 */
export type NotificationType =
  | 'booking.new'
  | 'booking.confirmed'
  | 'booking.rejected'
  | 'booking.cancelled'
  | 'booking.rescheduled'
  | 'booking.completed'
  | 'booking.summary'
  | 'booking.guarantee'
  | 'lesson.reminder'
  | 'payment.paid'
  | 'payment.failed'
  | 'payment.refunded'
  | 'homework.assigned'
  | 'homework.submitted'
  | 'homework.reviewed'
  | 'message.new'
  | 'teacher.verification'
  | 'review.new'
  | 'system';

export async function notify(
  userId: string,
  type: NotificationType,
  title: string,
  body?: string,
  link?: string,
  data?: Record<string, unknown>,
) {
  // Foydalanuvchi sozlamalari: eslatma va xabar bildirishnomalarini o'chirib qo'yishi mumkin
  if (type === 'lesson.reminder' || type === 'message.new') {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { notifyPrefs: true } });
    const prefs = (u?.notifyPrefs ?? {}) as { reminders?: boolean; messages?: boolean };
    if (type === 'lesson.reminder' && prefs.reminders === false) return null;
    if (type === 'message.new' && prefs.messages === false) return null;
  }
  const n = await prisma.notification.create({
    data: { userId, type, title, body, link, data: (data ?? undefined) as any },
  });
  emitToUser(userId, 'notification', n);
  return n;
}
