/**
 * Fon vazifalari (har daqiqa), Redis'siz. Supabase pooler (transaction mode) bilan session-level
 * advisory lock ishonchsiz bo'lgani uchun: jobs faqat RUN_JOBS!=false bo'lgan BITTA instansiyada ishlaydi.
 */
import { prisma } from './lib/prisma';
import { notify } from './lib/notify';
import { getSettings } from './lib/settings';
import { cancelBookingInternal, completeBooking } from './modules/bookings/bookings.service';

let running = false;

async function withLock(fn: () => Promise<void>) {
  if (running) return;
  running = true;
  try {
    await fn();
  } finally {
    running = false;
  }
}

export async function runJobs() {
  const settings = await getSettings();
  const now = new Date();

  // 1) To'lanmagan bron so'rovlarini bekor qilish (slotni bo'shatish)
  const unpaidCutoff = new Date(now.getTime() - Number(settings.autoCancelUnpaidMinutes) * 60_000);
  const unpaid = await prisma.booking.findMany({
    where: { status: 'requested', price: { gt: 0 }, createdAt: { lt: unpaidCutoff }, payments: { none: { status: { in: ['paid', 'processing'] } } } },
    select: { id: true },
    take: 50,
  });
  for (const b of unpaid) await cancelBookingInternal(b.id, 'system', null, 'To\'lov o\'z vaqtida qilinmadi').catch(() => undefined);

  // 2) O'qituvchi javob bermagan so'rovlar — dars boshlanishiga 1 soat qolganda rad etiladi (100% qaytariladi)
  const stale = await prisma.booking.findMany({
    where: { status: 'requested', session: { startAt: { lt: new Date(now.getTime() + 60 * 60_000) } } },
    select: { id: true },
    take: 50,
  });
  for (const b of stale) await cancelBookingInternal(b.id, 'system', null, 'O\'qituvchi javob bermadi', true).catch(() => undefined);

  // 3) Dars eslatmalari (1 soat oldin)
  const soon = await prisma.lessonSession.findMany({
    where: { status: 'scheduled', remindedAt: null, startAt: { gt: now, lt: new Date(now.getTime() + 60 * 60_000) } },
    include: { lesson: { select: { title: true } }, teacher: { select: { userId: true } }, bookings: { where: { status: 'confirmed' }, select: { studentId: true } } },
    take: 100,
  });
  for (const s of soon) {
    if (!s.bookings.length) continue;
    const users = [s.teacher.userId, ...s.bookings.map((b) => b.studentId)];
    await Promise.all(users.map((u) => notify(u, 'lesson.reminder', 'Dars 1 soatdan keyin boshlanadi', s.lesson.title, `/room/${s.id}`)));
    await prisma.lessonSession.update({ where: { id: s.id }, data: { remindedAt: now } });
  }

  // 4) Yakunlanmay qolgan darslar — tugaganidan 24 soat o'tgach avtomatik "completed"
  const forgotten = await prisma.booking.findMany({
    where: { status: 'confirmed', session: { endAt: { lt: new Date(now.getTime() - 24 * 3600_000) } } },
    select: { id: true },
    take: 50,
  });
  for (const b of forgotten) await completeBooking(b.id, null).catch(() => undefined);

  // 5) Escrow: ushlab turish muddati tugagan daromadlar yechib olishga ochiladi
  await prisma.teacherEarning.updateMany({
    where: { status: 'held', availableAt: { lte: now } },
    data: { status: 'available' },
  });

  // 6) Eski OTP va sessiyalarni tozalash
  await prisma.otpCode.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 86400_000) } } });
  await prisma.authSession.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 7 * 86400_000) } } });
}

export function startJobs() {
  const tick = () =>
    withLock(runJobs).catch((e) => {
      console.error('[jobs]', e);
    });
  setTimeout(tick, 10_000);
  return setInterval(tick, 60_000);
}
