import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ah, ok, pageMeta, paginate, parse } from '../../common/http';
import { badRequest, notFound } from '../../common/errors';
import { optionalAuth, requireAuth, requireRole } from '../../middleware/auth';
import { assertSniff, uploadDoc } from '../../middleware/upload';
import { saveFile } from '../../lib/storage';
import { computeSlots, utcToLocalParts } from '../../common/time';
import { audit } from '../../lib/audit';
import { notify } from '../../lib/notify';
import { getTeacherId } from '../../common/owners';

export const teachersRouter = Router();

const listQuery = z.object({
  q: z.string().max(80).optional(),
  subject: z.string().max(60).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  minExperience: z.coerce.number().int().min(0).optional(),
  language: z.enum(['uz', 'ru', 'en']).optional(),
  format: z.enum(['online', 'offline']).optional(),
  weekday: z.coerce.number().int().min(0).max(6).optional(),
  sort: z.enum(['rating', 'price_asc', 'price_desc', 'experience', 'newest', 'popular']).default('rating'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
});

export const teacherCardSelect = {
  id: true,
  headline: true,
  bio: true,
  experienceYears: true,
  languages: true,
  hourlyPrice: true,
  trialPrice: true,
  onlineFormat: true,
  offlineFormat: true,
  city: true,
  ratingAvg: true,
  ratingCount: true,
  lessonsCompleted: true,
  createdAt: true,
  user: { select: { id: true, fullName: true, avatarUrl: true } },
  subjects: { select: { level: true, subject: { select: { id: true, slug: true, nameUz: true, nameRu: true, nameEn: true, icon: true } } } },
  availability: { select: { weekday: true, startMinute: true, endMinute: true } },
} satisfies Prisma.TeacherProfileSelect;

/** O'qituvchilarni qidirish va filtrlash (ochiq) */
teachersRouter.get(
  '/',
  optionalAuth,
  ah(async (req, res) => {
    const f = parse(listQuery, req.query);
    const where: Prisma.TeacherProfileWhereInput = {
      verification: 'APPROVED',
      user: { status: 'ACTIVE', deletedAt: null },
      AND: [],
    };
    const and = where.AND as Prisma.TeacherProfileWhereInput[];
    if (f.q) {
      and.push({
        OR: [
          { user: { fullName: { contains: f.q, mode: 'insensitive' } } },
          { headline: { contains: f.q, mode: 'insensitive' } },
          { bio: { contains: f.q, mode: 'insensitive' } },
          {
            subjects: {
              some: {
                subject: {
                  OR: [
                    { nameUz: { contains: f.q, mode: 'insensitive' } },
                    { nameRu: { contains: f.q, mode: 'insensitive' } },
                    { nameEn: { contains: f.q, mode: 'insensitive' } },
                  ],
                },
              },
            },
          },
        ],
      });
    }
    if (f.subject) and.push({ subjects: { some: { subject: { slug: f.subject } } } });
    if (f.minPrice !== undefined) and.push({ hourlyPrice: { gte: f.minPrice } });
    if (f.maxPrice !== undefined) and.push({ hourlyPrice: { lte: f.maxPrice } });
    if (f.minRating !== undefined) and.push({ ratingAvg: { gte: f.minRating } });
    if (f.minExperience !== undefined) and.push({ experienceYears: { gte: f.minExperience } });
    if (f.language) and.push({ languages: { has: f.language } });
    if (f.format === 'online') and.push({ onlineFormat: true });
    if (f.format === 'offline') and.push({ offlineFormat: true });
    if (f.weekday !== undefined) and.push({ availability: { some: { weekday: f.weekday } } });

    const orderBy: Prisma.TeacherProfileOrderByWithRelationInput[] = {
      rating: [{ ratingAvg: 'desc' as const }, { ratingCount: 'desc' as const }],
      price_asc: [{ hourlyPrice: 'asc' as const }],
      price_desc: [{ hourlyPrice: 'desc' as const }],
      experience: [{ experienceYears: 'desc' as const }],
      newest: [{ createdAt: 'desc' as const }],
      popular: [{ lessonsCompleted: 'desc' as const }],
    }[f.sort];

    const [items, total] = await Promise.all([
      prisma.teacherProfile.findMany({ where, orderBy, select: teacherCardSelect, ...paginate(f.page, f.limit) }),
      prisma.teacherProfile.count({ where }),
    ]);
    let favs = new Set<string>();
    if (req.user) {
      const rows = await prisma.favoriteTeacher.findMany({
        where: { userId: req.user.id, teacherId: { in: items.map((i) => i.id) } },
        select: { teacherId: true },
      });
      favs = new Set(rows.map((r) => r.teacherId));
    }
    ok(res, items.map((t) => ({ ...t, isFavorite: favs.has(t.id) })), pageMeta(f.page, f.limit, total));
  }),
);

/* ------------------------- O'qituvchining o'zi ------------------------- */

const meRouter = Router();
meRouter.use(requireAuth, requireRole('TEACHER'));

meRouter.get(
  '/profile',
  ah(async (req, res) => {
    const p = await prisma.teacherProfile.findUniqueOrThrow({
      where: { userId: req.user!.id },
      include: {
        subjects: { include: { subject: true } },
        certificates: { orderBy: { createdAt: 'desc' } },
        availability: { orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] },
        user: { select: { fullName: true, avatarUrl: true, email: true, phone: true } },
      },
    });
    ok(res, p);
  }),
);

