import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ah, ok, pageMeta, paginate, parse } from '../../common/http';
import { badRequest, conflict, notFound } from '../../common/errors';
import { requireAuth, requireRole } from '../../middleware/auth';
import { audit } from '../../lib/audit';
import { notify } from '../../lib/notify';
import { getSettings, invalidateSettings } from '../../lib/settings';
import { invalidateSubjects } from '../subjects/subjects.routes';
import { recomputeRating } from '../reviews/reviews.routes';
import { mountAdminExtra } from './admin.extra.routes';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('ADMIN'));
// batafsil ko'rinishlar va foydalanuvchi nomidan amallar (oldin ro'yxatdan keyin emas — '/users/:id' tartibi muhim emas)
mountAdminExtra(adminRouter);

const pq = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().max(80).optional(),
  status: z.string().optional(),
  role: z.string().optional(),
  user: z.string().max(40).optional(), // bitta foydalanuvchiga tegishli yozuvlar
  provider: z.string().optional(),
});

/* ------------------------------ Statistika ------------------------------ */
adminRouter.get(
  '/stats',
  ah(async (_req, res) => {
    const since = new Date(Date.now() - 30 * 86400_000);
    const [roles, pendingTeachers, lessons, bookings, bookingGroups, payGroups, revenue, newUsers, openComplaints, refundRequests] =
      await Promise.all([
        prisma.user.groupBy({ by: ['role'], where: { deletedAt: null }, _count: { _all: true } }),
        prisma.teacherProfile.count({ where: { verification: 'PENDING' } }),
        prisma.lesson.count({ where: { deletedAt: null } }),
        prisma.booking.count(),
        prisma.booking.groupBy({ by: ['status'], _count: { _all: true } }),
        prisma.payment.groupBy({ by: ['status'], _count: { _all: true }, _sum: { amount: true } }),
        prisma.teacherEarning.aggregate({ where: { status: { not: 'reversed' } }, _sum: { commission: true, gross: true } }),
        prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, role: true } }),
        prisma.complaint.count({ where: { status: { in: ['open', 'in_review'] } } }),
        prisma.refund.count({ where: { status: 'requested' } }),
      ]);
    const days: { date: string; students: number; teachers: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      const list = newUsers.filter((u) => u.createdAt.toISOString().slice(0, 10) === d);
      days.push({ date: d, students: list.filter((u) => u.role === 'STUDENT').length, teachers: list.filter((u) => u.role === 'TEACHER').length });
    }
    // Oxirgi 6 oy: oyma-oy tushum (to'langan summa) va platforma ulushi
    const sixAgo = new Date();
    sixAgo.setUTCMonth(sixAgo.getUTCMonth() - 5, 1);
    sixAgo.setUTCHours(0, 0, 0, 0);
    const earnings = await prisma.teacherEarning.findMany({
      where: { status: { not: 'reversed' }, createdAt: { gte: sixAgo } },
      select: { createdAt: true, gross: true, commission: true },
    });
    const months: { month: string; gross: number; commission: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(sixAgo);
      d.setUTCMonth(sixAgo.getUTCMonth() + i);
      const key = d.toISOString().slice(0, 7);
      const list = earnings.filter((e) => e.createdAt.toISOString().slice(0, 7) === key);
      months.push({ month: key, gross: list.reduce((a, e) => a + Number(e.gross), 0), commission: list.reduce((a, e) => a + Number(e.commission), 0) });
    }
    const r = (role: string) => roles.find((x) => x.role === role)?._count._all ?? 0;
    ok(res, {
      totalUsers: roles.reduce((a, x) => a + x._count._all, 0),
      students: r('STUDENT'),
      teachers: r('TEACHER'),
      admins: r('ADMIN'),
      pendingTeachers,
      lessons,
      bookings,
      completedLessons: bookingGroups.find((g) => g.status === 'completed')?._count._all ?? 0,
      bookingStatus: bookingGroups.map((g) => ({ status: g.status, count: g._count._all })),
      payments: payGroups.map((g) => ({ status: g.status, count: g._count._all, amount: Number(g._sum.amount ?? 0) })),
      platformRevenue: Number(revenue._sum.commission ?? 0),
      grossVolume: Number(revenue._sum.gross ?? 0),
      openComplaints,
      refundRequests,
      growth: days,
      revenueByMonth: months,
    });
  }),
);

