import { prisma } from '../../lib/prisma';
import { badRequest, conflict, forbidden, notFound } from '../../common/errors';
import { refundPercent } from '../../common/money';
import { fitsAvailability } from '../../common/time';
import { notify } from '../../lib/notify';
import { assertFree, createSessionSafe, lockTeacher, TX_OPTS } from '../lessons/scheduling';
import { markPaid, refundForBooking, releaseEarningOnComplete } from '../payments/payments.service';

const MIN_LEAD_MIN = 120;

const fmt = (d: Date) =>
  new Intl.DateTimeFormat('uz-UZ', { timeZone: 'Asia/Tashkent', dateStyle: 'medium', timeStyle: 'short' }).format(d);

/** O'quvchi dars bron qiladi. Individual/sinov/konsultatsiya — slot tanlanadi; guruh — mavjud sessiya. */
export async function createBooking(
  studentId: string,
  input: { lessonId: string; startAt?: string; sessionId?: string; note?: string },
) {
  const lesson = await prisma.lesson.findFirst({
    where: { id: input.lessonId, status: 'published', deletedAt: null },
    include: { teacher: { include: { availability: true, user: { select: { id: true, status: true } } } } },
  });
  if (!lesson) throw notFound('LESSON_NOT_FOUND', 'Dars topilmadi');
  if (lesson.teacher.verification !== 'APPROVED' || lesson.teacher.user.status !== 'ACTIVE') throw badRequest('TEACHER_UNAVAILABLE');
  if (lesson.teacher.userId === studentId) throw forbidden('OWN_LESSON');

  if (lesson.type === 'TRIAL') {
    const prev = await prisma.booking.count({
      where: { studentId, teacherId: lesson.teacherId, lesson: { type: 'TRIAL' }, status: { notIn: ['cancelled', 'rejected'] } },
    });
    if (prev) throw conflict('TRIAL_USED', 'Bu o\'qituvchi bilan sinov darsidan foydalangansiz');
  }

  const booking = await prisma.$transaction(async (tx) => {
    let sessionId = input.sessionId;
    if (lesson.type === 'GROUP' || input.sessionId) {
      if (!sessionId) throw badRequest('SESSION_REQUIRED', 'Guruh darsi uchun sanani tanlang');
      await lockTeacher(tx, lesson.teacherId);
      const s = await tx.lessonSession.findFirst({ where: { id: sessionId, lessonId: lesson.id, status: 'scheduled' } });
      if (!s) throw notFound('SESSION_NOT_FOUND');
      if (s.startAt.getTime() - Date.now() < 30 * 60_000) throw badRequest('TOO_LATE', 'Bron qilish vaqti o\'tgan');
      const taken = await tx.booking.count({ where: { sessionId: s.id, status: { in: ['requested', 'confirmed'] } } });
      if (taken >= s.capacity) throw conflict('SESSION_FULL', 'Guruhda joy qolmagan');
    } else {
      if (!input.startAt) throw badRequest('START_REQUIRED', 'Vaqtni tanlang');
      const startAt = new Date(input.startAt);
      const endAt = new Date(startAt.getTime() + lesson.durationMin * 60_000);
      if (startAt.getTime() - Date.now() < MIN_LEAD_MIN * 60_000) {
        throw badRequest('TOO_SOON', 'Darsni kamida 2 soat oldin bron qiling');
      }
      if (!fitsAvailability(lesson.teacher.availability, startAt, endAt)) {
        throw badRequest('OUTSIDE_AVAILABILITY', 'Tanlangan vaqt o\'qituvchi jadvalida yo\'q');
      }
      // O'quvchining o'zi ham shu vaqtda boshqa darsda bo'lmasligi kerak
      const studentClash = await tx.booking.findFirst({
        where: {
          studentId,
          status: { in: ['requested', 'confirmed'] },
          session: { startAt: { lt: endAt }, endAt: { gt: startAt } },
        },
      });
      if (studentClash) throw conflict('STUDENT_BUSY', 'Bu vaqtda sizda boshqa dars bor');
      const s = await createSessionSafe(tx, { teacherId: lesson.teacherId, lessonId: lesson.id, startAt, endAt, capacity: 1 });
      sessionId = s.id;
    }
    const b = await tx.booking.create({
      data: {
        studentId,
        teacherId: lesson.teacherId,
        lessonId: lesson.id,
        sessionId: sessionId!,
        price: lesson.price,
        note: input.note,
        participants: { create: [{ userId: studentId }] },
      },
      include: { session: true, lesson: { select: { title: true } } },
    });
    return b;
  }, TX_OPTS);

  const free = Number(booking.price) <= 0;
  if (free) {
    await notify(lesson.teacher.userId, 'booking.new', 'Yangi bron so\'rovi', `${booking.lesson.title} · ${fmt(booking.session.startAt)}`, '/teacher/bookings', { bookingId: booking.id });
  }
  return { booking, needsPayment: !free };
}

