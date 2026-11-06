import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import type { OtpPurpose, User } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { randomCode, randomToken, sha256 } from '../../common/crypto';
import { badRequest, tooMany } from '../../common/errors';
import { ACCESS_COOKIE, ACCESS_TTL_SEC, REFRESH_COOKIE, signAccess } from '../../middleware/auth';
import { otpMail, sendMail } from '../../lib/mailer';

export const BCRYPT_ROUNDS = 12;
const OTP_TTL_MIN = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_SEC = 60;
export const IDLE_LOCK_MIN = 5;

export const hashPassword = (p: string) => bcrypt.hash(p, BCRYPT_ROUNDS);
export const checkPassword = (p: string, h: string) => bcrypt.compare(p, h);

const cookieBase = () => ({
  httpOnly: true,
  secure: env.isProd,
  sameSite: 'lax' as const,
});

export async function issueSession(req: Request, res: Response, user: Pick<User, 'id' | 'role'>, remember: boolean) {
  const refresh = randomToken(48);
  const ttlMs = (remember ? 30 : 1) * 24 * 3600_000;
  // Bank ilovalaridagidek: shu telefonda avval PIN o'rnatilgan bo'lsa, yangi kirishda ham u saqlanadi
  const rawDevice = req.get('x-device-id');
  const device =
    rawDevice && rawDevice.length <= 40
      ? await prisma.appDevice.findFirst({ where: { id: rawDevice, userId: user.id, pinHash: { not: null } }, select: { id: true } })
      : null;
  const session = await prisma.authSession.create({
    data: {
      userId: user.id,
      refreshTokenHash: sha256(refresh),
      userAgent: req.get('user-agent')?.slice(0, 250),
      ip: req.ip,
      expiresAt: new Date(Date.now() + ttlMs),
      deviceId: device?.id ?? null,
    },
  });
  setAuthCookies(res, user, session.id, refresh, remember ? ttlMs : undefined);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), failedLogins: 0, lockedUntil: null } });
  return session;
}

export function setAuthCookies(
  res: Response,
  user: Pick<User, 'id' | 'role'>,
  sid: string,
  refresh: string,
  refreshMaxAge?: number,
) {
  res.cookie(ACCESS_COOKIE, signAccess({ sub: user.id, role: user.role, sid }), {
    ...cookieBase(),
    path: '/',
    maxAge: ACCESS_TTL_SEC * 1000,
  });
  res.cookie(REFRESH_COOKIE, refresh, {
    ...cookieBase(),
    path: '/api/v1/auth',
    ...(refreshMaxAge ? { maxAge: refreshMaxAge } : {}),
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { ...cookieBase(), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...cookieBase(), path: '/api/v1/auth' });
}

export async function createOtp(user: Pick<User, 'id' | 'email' | 'locale'>, purpose: OtpPurpose) {
  const last = await prisma.otpCode.findFirst({
    where: { userId: user.id, purpose },
    orderBy: { createdAt: 'desc' },
  });
  if (last && Date.now() - last.createdAt.getTime() < OTP_RESEND_COOLDOWN_SEC * 1000) {
    throw tooMany('OTP_COOLDOWN', 'Kodni qayta yuborish uchun 60 soniya kuting');
  }
  const code = randomCode(6);
  await prisma.otpCode.updateMany({ where: { userId: user.id, purpose, consumedAt: null }, data: { consumedAt: new Date() } });
  await prisma.otpCode.create({
    data: { userId: user.id, purpose, codeHash: sha256(code), expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60_000) },
  });
  if (user.email) {
    await sendMail(otpMail(user.email, code, purpose === 'EMAIL_VERIFY' ? 'verify' : 'reset', user.locale));
  }
  return env.isProd ? undefined : code; // dev/test uchun javobda qaytariladi
}

export async function consumeOtp(userId: string, purpose: OtpPurpose, code: string) {
  const otp = await prisma.otpCode.findFirst({
    where: { userId, purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp || otp.expiresAt < new Date()) throw badRequest('OTP_EXPIRED', 'Kod muddati tugagan. Yangi kod so\'rang');
  if (otp.attempts >= OTP_MAX_ATTEMPTS) throw tooMany('OTP_ATTEMPTS', 'Urinishlar soni tugadi. Yangi kod so\'rang');
  if (otp.codeHash !== sha256(code)) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw badRequest('OTP_INVALID', 'Kod noto\'g\'ri');
  }
  await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
}

export function normalizePhone(p?: string | null) {
  if (!p) return undefined;
  const digits = p.replace(/\D/g, '');
  if (digits.length === 9) return `+998${digits}`;
  if (digits.length === 12 && digits.startsWith('998')) return `+${digits}`;
  return undefined;
}

export async function findByLogin(login: string) {
  const l = login.trim().toLowerCase();
  if (l.includes('@')) return prisma.user.findUnique({ where: { email: l } });
  const phone = normalizePhone(l);
  return phone ? prisma.user.findUnique({ where: { phone } }) : null;
}

export async function publicMe(userId: string, sid: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      phone: true,
      fullName: true,
      avatarUrl: true,
      role: true,
      status: true,
      locale: true,
      emailVerifiedAt: true,
      createdAt: true,
      studentProfile: true,
      teacherProfile: {
        select: {
          id: true,
          verification: true,
          verificationNote: true,
          hourlyPrice: true,
          headline: true,
          ratingAvg: true,
          ratingCount: true,
        },
      },
    },
  });
  const session = await prisma.authSession.findUnique({ where: { id: sid } });
  const device = session?.deviceId ? await prisma.appDevice.findUnique({ where: { id: session.deviceId } }) : null;
  return {
    ...user,
    appLock: {
      locked: !!session?.requiresUnlock,
      deviceId: device?.id ?? null,
      hasPin: !!device?.pinHash,
      hasBiometric: !!device?.credentialId,
      idleLockMinutes: IDLE_LOCK_MIN,
    },
  };
}
