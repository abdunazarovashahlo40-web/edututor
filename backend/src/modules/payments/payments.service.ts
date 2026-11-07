import { audit } from '../../lib/audit';
import type { PaymentProvider } from '@prisma/client';
import { prisma, type Tx } from '../../lib/prisma';
import { env } from '../../config/env';
import { receiptNumber } from '../../common/crypto';
import { fromTiyin, percentOf, splitCommission, toTiyin } from '../../common/money';
import { badRequest, conflict, forbidden, notFound } from '../../common/errors';
import { commissionPercent, getSettings } from '../../lib/settings';
import { notify } from '../../lib/notify';
import { sendMail } from '../../lib/mailer';
import { receiptMail } from '../../lib/receipt';

/**
 * Provayderdan mustaqil to'lov arxitekturasi:
 *   createCheckout() → provayder sahifasiga yo'naltirish URL
 *   markPaid()       → FAQAT server tomonda (webhook yoki sandbox tasdiqlash) chaqiriladi
 *   refundForBooking() → bekor qilish siyosati bo'yicha qaytarish
 */

export async function createCheckout(userId: string, bookingId: string, provider: PaymentProvider) {
  if (provider === 'sandbox' && !env.PAYMENT_SANDBOX) throw badRequest('SANDBOX_DISABLED');
  if (provider === 'payme' && !env.PAYME_MERCHANT_ID) throw badRequest('PROVIDER_DISABLED', 'Payme sozlanmagan');
  if (provider === 'click' && !env.CLICK_SERVICE_ID) throw badRequest('PROVIDER_DISABLED', 'Click sozlanmagan');
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { payments: true, session: true } });
  if (!booking || booking.studentId !== userId) throw notFound('BOOKING_NOT_FOUND');
  if (!['requested', 'confirmed'].includes(booking.status)) throw conflict('BOOKING_NOT_PAYABLE', 'Bu bron uchun to\'lov qilib bo\'lmaydi');
  if (booking.payments.some((p) => p.status === 'paid')) throw conflict('ALREADY_PAID', 'Allaqachon to\'langan');
  if (Number(booking.price) <= 0) throw badRequest('FREE_BOOKING', 'Bu dars bepul');

  let payment = booking.payments.find((p) => p.status === 'pending' && p.provider === provider);
  if (!payment) {
    // boshqa provayderdagi kutilayotgan to'lovlarni bekor qilamiz
    await prisma.payment.updateMany({ where: { bookingId, status: 'pending' }, data: { status: 'cancelled' } });
    payment = await prisma.payment.create({
      data: { userId, bookingId, amount: booking.price, provider, receiptNo: receiptNumber() },
    });
  }
  const returnUrl = `${env.APP_URL}/student/payments?paid=${payment.id}`;
  let redirectUrl: string;
  if (provider === 'payme') {
    const params = `m=${env.PAYME_MERCHANT_ID};ac.payment_id=${payment.id};a=${toTiyin(payment.amount)};c=${returnUrl}`;
    redirectUrl = `${env.PAYME_CHECKOUT_URL}/${Buffer.from(params).toString('base64')}`;
  } else if (provider === 'click') {
    const q = new URLSearchParams({
      service_id: env.CLICK_SERVICE_ID!,
      merchant_id: env.CLICK_MERCHANT_ID ?? '',
      amount: Number(payment.amount).toFixed(2),
      transaction_param: payment.id,
      return_url: returnUrl,
    });
    redirectUrl = `https://my.click.uz/services/pay?${q.toString()}`;
  } else {
    redirectUrl = `${env.APP_URL}/pay/sandbox/${payment.id}`;
  }
  return { payment, redirectUrl };
}

/** To'lovni muvaffaqiyatli deb belgilash (idempotent) + escrow daromad yozuvi */
export async function markPaid(tx: Tx, paymentId: string) {
  const p = await tx.payment.findUnique({ where: { id: paymentId }, include: { booking: true } });
  if (!p) throw notFound('PAYMENT_NOT_FOUND');
  if (p.status === 'paid') return p;
  if (!['pending', 'processing'].includes(p.status)) throw conflict('PAYMENT_STATE', `To'lov holati: ${p.status}`);
  const percent = await commissionPercent();
  const split = splitCommission(p.amount.toString(), percent);
  const updated = await tx.payment.update({ where: { id: p.id }, data: { status: 'paid', paidAt: new Date() } });
  await tx.teacherEarning.create({
    data: {
      teacherId: p.booking.teacherId,
      paymentId: p.id,
      gross: split.gross,
      commission: split.commission,
      net: split.net,
      status: 'held',
    },
  });
  return updated;
}