async function loadForActor(bookingId: string) {
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      session: true,
      lesson: { select: { title: true, type: true, durationMin: true } },
      teacher: { select: { userId: true, availability: true } },
      payments: { where: { status: 'paid' } },
    },
  });
  if (!b) throw notFound('BOOKING_NOT_FOUND');
  return b;
}

export async function confirmBooking(bookingId: string, teacherUserId: string) {
  const b = await loadForActor(bookingId);
  if (b.teacher.userId !== teacherUserId) throw forbidden('NOT_OWNER');
  if (b.status !== 'requested') throw conflict('BOOKING_STATE', `Holat: ${b.status}`);
  if (Number(b.price) > 0 && !b.payments.length) throw conflict('PAYMENT_REQUIRED', 'O\'quvchi hali to\'lov qilmagan');
  const updated = await prisma.booking.update({ where: { id: b.id }, data: { status: 'confirmed', confirmedAt: new Date() } });
  await notify(b.studentId, 'booking.confirmed', 'Dars tasdiqlandi', `${b.lesson.title} · ${fmt(b.session.startAt)}`, '/student/lessons', { bookingId: b.id });
  return updated;
}

/**
 * Bekor qilish / rad etish. Pul qaytarish siyosati refundPercent() da.
 * actor: kim bekor qildi. reject=true — o'qituvchi so'rovni rad etdi.
 */
export async function cancelBookingInternal(
  bookingId: string,
  actor: 'student' | 'teacher' | 'admin' | 'system',
  actorUserId: string | null,
  reason?: string,
  reject = false,
) {
  const b = await loadForActor(bookingId);
  if (!['requested', 'confirmed'].includes(b.status)) throw conflict('BOOKING_STATE', `Holat: ${b.status}`);
  const percent = refundPercent(actor === 'student' ? 'student' : 'teacher', b.session.startAt);
  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: b.id },
      data: {
        status: reject ? 'rejected' : 'cancelled',
        cancelledAt: new Date(),
        cancelReason: reason,
        cancelledById: actorUserId,
      },
    });
    await refundForBooking(tx, b.id, percent, actorUserId ?? 'system', reason ?? 'cancel');
    await tx.payment.updateMany({ where: { bookingId: b.id, status: 'pending' }, data: { status: 'cancelled' } });
    // Sessiyada boshqa faol bron qolmasa va u individual bo'lsa — vaqtni bo'shatamiz
    const left = await tx.booking.count({ where: { sessionId: b.sessionId, status: { in: ['requested', 'confirmed'] } } });
    if (!left && b.lesson.type !== 'GROUP') {
      await tx.lessonSession.update({ where: { id: b.sessionId }, data: { status: 'cancelled' } });
    }
  }, TX_OPTS);

  const when = fmt(b.session.startAt);
  if (actor === 'student') {
    await notify(b.teacher.userId, 'booking.cancelled', 'O\'quvchi darsni bekor qildi', `${b.lesson.title} · ${when}`, '/teacher/bookings', { bookingId: b.id });
  } else {
    await notify(
      b.studentId,
      reject ? 'booking.rejected' : 'booking.cancelled',
      reject ? 'Bron rad etildi' : 'Dars bekor qilindi',
      `${b.lesson.title} · ${when}${b.payments.length ? ' — to\'lov qaytariladi' : ''}`,
      '/student/lessons',
      { bookingId: b.id },
    );
  }
  return { refundPercent: b.payments.length ? percent : 0 };
}

