import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { ah, ok } from '../../common/http';
import { notFound } from '../../common/errors';
import { studentAnalytics } from '../analytics/analytics.routes';

export const subjectsRouter = Router();

let cache: { at: number; data: unknown } | null = null;

/** Ochiq ro'yxat — 60 soniya keshlanadi */
subjectsRouter.get(
  '/',
  ah(async (_req, res) => {
    if (!cache || Date.now() - cache.at > 60_000) {
      const subjects = await prisma.subject.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { nameUz: 'asc' }],
        include: {
          _count: {
            select: { teachers: { where: { teacher: { verification: 'APPROVED', user: { status: 'ACTIVE' } } } } },
          },
        },
      });
      cache = {
        at: Date.now(),
        data: subjects.map(({ _count, ...s }) => ({ ...s, teacherCount: _count.teachers })),
      };
    }
    res.set('Cache-Control', 'public, max-age=60');
    ok(res, cache.data);
  }),
);

export const invalidateSubjects = () => {
  cache = null;
};

/** Landing sahifasi uchun ochiq statistika (5 daqiqa kesh) */
export const publicRouter = Router();
let statsCache: { at: number; data: unknown } | null = null;
publicRouter.get(
  '/stats',
  ah(async (_req, res) => {
    if (!statsCache || Date.now() - statsCache.at > 300_000) {
      const [teachers, students, lessons, rating] = await Promise.all([
        prisma.teacherProfile.count({ where: { verification: 'APPROVED', user: { status: 'ACTIVE' } } }),
        prisma.user.count({ where: { role: 'STUDENT', deletedAt: null } }),
        prisma.booking.count({ where: { status: 'completed' } }),
        prisma.review.aggregate({ where: { isHidden: false }, _avg: { rating: true } }),
      ]);
      statsCache = { at: Date.now(), data: { teachers, students, lessons, rating: Math.round((rating._avg.rating ?? 0) * 10) / 10 } };
    }
    res.set('Cache-Control', 'public, max-age=300');
    ok(res, statsCache.data);
  }),
);

/** Bosh sahifa uchun haqiqiy sharhlar (faqat izohli, yashirilmagan, 4–5 yulduz) — o'ylab topilgan "otzivlar" emas */
publicRouter.get(
  '/reviews',
  ah(async (_req, res) => {
    const items = await prisma.review.findMany({
      where: { isHidden: false, rating: { gte: 4 }, comment: { not: null } },
      orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
      take: 6,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        student: { select: { fullName: true, avatarUrl: true } },
        teacher: { select: { id: true, user: { select: { fullName: true } } } },
      },
    });
    res.set('Cache-Control', 'public, max-age=300');
    ok(
      res,
      items
        .filter((r) => (r.comment ?? '').trim().length >= 10)
        .slice(0, 3)
        .map((r) => ({ ...r, student: { name: r.student.fullName.split(' ').map((p, i) => (i === 0 ? p : `${p[0]}.`)).join(' '), avatarUrl: r.student.avatarUrl } })),
    );
  }),
);

/**
 * Ota-ona sahifasi: o'quvchi ulashgan havola orqali (login talab qilinmaydi) faqat o'qiladigan natijalar.
 * Kontakt ma'lumotlari, to'lovlar va xabarlar ko'rsatilmaydi.
 */
publicRouter.get(
  '/progress/:token',
  ah(async (req, res) => {
    const token = String(req.params.token);
    if (token.length < 16 || token.length > 64) throw notFound('LINK_NOT_FOUND');
    const user = await prisma.user.findFirst({
      where: { parentShareToken: token, role: 'STUDENT', deletedAt: null },
      select: { id: true, fullName: true, avatarUrl: true },
    });
    if (!user) throw notFound('LINK_NOT_FOUND', 'Havola topilmadi yoki o\'chirilgan');
    const subjectSel = { select: { id: true, nameUz: true, nameRu: true, nameEn: true, slug: true } };
    const teacherSel = { select: { user: { select: { fullName: true } } } };
    const [analytics, recent, upcoming, homework] = await Promise.all([
      studentAnalytics(user.id),
      prisma.booking.findMany({
        where: { studentId: user.id, status: { in: ['completed', 'no_show'] } },
        orderBy: { session: { startAt: 'desc' } },
        take: 10,
        select: {
          id: true,
          status: true,
          lessonSummary: true,
          session: { select: { startAt: true } },
          lesson: { select: { title: true, durationMin: true, subject: subjectSel } },
          teacher: teacherSel,
        },
      }),
      prisma.booking.findMany({
        where: { studentId: user.id, status: { in: ['requested', 'confirmed'] }, session: { endAt: { gt: new Date() } } },
        orderBy: { session: { startAt: 'asc' } },
        take: 5,
        select: { id: true, status: true, session: { select: { startAt: true } }, lesson: { select: { title: true, subject: subjectSel } }, teacher: teacherSel },
      }),
      prisma.homework.findMany({
        where: { studentId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          title: true,
          status: true,
          dueAt: true,
          maxScore: true,
          submissions: { select: { score: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
    ]);
    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    ok(res, {
      student: { firstName: user.fullName.split(' ')[0], avatarUrl: user.avatarUrl },
      analytics,
      recent,
      upcoming,
      homework: homework.map((h) => ({ ...h, score: h.submissions[0]?.score ?? null, submissions: undefined })),
    });
  }),
);
