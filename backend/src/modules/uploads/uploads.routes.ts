import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { ah } from '../../common/http';
import { forbidden, notFound } from '../../common/errors';
import { optionalAuth } from '../../middleware/auth';
import { getFile } from '../../lib/storage';
import { studentMaterialFilter } from '../materials/materials.routes';

export const uploadsRouter = Router();

/**
 * Fayllarni ruxsat tekshirib berish. Avatarlar — ochiq; qolganlari faqat tegishli foydalanuvchilarga.
 */
uploadsRouter.get(
  '/*',
  optionalAuth,
  ah(async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    const url = `/api/v1/uploads/${key}`;
    const folder = key.split('/')[0];
    const u = req.user;
    const isAdmin = u?.role === 'ADMIN';
    let allowed = folder === 'avatars';

    if (!allowed && u) {
      if (isAdmin) allowed = true;
      else if (folder === 'certificates') {
        allowed = !!(await prisma.teacherCertificate.findFirst({ where: { fileUrl: url, teacher: { userId: u.id } } }));
      } else if (folder === 'materials') {
        const m = await prisma.learningMaterial.findFirst({ where: { fileUrl: url, deletedAt: null }, include: { teacher: true } });
        if (m) {
          if (m.teacher.userId === u.id) allowed = true;
          else if (u.role === 'STUDENT') {
            allowed = !!(await prisma.learningMaterial.findFirst({ where: { id: m.id, ...(await studentMaterialFilter(u.id)) } }));
          }
        }
      } else if (folder === 'homework') {
        allowed = !!(await prisma.homework.findFirst({
          where: { attachmentUrl: url, OR: [{ studentId: u.id }, { teacher: { userId: u.id } }] },
        }));
      } else if (folder === 'submissions') {
        allowed = !!(await prisma.homeworkSubmission.findFirst({
          where: { fileUrl: url, OR: [{ studentId: u.id }, { homework: { teacher: { userId: u.id } } }] },
        }));
      } else if (folder === 'messages') {
        allowed = !!(await prisma.message.findFirst({
          where: { attachmentUrl: url, conversation: { OR: [{ userAId: u.id }, { userBId: u.id }] } },
        }));
      }
    }
    if (!allowed) throw u ? forbidden() : notFound();
    const f = await getFile(key);
    if (!f) throw notFound();
    res.set('X-Content-Type-Options', 'nosniff');
    if (folder !== 'avatars') res.set('Cache-Control', 'private, max-age=300');
    else res.set('Cache-Control', 'public, max-age=86400');
    if (f.type === 'redirect') return res.redirect(f.url);
    res.sendFile(f.path, { dotfiles: 'deny' });
  }),
);