/* ------------------------------ Foydalanuvchilar ------------------------------ */
adminRouter.get(
  '/users',
  ah(async (req, res) => {
    const q = parse(pq, req.query);
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(q.role ? { role: q.role as any } : {}),
      ...(q.status ? { status: q.status as any } : {}),
      ...(q.q
        ? { OR: [{ fullName: { contains: q.q, mode: 'insensitive' } }, { email: { contains: q.q, mode: 'insensitive' } }, { phone: { contains: q.q } }] }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, fullName: true, email: true, phone: true, role: true, status: true, avatarUrl: true, createdAt: true, lastLoginAt: true,
          teacherProfile: { select: { id: true, verification: true } },
        },
        orderBy: { createdAt: 'desc' },
        ...paginate(q.page, q.limit),
      }),
      prisma.user.count({ where }),
    ]);
    ok(res, items, pageMeta(q.page, q.limit, total));
  }),
);

adminRouter.patch(
  '/users/:id/status',
  ah(async (req, res) => {
    const b = parse(z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']), reason: z.string().max(300).optional() }), req.body);
    if (req.params.id === req.user!.id) throw badRequest('SELF_ACTION', 'O\'zingizni bloklay olmaysiz');
    const u = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!u) throw notFound();
    if (u.role === 'ADMIN') throw badRequest('ADMIN_PROTECTED', 'Adminni bu yerda bloklab bo\'lmaydi');
    await prisma.$transaction([
      prisma.user.update({ where: { id: u.id }, data: { status: b.status } }),
      ...(b.status === 'SUSPENDED'
        ? [prisma.authSession.updateMany({ where: { userId: u.id, revokedAt: null }, data: { revokedAt: new Date() } })]
        : []),
    ]);
    await audit(req, b.status === 'SUSPENDED' ? 'user.suspend' : 'user.activate', 'User', u.id, { reason: b.reason });
    ok(res, { status: b.status });
  }),
);

/* ------------------------------ O'qituvchi tekshiruvi ------------------------------ */
adminRouter.get(
  '/teachers',
  ah(async (req, res) => {
    const q = parse(pq.extend({ verification: z.string().optional() }), req.query);
    const where: Prisma.TeacherProfileWhereInput = {
      user: { deletedAt: null, ...(q.q ? { fullName: { contains: q.q, mode: 'insensitive' } } : {}) },
      ...(q.verification ? { verification: q.verification as any } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.teacherProfile.findMany({
        where,
        include: {
          user: { select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true, status: true, createdAt: true } },
          subjects: { include: { subject: true } },
          certificates: true,
        },
        orderBy: { updatedAt: 'desc' },
        ...paginate(q.page, q.limit),
      }),
      prisma.teacherProfile.count({ where }),
    ]);
    ok(res, items.map(({ identityHash, ...t }) => ({ ...t, hasIdentity: !!identityHash })), pageMeta(q.page, q.limit, total));
  }),
);

adminRouter.post(
  '/teachers/:id/verify',
  ah(async (req, res) => {
    const b = parse(z.object({ decision: z.enum(['APPROVED', 'REJECTED']), note: z.string().max(500).optional() }), req.body);
    if (b.decision === 'REJECTED' && !b.note) throw badRequest('NOTE_REQUIRED', 'Rad etish sababini yozing');
    const t = await prisma.teacherProfile.findUnique({ where: { id: req.params.id } });
    if (!t) throw notFound();
    await prisma.teacherProfile.update({
      where: { id: t.id },
      data: { verification: b.decision, verificationNote: b.note ?? null, verifiedAt: b.decision === 'APPROVED' ? new Date() : null },
    });
    await audit(req, `teacher.${b.decision.toLowerCase()}`, 'TeacherProfile', t.id, { note: b.note });
    await notify(
      t.userId,
      'teacher.verification',
      b.decision === 'APPROVED' ? 'Profilingiz tasdiqlandi! 🎉' : 'Profilingiz rad etildi',
      b.decision === 'APPROVED' ? 'Endi darslaringiz o\'quvchilarga ko\'rinadi' : b.note,
      '/teacher/profile',
    );
    ok(res, { verification: b.decision });
  }),
);

