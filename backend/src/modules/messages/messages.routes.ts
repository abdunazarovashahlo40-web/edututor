import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { ah, ok, parse } from '../../common/http';
import { badRequest, forbidden, notFound } from '../../common/errors';
import { requireAuth } from '../../middleware/auth';
import { assertSniff, uploadDoc } from '../../middleware/upload';
import { saveFile } from '../../lib/storage';
import { emitToUser, getIO } from '../../lib/realtime';
import { notify } from '../../lib/notify';
import { maskContacts } from '../../common/contacts';

export const messagesRouter = Router();
messagesRouter.use(requireAuth);

const userSel = { id: true, fullName: true, avatarUrl: true, role: true } as const;

async function hasPaidRelation(a: string, b: string) {
  return !!(await prisma.booking.findFirst({
    where: {
      status: { in: ['confirmed', 'completed'] },
      OR: [
        { studentId: a, teacher: { userId: b } },
        { studentId: b, teacher: { userId: a } },
      ],
    },
    select: { id: true },
  }));
}

async function canStart(me: { id: string; role: string }, otherId: string) {
  if (me.id === otherId) return false;
  const other = await prisma.user.findUnique({ where: { id: otherId }, include: { teacherProfile: { select: { verification: true } } } });
  if (!other || other.deletedAt || other.status !== 'ACTIVE') return false;
  if (me.role === 'ADMIN' || other.role === 'ADMIN') return true;
  // O'quvchi istalgan tasdiqlangan o'qituvchiga yozishi mumkin (bron oldidan savol)
  if (me.role === 'STUDENT' && other.role === 'TEACHER') return other.teacherProfile?.verification === 'APPROVED';
  // O'qituvchi faqat o'z o'quvchilariga yoza oladi
  if (me.role === 'TEACHER' && other.role === 'STUDENT') {
    return !!(await prisma.booking.findFirst({ where: { studentId: otherId, teacher: { userId: me.id } } }));
  }
  return false;
}

async function loadConversation(id: string, userId: string) {
  const c = await prisma.conversation.findUnique({ where: { id } });
  if (!c) throw notFound();
  if (c.userAId !== userId && c.userBId !== userId) throw forbidden();
  return { c, otherId: c.userAId === userId ? c.userBId : c.userAId };
}

messagesRouter.get(
  '/conversations',
  ah(async (req, res) => {
    const me = req.user!.id;
    const convs = await prisma.conversation.findMany({
      where: { OR: [{ userAId: me }, { userBId: me }] },
      include: {
        userA: { select: userSel },
        userB: { select: userSel },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
    });
    const unread = await prisma.message.groupBy({
      by: ['conversationId'],
      where: { conversationId: { in: convs.map((c) => c.id) }, senderId: { not: me }, readAt: null },
      _count: { _all: true },
    });
    ok(
      res,
      convs.map((c) => ({
        id: c.id,
        other: c.userAId === me ? c.userB : c.userA,
        lastMessage: c.messages[0] ?? null,
        lastMessageAt: c.lastMessageAt,
        unread: unread.find((u) => u.conversationId === c.id)?._count._all ?? 0,
      })),
    );
  }),
);

messagesRouter.post(
  '/conversations',
  ah(async (req, res) => {
    const { userId } = parse(z.object({ userId: z.string() }), req.body);
    const me = req.user!;
    const [a, b] = [me.id, userId].sort();
    const existing = await prisma.conversation.findUnique({ where: { userAId_userBId: { userAId: a, userBId: b } } });
    if (existing) return ok(res, existing);
    if (!(await canStart(me, userId))) throw forbidden('CANNOT_MESSAGE', 'Bu foydalanuvchiga yozib bo\'lmaydi');
    const c = await prisma.conversation.create({ data: { userAId: a, userBId: b } });
    ok(res, c, undefined, 201);
  }),
);

messagesRouter.get(
  '/conversations/:id/messages',
  ah(async (req, res) => {
    const { c } = await loadConversation(req.params.id, req.user!.id);
    const q = parse(z.object({ before: z.string().datetime().optional(), limit: z.coerce.number().min(1).max(100).default(40) }), req.query);
    const items = await prisma.message.findMany({
      where: { conversationId: c.id, ...(q.before ? { createdAt: { lt: new Date(q.before) } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: q.limit,
      include: { booking: { select: { id: true, lesson: { select: { title: true } }, session: { select: { startAt: true } } } } },
    });
    ok(res, items.reverse(), { hasMore: items.length === q.limit });
  }),
);

messagesRouter.post(
  '/conversations/:id/messages',
  uploadDoc.single('file'),
  ah(async (req, res) => {
    const me = req.user!;
    const { c, otherId } = await loadConversation(req.params.id, me.id);
    const b = parse(z.object({ body: z.string().max(4000).default(''), bookingId: z.string().optional().or(z.literal('')) }), req.body);
    if (!b.body.trim() && !req.file) throw badRequest('EMPTY_MESSAGE');
    let attachmentUrl: string | undefined;
    if (req.file) {
      assertSniff(req.file);
      attachmentUrl = (await saveFile(`messages/${c.id}`, req.file)).url;
    }
    if (b.bookingId) {
      const bk = await prisma.booking.findFirst({
        where: { id: b.bookingId, OR: [{ studentId: me.id }, { teacher: { userId: me.id } }] },
      });
      if (!bk) throw forbidden('BOOKING_CONTEXT');
    }
    const paid = me.role === 'ADMIN' || (await hasPaidRelation(me.id, otherId));
    const body = paid ? b.body.trim() : maskContacts(b.body.trim());
    const msg = await prisma.$transaction(async (tx) => {
      const m = await tx.message.create({
        data: { conversationId: c.id, senderId: me.id, body, attachmentUrl, bookingId: b.bookingId || null },
      });
      await tx.conversation.update({ where: { id: c.id }, data: { lastMessageAt: m.createdAt } });
      return m;
    });
    emitToUser(otherId, 'message:new', { ...msg, conversationId: c.id });
    emitToUser(me.id, 'message:new', { ...msg, conversationId: c.id });
    // Qabul qiluvchi onlayn bo'lmasa — bildirishnoma
    const online = (await getIO()?.in(`user:${otherId}`).fetchSockets())?.length ?? 0;
    if (!online) {
      const role = (await prisma.user.findUnique({ where: { id: otherId }, select: { role: true } }))?.role;
      await notify(otherId, 'message.new', `Yangi xabar: ${me.fullName}`, body.slice(0, 120), `/${role === 'TEACHER' ? 'teacher' : role === 'ADMIN' ? 'admin' : 'student'}/messages?c=${c.id}`);
    }
    ok(res, msg, undefined, 201);
  }),
);

messagesRouter.post(
  '/conversations/:id/read',
  ah(async (req, res) => {
    const { c, otherId } = await loadConversation(req.params.id, req.user!.id);
    const r = await prisma.message.updateMany({
      where: { conversationId: c.id, senderId: { not: req.user!.id }, readAt: null },
      data: { readAt: new Date() },
    });
    if (r.count) emitToUser(otherId, 'message:read', { conversationId: c.id });
    ok(res, { read: r.count });
  }),
);

messagesRouter.get(
  '/unread-count',
  ah(async (req, res) => {
    const me = req.user!.id;
    const count = await prisma.message.count({
      where: { readAt: null, senderId: { not: me }, conversation: { OR: [{ userAId: me }, { userBId: me }] } },
    });
    ok(res, { count });
  }),
);
