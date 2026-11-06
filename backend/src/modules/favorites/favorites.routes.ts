import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { ah, ok } from '../../common/http';
import { notFound } from '../../common/errors';
import { requireAuth } from '../../middleware/auth';
import { teacherCardSelect } from '../teachers/teachers.routes';

export const favoritesRouter = Router();
favoritesRouter.use(requireAuth);

favoritesRouter.get(
  '/',
  ah(async (req, res) => {
    const favs = await prisma.favoriteTeacher.findMany({
      where: { userId: req.user!.id },
      include: { teacher: { select: teacherCardSelect } },
      orderBy: { createdAt: 'desc' },
    });
    ok(res, favs.map((f) => ({ ...f.teacher, isFavorite: true })));
  }),
);

favoritesRouter.post(
  '/:teacherId',
  ah(async (req, res) => {
    const t = await prisma.teacherProfile.findUnique({ where: { id: req.params.teacherId } });
    if (!t) throw notFound();
    const key = { userId_teacherId: { userId: req.user!.id, teacherId: t.id } };
    const exists = await prisma.favoriteTeacher.findUnique({ where: key });
    if (exists) await prisma.favoriteTeacher.delete({ where: key });
    else await prisma.favoriteTeacher.create({ data: { userId: req.user!.id, teacherId: t.id } });
    ok(res, { isFavorite: !exists });
  }),
);
