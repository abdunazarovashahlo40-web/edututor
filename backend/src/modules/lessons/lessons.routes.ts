import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ah, ok, pageMeta, paginate, parse } from '../../common/http';
import { badRequest, conflict, forbidden, notFound } from '../../common/errors';
import { optionalAuth, requireAuth, requireRole } from '../../middleware/auth';
import { getApprovedTeacherId, getTeacherId } from '../../common/owners';
import { createSessionSafe, TX_OPTS } from './scheduling';
import { cancelBookingInternal } from '../bookings/bookings.service';

export const lessonsRouter = Router();

const lessonSchema = z.object({
  title: z.string().min(3).max(140),
  description: z.string().max(4000).optional().nullable(),
  subjectId: z.string(),
  type: z.enum(['INDIVIDUAL', 'GROUP', 'TRIAL', 'CONSULTATION']),
  durationMin: z.number().int().min(30).max(180),
  price: z.number().min(0).max(10_000_000),
  maxStudents: z.number().int().min(1).max(30),
  level: z.string().max(60).optional().nullable(),
  meetingMethod: z.enum(['webrtc', 'jitsi']).default('webrtc'),
  status: z.enum(['draft', 'published', 'pending']).default('draft'),
  sessions: z.array(z.object({ startAt: z.string().datetime() })).max(20).optional(),
});

function normalize(b: z.infer<typeof lessonSchema> | Partial<z.infer<typeof lessonSchema>>) {
  if (b.type === 'INDIVIDUAL' || b.type === 'TRIAL') b.maxStudents = 1;
  if (b.type === 'GROUP' && b.maxStudents !== undefined && b.maxStudents < 2) {
    throw badRequest('GROUP_MIN', 'Guruh darsi uchun kamida 2 o\'quvchi');
  }
  return b;
}

const lessonInclude = {
  subject: { select: { id: true, slug: true, nameUz: true, nameRu: true, nameEn: true } },
  teacher: { select: { id: true, ratingAvg: true, ratingCount: true, user: { select: { fullName: true, avatarUrl: true } } } },
} satisfies Prisma.LessonInclude;

/** Ochiq ro'yxat: chop etilgan darslar */
lessonsRouter.get(
  '/',
  ah(async (req, res) => {
    const q = parse(
      z.object({
        q: z.string().max(80).optional(),
        subject: z.string().optional(),
        type: z.enum(['INDIVIDUAL', 'GROUP', 'TRIAL', 'CONSULTATION']).optional(),
        teacherId: z.string().optional(),
        maxPrice: z.coerce.number().optional(),
        sort: z.enum(['newest', 'price_asc', 'price_desc']).default('newest'),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(12),
      }),
      req.query,
    );
    const where: Prisma.LessonWhereInput = {
      status: 'published',
      deletedAt: null,
      teacher: { verification: 'APPROVED', user: { status: 'ACTIVE' } },
      ...(q.subject ? { subject: { slug: q.subject } } : {}),
      ...(q.type ? { type: q.type } : {}),
      ...(q.teacherId ? { teacherId: q.teacherId } : {}),
      ...(q.maxPrice !== undefined ? { price: { lte: q.maxPrice } } : {}),
      ...(q.q
        ? { OR: [{ title: { contains: q.q, mode: 'insensitive' } }, { description: { contains: q.q, mode: 'insensitive' } }] }
        : {}),
    };
    const orderBy = { newest: { createdAt: 'desc' as const }, price_asc: { price: 'asc' as const }, price_desc: { price: 'desc' as const } }[q.sort];
    const [items, total] = await Promise.all([
      prisma.lesson.findMany({
        where,
        orderBy,
        include: {
          ...lessonInclude,
          sessions: {
            where: { status: 'scheduled', startAt: { gt: new Date() } },
            orderBy: { startAt: 'asc' },
            take: 3,
            select: { id: true, startAt: true, endAt: true, capacity: true },
          },
        },
        ...paginate(q.page, q.limit),
      }),
      prisma.lesson.count({ where }),
    ]);
    ok(res, items, pageMeta(q.page, q.limit, total));
  }),
);

