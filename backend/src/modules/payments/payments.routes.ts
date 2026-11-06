import { Router, urlencoded } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { ah, ok, pageMeta, paginate, parse } from '../../common/http';
import { badRequest, conflict, forbidden, notFound } from '../../common/errors';
import { requireAuth, requireRole } from '../../middleware/auth';
import { getTeacherId } from '../../common/owners';
import { fromTiyin, toTiyin } from '../../common/money';
import { getSettings } from '../../lib/settings';
import { notify } from '../../lib/notify';
import { afterPaidNotify, assertPaymentOwner, createCheckout, markFailed, markPaid } from './payments.service';
import { paymeHandler } from './payme';
import { clickComplete, clickPrepare } from './click';

/** Provayder webhooklari — CSRF va cookie auth'siz, o'z imzosi bilan himoyalangan */
export const paymentWebhooksRouter = Router();
paymentWebhooksRouter.post('/payme', ah(async (req, res) => paymeHandler(req, res)));
paymentWebhooksRouter.post('/click/prepare', urlencoded({ extended: false }), ah(async (req, res) => clickPrepare(req, res)));
paymentWebhooksRouter.post('/click/complete', urlencoded({ extended: false }), ah(async (req, res) => clickComplete(req, res)));

export const paymentsRouter = Router();
paymentsRouter.use(requireAuth);

paymentsRouter.get('/providers', (_req, res) =>
  ok(res, {
    sandbox: env.PAYMENT_SANDBOX,
    payme: !!env.PAYME_MERCHANT_ID,
    click: !!env.CLICK_SERVICE_ID,
  }),
);

paymentsRouter.post(
  '/checkout',
  requireRole('STUDENT'),
  ah(async (req, res) => {
    const b = parse(z.object({ bookingId: z.string(), provider: z.enum(['sandbox', 'payme', 'click']) }), req.body);
    const r = await createCheckout(req.user!.id, b.bookingId, b.provider);
    ok(res, { paymentId: r.payment.id, redirectUrl: r.redirectUrl, amount: r.payment.amount });
  }),
);

/** Sandbox: test to'lov sahifasi natijasi. Faqat PAYMENT_SANDBOX=true bo'lganda va faqat server tomonda. */
paymentsRouter.post(
  '/sandbox/:id/complete',
  ah(async (req, res) => {
    if (!env.PAYMENT_SANDBOX) throw forbidden('SANDBOX_DISABLED');
    const b = parse(z.object({ success: z.boolean() }), req.body);
    const p = await prisma.payment.findUnique({ where: { id: req.params.id } });
    if (!p || p.userId !== req.user!.id || p.provider !== 'sandbox') throw notFound();
    if (!b.success) {
      await markFailed(p.id);
      return ok(res, { status: 'failed' });
    }
    await prisma.$transaction(async (tx) => {
      await tx.paymentTransaction.create({
        data: { paymentId: p.id, provider: 'sandbox', externalId: `sbx_${p.id}`, state: 2, amount: p.amount, performedAt: new Date() },
      });
      await markPaid(tx, p.id);
    });
    await afterPaidNotify(p.id);
    ok(res, { status: 'paid' });
  }),
);

paymentsRouter.get(
  '/',
  ah(async (req, res) => {
    const q = parse(z.object({ page: z.coerce.number().default(1), limit: z.coerce.number().max(100).default(20) }), req.query);
    const where = { userId: req.user!.id };
    const [items, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          booking: { select: { id: true, status: true, lesson: { select: { title: true } }, session: { select: { startAt: true } } } },
          refunds: { select: { id: true, amount: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        ...paginate(q.page, q.limit),
      }),
      prisma.payment.count({ where }),
    ]);
    ok(res, items, pageMeta(q.page, q.limit, total));
  }),
);

paymentsRouter.get(
  '/:id',
  ah(async (req, res) => ok(res, await assertPaymentOwner(req.user!.id, req.user!.role, req.params.id))),
);

/** Chek (kvitansiya) — chop etish uchun HTML */
paymentsRouter.get(
  '/:id/receipt',
  ah(async (req, res) => {
    const p = await assertPaymentOwner(req.user!.id, req.user!.role, req.params.id);
    const fmt = (d?: Date | null) =>
      d ? new Intl.DateTimeFormat('uz-UZ', { timeZone: 'Asia/Tashkent', dateStyle: 'long', timeStyle: 'short' }).format(d) : '—';
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
    const amount = Number(p.amount).toLocaleString('ru-RU');
    res.type('html').send(`<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>Chek ${p.receiptNo}</title>
<style>body{font-family:Inter,Arial,sans-serif;background:#F8FAFF;color:#111827;padding:32px}.c{max-width:520px;margin:auto;background:#fff;border-radius:20px;padding:28px;box-shadow:0 10px 30px rgba(109,40,217,.1)}
h1{color:#6D28D9;margin:0 0 4px}.m{color:#64748B;font-size:13px}table{width:100%;margin-top:18px;border-collapse:collapse}td{padding:9px 0;border-bottom:1px dashed #E5E7EB}td:last-child{text-align:right;font-weight:600}
.t{font-size:22px;color:#6D28D9}.s{display:inline-block;padding:4px 10px;border-radius:99px;background:#DCFCE7;color:#166534;font-size:12px;font-weight:700;text-transform:uppercase}@media print{button{display:none}}</style></head>
<body><div class="c"><h1>🎓 EduTutor</h1><div class="m">To'lov cheki / Квитанция об оплате</div>
<table><tr><td>Chek raqami</td><td>${p.receiptNo}</td></tr><tr><td>Holat</td><td><span class="s">${p.status}</span></td></tr>
<tr><td>To'lovchi</td><td>${esc(p.user.fullName)}</td></tr><tr><td>Dars</td><td>${esc(p.booking.lesson.title)}</td></tr>
<tr><td>O'qituvchi</td><td>${esc(p.booking.teacher.user.fullName)}</td></tr><tr><td>Dars vaqti</td><td>${fmt(p.booking.session.startAt)}</td></tr>
<tr><td>To'lov usuli</td><td>${p.provider.toUpperCase()}</td></tr><tr><td>To'langan vaqt</td><td>${fmt(p.paidAt)}</td></tr>
<tr><td>Summa</td><td class="t">${amount} so'm</td></tr></table>
<p class="m" style="margin-top:18px">Karta ma'lumotlari EduTutor serverlarida saqlanmaydi. Savollar: support@edututor.uz</p>
<button onclick="print()" style="margin-top:8px;padding:10px 18px;border:0;border-radius:12px;background:#6D28D9;color:#fff;font-weight:600;cursor:pointer">Chop etish</button></div></body></html>`);
  }),
);

