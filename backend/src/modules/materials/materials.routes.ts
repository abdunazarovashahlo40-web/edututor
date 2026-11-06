import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { ah, ok, parse } from '../../common/http';
import { forbidden, notFound } from '../../common/errors';
import { requireAuth, requireRole } from '../../middleware/auth';
import { assertSniff, uploadDoc } from '../../middleware/upload';
import { saveFile } from '../../lib/storage';
import { getTeacherId } from '../../common/owners';

export const materialsRouter = Router();
materialsRouter.use(requireAuth);

/** O'quvchi qaysi materiallarni ko'ra oladi: bron qilgan darslari va o'qituvchilarining ochiq materiallari */
export async function studentMaterialFilter(studentId: string) {
  const bookings = await prisma.booking.findMany({
    where: { studentId, status: { in: ['confirmed', 'completed'] } },
    select: { lessonId: true, teacherId: true },
  });
  const lessonIds = [...new Set(bookings.map((b) => b.lessonId))];
  const teacherIds = [...new Set(bookings.map((b) => b.teacherId))];
  return {
    deletedAt: null,
    OR: [{ lessonId: { in: lessonIds } }, { teacherId: { in: teacherIds }, isPublic: true }, { teacherId: { in: teacherIds }, lessonId: null }],
  };
}

materialsRouter.get(
  '/',
  ah(async (req, res) => {
    const q = parse(z.object({ lessonId: z.string().optional(), q: z.string().optional() }), req.query);
    let where: any;
    if (req.user!.role === 'TEACHER') where = { teacherId: await getTeacherId(req.user!.id), deletedAt: null };
    else if (req.user!.role === 'STUDENT') where = await studentMaterialFilter(req.user!.id);
    else throw forbidden();
    if (q.lessonId) where.lessonId = q.lessonId;
    if (q.q) where.title = { contains: q.q, mode: 'insensitive' };
    const items = await prisma.learningMaterial.findMany({
      where,
      include: {
        lesson: { select: { id: true, title: true } },
        teacher: { select: { user: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    ok(res, items);
  }),
);

materialsRouter.post(
  '/',
  requireRole('TEACHER'),
  uploadDoc.single('file'),
  ah(async (req, res) => {
    assertSniff(req.file);
    const b = parse(
      z.object({
        title: z.string().min(2).max(160),
        description: z.string().max(2000).optional(),
        lessonId: z.string().optional().or(z.literal('')),
        isPublic: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
      }),
      req.body,
    );
    const teacherId = await getTeacherId(req.user!.id);
    if (b.lessonId) {
      const l = await prisma.lesson.findFirst({ where: { id: b.lessonId, teacherId } });
      if (!l) throw forbidden('NOT_OWNER');
    }
    const f = await saveFile(`materials/${teacherId}`, req.file!);
    const m = await prisma.learningMaterial.create({
      data: {
        teacherId,
        lessonId: b.lessonId || null,
        title: b.title,
        description: b.description,
        isPublic: b.isPublic,
        fileUrl: f.url,
        fileName: req.file!.originalname.slice(0, 200),
        mimeType: req.file!.mimetype,
        sizeBytes: req.file!.size,
      },
    });
    ok(res, m, undefined, 201);
  }),
);

materialsRouter.delete(
  '/:id',
  requireRole('TEACHER'),
  ah(async (req, res) => {
    const teacherId = await getTeacherId(req.user!.id);
    const m = await prisma.learningMaterial.findFirst({ where: { id: req.params.id, teacherId, deletedAt: null } });
    if (!m) throw notFound();
    await prisma.learningMaterial.update({ where: { id: m.id }, data: { deletedAt: new Date() } });
    ok(res, { deleted: true });
  }),
);