/* ------------------------------ Fanlar ------------------------------ */
const subjectSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/).max(60),
  nameUz: z.string().min(2).max(80),
  nameRu: z.string().min(2).max(80),
  nameEn: z.string().min(2).max(80),
  category: z.string().max(40).default('general'),
  icon: z.string().max(40).optional().nullable(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

adminRouter.get('/subjects', ah(async (_req, res) => ok(res, await prisma.subject.findMany({ orderBy: { sortOrder: 'asc' }, include: { _count: { select: { teachers: true, lessons: true } } } }))));

adminRouter.post(
  '/subjects',
  ah(async (req, res) => {
    const s = await prisma.subject.create({ data: parse(subjectSchema, req.body) });
    invalidateSubjects();
    await audit(req, 'subject.create', 'Subject', s.id);
    ok(res, s, undefined, 201);
  }),
);

adminRouter.patch(
  '/subjects/:id',
  ah(async (req, res) => {
    const s = await prisma.subject.update({ where: { id: req.params.id }, data: parse(subjectSchema.partial(), req.body) });
    invalidateSubjects();
    await audit(req, 'subject.update', 'Subject', s.id);
    ok(res, s);
  }),
);

adminRouter.delete(
  '/subjects/:id',
  ah(async (req, res) => {
    const used = await prisma.lesson.count({ where: { subjectId: req.params.id } });
    if (used) {
      await prisma.subject.update({ where: { id: req.params.id }, data: { isActive: false } });
    } else {
      await prisma.subject.delete({ where: { id: req.params.id } });
    }
    invalidateSubjects();
    await audit(req, 'subject.delete', 'Subject', req.params.id, { deactivatedOnly: !!used });
    ok(res, { deleted: !used, deactivated: !!used });
  }),
);

/* ------------------------------ Darslar va bronlar ------------------------------ */
adminRouter.get(
  '/lessons',
  ah(async (req, res) => {
    const q = parse(pq, req.query);
    const where: Prisma.LessonWhereInput = {
      deletedAt: null,
      ...(q.status ? { status: q.status as any } : {}),
      ...(q.q ? { title: { contains: q.q, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.lesson.findMany({
        where,
        include: { subject: { select: { nameUz: true, nameRu: true, nameEn: true } }, teacher: { select: { id: true, user: { select: { fullName: true } } } }, _count: { select: { bookings: true } } },
        orderBy: { createdAt: 'desc' },
        ...paginate(q.page, q.limit),
      }),
      prisma.lesson.count({ where }),
    ]);
    ok(res, items, pageMeta(q.page, q.limit, total));
  }),
);

adminRouter.patch(
  '/lessons/:id/status',
  ah(async (req, res) => {
    const b = parse(z.object({ status: z.enum(['published', 'draft', 'cancelled']), reason: z.string().max(300).optional() }), req.body);
    const l = await prisma.lesson.update({ where: { id: req.params.id }, data: { status: b.status }, include: { teacher: true } });
    await audit(req, 'lesson.moderate', 'Lesson', l.id, b);
    if (b.status !== 'published') await notify(l.teacher.userId, 'system', 'Darsingiz moderatsiyadan o\'tmadi', `${l.title}${b.reason ? ': ' + b.reason : ''}`, '/teacher/lessons');
    ok(res, l);
  }),
);

adminRouter.get(
  '/bookings',
  ah(async (req, res) => {
    const q = parse(pq, req.query);
    const and: Prisma.BookingWhereInput[] = [];
    if (q.status) and.push({ status: q.status as any });
    if (q.user) and.push({ OR: [{ studentId: q.user }, { teacher: { userId: q.user } }] });
    if (q.q) and.push({ OR: [{ lesson: { title: { contains: q.q, mode: 'insensitive' } } }, { student: { fullName: { contains: q.q, mode: 'insensitive' } } }, { teacher: { user: { fullName: { contains: q.q, mode: 'insensitive' } } } }] });
    const where: Prisma.BookingWhereInput = and.length ? { AND: and } : {};
    const [items, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          student: { select: { fullName: true } },
          teacher: { select: { user: { select: { fullName: true } } } },
          lesson: { select: { title: true, type: true } },
          session: { select: { startAt: true } },
          payments: { select: { status: true, amount: true } },
        },
        orderBy: { createdAt: 'desc' },
        ...paginate(q.page, q.limit),
      }),
      prisma.booking.count({ where }),
    ]);
    ok(res, items, pageMeta(q.page, q.limit, total));
  }),
);

