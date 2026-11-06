import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ah, ok, parse } from '../../common/http';
import { badRequest, conflict, forbidden, notFound } from '../../common/errors';
import { requireAuth, requireRole } from '../../middleware/auth';
import { assertSniff, uploadDoc } from '../../middleware/upload';
import { saveFile } from '../../lib/storage';
import { getTeacherId } from '../../common/owners';
import { notify } from '../../lib/notify';

export const homeworkRouter = Router();
homeworkRouter.use(requireAuth);

const include = {
  teacher: { select: { id: true, user: { select: { id: true, fullName: true, avatarUrl: true } } } },
  student: { select: { id: true, fullName: true, avatarUrl: true } },
  session: { select: { id: true, startAt: true, lesson: { select: { title: true } } } },
  submissions: { orderBy: { createdAt: 'desc' as const } },
} satisfies Prisma.HomeworkInclude;

async function loadHomework(id: string, userId: string) {
  const h = await prisma.homework.findUnique({ where: { id }, include });
  if (!h) throw notFound();
  const isTeacher = h.teacher.user.id === userId;
  const isStudent = h.studentId === userId;
  if (!isTeacher && !isStudent) throw forbidden();
  return { h, isTeacher, isStudent };
}

homeworkRouter.get(
  '/',
  ah(async (req, res) => {
    const q = parse(z.object({ status: z.string().optional(), studentId: z.string().optional() }), req.query);
    const where: Prisma.HomeworkWhereInput = {};
    if (req.user!.role === 'STUDENT') where.studentId = req.user!.id;
    else if (req.user!.role === 'TEACHER') {
      where.teacherId = await getTeacherId(req.user!.id);
      if (q.studentId) where.studentId = q.studentId;
    } else throw forbidden();
    if (q.status) where.status = q.status as any;
    const items = await prisma.homework.findMany({ where, include, orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }] });
    ok(res, items);
  }),
);

homeworkRouter.get(
  '/:id',
  ah(async (req, res) => ok(res, (await loadHomework(req.params.id, req.user!.id)).h)),
);

homeworkRouter.post(
  '/',
  requireRole('TEACHER'),
  uploadDoc.single('file'),
  ah(async (req, res) => {
    const b = parse(
      z.object({
        studentIds: z.union([z.string(), z.array(z.string())]).transform((v) => (Array.isArray(v) ? v : v.split(',').filter(Boolean))),
        title: z.string().min(3).max(160),
        description: z.string().max(4000).optional(),
        dueAt: z.string().datetime().optional().or(z.literal('')),
        sessionId: z.string().optional().or(z.literal('')),
        maxScore: z.coerce.number().int().min(1).max(1000).default(100),
      }),
      req.body,
    );
    if (!b.studentIds.length) throw badRequest('STUDENTS_REQUIRED', 'Kamida bitta o\'quvchini tanlang');
    const teacherId = await getTeacherId(req.user!.id);
    // Faqat o'z o'quvchilariga (bron qilgan) vazifa berish mumkin
    const valid = await prisma.booking.findMany({
      where: { teacherId, studentId: { in: b.studentIds }, status: { in: ['confirmed', 'completed'] } },
      select: { studentId: true },
      distinct: ['studentId'],
    });
    if (valid.length !== new Set(b.studentIds).size) throw forbidden('NOT_YOUR_STUDENT', 'Faqat o\'z o\'quvchilaringizga vazifa bera olasiz');
    let attachmentUrl: string | undefined;
    if (req.file) {
      assertSniff(req.file);
      attachmentUrl = (await saveFile(`homework/${teacherId}`, req.file)).url;
    }
    const created = await prisma.$transaction(
      b.studentIds.map((studentId) =>
        prisma.homework.create({
          data: {
            teacherId,
            studentId,
            title: b.title,
            description: b.description,
            dueAt: b.dueAt ? new Date(b.dueAt) : null,
            sessionId: b.sessionId || null,
            maxScore: b.maxScore,
            attachmentUrl,
          },
        }),
      ),
    );
    await Promise.all(created.map((h) => notify(h.studentId, 'homework.assigned', 'Yangi uy vazifasi', h.title, '/student/homework', { homeworkId: h.id })));
    ok(res, created, undefined, 201);
  }),
);

homeworkRouter.post(
  '/:id/submit',
  requireRole('STUDENT'),
  uploadDoc.single('file'),
  ah(async (req, res) => {
    const { h, isStudent } = await loadHomework(req.params.id, req.user!.id);
    if (!isStudent) throw forbidden();
    if (h.status === 'completed') throw conflict('HOMEWORK_CLOSED', 'Vazifa yopilgan');
    const b = parse(z.object({ text: z.string().max(5000).optional() }), req.body);
    if (!b.text && !req.file) throw badRequest('EMPTY_SUBMISSION', 'Javob matni yoki fayl kerak');
    let fileUrl: string | undefined;
    if (req.file) {
      assertSniff(req.file);
      fileUrl = (await saveFile(`submissions/${h.id}`, req.file)).url;
    }
    const s = await prisma.$transaction(async (tx) => {
      const sub = await tx.homeworkSubmission.create({ data: { homeworkId: h.id, studentId: req.user!.id, text: b.text, fileUrl } });
      await tx.homework.update({ where: { id: h.id }, data: { status: 'submitted' } });
      return sub;
    });
    await notify(h.teacher.user.id, 'homework.submitted', 'Vazifa topshirildi', `${h.student.fullName}: ${h.title}`, '/teacher/homework', { homeworkId: h.id });
    ok(res, s, undefined, 201);
  }),
);

homeworkRouter.post(
  '/:id/review',
  requireRole('TEACHER'),
  ah(async (req, res) => {
    const { h, isTeacher } = await loadHomework(req.params.id, req.user!.id);
    if (!isTeacher) throw forbidden();
    const b = parse(
      z.object({ score: z.number().int().min(0), feedback: z.string().max(3000).optional(), complete: z.boolean().default(true) }),
      req.body,
    );
    if (b.score > h.maxScore) throw badRequest('SCORE_MAX', `Maksimal ball: ${h.maxScore}`);
    const last = h.submissions[0];
    if (!last) throw conflict('NO_SUBMISSION', 'Hali topshirilmagan');
    await prisma.$transaction([
      prisma.homeworkSubmission.update({ where: { id: last.id }, data: { score: b.score, feedback: b.feedback, reviewedAt: new Date() } }),
      prisma.homework.update({ where: { id: h.id }, data: { status: b.complete ? 'completed' : 'reviewed' } }),
    ]);
    await notify(h.studentId, 'homework.reviewed', 'Vazifangiz tekshirildi', `${h.title}: ${b.score}/${h.maxScore}`, '/student/homework', { homeworkId: h.id });
    ok(res, { reviewed: true });
  }),
);

homeworkRouter.delete(
  '/:id',
  requireRole('TEACHER'),
  ah(async (req, res) => {
    const { h, isTeacher } = await loadHomework(req.params.id, req.user!.id);
    if (!isTeacher) throw forbidden();
    await prisma.homework.delete({ where: { id: h.id } });
    ok(res, { deleted: true });
  }),
);
