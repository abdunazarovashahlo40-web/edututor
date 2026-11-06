import type { Server } from 'socket.io';

let io: Server | null = null;
export const setIO = (s: Server) => {
  io = s;
};
export const getIO = () => io;

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}