/** O'qituvchining barcha darslari (qoralamalar bilan) */
lessonsRouter.get(
  '/mine',
  requireAuth,
  requireRole('TEACHER'),
  ah(async (req, res) => {
    const teacherId = await getTeacherId(req.user!.id);
    const q = parse(z.object({ status: z.string().optional(), q: z.string().optional() }), req.query);
    const lessons = await prisma.lesson.findMany({
      where: {
        teacherId,
        deletedAt: null,
        ...(q.status ? { status: q.status as any } : {}),
        ...(q.q ? { title: { contains: q.q, mode: 'insensitive' } } : {}),
      },
      include: {
        subject: lessonInclude.subject,
        _count: { select: { bookings: { where: { status: { in: ['requested', 'confirmed'] } } }, materials: true } },
        sessions: {
          where: { status: { in: ['scheduled', 'in_progress'] }, endAt: { gt: new Date() } },
          orderBy: { startAt: 'asc' },
          select: { id: true, startAt: true, endAt: true, capacity: true, status: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    ok(res, lessons);
  }),
);

lessonsRouter.get(
  '/:id',
  optionalAuth,
  ah(async (req, res) => {
    const lesson = await prisma.lesson.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        ...lessonInclude,
        sessions: {
          where: { status: 'scheduled', startAt: { gt: new Date() } },
          orderBy: { startAt: 'asc' },
          select: {
            id: true,
            startAt: true,
            endAt: true,
            capacity: true,
            _count: { select: { bookings: { where: { status: { in: ['requested', 'confirmed'] } } } } },
          },
        },
        materials: { where: { isPublic: true, deletedAt: null }, select: { id: true, title: true, fileName: true } },
      },
    });
    if (!lesson) throw notFound('LESSON_NOT_FOUND');
    if (lesson.status !== 'published') {
      const own = req.user && (await prisma.teacherProfile.findFirst({ where: { id: lesson.teacherId, userId: req.user.id } }));
      if (!own && req.user?.role !== 'ADMIN') throw notFound('LESSON_NOT_FOUND');
    }
    ok(res, lesson);
  }),
);

lessonsRouter.post(
  '/',
  requireAuth,
  requireRole('TEACHER'),
  ah(async (req, res) => {
    const b = normalize(parse(lessonSchema, req.body)) as z.infer<typeof lessonSchema>;
    const teacherId = b.status === 'published' ? await getApprovedTeacherId(req.user!.id) : await getTeacherId(req.user!.id);
    const subject = await prisma.subject.findFirst({ where: { id: b.subjectId, isActive: true } });
    if (!subject) throw badRequest('SUBJECT_INVALID');
    const { sessions, ...data } = b;
    const lesson = await prisma.$transaction(async (tx) => {
      const l = await tx.lesson.create({ data: { ...data, price: data.price, teacherId } });
      for (const s of sessions ?? []) {
        const startAt = new Date(s.startAt);
        if (startAt < new Date()) throw badRequest('PAST_DATE', 'O\'tgan vaqtga dars qo\'yib bo\'lmaydi');
        await createSessionSafe(tx, {
          teacherId,
          lessonId: l.id,
          startAt,
          endAt: new Date(startAt.getTime() + l.durationMin * 60_000),
          capacity: l.maxStudents,
        });
      }
      return l;
    }, TX_OPTS);
    ok(res, lesson, undefined, 201);
  }),
);

async function ownLesson(userId: string, id: string) {
  const teacherId = await getTeacherId(userId);
  const lesson = await prisma.lesson.findFirst({ where: { id, deletedAt: null } });
  if (!lesson) throw notFound('LESSON_NOT_FOUND');
  if (lesson.teacherId !== teacherId) throw forbidden('NOT_OWNER');
  return { lesson, teacherId };
}

lessonsRouter.patch(
  '/:id',
  requireAuth,
  requireRole('TEACHER'),
  ah(async (req, res) => {
    const { lesson } = await ownLesson(req.user!.id, req.params.id);
    const b = normalize(parse(lessonSchema.partial().omit({ sessions: true }), req.body));
    if (b.status === 'published') await getApprovedTeacherId(req.user!.id);
    const active = await prisma.booking.count({ where: { lessonId: lesson.id, status: { in: ['requested', 'confirmed'] } } });
    if (active && (b.durationMin !== undefined && b.durationMin !== lesson.durationMin)) {
      throw conflict('LESSON_HAS_BOOKINGS', 'Faol bronlar bor — davomiylikni o\'zgartirib bo\'lmaydi');
    }
    if (b.subjectId) {
      const subject = await prisma.subject.findFirst({ where: { id: b.subjectId, isActive: true } });
      if (!subject) throw badRequest('SUBJECT_INVALID');
    }
    const updated = await prisma.lesson.update({ where: { id: lesson.id }, data: b as any });
    ok(res, updated);
  }),
);

/** O'chirish: faol bron bo'lsa — ruxsat yo'q; aks holda soft-delete (arxiv) */
lessonsRouter.delete(
  '/:id',
  requireAuth,
  requireRole('TEACHER'),
  ah(async (req, res) => {
    const { lesson } = await ownLesson(req.user!.id, req.params.id);
    const active = await prisma.booking.count({ where: { lessonId: lesson.id, status: { in: ['requested', 'confirmed'] } } });
    if (active) throw conflict('LESSON_HAS_BOOKINGS', 'Avval faol bronlarni bekor qiling');
    await prisma.$transaction([
      prisma.lesson.update({ where: { id: lesson.id }, data: { deletedAt: new Date(), status: 'cancelled' } }),
      prisma.lessonSession.updateMany({ where: { lessonId: lesson.id, status: 'scheduled' }, data: { status: 'cancelled' } }),
    ]);
    ok(res, { archived: true });
  }),
);

/** Guruh/konsultatsiya darsiga yangi sana qo'shish */
lessonsRouter.post(
  '/:id/sessions',
  requireAuth,
  requireRole('TEACHER'),
  ah(async (req, res) => {
    const { lesson, teacherId } = await ownLesson(req.user!.id, req.params.id);
    const b = parse(z.object({ startAt: z.string().datetime() }), req.body);
    const startAt = new Date(b.startAt);
    if (startAt < new Date()) throw badRequest('PAST_DATE', 'O\'tgan vaqtga dars qo\'yib bo\'lmaydi');
    const s = await prisma.$transaction(
      (tx) =>
        createSessionSafe(tx, {
          teacherId,
          lessonId: lesson.id,
          startAt,
          endAt: new Date(startAt.getTime() + lesson.durationMin * 60_000),
          capacity: lesson.maxStudents,
        }),
      TX_OPTS,
    );
    ok(res, s, undefined, 201);
  }),
);

/** Sessiyani bekor qilish — barcha bronlar 100% qaytariladi */
lessonsRouter.delete(
  '/:id/sessions/:sessionId',
  requireAuth,
  requireRole('TEACHER'),
  ah(async (req, res) => {
    const { lesson } = await ownLesson(req.user!.id, req.params.id);
    const session = await prisma.lessonSession.findFirst({ where: { id: req.params.sessionId, lessonId: lesson.id } });
    if (!session) throw notFound();
    const bookings = await prisma.booking.findMany({
      where: { sessionId: session.id, status: { in: ['requested', 'confirmed'] } },
    });
    for (const bk of bookings) await cancelBookingInternal(bk.id, 'teacher', req.user!.id, 'O\'qituvchi darsni bekor qildi');
    await prisma.lessonSession.update({ where: { id: session.id }, data: { status: 'cancelled' } });
    ok(res, { cancelled: true, refundedBookings: bookings.length });
  }),
);