/** Individual darsni boshqa vaqtga ko'chirish. To'lov yangi bronga o'tadi. */
export async function rescheduleBooking(bookingId: string, actorUserId: string, startAtIso: string) {
  const b = await loadForActor(bookingId);
  const isStudent = b.studentId === actorUserId;
  const isTeacher = b.teacher.userId === actorUserId;
  if (!isStudent && !isTeacher) throw forbidden();
  if (!['requested', 'confirmed'].includes(b.status)) throw conflict('BOOKING_STATE');
  if (b.lesson.type === 'GROUP') throw badRequest('GROUP_RESCHEDULE', 'Guruh darsini ko\'chirib bo\'lmaydi');
  if (isStudent && b.session.startAt.getTime() - Date.now() < 12 * 3600_000) {
    throw badRequest('TOO_LATE', 'Darsdan 12 soatdan kam qolganda ko\'chirib bo\'lmaydi');
  }
  const startAt = new Date(startAtIso);
  const endAt = new Date(startAt.getTime() + b.lesson.durationMin * 60_000);
  if (startAt.getTime() - Date.now() < MIN_LEAD_MIN * 60_000) throw badRequest('TOO_SOON');
  if (isStudent && !fitsAvailability(b.teacher.availability, startAt, endAt)) throw badRequest('OUTSIDE_AVAILABILITY');

  const nb = await prisma.$transaction(async (tx) => {
    await lockTeacher(tx, b.teacherId);
    await tx.lessonSession.update({ where: { id: b.sessionId }, data: { status: 'cancelled' } });
    await assertFree(tx, b.teacherId, startAt, endAt);
    const s = await tx.lessonSession.create({
      data: { teacherId: b.teacherId, lessonId: b.lessonId, startAt, endAt, capacity: 1 },
    });
    await tx.booking.update({ where: { id: b.id }, data: { status: 'rescheduled' } });
    const created = await tx.booking.create({
      data: {
        studentId: b.studentId,
        teacherId: b.teacherId,
        lessonId: b.lessonId,
        sessionId: s.id,
        price: b.price,
        note: b.note,
        rescheduleFromId: b.id,
        // o'qituvchi ko'chirsa — avtomatik tasdiqlanadi; o'quvchi ko'chirsa — o'qituvchi tasdiqlaydi
        status: isTeacher ? 'confirmed' : 'requested',
        confirmedAt: isTeacher ? new Date() : null,
        participants: { create: [{ userId: b.studentId }] },
      },
    });
    await tx.payment.updateMany({ where: { bookingId: b.id, status: { in: ['paid', 'pending'] } }, data: { bookingId: created.id } });
    return created;
  }, TX_OPTS);

  const target = isStudent ? b.teacher.userId : b.studentId;
  await notify(target, 'booking.rescheduled', 'Dars vaqti o\'zgardi', `${b.lesson.title}: ${fmt(b.session.startAt)} → ${fmt(startAt)}`, isStudent ? '/teacher/bookings' : '/student/lessons', { bookingId: nb.id });
  return nb;
}