/* ------------------------------ To'lovlar, qaytarishlar, payoutlar ------------------------------ */
adminRouter.get(
  '/payments',
  ah(async (req, res) => {
    const q = parse(pq, req.query);
    const where: Prisma.PaymentWhereInput = {
      ...(q.status ? { status: q.status as any } : {}),
      ...(q.provider ? { provider: q.provider as any } : {}),
      ...(q.user ? { userId: q.user } : {}),
      ...(q.q ? { OR: [{ receiptNo: { contains: q.q, mode: 'insensitive' } }, { user: { fullName: { contains: q.q, mode: 'insensitive' } } }] } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: { user: { select: { id: true, fullName: true } }, booking: { select: { id: true, lesson: { select: { title: true } } } }, refunds: true },
        orderBy: { createdAt: 'desc' },
        ...paginate(q.page, q.limit),
      }),
      prisma.payment.count({ where }),
    ]);
    ok(res, items, pageMeta(q.page, q.limit, total));
  }),
);

adminRouter.get(
  '/refunds',
  ah(async (req, res) => {
    const q = parse(pq, req.query);
    const where: Prisma.RefundWhereInput = q.status ? { status: q.status as any } : {};
    const items = await prisma.refund.findMany({
      where,
      include: { payment: { include: { user: { select: { fullName: true } }, booking: { select: { lesson: { select: { title: true } } } } } } },
      orderBy: { createdAt: 'desc' },
      ...paginate(q.page, q.limit),
    });
    ok(res, items);
  }),
);

adminRouter.post(
  '/refunds/:id/decide',
  ah(async (req, res) => {
    const b = parse(z.object({ approve: z.boolean(), note: z.string().max(300).optional() }), req.body);
    const r = await prisma.refund.findUnique({ where: { id: req.params.id }, include: { payment: true } });
    if (!r) throw notFound();
    if (!['requested', 'approved'].includes(r.status)) throw conflict('REFUND_STATE');
    await prisma.$transaction(async (tx) => {
      if (!b.approve) {
        await tx.refund.update({ where: { id: r.id }, data: { status: 'rejected', processedBy: req.user!.id, processedAt: new Date() } });
        await tx.teacherEarning.updateMany({ where: { paymentId: r.paymentId, status: 'held' }, data: { availableAt: new Date() } });
        return;
      }
      await tx.refund.update({ where: { id: r.id }, data: { status: 'processed', processedBy: req.user!.id, processedAt: new Date() } });
      const full = Number(r.amount) >= Number(r.payment.amount);
      if (full) {
        await tx.payment.update({ where: { id: r.paymentId }, data: { status: 'refunded' } });
        await tx.teacherEarning.updateMany({ where: { paymentId: r.paymentId, payoutId: null }, data: { status: 'reversed' } });
      }
    });
    await audit(req, b.approve ? 'refund.approve' : 'refund.reject', 'Refund', r.id, { amount: r.amount.toString(), note: b.note });
    await notify(r.payment.userId, 'payment.refunded', b.approve ? 'Pul qaytarildi' : 'Qaytarish so\'rovi rad etildi', b.note, '/student/payments');
    ok(res, { done: true });
  }),
);

adminRouter.get(
  '/payouts',
  ah(async (req, res) => {
    const q = parse(pq, req.query);
    ok(
      res,
      await prisma.teacherPayout.findMany({
        where: q.status ? { status: q.status as any } : {},
        include: { teacher: { select: { user: { select: { fullName: true } } } } },
        orderBy: { createdAt: 'desc' },
        ...paginate(q.page, q.limit),
      }),
    );
  }),
);

adminRouter.post(
  '/payouts/:id/decide',
  ah(async (req, res) => {
    const b = parse(z.object({ status: z.enum(['paid', 'rejected']) }), req.body);
    const p = await prisma.teacherPayout.findUnique({ where: { id: req.params.id }, include: { teacher: true } });
    if (!p || !['requested', 'processing'].includes(p.status)) throw notFound();
    await prisma.$transaction([
      prisma.teacherPayout.update({ where: { id: p.id }, data: { status: b.status, processedAt: new Date() } }),
      ...(b.status === 'rejected'
        ? [prisma.teacherEarning.updateMany({ where: { payoutId: p.id }, data: { payoutId: null, status: 'available' } })]
        : []),
    ]);
    await audit(req, `payout.${b.status}`, 'TeacherPayout', p.id, { amount: p.amount.toString() });
    await notify(p.teacher.userId, 'system', b.status === 'paid' ? 'Pul kartangizga o\'tkazildi' : 'Pul yechish rad etildi', `${Number(p.amount).toLocaleString('ru-RU')} so'm`, '/teacher/earnings');
    ok(res, { status: b.status });
  }),
);

