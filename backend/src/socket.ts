import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { setIO } from './lib/realtime';
import { ACCESS_COOKIE, verifyAccess } from './middleware/auth';
import { authorizeRoomKey } from './modules/meetings/meetings.service';

interface SocketUser {
  id: string;
  role: string;
  fullName: string;
}

function parseCookies(header?: string) {
  const out: Record<string, string> = {};
  (header ?? '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

/**
 * Socket.IO: realtime bildirishnomalar, chat va WebRTC signalizatsiya.
 * Ulanishda HttpOnly access cookie tekshiriladi; xona kirishida ruxsat qayta tekshiriladi.
 */
export function createSocket(server: HttpServer) {
  const io = new Server(server, {
    path: '/socket.io',
    cors: { origin: env.corsOrigins, credentials: true },
  });
  setIO(io);

  io.use(async (socket, next) => {
    try {
      const token = parseCookies(socket.handshake.headers.cookie)[ACCESS_COOKIE];
      if (!token) return next(new Error('UNAUTHORIZED'));
      const p = verifyAccess(token);
      const s = await prisma.authSession.findUnique({
        where: { id: p.sid },
        select: { revokedAt: true, requiresUnlock: true, user: { select: { id: true, role: true, fullName: true, status: true } } },
      });
      if (!s || s.revokedAt || s.requiresUnlock || s.user.status !== 'ACTIVE') return next(new Error('UNAUTHORIZED'));
      socket.data.user = { id: s.user.id, role: s.user.role, fullName: s.user.fullName } satisfies SocketUser;
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user as SocketUser;
    socket.join(`user:${user.id}`);

    /* -------- Chat: yozayapti indikatori -------- */
    socket.on('chat:typing', async ({ conversationId }: { conversationId: string }) => {
      const c = await prisma.conversation.findUnique({ where: { id: String(conversationId) } });
      if (!c || (c.userAId !== user.id && c.userBId !== user.id)) return;
      const other = c.userAId === user.id ? c.userBId : c.userAId;
      io.to(`user:${other}`).emit('chat:typing', { conversationId, userId: user.id });
    });

    /* -------- Video dars: WebRTC signalizatsiya -------- */
    socket.on('room:join', async ({ roomKey }: { roomKey: string }, ack?: (r: unknown) => void) => {
      try {
        const a = await authorizeRoomKey(user.id, user.role, String(roomKey));
        const room = `room:${a.meeting.roomKey}`;
        const peers = (await io.in(room).fetchSockets()).map((s) => ({
          socketId: s.id,
          user: s.data.user as SocketUser,
          media: s.data.media ?? { audio: true, video: true },
        }));
        if (peers.length >= 8) return ack?.({ ok: false, error: 'ROOM_FULL' });
        socket.data.room = room;
        socket.data.media = { audio: true, video: true };
        await socket.join(room);
        socket.to(room).emit('room:peer-joined', { socketId: socket.id, user, media: socket.data.media });
        if (a.booking) {
          await prisma.bookingParticipant.updateMany({
            where: { bookingId: a.booking.id, userId: user.id },
            data: { joinedAt: new Date(), attended: true },
          });
        }
        ack?.({ ok: true, peers, isTeacher: a.isTeacher });
      } catch (e) {
        ack?.({ ok: false, error: (e as { code?: string }).code ?? 'FORBIDDEN' });
      }
    });

    socket.on('rtc:signal', ({ to, data }: { to: string; data: unknown }) => {
      const room = socket.data.room as string | undefined;
      if (!room) return;
      const target = io.sockets.sockets.get(String(to));
      if (!target || target.data.room !== room) return; // faqat bir xonadagilar o'rtasida
      target.emit('rtc:signal', { from: socket.id, user, data });
    });

    socket.on('room:media', (media: { audio: boolean; video: boolean; screen?: boolean }) => {
      const room = socket.data.room as string | undefined;
      if (!room) return;
      socket.data.media = media;
      socket.to(room).emit('room:media', { socketId: socket.id, media });
    });

    socket.on('room:chat', (text: string) => {
      const room = socket.data.room as string | undefined;
      if (!room || typeof text !== 'string') return;
      io.to(room).emit('room:chat', { from: user, text: text.slice(0, 500), at: Date.now() });
    });

    const leave = () => {
      const room = socket.data.room as string | undefined;
      if (!room) return;
      socket.to(room).emit('room:peer-left', { socketId: socket.id });
      socket.leave(room);
      socket.data.room = undefined;
    };
    socket.on('room:leave', leave);
    socket.on('disconnect', leave);
  });

  return io;
}