/** Nizoli holat uchun pulni qaytarish so'rovi (masalan, o'qituvchi darsga kelmadi) — admin ko'rib chiqadi */
paymentsRouter.post(
  '/:id/refund-request',
  requireRole('STUDENT'),
  ah(async (req, res) => {
    const b = parse(z.object({ reason: z.string().min(10).max(1000) }), req.body);
    const p = await assertPaymentOwner(req.user!.id, req.user!.role, req.params.id);
    if (p.status !== 'paid') throw conflict('PAYMENT_STATE', 'Faqat to\'langan to\'lov uchun');
    if (p.refunds.some((r) => r.status === 'requested')) throw conflict('REFUND_EXISTS', 'So\'rov allaqachon yuborilgan');
    const r = await prisma.refund.create({
      data: { paymentId: p.id, amount: p.amount, reason: b.reason, requestedBy: req.user!.id },
    });
    // Nizo davomida daromad yechib olinmasligi uchun ushlab turiladi
    await prisma.teacherEarning.updateMany({ where: { paymentId: p.id, status: 'available', payoutId: null }, data: { status: 'held', availableAt: null } });
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
    await Promise.all(admins.map((a) => notify(a.id, 'system', 'Yangi qaytarish so\'rovi', p.receiptNo, '/admin/payments')));
    ok(res, r, undefined, 201);
  }),
);

/* ------------------------- O'qituvchi daromadi ------------------------- */

paymentsRouter.get(
  '/earnings/me',
  requireRole('TEACHER'),
  ah(async (req, res) => {
    const teacherId = await getTeacherId(req.user!.id);
    const [groups, items, payouts, profile] = await Promise.all([
      prisma.teacherEarning.groupBy({ by: ['status'], where: { teacherId }, _sum: { net: true, commission: true, gross: true } }),
      prisma.teacherEarning.findMany({
        where: { teacherId },
        include: {
          payment: {
            select: {
              receiptNo: true,
              paidAt: true,
              booking: { select: { lesson: { select: { title: true } }, student: { select: { fullName: true } }, session: { select: { startAt: true } } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.teacherPayout.findMany({ where: { teacherId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.teacherProfile.findUniqueOrThrow({ where: { id: teacherId }, select: { payoutCard: true } }),
    ]);
    const sum = (s: string) => Number(groups.find((g) => g.status === s)?._sum.net ?? 0);
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const month = await prisma.teacherEarning.aggregate({
      where: { teacherId, status: { not: 'reversed' }, createdAt: { gte: monthStart } },
      _sum: { net: true },
    });
    const settings = await getSettings();
    ok(res, {
      summary: {
        held: sum('held'),
        available: sum('available'),
        paidOut: sum('paid_out'),
        thisMonth: Number(month._sum.net ?? 0),
        commissionPercent: Number(settings.commissionPercent),
        minPayoutAmount: Number(settings.minPayoutAmount),
        payoutCard: profile.payoutCard,
      },
      items,
      payouts,
    });
  }),
);

paymentsRouter.post(
  '/payouts',
  requireRole('TEACHER'),
  ah(async (req, res) => {
    const teacherId = await getTeacherId(req.user!.id);
    const profile = await prisma.teacherProfile.findUniqueOrThrow({ where: { id: teacherId } });
    if (!profile.payoutCard) throw badRequest('NO_PAYOUT_CARD', 'Profilda karta raqamini kiriting');
    const min = Number((await getSettings()).minPayoutAmount);
    const payout = await prisma.$transaction(async (tx) => {
      const available = await tx.teacherEarning.findMany({ where: { teacherId, status: 'available', payoutId: null } });
      const total = available.reduce((a, e) => a + toTiyin(e.net), 0);
      if (total / 100 < min) throw badRequest('PAYOUT_MIN', `Minimal yechish summasi: ${min.toLocaleString('ru-RU')} so'm`);
      const p = await tx.teacherPayout.create({ data: { teacherId, amount: fromTiyin(total), destination: profile.payoutCard } });
      await tx.teacherEarning.updateMany({ where: { id: { in: available.map((e) => e.id) } }, data: { payoutId: p.id, status: 'paid_out' } });
      return p;
    });
    ok(res, payout, undefined, 201);
  }),
);
