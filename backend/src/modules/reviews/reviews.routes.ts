import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { ah, ok, pageMeta, paginate, parse } from '../../common/http';
import { conflict, forbidden, notFound } from '../../common/errors';
import { requireAuth, requireRole } from '../../middleware/auth';
import { getTeacherId } from '../../common/owners';
import { notify } from '../../lib/notify';
import type { Tx } from '../../lib/prisma';

export const reviewsRouter = Router();

export async function recomputeRating(tx: Tx, teacherId: string) {
  const agg = await tx.review.aggregate({ where: { teacherId, isHidden: false }, _avg: { rating: true }, _count: { _all: true } });
  await tx.teacherProfile.update({
    where: { id: teacherId },
    data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 100) / 100, ratingCount: agg._count._all },
  });
}

reviewsRouter.get(
  '/teacher/:teacherId',
  ah(async (req, res) => {
    const q = parse(z.object({ page: z.coerce.number().default(1), limit: z.coerce.number().max(50).default(10) }), req.query);
    const where = { teacherId: req.params.teacherId, isHidden: false };
    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where,
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          student: { select: { fullName: true, avatarUrl: true } },
          booking: { select: { lesson: { select: { title: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        ...paginate(q.page, q.limit),
      }),
      prisma.review.count({ where }),
    ]);
    ok(res, items.map((r) => ({ ...r, verified: true })), pageMeta(q.page, q.limit, total));
  }),
);

reviewsRouter.use(requireAuth);

reviewsRouter.get(
  '/mine',
  ah(async (req, res) => {
    const where =
      req.user!.role === 'TEACHER' ? { teacherId: await getTeacherId(req.user!.id) } : { studentId: req.user!.id };
    const items = await prisma.review.findMany({
      where,
      include: {
        student: { select: { fullName: true, avatarUrl: true } },
        teacher: { select: { user: { select: { fullName: true } } } },
        booking: { select: { lesson: { select: { title: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    ok(res, items);
  }),
);

/** Faqat yakunlangan dars uchun, har bir bronga bitta sharh (unique bookingId) */
reviewsRouter.post(
  '/',
  requireRole('STUDENT'),
  ah(async (req, res) => {
    const b = parse(
      z.object({ bookingId: z.string(), rating: z.number().int().min(1).max(5), comment: z.string().max(2000).optional() }),
      req.body,
    );
    const booking = await prisma.booking.findUnique({ where: { id: b.bookingId }, include: { review: true, teacher: true } });
    if (!booking || booking.studentId !== req.user!.id) throw notFound('BOOKING_NOT_FOUND');
    if (booking.status !== 'completed') throw conflict('NOT_COMPLETED', 'Faqat yakunlangan darsga baho qo\'yish mumkin');
    if (booking.review) throw conflict('ALREADY_REVIEWED', 'Bu darsga allaqachon baho qo\'ygansiz');
    const review = await prisma.$transaction(async (tx) => {
      const r = await tx.review.create({
        data: { bookingId: booking.id, studentId: req.user!.id, teacherId: booking.teacherId, rating: b.rating, comment: b.comment },
      });
      await recomputeRating(tx, booking.teacherId);
      return r;
    });
    await notify(booking.teacher.userId, 'review.new', `Yangi sharh: ${'★'.repeat(b.rating)}`, b.comment?.slice(0, 100), '/teacher/reviews');
    ok(res, review, undefined, 201);
  }),
);

reviewsRouter.post(
  '/:id/report',
  ah(async (req, res) => {
    const { reason } = parse(z.object({ reason: z.string().min(5).max(500) }), req.body);
    const r = await prisma.review.findUnique({ where: { id: req.params.id } });
    if (!r) throw notFound();
    if (r.studentId === req.user!.id) throw forbidden();
    await prisma.$transaction([
      prisma.review.update({ where: { id: r.id }, data: { reportCount: { increment: 1 } } }),
      prisma.complaint.create({ data: { authorId: req.user!.id, targetType: 'review', targetId: r.id, reason } }),
    ]);
    ok(res, { reported: true });
  }),
);
