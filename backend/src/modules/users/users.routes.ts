import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { ah, ok, parse } from '../../common/http';
import { requireAuth } from '../../middleware/auth';
import { assertSniff, uploadImage } from '../../middleware/upload';
import { saveFile } from '../../lib/storage';
import { normalizePhone } from '../auth/auth.service';
import { badRequest } from '../../common/errors';
import { clearAuthCookies } from '../auth/auth.service';

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.patch(
  '/me',
  ah(async (req, res) => {
    const b = parse(
      z.object({
        fullName: z.string().min(3).max(100).optional(),
        phone: z.string().optional().nullable(),
        locale: z.enum(['uz', 'ru', 'en']).optional(),
        student: z
          .object({
            grade: z.string().max(40).optional().nullable(),
            goals: z.string().max(500).optional().nullable(),
            city: z.string().max(60).optional().nullable(),
            birthYear: z.number().int().min(1940).max(2025).optional().nullable(),
          })
          .optional(),
      }),
      req.body,
    );
    let phone: string | null | undefined = undefined;
    if (b.phone === null || b.phone === '') phone = null;
    else if (b.phone) {
      phone = normalizePhone(b.phone);
      if (!phone) throw badRequest('PHONE_INVALID', 'Telefon raqam formati: +998 XX XXX XX XX');
    }
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { fullName: b.fullName, locale: b.locale, phone },
      select: { id: true, fullName: true, phone: true, locale: true },
    });
    if (b.student && req.user!.role === 'STUDENT') {
      await prisma.studentProfile.upsert({
        where: { userId: req.user!.id },
        create: { userId: req.user!.id, ...b.student },
        update: b.student,
      });
    }
    ok(res, user);
  }),
);

usersRouter.post(
  '/me/avatar',
  uploadImage.single('file'),
  ah(async (req, res) => {
    assertSniff(req.file);
    const f = await saveFile('avatars', req.file!);
    // Avatarlar ochiq: /api/v1/uploads/avatars/... ruxsatsiz beriladi
    await prisma.user.update({ where: { id: req.user!.id }, data: { avatarUrl: f.url } });
    ok(res, { avatarUrl: f.url });
  }),
);

usersRouter.get(
  '/me/sessions',
  ah(async (req, res) => {
    const sessions = await prisma.authSession.findMany({
      where: { userId: req.user!.id, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userAgent: true, ip: true, lastActiveAt: true, createdAt: true },
      orderBy: { lastActiveAt: 'desc' },
    });
    ok(res, sessions.map((s) => ({ ...s, current: s.id === req.user!.sid })));
  }),
);

usersRouter.delete(
  '/me/sessions/:id',
  ah(async (req, res) => {
    await prisma.authSession.updateMany({ where: { id: req.params.id, userId: req.user!.id }, data: { revokedAt: new Date() } });
    ok(res, { revoked: true });
  }),
);

/** Hisobni o'chirish (soft delete + shaxsiy ma'lumotlarni anonimlashtirish) */
usersRouter.delete(
  '/me',
  ah(async (req, res) => {
    const id = req.user!.id;
    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          email: `deleted+${id}@edututor.local`,
          phone: null,
          googleId: null,
          telegramId: null,
          fullName: 'O\'chirilgan foydalanuvchi',
          avatarUrl: null,
          passwordHash: null,
        },
      }),
      prisma.authSession.updateMany({ where: { userId: id }, data: { revokedAt: new Date() } }),
    ]);
    clearAuthCookies(res);
    ok(res, { deleted: true });
  }),
);
