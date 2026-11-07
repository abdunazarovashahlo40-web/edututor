/**
 * Admin paneli: batafsil ko'rinishlar va foydalanuvchi nomidan bajariladigan amallar.
 * Har bir o'zgartirish audit jurnaliga yoziladi.
 */
import type { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ah, ok, pageMeta, paginate, parse } from '../../common/http';
import { badRequest, conflict, notFound } from '../../common/errors';
import { randomToken } from '../../common/crypto';
import { audit } from '../../lib/audit';
import { notify } from '../../lib/notify';
import { sendReceiptEmail } from '../payments/payments.service';
import { hashPassword } from '../auth/auth.service';

const phoneRe = /^\+998\d{9}$/;

export function mountAdminExtra(adminRouter: Router) {
  /* ------------------------------ Foydalanuvchi: batafsil ------------------------------ */
  adminRouter.get(
    '/users/:id',
    ah(async (req, res) => {
      const u = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: {
          id: true, fullName: true, email: true, phone: true, role: true, status: true, locale: true, avatarUrl: true,
          emailVerifiedAt: true, failedLogins: true, lockedUntil: true, lastLoginAt: true, createdAt: true, deletedAt: true,
          googleId: true, telegramId: true,
          studentProfile: true,
          teacherProfile: { select: { id: true, verification: true, headline: true, hourlyPrice: true, ratingAvg: true, ratingCount: true, lessonsCompleted: true } },
          devices: { select: { id: true, name: true, pinHash: true, credentialId: true, lastUsedAt: true, createdAt: true } },
          sessions: { where: { revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, userAgent: true, ip: true, lastActiveAt: true, createdAt: true }, orderBy: { lastActiveAt: 'desc' } },
        },
      });
      if (!u) throw notFound();
      const [bookings, paid, complaints, logs] = await Promise.all([
        prisma.booking.groupBy({ by: ['status'], where: { OR: [{ studentId: u.id }, { teacher: { userId: u.id } }] }, _count: { _all: true } }),
        prisma.payment.aggregate({ where: { userId: u.id, status: 'paid' }, _sum: { amount: true }, _count: { _all: true } }),
        prisma.complaint.count({ where: { authorId: u.id } }),
        prisma.auditLog.findMany({
          where: { OR: [{ actorId: u.id }, { entityId: u.id }] },
          orderBy: { createdAt: 'desc' },
          take: 15,
          select: { id: true, action: true, createdAt: true, ip: true, actor: { select: { fullName: true } } },
        }),
      ]);
      ok(res, {
        ...u,
        devices: u.devices.map(({ pinHash, credentialId, ...d }) => ({ ...d, hasPin: !!pinHash, hasBiometric: !!credentialId })),
        stats: {
          bookings: bookings.map((b) => ({ status: b.status, count: b._count._all })),
          paidCount: paid._count._all,
          paidSum: Number(paid._sum.amount ?? 0),
          complaints,
        },
        logs,
      });
    }),
  );

  /** Admin foydalanuvchi ma'lumotlarini tahrirlaydi (foydalanuvchi o'zi qila oladigan hamma narsa) */
  adminRouter.patch(
    '/users/:id',
    ah(async (req, res) => {
      const b = parse(
        z.object({
          fullName: z.string().trim().min(2).max(80).optional(),
          email: z.string().trim().email().max(160).nullable().optional(),
          phone: z.string().regex(phoneRe, 'PHONE_INVALID').nullable().optional(),
          locale: z.enum(['uz', 'ru', 'en']).optional(),
          student: z.object({ grade: z.string().max(40).nullable().optional(), goals: z.string().max(500).nullable().optional(), city: z.string().max(80).nullable().optional() }).optional(),
        }),
        req.body,
      );
      const u = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!u) throw notFound();
      if (u.role === 'ADMIN' && u.id !== req.user!.id) throw badRequest('ADMIN_PROTECTED');
      const { student, ...data } = b;
      try {
        await prisma.user.update({
          where: { id: u.id },
          data: {
            ...data,
            ...(b.email !== undefined && b.email !== u.email ? { emailVerifiedAt: null } : {}),
            ...(student && u.role === 'STUDENT' ? { studentProfile: { upsert: { create: student, update: student } } } : {}),
          },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw conflict('USER_EXISTS');
        throw e;
      }
      await audit(req, 'admin.user_update', 'User', u.id, { fields: Object.keys(b) });
      ok(res, { updated: true });
    }),
  );

  adminRouter.post(
    '/users/:id/verify-email',
    ah(async (req, res) => {
      const u = await prisma.user.update({
        where: { id: req.params.id },
        data: { emailVerifiedAt: new Date(), status: 'ACTIVE' },
      }).catch(() => null);
      if (!u) throw notFound();
      await audit(req, 'admin.user_verify_email', 'User', u.id);
      ok(res, { verified: true });
    }),
  );

  /** Vaqtinchalik parol: bir marta ko'rsatiladi, foydalanuvchining barcha qurilmalaridan chiqariladi */
  adminRouter.post(
    '/users/:id/password',
    ah(async (req, res) => {
      const u = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!u) throw notFound();
      if (u.role === 'ADMIN') throw badRequest('ADMIN_PROTECTED');
      const temp = randomToken(9).replace(/[^A-Za-z0-9]/g, '').slice(0, 8) + '7a!';
      await prisma.$transaction([
        prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(temp), failedLogins: 0, lockedUntil: null } }),
        prisma.authSession.updateMany({ where: { userId: u.id, revokedAt: null }, data: { revokedAt: new Date() } }),
      ]);
      await audit(req, 'admin.user_password', 'User', u.id);
      await notify(u.id, 'system', 'Parolingiz administrator tomonidan almashtirildi', 'Kirgach, Sozlamalar → Xavfsizlik bo\'limida yangi parol qo\'ying', '/');
      ok(res, { tempPassword: temp });
    }),
  );

  adminRouter.post(
    '/users/:id/sessions/revoke',
    ah(async (req, res) => {
      if (req.params.id === req.user!.id) throw badRequest('SELF_ACTION');
      const r = await prisma.authSession.updateMany({ where: { userId: req.params.id, revokedAt: null }, data: { revokedAt: new Date() } });
      await audit(req, 'admin.user_sessions', 'User', req.params.id, { count: r.count });
      ok(res, { revoked: r.count });
    }),
  );

  adminRouter.post(
    '/users/:id/unlock',
    ah(async (req, res) => {
      await prisma.user.update({ where: { id: req.params.id }, data: { failedLogins: 0, lockedUntil: null } });
      await prisma.appDevice.updateMany({ where: { userId: req.params.id }, data: { pinFailed: 0 } });
      await audit(req, 'admin.user_unlock', 'User', req.params.id);
      ok(res, { unlocked: true });
    }),
  );

  /** Ilova qulfi (PIN va barmoq izi)ni o'chirish — foydalanuvchi kodni unutib, parol bilan ham kira olmasa */
  adminRouter.post(
    '/users/:id/applock-reset',
    ah(async (req, res) => {
      await prisma.$transaction([
        prisma.authSession.updateMany({ where: { userId: req.params.id }, data: { requiresUnlock: false, deviceId: null } }),
        prisma.appDevice.deleteMany({ where: { userId: req.params.id } }),
      ]);
      await audit(req, 'admin.user_applock_reset', 'User', req.params.id);
      ok(res, { reset: true });
    }),
  );

  /* ------------------------------ O'qituvchi: batafsil ------------------------------ */
  adminRouter.get(
    '/teachers/:id',
    ah(async (req, res) => {
      const t = await prisma.teacherProfile.findUnique({
        where: { id: req.params.id },
        include: {
          user: { select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true, status: true, createdAt: true, lastLoginAt: true } },
          subjects: { include: { subject: true } },
          certificates: { orderBy: { createdAt: 'asc' } },
          availability: { orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] },
          lessons: { where: { deletedAt: null }, select: { id: true, title: true, type: true, price: true, durationMin: true, status: true }, orderBy: { createdAt: 'desc' } },
          reviews: { where: { isHidden: false }, orderBy: { createdAt: 'desc' }, take: 5, include: { student: { select: { fullName: true } } } },
        },
      });
      if (!t) throw notFound();
      const [earned, duplicates] = await Promise.all([
        prisma.teacherEarning.aggregate({ where: { teacherId: t.id, status: { not: 'reversed' } }, _sum: { gross: true, net: true } }),
        t.identityHash
          ? prisma.teacherProfile.findMany({ where: { identityHash: t.identityHash, id: { not: t.id } }, select: { id: true, user: { select: { fullName: true } } } })
          : Promise.resolve([]),
      ]);
      const { identityHash, ...rest } = t;
      ok(res, { ...rest, hasIdentity: !!identityHash, identityDuplicates: duplicates, earnings: { gross: Number(earned._sum.gross ?? 0), net: Number(earned._sum.net ?? 0) } });
    }),
  );

  /** Admin hujjatni rasmiy manbada tekshirgach natijani belgilaydi */
  adminRouter.post(
    '/certificates/:id/check',
    ah(async (req, res) => {
      const b = parse(
        z.object({ status: z.enum(['verified', 'not_found', 'mismatch', 'unchecked']), source: z.string().max(120).optional(), note: z.string().max(500).optional() }),
        req.body,
      );
      const c = await prisma.teacherCertificate.update({
        where: { id: req.params.id },
        data: { checkStatus: b.status, checkSource: b.source ?? null, checkNote: b.note ?? null, checkedAt: new Date(), checkedBy: req.user!.id },
      }).catch(() => null);
      if (!c) throw notFound();
      await audit(req, 'teacher.document_check', 'Certificate', c.id, b);
      ok(res, c);
    }),
  );

  /* ------------------------------ Darslar: batafsil va tahrirlash ------------------------------ */
  adminRouter.get(
    '/lessons/:id',
    ah(async (req, res) => {
      const l = await prisma.lesson.findUnique({
        where: { id: req.params.id },
        include: {
          subject: true,
          teacher: { select: { id: true, user: { select: { fullName: true, avatarUrl: true } } } },
          _count: { select: { bookings: true, materials: true } },
          bookings: { orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, status: true, price: true, student: { select: { fullName: true } }, session: { select: { startAt: true } } } },
        },
      });
      if (!l) throw notFound('LESSON_NOT_FOUND');
      ok(res, l);
    }),
  );

  adminRouter.patch(
    '/lessons/:id',
    ah(async (req, res) => {
      const b = parse(
        z.object({
          title: z.string().trim().min(3).max(120).optional(),
          description: z.string().max(3000).nullable().optional(),
          price: z.number().min(0).max(100_000_000).optional(),
          level: z.string().max(40).nullable().optional(),
          maxStudents: z.number().int().min(1).max(50).optional(),
          status: z.enum(['published', 'draft', 'cancelled']).optional(),
          reason: z.string().max(300).optional(),
        }),
        req.body,
      );
      const { reason, ...data } = b;
      const l = await prisma.lesson.update({ where: { id: req.params.id }, data, include: { teacher: true } }).catch(() => null);
      if (!l) throw notFound('LESSON_NOT_FOUND');
      await audit(req, 'lesson.admin_update', 'Lesson', l.id, { fields: Object.keys(data), reason });
      await notify(l.teacher.userId, 'system', 'Darsingiz administrator tomonidan o\'zgartirildi', `${l.title}${reason ? ': ' + reason : ''}`, '/teacher/lessons');
      ok(res, l);
    }),
  );

  /* ------------------------------ Bron: batafsil ------------------------------ */
  adminRouter.get(
    '/bookings/:id',
    ah(async (req, res) => {
      const b = await prisma.booking.findUnique({
        where: { id: req.params.id },
        include: {
          student: { select: { id: true, fullName: true, email: true, phone: true } },
          teacher: { select: { id: true, user: { select: { id: true, fullName: true } } } },
          lesson: { select: { id: true, title: true, type: true, durationMin: true, subject: { select: { nameUz: true, nameRu: true, nameEn: true } } } },
          session: { select: { id: true, startAt: true, endAt: true, status: true } },
          payments: { include: { refunds: true } },
          review: { select: { rating: true, comment: true } },
        },
      });
      if (!b) throw notFound('BOOKING_NOT_FOUND');
      ok(res, b);
    }),
  );

  /* ------------------------------ Chekni foydalanuvchiga yuborish ------------------------------ */
  adminRouter.post(
    '/payments/:id/send-receipt',
    ah(async (req, res) => {
      const p = await prisma.payment.findUnique({ where: { id: req.params.id }, select: { id: true, userId: true, status: true, receiptNo: true } });
      if (!p) throw notFound('PAYMENT_NOT_FOUND');
      if (p.status !== 'paid' && p.status !== 'refunded') throw conflict('PAYMENT_STATE');
      const emailed = await sendReceiptEmail(p.id).then(() => true, () => false);
      await notify(p.userId, 'payment.paid', "Chek: to'lov tasdiqlandi", p.receiptNo, `/student/payments?receipt=${p.id}`, { paymentId: p.id });
      await audit(req, 'payment.receipt_sent', 'Payment', p.id, { emailed });
      ok(res, { emailed });
    }),
  );

  /* ------------------------------ Shikoyatlar: nima haqida ekanini ko'rsatish ------------------------------ */
  adminRouter.get(
    '/complaints-full',
    ah(async (req, res) => {
      const q = parse(z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(20), status: z.string().optional() }), req.query);
      const where: Prisma.ComplaintWhereInput = q.status ? { status: q.status as any } : {};
      const [items, total, counts] = await Promise.all([
        prisma.complaint.findMany({ where, include: { author: { select: { id: true, fullName: true, role: true } } }, orderBy: { createdAt: 'desc' }, ...paginate(q.page, q.limit) }),
        prisma.complaint.count({ where }),
        prisma.complaint.groupBy({ by: ['status'], _count: { _all: true } }),
      ]);
      // Shikoyat obyektini (kim/nima haqida) qisqacha topib beramiz
      const target = async (type: string, id: string) => {
        if (type === 'user' || type === 'teacher') {
          const u = await prisma.user.findFirst({ where: { OR: [{ id }, { teacherProfile: { id } }] }, select: { id: true, fullName: true, role: true } });
          return u ? { label: u.fullName, role: u.role, userId: u.id } : null;
        }
        if (type === 'review') {
          const r = await prisma.review.findUnique({ where: { id }, select: { rating: true, comment: true, teacher: { select: { user: { select: { fullName: true } } } } } });
          return r ? { label: r.teacher.user.fullName, text: r.comment, rating: r.rating } : null;
        }
        if (type === 'lesson') {
          const l = await prisma.lesson.findUnique({ where: { id }, select: { id: true, title: true, teacher: { select: { user: { select: { fullName: true } } } } } });
          return l ? { label: l.title, sub: l.teacher.user.fullName, lessonId: l.id } : null;
        }
        if (type === 'booking') {
          const b = await prisma.booking.findUnique({ where: { id }, select: { id: true, lesson: { select: { title: true } }, session: { select: { startAt: true } } } });
          return b ? { label: b.lesson.title, at: b.session.startAt, bookingId: b.id } : null;
        }
        return null;
      };
      const enriched = await Promise.all(items.map(async (c) => ({ ...c, target: await target(c.targetType, c.targetId) })));
      ok(res, enriched, { ...pageMeta(q.page, q.limit, total), counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) });
    }),
  );

  /* ------------------------------ Audit jurnali: filtrlar bilan ------------------------------ */
  adminRouter.get(
    '/audit',
    ah(async (req, res) => {
      const q = parse(
        z.object({
          page: z.coerce.number().int().min(1).default(1),
          limit: z.coerce.number().int().min(1).max(100).default(30),
          group: z.string().max(30).optional(), // auth | user | admin | teacher | booking | payment | ...
          actor: z.string().max(80).optional(),
          from: z.coerce.date().optional(),
          to: z.coerce.date().optional(),
          entityId: z.string().max(40).optional(),
        }),
        req.query,
      );
      const where: Prisma.AuditLogWhereInput = {
        ...(q.group ? { action: { startsWith: `${q.group}.` } } : {}),
        ...(q.actor ? { actor: { fullName: { contains: q.actor, mode: 'insensitive' } } } : {}),
        ...(q.entityId ? { entityId: q.entityId } : {}),
        ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: new Date(q.to.getTime() + 86_399_000) } : {}) } } : {}),
      };
      const [items, total] = await Promise.all([
        prisma.auditLog.findMany({ where, include: { actor: { select: { id: true, fullName: true, role: true } } }, orderBy: { createdAt: 'desc' }, ...paginate(q.page, q.limit) }),
        prisma.auditLog.count({ where }),
      ]);
      ok(res, items, pageMeta(q.page, q.limit, total));
    }),
  );
}
