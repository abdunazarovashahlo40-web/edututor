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
  const n = await prisma.notification.create({
    data: { userId, type, title, body, link, data: (data ?? undefined) as any },
  });
  emitToUser(userId, 'notification', n);
  return n;
}
