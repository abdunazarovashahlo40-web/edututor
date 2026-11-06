import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { ah, ok, parse } from '../../common/http';
import { requireAuth } from '../../middleware/auth';
import { notify } from '../../lib/notify';

export const complaintsRouter = Router();
complaintsRouter.use(requireAuth);

complaintsRouter.post(
  '/',
  ah(async (req, res) => {
    const b = parse(
      z.object({
        targetType: z.enum(['user', 'review', 'lesson', 'booking', 'other']),
        targetId: z.string().max(60).default('-'),
        reason: z.string().min(10).max(2000),
      }),
      req.body,
    );
    const c = await prisma.complaint.create({ data: { ...b, authorId: req.user!.id } });
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
    await Promise.all(admins.map((a) => notify(a.id, 'system', 'Yangi shikoyat', b.reason.slice(0, 100), '/admin/complaints')));
    ok(res, c, undefined, 201);
  }),
);

complaintsRouter.get(
  '/mine',
  ah(async (req, res) => {
    ok(res, await prisma.complaint.findMany({ where: { authorId: req.user!.id }, orderBy: { createdAt: 'desc' } }));
  }),
);
