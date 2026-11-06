import type { Server } from 'socket.io';

let io: Server | null = null;
export const setIO = (s: Server) => {
  io = s;
};
export const getIO = () => io;

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}

/* -------- Onlayn holat: foydalanuvchining nechta ochiq ulanishi bor -------- */
const online = new Map<string, number>();
export function markOnline(userId: string) {
  online.set(userId, (online.get(userId) ?? 0) + 1);
}
export function markOffline(userId: string) {
  const n = (online.get(userId) ?? 1) - 1;
  if (n <= 0) online.delete(userId);
  else online.set(userId, n);
}
export const isOnline = (userId: string) => online.has(userId);
export const onlineUserIds = () => [...online.keys()];