const profileSchema = z.object({
  headline: z.string().max(120).optional().nullable(),
  bio: z.string().max(3000).optional().nullable(),
  education: z.string().max(1000).optional().nullable(),
  experienceYears: z.number().int().min(0).max(60).optional(),
  languages: z.array(z.enum(['uz', 'ru', 'en'])).min(1).optional(),
  hourlyPrice: z.number().min(10000).max(5_000_000).optional(),
  trialPrice: z.number().min(0).max(5_000_000).optional().nullable(),
  onlineFormat: z.boolean().optional(),
  offlineFormat: z.boolean().optional(),
  city: z.string().max(60).optional().nullable(),
  videoIntroUrl: z.string().url().max(300).optional().nullable().or(z.literal('')),
  payoutCard: z
    .string()
    .regex(/^\d{16}$/, '16 raqam')
    .optional()
    .nullable(),
});

meRouter.patch(
  '/profile',
  ah(async (req, res) => {
    const b = parse(profileSchema, req.body);
    // Karta raqami to'liq saqlanmaydi — faqat niqoblangan ko'rinishi (to'lov tizimi orqali payout qilinadi)
    const payoutCard = b.payoutCard ? `${b.payoutCard.slice(0, 4)} **** **** ${b.payoutCard.slice(-4)}` : b.payoutCard;
    const p = await prisma.teacherProfile.update({
      where: { userId: req.user!.id },
      data: { ...b, payoutCard, videoIntroUrl: b.videoIntroUrl || null },
    });
    ok(res, p);
  }),
);

meRouter.put(
  '/subjects',
  ah(async (req, res) => {
    const b = parse(
      z.object({ subjects: z.array(z.object({ subjectId: z.string(), level: z.string().max(60).optional() })).min(1).max(8) }),
      req.body,
    );
    const teacherId = await getTeacherId(req.user!.id);
    const valid = await prisma.subject.count({ where: { id: { in: b.subjects.map((s) => s.subjectId) }, isActive: true } });
    if (valid !== new Set(b.subjects.map((s) => s.subjectId)).size) throw badRequest('SUBJECT_INVALID');
    await prisma.$transaction([
      prisma.teacherSubject.deleteMany({ where: { teacherId } }),
      prisma.teacherSubject.createMany({
        data: b.subjects.map((s) => ({ teacherId, subjectId: s.subjectId, level: s.level })),
        skipDuplicates: true,
      }),
    ]);
    ok(res, { saved: true });
  }),
);

