import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { ah, ok, pageMeta, paginate, parse } from '../../common/http';
import { requireAuth } from '../../middleware/auth';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get(
  '/',
  ah(async (req, res) => {
    const q = parse(
      z.object({ unread: z.enum(['true', 'false']).optional(), page: z.coerce.number().default(1), limit: z.coerce.number().max(100).default(30) }),
      req.query,
    );
    const where = { userId: req.user!.id, ...(q.unread === 'true' ? { readAt: null } : {}) };
    const [items, total, unread] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginate(q.page, q.limit) }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: req.user!.id, readAt: null } }),
    ]);
    ok(res, items, { ...pageMeta(q.page, q.limit, total), unread });
  }),
);

notificationsRouter.post(
  '/:id/read',
  ah(async (req, res) => {
    await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user!.id }, data: { readAt: new Date() } });
    ok(res, { read: true });
  }),
);

notificationsRouter.post(
  '/read-all',
  ah(async (req, res) => {
    const r = await prisma.notification.updateMany({ where: { userId: req.user!.id, readAt: null }, data: { readAt: new Date() } });
    ok(res, { read: r.count });
  }),
);