export async function completeBooking(bookingId: string, actorUserId: string | null, noShow = false) {
  const b = await loadForActor(bookingId);
  if (actorUserId && b.teacher.userId !== actorUserId) throw forbidden('NOT_OWNER');
  if (b.status !== 'confirmed') throw conflict('BOOKING_STATE', `Holat: ${b.status}`);
  if (b.session.startAt > new Date()) throw badRequest('NOT_STARTED', 'Dars hali boshlanmagan');
  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: b.id },
      data: { status: noShow ? 'no_show' : 'completed', completedAt: new Date() },
    });
    await releaseEarningOnComplete(tx, b.id);
    if (!noShow) await tx.teacherProfile.update({ where: { id: b.teacherId }, data: { lessonsCompleted: { increment: 1 } } });
    const open = await tx.booking.count({ where: { sessionId: b.sessionId, status: { in: ['requested', 'confirmed'] } } });
    if (!open) await tx.lessonSession.update({ where: { id: b.sessionId }, data: { status: 'completed', endedAt: new Date() } });
  }, TX_OPTS);
  if (!noShow) {
    await notify(b.studentId, 'booking.completed', 'Dars yakunlandi — baho qo\'ying', b.lesson.title, `/student/lessons?review=${b.id}`, { bookingId: b.id });
  }
}

/** O'qituvchi dars yakunida qisqa xulosa yozadi (nima o'tildi, uyga vazifa, keyingi qadam) */
export async function saveLessonSummary(bookingId: string, teacherUserId: string, summary: string) {
  const b = await loadForActor(bookingId);
  if (b.teacher.userId !== teacherUserId) throw forbidden('NOT_OWNER');
  if (!['completed', 'confirmed'].includes(b.status)) throw conflict('BOOKING_STATE', `Holat: ${b.status}`);
  if (b.session.startAt > new Date()) throw badRequest('NOT_STARTED', 'Dars hali boshlanmagan');
  const first = !b.lessonSummary;
  const updated = await prisma.booking.update({ where: { id: b.id }, data: { lessonSummary: summary.trim() } });
  if (first) {
    await notify(b.studentId, 'booking.summary', 'O\'qituvchi dars xulosasini yozdi', b.lesson.title, '/student/lessons', { bookingId: b.id });
  }
  return updated;
}

export const GUARANTEE_HOURS = 24;

/**
 * Sinov darsi kafolati: sinov darsi yoqmasa, o'quvchi 24 soat ichida pulini to'liq qaytarib oladi.
 * Har bir o'quvchi uchun bir marta. Daromad hali "held" (ushlab turilgan) bo'lgandagina ishlaydi.
 */
export async function claimTrialGuarantee(bookingId: string, studentId: string, reason: string) {
  const b = await loadForActor(bookingId);
  if (b.studentId !== studentId) throw forbidden('NOT_OWNER');
  if (b.lesson.type !== 'TRIAL') throw badRequest('NOT_TRIAL', 'Kafolat faqat sinov darsiga amal qiladi');
  if (b.status !== 'completed' || !b.completedAt) throw conflict('BOOKING_STATE', 'Dars hali yakunlanmagan');
  if (Date.now() - b.completedAt.getTime() > GUARANTEE_HOURS * 3600_000) {
    throw badRequest('GUARANTEE_EXPIRED', `Kafolat muddati (${GUARANTEE_HOURS} soat) o'tgan`);
  }
  const payment = await prisma.payment.findFirst({ where: { bookingId: b.id, status: 'paid' }, include: { earning: true } });
  if (!payment) throw badRequest('NOTHING_TO_REFUND', 'Bu dars uchun to\'lov topilmadi');
  if (payment.earning && payment.earning.status !== 'held') throw badRequest('GUARANTEE_EXPIRED', 'Kafolat muddati o\'tgan');
  const used = await prisma.refund.count({ where: { requestedBy: studentId, reason: { startsWith: 'trial_guarantee' } } });
  if (used) throw conflict('GUARANTEE_USED', 'Sinov darsi kafolatidan avval foydalangansiz');

  await prisma.$transaction(async (tx) => {
    await refundForBooking(tx, b.id, 100, studentId, `trial_guarantee: ${reason.slice(0, 250)}`);
  }, TX_OPTS);
  await notify(b.teacher.userId, 'booking.guarantee', 'Sinov darsi kafolati ishlatildi', `${b.lesson.title}: o'quvchi to'lovni qaytarib oldi`, '/teacher/bookings', { bookingId: b.id });
  return { refunded: true };
}

export { markPaid };