meRouter.post(
  '/certificates',
  uploadDoc.single('file'),
  ah(async (req, res) => {
    const b = parse(
      z.object({
        title: z.string().min(2).max(160),
        issuer: z.string().max(160).optional(),
        year: z.coerce.number().int().min(1960).max(2100).optional(),
        isVerificationDoc: z
          .enum(['true', 'false'])
          .optional()
          .transform((v) => v === 'true'),
      }),
      req.body,
    );
    const teacherId = await getTeacherId(req.user!.id);
    let fileUrl: string | undefined;
    if (req.file) {
      assertSniff(req.file);
      fileUrl = (await saveFile(`certificates/${teacherId}`, req.file)).url;
    }
    const c = await prisma.teacherCertificate.create({ data: { teacherId, ...b, fileUrl } });
    ok(res, c, undefined, 201);
  }),
);

meRouter.delete(
  '/certificates/:id',
  ah(async (req, res) => {
    const teacherId = await getTeacherId(req.user!.id);
    const r = await prisma.teacherCertificate.deleteMany({ where: { id: req.params.id, teacherId } });
    if (!r.count) throw notFound();
    ok(res, { deleted: true });
  }),
);

/** Profilni tekshiruvga yuborish — majburiy maydonlar to'ldirilganini tekshiradi */
meRouter.post(
  '/submit-verification',
  ah(async (req, res) => {
    const p = await prisma.teacherProfile.findUniqueOrThrow({
      where: { userId: req.user!.id },
      include: { subjects: true, certificates: true, availability: true, user: true },
    });
    const missing: string[] = [];
    if (!p.bio || p.bio.length < 50) missing.push('bio');
    if (!p.education) missing.push('education');
    if (Number(p.hourlyPrice) <= 0) missing.push('hourlyPrice');
    if (!p.subjects.length) missing.push('subjects');
    if (!p.certificates.some((c) => c.isVerificationDoc && c.fileUrl)) missing.push('verificationDoc');
    if (!p.user.avatarUrl) missing.push('avatar');
    if (missing.length) throw badRequest('PROFILE_INCOMPLETE', 'Profil to\'liq emas', { missing });
    if (p.verification === 'APPROVED') return ok(res, { verification: 'APPROVED' });
    await prisma.teacherProfile.update({ where: { id: p.id }, data: { verification: 'PENDING', verificationNote: null } });
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
    await Promise.all(
      admins.map((a) =>
        notify(a.id, 'teacher.verification', 'Yangi o\'qituvchi tekshiruvga yubordi', p.user.fullName, '/admin/teachers'),
      ),
    );
    await audit(req, 'teacher.submit_verification', 'TeacherProfile', p.id);
    ok(res, { verification: 'PENDING' });
  }),
);

meRouter.get(
  '/students',
  ah(async (req, res) => {
    const teacherId = await getTeacherId(req.user!.id);
    const rows = await prisma.booking.groupBy({
      by: ['studentId'],
      where: { teacherId, status: { in: ['confirmed', 'completed'] } },
      _count: { _all: true },
      _max: { createdAt: true },
    });
    const ids = rows.map((r) => r.studentId);
    const [users, completed, hw] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, fullName: true, avatarUrl: true, studentProfile: { select: { grade: true, goals: true } } },
      }),
      prisma.booking.groupBy({
        by: ['studentId'],
        where: { teacherId, status: 'completed', studentId: { in: ids } },
        _count: { _all: true },
      }),
      prisma.homework.groupBy({
        by: ['studentId', 'status'],
        where: { teacherId, studentId: { in: ids } },
        _count: { _all: true },
      }),
    ]);
    const data = rows.map((r) => {
      const u = users.find((x) => x.id === r.studentId);
      const done = completed.find((c) => c.studentId === r.studentId)?._count._all ?? 0;
      const hwAll = hw.filter((h) => h.studentId === r.studentId).reduce((a, h) => a + h._count._all, 0);
      const hwDone = hw
        .filter((h) => h.studentId === r.studentId && (h.status === 'reviewed' || h.status === 'completed'))
        .reduce((a, h) => a + h._count._all, 0);
      return {
        student: u,
        bookings: r._count._all,
        completedLessons: done,
        lastBookingAt: r._max.createdAt,
        homeworkTotal: hwAll,
        homeworkDone: hwDone,
        progress: hwAll ? Math.round((hwDone / hwAll) * 100) : null,
      };
    });
    ok(res, data);
  }),
);

