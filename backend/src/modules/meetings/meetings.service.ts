import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { randomToken } from '../../common/crypto';
import { badRequest, forbidden, notFound } from '../../common/errors';

const EARLY_JOIN_MIN = 15;
const LATE_JOIN_MIN = 30;

/**
 * Faqat ruxsat etilgan ishtirokchilar dars xonasiga kira oladi:
 *  - shu sessiyaning o'qituvchisi
 *  - tasdiqlangan (confirmed) va (pullik bo'lsa) to'langan bronga ega o'quvchi
 * Xona kaliti (roomKey) tasodifiy va hech qachon ochiq ro'yxatlarda ko'rsatilmaydi.
 */
export async function authorizeSession(userId: string, role: string, sessionId: string) {
  const s = await prisma.lessonSession.findUnique({
    where: { id: sessionId },
    include: {
      lesson: { select: { id: true, title: true, type: true, meetingMethod: true } },
      teacher: { select: { userId: true, user: { select: { fullName: true, avatarUrl: true } } } },
      bookings: {
        where: { status: { in: ['confirmed', 'completed'] } },
        include: {
          student: { select: { id: true, fullName: true, avatarUrl: true } },
          payments: { where: { status: 'paid' }, select: { id: true } },
        },
      },
    },
  });
  if (!s) throw notFound('SESSION_NOT_FOUND');
  const isTeacher = s.teacher.userId === userId;
  const booking = s.bookings.find((b) => b.studentId === userId);
  if (!isTeacher && role !== 'ADMIN') {
    if (!booking) throw forbidden('NOT_PARTICIPANT', 'Siz bu darsning ishtirokchisi emassiz');
    if (Number(booking.price) > 0 && !booking.payments.length) throw forbidden('NOT_PAID', 'Dars uchun to\'lov qilinmagan');
  }
  if (s.status === 'cancelled') throw badRequest('SESSION_CANCELLED', 'Dars bekor qilingan');
  const now = Date.now();
  const opensAt = s.startAt.getTime() - EARLY_JOIN_MIN * 60_000;
  const closesAt = s.endAt.getTime() + LATE_JOIN_MIN * 60_000;
  if (!isTeacher && role !== 'ADMIN' && (now < opensAt || now > closesAt)) {
    throw forbidden('ROOM_CLOSED', 'Xona darsdan 15 daqiqa oldin ochiladi');
  }
  return { session: s, isTeacher, booking, opensAt, closesAt };
}

export async function getOrCreateMeeting(sessionId: string, method: string) {
  const existing = await prisma.meeting.findUnique({ where: { sessionId } });
  if (existing) return existing;
  const roomKey = randomToken(18);
  const provider = method === 'jitsi' || env.VIDEO_PROVIDER === 'jitsi' ? 'jitsi' : 'webrtc';
  return prisma.meeting.upsert({
    where: { sessionId },
    create: {
      sessionId,
      roomKey,
      provider,
      externalUrl: provider === 'jitsi' ? `${env.JITSI_BASE_URL}/EduTutor-${roomKey}` : null,
    },
    update: {},
  });
}

export function iceServers() {
  const servers: { urls: string | string[]; username?: string; credential?: string }[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];
  if (env.TURN_URL) {
    servers.push({ urls: env.TURN_URL.split(','), username: env.TURN_USERNAME, credential: env.TURN_CREDENTIAL });
  }
  return servers;
}

export async function authorizeRoomKey(userId: string, role: string, roomKey: string) {
  const m = await prisma.meeting.findUnique({ where: { roomKey } });
  if (!m) throw notFound('ROOM_NOT_FOUND');
  const a = await authorizeSession(userId, role, m.sessionId);
  return { meeting: m, ...a };
}
