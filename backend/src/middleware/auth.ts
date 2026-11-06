import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { forbidden, locked, unauthorized } from '../common/errors';

export interface AuthUser {
  id: string;
  role: Role;
  sid: string;
  fullName: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const ACCESS_COOKIE = 'et_access';
export const REFRESH_COOKIE = 'et_refresh';
export const CSRF_COOKIE = 'et_csrf';
export const ACCESS_TTL_SEC = 15 * 60;

export function signAccess(payload: { sub: string; role: Role; sid: string }) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TTL_SEC, issuer: 'edututor' });
}

export function verifyAccess(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: 'edututor' }) as {
    sub: string;
    role: Role;
    sid: string;
  };
}

function readToken(req: Request) {
  const c = req.cookies?.[ACCESS_COOKIE];
  if (c) return c as string;
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) return h.slice(7);
  return null;
}

async function resolve(req: Request, allowLocked: boolean) {
  const token = readToken(req);
  if (!token) throw unauthorized('NO_TOKEN');
  let payload: ReturnType<typeof verifyAccess>;
  try {
    payload = verifyAccess(token);
  } catch {
    throw unauthorized('TOKEN_EXPIRED');
  }
  const session = await prisma.authSession.findUnique({
    where: { id: payload.sid },
    select: {
      revokedAt: true,
      expiresAt: true,
      requiresUnlock: true,
      user: { select: { id: true, role: true, status: true, fullName: true, deletedAt: true } },
    },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) throw unauthorized('SESSION_REVOKED');
  const u = session.user;
  if (u.deletedAt) throw unauthorized('USER_DELETED');
  if (u.status === 'SUSPENDED') throw forbidden('ACCOUNT_SUSPENDED');
  if (session.requiresUnlock && !allowLocked) throw locked();
  req.user = { id: u.id, role: u.role, sid: payload.sid, fullName: u.fullName };
}

/** Kirish majburiy */
export const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
  resolve(req, false).then(() => next(), next);
};

/** Ilova qulflangan holatda ham ruxsat (lock screen uchun) */
export const requireAuthAllowLocked = (req: Request, _res: Response, next: NextFunction) => {
  resolve(req, true).then(() => next(), next);
};

/** Ixtiyoriy autentifikatsiya: token bo'lsa user o'rnatiladi */
export const optionalAuth = (req: Request, _res: Response, next: NextFunction) => {
  if (!readToken(req)) return next();
  resolve(req, false).then(
    () => next(),
    () => next(),
  );
};

/** Rolga asoslangan avtorizatsiya (RBAC) */
export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden('ROLE_FORBIDDEN'));
    next();
  };