teachersRouter.use('/me', meRouter);

/* ------------------------- Ochiq profil ------------------------- */

teachersRouter.get(
  '/:id',
  optionalAuth,
  ah(async (req, res) => {
    const t = await prisma.teacherProfile.findFirst({
      where: { id: req.params.id, user: { deletedAt: null } },
      select: {
        ...teacherCardSelect,
        education: true,
        videoIntroUrl: true,
        verification: true,
        certificates: {
          where: { isVerificationDoc: false },
          select: { id: true, title: true, issuer: true, year: true },
        },
        lessons: {
          where: { status: 'published', deletedAt: null },
          select: {
            id: true,
            title: true,
            description: true,
            type: true,
            durationMin: true,
            price: true,
            maxStudents: true,
            level: true,
            subject: { select: { nameUz: true, nameRu: true, nameEn: true } },
            sessions: {
              where: { status: 'scheduled', startAt: { gt: new Date() } },
              select: { id: true, startAt: true, endAt: true, capacity: true, _count: { select: { bookings: { where: { status: { in: ['requested', 'confirmed'] } } } } } },
              orderBy: { startAt: 'asc' },
              take: 10,
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        reviews: {
          where: { isHidden: false },
          select: { id: true, rating: true, comment: true, createdAt: true, student: { select: { fullName: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
    // Tasdiqlanmagan profil faqat egasi va adminga ko'rinadi
    const isOwner = req.user && t?.user.id === req.user.id;
    if (!t || (t.verification !== 'APPROVED' && !isOwner && req.user?.role !== 'ADMIN')) throw notFound('TEACHER_NOT_FOUND');
    let isFavorite = false;
    if (req.user) {
      isFavorite = !!(await prisma.favoriteTeacher.findUnique({ where: { userId_teacherId: { userId: req.user.id, teacherId: t.id } } }));
    }
    const ratingBreakdown = await prisma.review.groupBy({
      by: ['rating'],
      where: { teacherId: t.id, isHidden: false },
      _count: { _all: true },
    });
    ok(res, {
      ...t,
      isFavorite,
      ratingBreakdown: [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: ratingBreakdown.find((x) => x.rating === r)?._count._all ?? 0 })),
    });
  }),
);

/** Bo'sh vaqtlar (individual dars uchun bron qilinadigan slotlar) */
teachersRouter.get(
  '/:id/slots',
  ah(async (req, res) => {
    const q = parse(
      z.object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        days: z.coerce.number().int().min(1).max(31).default(14),
        duration: z.coerce.number().int().min(30).max(180).default(60),
      }),
      req.query,
    );
    const teacher = await prisma.teacherProfile.findFirst({
      where: { id: req.params.id, verification: 'APPROVED' },
      include: { availability: true },
    });
    if (!teacher) throw notFound('TEACHER_NOT_FOUND');
    const from = q.from ?? utcToLocalParts(new Date()).dateStr;
    const busy = await prisma.lessonSession.findMany({
      where: {
        teacherId: teacher.id,
        status: { in: ['scheduled', 'in_progress'] },
        endAt: { gt: new Date() },
      },
      select: { startAt: true, endAt: true },
    });
    const slots = computeSlots({ windows: teacher.availability, fromDate: from, days: q.days, durationMin: q.duration, busy });
    ok(res, slots);
  }),
);