export async function afterPaidNotify(paymentId: string) {
  const p = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { booking: { include: { teacher: { select: { userId: true } }, lesson: { select: { title: true } } } } },
  });
  if (!p) return;
  await audit(null, 'payment.paid', 'Payment', p.id, { amount: p.amount.toString(), provider: p.provider }, p.userId);
  // Chek emailga — foydalanuvchi o'chirib qo'ymagan bo'lsa
  const prefs = (await prisma.user.findUnique({ where: { id: p.userId }, select: { notifyPrefs: true } }))?.notifyPrefs as { email?: boolean } | null;
  if (prefs?.email !== false) await sendReceiptEmail(p.id).catch(() => undefined);
  await notify(p.userId, 'payment.paid', 'To\'lov qabul qilindi', `${p.booking.lesson.title} — ${Number(p.amount).toLocaleString('ru-RU')} so'm`, `/student/payments?receipt=${p.id}`, { paymentId: p.id });
  await notify(
    p.booking.teacher.userId,
    'booking.new',
    'Yangi to\'langan bron',
    p.booking.lesson.title,
    '/teacher/bookings',
    { bookingId: p.bookingId },
  );
}

/** Chekni foydalanuvchi emailiga yuborish (to'lovdan keyin avtomatik yoki admin qayta yuboradi) */
export async function sendReceiptEmail(paymentId: string) {
  const p = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      user: { select: { fullName: true, email: true, locale: true, notifyPrefs: true } },
      booking: { include: { lesson: { select: { title: true } }, teacher: { select: { user: { select: { fullName: true } } } }, session: { select: { startAt: true } } } },
    },
  });
  if (!p?.user.email) return false;
  await sendMail(receiptMail(p.user.email, p, p.user.locale));
  return true;
}

export async function markFailed(paymentId: string, status: 'failed' | 'cancelled' = 'failed') {
  const p = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!p || p.status === 'paid' || p.status === 'refunded') return p;
  const u = await prisma.payment.update({ where: { id: paymentId }, data: { status } });
  if (status === 'failed') await notify(p.userId, 'payment.failed', 'To\'lov amalga oshmadi', undefined, '/student/payments');
  return u;
}

/**
 * Bron bekor bo'lganda pulni qaytarish.
 * - Sandbox / manual: darhol "processed"
 * - Payme / Click: "approved" holatida yaratiladi, admin provayder kabinetida qaytarib "processed" qiladi
 *   (Payme'da bajarilgan tranzaksiyani bekor qilish provayder tomonidan CancelTransaction orqali keladi)
 */
export async function refundForBooking(tx: Tx, bookingId: string, percent: number, requestedBy: string, reason: string) {
  const payment = await tx.payment.findFirst({ where: { bookingId, status: 'paid' }, include: { earning: true } });
  if (!payment) return null;
  const amount = percentOf(payment.amount.toString(), percent);
  const auto = payment.provider === 'sandbox' || payment.provider === 'manual';
  let refund = null;
  if (percent > 0) {
    refund = await tx.refund.create({
      data: {
        paymentId: payment.id,
        amount,
        reason,
        requestedBy,
        status: auto ? 'processed' : 'approved',
        processedAt: auto ? new Date() : null,
      },
    });
  }
  if (percent >= 100) {
    await tx.payment.update({ where: { id: payment.id }, data: { status: 'refunded' } });
    if (payment.earning) await tx.teacherEarning.update({ where: { id: payment.earning.id }, data: { status: 'reversed' } });
  } else if (payment.earning) {
    // Kech bekor qilish: qolgan qismi o'qituvchiga kompensatsiya sifatida darhol beriladi
    const keep = toTiyin(payment.amount) - toTiyin(amount);
    const split = splitCommission(fromTiyin(keep), await commissionPercent());
    await tx.teacherEarning.update({
      where: { id: payment.earning.id },
      data: { gross: split.gross, commission: split.commission, net: split.net, status: 'available', availableAt: new Date() },
    });
  }
  return refund;
}

/** Dars tugaganda — daromad ushlab turish muddatidan keyin yechib olishga ochiladi */
export async function releaseEarningOnComplete(tx: Tx, bookingId: string) {
  const payment = await tx.payment.findFirst({ where: { bookingId, status: 'paid' }, include: { earning: true } });
  if (!payment?.earning || payment.earning.status !== 'held') return;
  const hold = Number((await getSettings()).earningHoldHours ?? 24);
  await tx.teacherEarning.update({
    where: { id: payment.earning.id },
    data: { availableAt: new Date(Date.now() + hold * 3600_000) },
  });
}

export async function assertPaymentOwner(userId: string, role: string, paymentId: string) {
  const p = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      booking: {
        include: {
          lesson: { select: { title: true, type: true, durationMin: true } },
          session: { select: { startAt: true } },
          teacher: { select: { user: { select: { fullName: true } } } },
        },
      },
      user: { select: { fullName: true, email: true, locale: true } },
      refunds: true,
    },
  });
  if (!p) throw notFound('PAYMENT_NOT_FOUND');
  if (role !== 'ADMIN' && p.userId !== userId) throw forbidden();
  return p;
}