/* ------------------------------ Sharhlar va shikoyatlar ------------------------------ */
adminRouter.get(
  '/reviews',
  ah(async (req, res) => {
    const q = parse(pq.extend({ reported: z.enum(['true', 'false']).optional() }), req.query);
    const where: Prisma.ReviewWhereInput = q.reported === 'true' ? { reportCount: { gt: 0 } } : {};
    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: { student: { select: { fullName: true } }, teacher: { select: { user: { select: { fullName: true } } } } },
        orderBy: [{ reportCount: 'desc' }, { createdAt: 'desc' }],
        ...paginate(q.page, q.limit),
      }),
      prisma.review.count({ where }),
    ]);
    ok(res, items, pageMeta(q.page, q.limit, total));
  }),
);

adminRouter.patch(
  '/reviews/:id',
  ah(async (req, res) => {
    const b = parse(z.object({ isHidden: z.boolean() }), req.body);
    const r = await prisma.$transaction(async (tx) => {
      const rv = await tx.review.update({ where: { id: req.params.id }, data: { isHidden: b.isHidden, ...(b.isHidden ? {} : { reportCount: 0 }) } });
      await recomputeRating(tx, rv.teacherId);
      return rv;
    });
    await audit(req, b.isHidden ? 'review.hide' : 'review.restore', 'Review', r.id);
    ok(res, r);
  }),
);

adminRouter.get(
  '/complaints',
  ah(async (req, res) => {
    const q = parse(pq, req.query);
    const where: Prisma.ComplaintWhereInput = q.status ? { status: q.status as any } : {};
    const [items, total] = await Promise.all([
      prisma.complaint.findMany({ where, include: { author: { select: { fullName: true, role: true } } }, orderBy: { createdAt: 'desc' }, ...paginate(q.page, q.limit) }),
      prisma.complaint.count({ where }),
    ]);
    ok(res, items, pageMeta(q.page, q.limit, total));
  }),
);

adminRouter.patch(
  '/complaints/:id',
  ah(async (req, res) => {
    const b = parse(z.object({ status: z.enum(['open', 'in_review', 'resolved', 'rejected']), resolution: z.string().max(1000).optional() }), req.body);
    const c = await prisma.complaint.update({ where: { id: req.params.id }, data: { ...b, resolvedBy: req.user!.id } });
    await audit(req, 'complaint.update', 'Complaint', c.id, b);
    if (['resolved', 'rejected'].includes(b.status)) await notify(c.authorId, 'system', 'Shikoyatingiz ko\'rib chiqildi', b.resolution);
    ok(res, c);
  }),
);

/* ------------------------------ Sozlamalar va audit ------------------------------ */
adminRouter.get('/settings', ah(async (_req, res) => ok(res, await getSettings())));

adminRouter.put(
  '/settings',
  ah(async (req, res) => {
    const b = parse(
      z.object({
        commissionPercent: z.number().min(0).max(50).optional(),
        trialDiscountPercent: z.number().min(0).max(100).optional(),
        autoCancelUnpaidMinutes: z.number().int().min(10).max(1440).optional(),
        earningHoldHours: z.number().int().min(0).max(720).optional(),
        minPayoutAmount: z.number().min(0).optional(),
      }),
      req.body,
    );
    const before = await getSettings();
    await prisma.$transaction(
      Object.entries(b).map(([key, value]) =>
        prisma.platformSetting.upsert({ where: { key }, create: { key, value: value as any }, update: { value: value as any } }),
      ),
    );
    invalidateSettings();
    await audit(req, 'settings.update', 'PlatformSetting', null, { before, after: b });
    ok(res, await getSettings());
  }),
);

adminRouter.get(
  '/audit-logs',
  ah(async (req, res) => {
    const q = parse(pq.extend({ action: z.string().optional() }), req.query);
    const where: Prisma.AuditLogWhereInput = q.action ? { action: { contains: q.action } } : {};
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({ where, include: { actor: { select: { fullName: true, role: true } } }, orderBy: { createdAt: 'desc' }, ...paginate(q.page, q.limit) }),
      prisma.auditLog.count({ where }),
    ]);
    ok(res, items, pageMeta(q.page, q.limit, total));
  }),
);
