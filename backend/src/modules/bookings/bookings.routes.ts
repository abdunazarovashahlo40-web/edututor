import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ah, ok, pageMeta, paginate, parse } from '../../common/http';
import { forbidden, notFound } from '../../common/errors';
import { requireAuth, requireRole } from '../../middleware/auth';
import { getTeacherId } from '../../common/owners';
import { audit } from '../../lib/audit';
import { cancelBookingInternal, completeBooking, confirmBooking, createBooking, rescheduleBooking } from './bookings.service';

export const bookingsRouter = Router();
bookingsRouter.use(requireAuth);

const include = {
  session: { select: { id: true, startAt: true, endAt: true, status: true } },
  lesson: {
    select: {
      id: true,
      title: true,
      type: true,
      durationMin: true,
      subject: { select: { nameUz: true, nameRu: true, nameEn: true, slug: true } },
    },
  },
  teacher: { select: { id: true, user: { select: { id: true, fullName: true, avatarUrl: true } } } },
  student: { select: { id: true, fullName: true, avatarUrl: true } },
  payments: { select: { id: true, status: true, amount: true, provider: true }, orderBy: { createdAt: 'desc' as const } },
  review: { select: { id: true, rating: true } },
} satisfies Prisma.BookingInclude;

bookingsRouter.post(
  '/',
  requireRole('STUDENT'),
  ah(async (req, res) => {
    const b = parse(
      z.object({
        lessonId: z.string(),
        startAt: z.string().datetime().optional(),
        sessionId: z.string().optional(),
        note: z.string().max(500).optional(),
      }),
      req.body,
    );
    const r = await createBooking(req.user!.id, b);
    ok(res, r, undefined, 201);
  }),
);

bookingsRouter.get(
  '/',
  ah(async (req, res) => {
    const q = parse(
      z.object({
        scope: z.enum(['upcoming', 'past', 'all', 'requests']).default('all'),
        status: z.string().optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(50),
      }),
      req.query,
    );
    const now = new Date();
    const where: Prisma.BookingWhereInput = {};
    if (req.user!.role === 'STUDENT') where.studentId = req.user!.id;
    else if (req.user!.role === 'TEACHER') where.teacherId = await getTeacherId(req.user!.id);
    if (q.scope === 'upcoming') {
      where.status = { in: ['requested', 'confirmed'] };
      where.session = { endAt: { gt: now } };
    } else if (q.scope === 'past') {
      where.OR = [{ status: { in: ['completed', 'no_show', 'cancelled', 'rejected'] } }, { session: { endAt: { lte: now } } }];
      where.NOT = { status: 'rescheduled' };
    } else if (q.scope === 'requests') {
      where.status = 'requested';
    }
    if (q.status) where.status = q.status as any;
    if (q.from || q.to) where.session = { ...(where.session as object), startAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } };
    const orderBy: Prisma.BookingOrderByWithRelationInput = { session: { startAt: q.scope === 'past' ? 'desc' : 'asc' } };
    const [items, total] = await Promise.all([
      prisma.booking.findMany({ where, include, orderBy, ...paginate(q.page, q.limit) }),
      prisma.booking.count({ where }),
    ]);
    ok(res, items, pageMeta(q.page, q.limit, total));
  }),
);

bookingsRouter.get(
  '/:id',
  ah(async (req, res) => {
    const b = await prisma.booking.findUnique({ where: { id: req.params.id }, include });
    if (!b) throw notFound();
    const allowed = req.user!.role === 'ADMIN' || b.student.id === req.user!.id || b.teacher.user.id === req.user!.id;
    if (!allowed) throw forbidden();
    ok(res, b);
  }),
);

bookingsRouter.post(
  '/:id/confirm',
  requireRole('TEACHER'),
  ah(async (req, res) => ok(res, await confirmBooking(req.params.id, req.user!.id))),
);

bookingsRouter.post(
  '/:id/reject',
  requireRole('TEACHER'),
  ah(async (req, res) => {
    const { reason } = parse(z.object({ reason: z.string().max(300).optional() }), req.body);
    const b = await prisma.booking.findUnique({ where: { id: req.params.id }, include: { teacher: true } });
    if (!b) throw notFound();
    if (b.teacher.userId !== req.user!.id) throw forbidden();
    ok(res, await cancelBookingInternal(b.id, 'teacher', req.user!.id, reason, true));
  }),
);

bookingsRouter.post(
  '/:id/cancel',
  ah(async (req, res) => {
    const { reason } = parse(z.object({ reason: z.string().max(300).optional() }), req.body);
    const b = await prisma.booking.findUnique({ where: { id: req.params.id }, include: { teacher: true } });
    if (!b) throw notFound();
    let actor: 'student' | 'teacher' | 'admin';
    if (b.studentId === req.user!.id) actor = 'student';
    else if (b.teacher.userId === req.user!.id) actor = 'teacher';
    else if (req.user!.role === 'ADMIN') actor = 'admin';
    else throw forbidden();
    const r = await cancelBookingInternal(b.id, actor, req.user!.id, reason);
    if (actor === 'admin') await audit(req, 'booking.cancel', 'Booking', b.id, { reason });
    ok(res, r);
  }),
);

bookingsRouter.post(
  '/:id/reschedule',
  ah(async (req, res) => {
    const { startAt } = parse(z.object({ startAt: z.string().datetime() }), req.body);
    ok(res, await rescheduleBooking(req.params.id, req.user!.id, startAt));
  }),
);

bookingsRouter.post(
  '/:id/complete',
  requireRole('TEACHER'),
  ah(async (req, res) => {
    await completeBooking(req.params.id, req.user!.id);
    ok(res, { completed: true });
  }),
);

bookingsRouter.post(
  '/:id/no-show',
  requireRole('TEACHER'),
  ah(async (req, res) => {
    await completeBooking(req.params.id, req.user!.id, true);
    ok(res, { noShow: true });
  }),
);
