import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { ah, ok } from '../../common/http';

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
