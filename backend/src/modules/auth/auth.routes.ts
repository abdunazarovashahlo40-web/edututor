import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { ah, ok, parse } from '../../common/http';
import { badRequest, forbidden, unauthorized } from '../../common/errors';
import { randomToken, sha256 } from '../../common/crypto';
import { authLimiter } from '../../middleware/security';
import { REFRESH_COOKIE, requireAuth, requireAuthAllowLocked } from '../../middleware/auth';
import { audit } from '../../lib/audit';
import {
  IDLE_LOCK_MIN,
  checkPassword,
  clearAuthCookies,
  consumeOtp,
  createOtp,
  findByLogin,
  hashPassword,
  issueSession,
  normalizePhone,
  publicMe,
  setAuthCookies,
} from './auth.service';
import { appLockRouter } from './applock.routes';
import { verifyTelegram } from '../../common/telegram';

export const authRouter = Router();

let _dummy: string | null = null;
const dummyHash = () => (_dummy ??= bcrypt.hashSync('not-a-real-password', 12));

const password = z
  .string()
  .min(8, 'Parol kamida 8 belgi')
  .max(128)
  .regex(/[A-Za-z]/, 'Parolda harf bo\'lishi kerak')
  .regex(/\d/, 'Parolda raqam bo\'lishi kerak');

const registerSchema = z.object({
  fullName: z.string().min(3).max(100),
  email: z.string().email().max(160).transform((v) => v.toLowerCase()),
  phone: z.string().optional(),
  password,
  role: z.enum(['STUDENT', 'TEACHER']), // ADMIN ro'yxatdan o'tish orqali olinmaydi
  acceptTerms: z.literal(true),
  locale: z.enum(['uz', 'ru', 'en']).default('uz'),
});

authRouter.get('/csrf', (_req, res) => ok(res, { ready: true }));

authRouter.post(
  '/register',
  authLimiter,
  ah(async (req, res) => {
    const b = parse(registerSchema, req.body);
    const phone = normalizePhone(b.phone);
    if (b.phone && !phone) throw badRequest('PHONE_INVALID', 'Telefon raqam formati: +998 XX XXX XX XX');
    const exists = await prisma.user.findFirst({ where: { OR: [{ email: b.email }, ...(phone ? [{ phone }] : [])] } });
    if (exists) {
      // Tasdiqlanmagan eski hisobni qayta ro'yxatdan o'tkazishga ruxsat
      if (exists.status === 'PENDING_VERIFICATION' && exists.email === b.email) {
        await prisma.user.update({
          where: { id: exists.id },
          data: { fullName: b.fullName, passwordHash: await hashPassword(b.password), locale: b.locale },
        });
        const devCode = await createOtp(exists, 'EMAIL_VERIFY').catch(() => undefined);
        return ok(res, { email: exists.email, needsVerification: true, devCode });
      }
      throw badRequest('USER_EXISTS', 'Bu email yoki telefon bilan hisob mavjud');
    }
    const user = await prisma.user.create({
      data: {
        fullName: b.fullName,
        email: b.email,
        phone,
        passwordHash: await hashPassword(b.password),
        role: b.role,
        locale: b.locale,
        ...(b.role === 'STUDENT' ? { studentProfile: { create: {} } } : { teacherProfile: { create: {} } }),
      },
    });
    const devCode = await createOtp(user, 'EMAIL_VERIFY');
    ok(res, { email: user.email, needsVerification: true, devCode }, undefined, 201);
  }),
);

authRouter.post(
  '/verify-email',
  authLimiter,
  ah(async (req, res) => {
    const b = parse(z.object({ email: z.string().email(), code: z.string().length(6) }), req.body);
    const user = await prisma.user.findUnique({ where: { email: b.email.toLowerCase() } });
    if (!user) throw badRequest('OTP_INVALID', 'Kod noto\'g\'ri');
    await consumeOtp(user.id, 'EMAIL_VERIFY', b.code);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date(), status: user.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE' },
    });
    if (updated.status === 'SUSPENDED') throw forbidden('ACCOUNT_SUSPENDED');
    const s = await issueSession(req, res, updated, true);
    ok(res, await publicMe(updated.id, s.id));
  }),
);

authRouter.post(
  '/resend-otp',
  authLimiter,
  ah(async (req, res) => {
    const b = parse(z.object({ email: z.string().email(), purpose: z.enum(['EMAIL_VERIFY', 'PASSWORD_RESET']).default('EMAIL_VERIFY') }), req.body);
    const user = await prisma.user.findUnique({ where: { email: b.email.toLowerCase() } });
    let devCode: string | undefined;
    if (user && (b.purpose === 'PASSWORD_RESET' || !user.emailVerifiedAt)) devCode = await createOtp(user, b.purpose);
    ok(res, { sent: true, devCode });
  }),
);

authRouter.post(
  '/login',
  authLimiter,
  ah(async (req, res) => {
    const b = parse(
      z.object({ login: z.string().min(3).max(160), password: z.string().min(1).max(128), remember: z.boolean().default(false) }),
      req.body,
    );
    const user = await findByLogin(b.login);
    const generic = unauthorized('INVALID_CREDENTIALS', 'Login yoki parol noto\'g\'ri');
    if (!user || !user.passwordHash || user.deletedAt) {
      await bcrypt.compare(b.password, dummyHash()); // foydalanuvchi mavjudligini vaqt orqali bilib bo'lmasligi uchun
      throw generic;
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw forbidden('ACCOUNT_TEMP_LOCKED', 'Ko\'p noto\'g\'ri urinish. 15 daqiqadan keyin qayta urinib ko\'ring');
    }
    if (!(await checkPassword(b.password, user.passwordHash))) {
      const failed = user.failedLogins + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLogins: failed, lockedUntil: failed >= 5 ? new Date(Date.now() + 15 * 60_000) : null },
      });
      if (failed >= 5) await audit(req, 'auth.lockout', 'User', user.id);
      throw generic;
    }
    if (user.status === 'SUSPENDED') throw forbidden('ACCOUNT_SUSPENDED', 'Hisob bloklangan');
    if (!user.emailVerifiedAt) {
      const devCode = await createOtp(user, 'EMAIL_VERIFY').catch(() => undefined);
      return res.status(403).json({
        ok: false,
        error: { code: 'EMAIL_NOT_VERIFIED', message: 'Email tasdiqlanmagan', details: { email: user.email, devCode } },
      });
    }
    const s = await issueSession(req, res, user, b.remember);
    ok(res, await publicMe(user.id, s.id));
  }),
);

authRouter.post(
  '/refresh',
  ah(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!token) throw unauthorized('NO_REFRESH');
    const session = await prisma.authSession.findUnique({ where: { refreshTokenHash: sha256(token) }, include: { user: true } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      clearAuthCookies(res);
      throw unauthorized('SESSION_EXPIRED');
    }
    if (session.user.status === 'SUSPENDED' || session.user.deletedAt) {
      clearAuthCookies(res);
      throw forbidden('ACCOUNT_SUSPENDED');
    }
    // Bank ilovalaridagidek: PIN o'rnatilgan qurilmada 5 daqiqa faolsizlikdan so'ng qulflash
    const idle = Date.now() - session.lastActiveAt.getTime() > IDLE_LOCK_MIN * 60_000;
    const next = randomToken(48);
    await prisma.authSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: sha256(next),
        lastActiveAt: new Date(),
        requiresUnlock: session.requiresUnlock || (!!session.deviceId && idle),
      },
    });
    const remaining = session.expiresAt.getTime() - Date.now();
    setAuthCookies(res, session.user, session.id, next, remaining > 2 * 24 * 3600_000 ? remaining : undefined);
    ok(res, { refreshed: true });
  }),
);

authRouter.post(
  '/logout',
  ah(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (token) {
      await prisma.authSession.updateMany({ where: { refreshTokenHash: sha256(token) }, data: { revokedAt: new Date() } });
    }
    clearAuthCookies(res);
    ok(res, { loggedOut: true });
  }),
);

authRouter.get(
  '/me',
  requireAuthAllowLocked,
  ah(async (req, res) => {
    await prisma.authSession.update({ where: { id: req.user!.sid }, data: { lastActiveAt: new Date() } });
    ok(res, await publicMe(req.user!.id, req.user!.sid));
  }),
);

authRouter.post(
  '/forgot-password',
  authLimiter,
  ah(async (req, res) => {
    const b = parse(z.object({ email: z.string().email() }), req.body);
    const user = await prisma.user.findUnique({ where: { email: b.email.toLowerCase() } });
    let devCode: string | undefined;
    if (user && !user.deletedAt) devCode = await createOtp(user, 'PASSWORD_RESET').catch(() => undefined);
    // Foydalanuvchi mavjudligini oshkor qilmaslik uchun har doim bir xil javob
    ok(res, { sent: true, devCode });
  }),
);

authRouter.post(
  '/reset-password',
  authLimiter,
  ah(async (req, res) => {
    const b = parse(z.object({ email: z.string().email(), code: z.string().length(6), password }), req.body);
    const user = await prisma.user.findUnique({ where: { email: b.email.toLowerCase() } });
    if (!user) throw badRequest('OTP_INVALID', 'Kod noto\'g\'ri');
    await consumeOtp(user.id, 'PASSWORD_RESET', b.code);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await hashPassword(b.password),
          failedLogins: 0,
          lockedUntil: null,
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
          status: user.status === 'PENDING_VERIFICATION' ? 'ACTIVE' : user.status,
        },
      }),
      prisma.authSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await audit(req, 'auth.password_reset', 'User', user.id);
    ok(res, { reset: true });
  }),
);

authRouter.post(
  '/change-password',
  requireAuth,
  ah(async (req, res) => {
    const b = parse(z.object({ currentPassword: z.string(), newPassword: password }), req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!user.passwordHash || !(await checkPassword(b.currentPassword, user.passwordHash))) {
      throw badRequest('WRONG_PASSWORD', 'Joriy parol noto\'g\'ri');
    }
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(b.newPassword) } }),
      prisma.authSession.updateMany({
        where: { userId: user.id, revokedAt: null, NOT: { id: req.user!.sid } },
        data: { revokedAt: new Date() },
      }),
    ]);
    ok(res, { changed: true });
  }),
);

/* ------------------------- Ijtimoiy kirish ------------------------- */

const socialRole = z.enum(['STUDENT', 'TEACHER']).default('STUDENT');

authRouter.get('/providers', (_req, res) =>
  ok(res, { google: !!env.GOOGLE_CLIENT_ID, telegram: !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_BOT_USERNAME), telegramBot: env.TELEGRAM_BOT_USERNAME ?? null }),
);

authRouter.post(
  '/google',
  authLimiter,
  ah(async (req, res) => {
    if (!env.GOOGLE_CLIENT_ID) throw badRequest('PROVIDER_DISABLED', 'Google orqali kirish sozlanmagan');
    const b = parse(z.object({ credential: z.string().min(10), role: socialRole }), req.body);
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(b.credential)}`);
    if (!r.ok) throw unauthorized('GOOGLE_INVALID');
    const info = (await r.json()) as { aud: string; sub: string; email?: string; email_verified?: string; name?: string; picture?: string };
    if (info.aud !== env.GOOGLE_CLIENT_ID || info.email_verified !== 'true' || !info.email) throw unauthorized('GOOGLE_INVALID');
    const email = info.email.toLowerCase();
    let user = await prisma.user.findFirst({ where: { OR: [{ googleId: info.sub }, { email }] } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          googleId: info.sub,
          fullName: info.name ?? email.split('@')[0],
          avatarUrl: info.picture,
          role: b.role,
          status: 'ACTIVE',
          emailVerifiedAt: new Date(),
          ...(b.role === 'STUDENT' ? { studentProfile: { create: {} } } : { teacherProfile: { create: {} } }),
        },
      });
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: info.sub, emailVerifiedAt: user.emailVerifiedAt ?? new Date(), status: user.status === 'PENDING_VERIFICATION' ? 'ACTIVE' : user.status },
      });
    }
    if (user.status === 'SUSPENDED') throw forbidden('ACCOUNT_SUSPENDED');
    const s = await issueSession(req, res, user, true);
    ok(res, await publicMe(user.id, s.id));
  }),
);

authRouter.post(
  '/telegram',
  authLimiter,
  ah(async (req, res) => {
    if (!env.TELEGRAM_BOT_TOKEN) throw badRequest('PROVIDER_DISABLED', 'Telegram orqali kirish sozlanmagan');
    const b = parse(z.object({ data: z.record(z.string()), role: socialRole }), req.body);
    const data = Object.fromEntries(Object.entries(b.data).map(([k, v]) => [k, String(v)]));
    if (!verifyTelegram(data, env.TELEGRAM_BOT_TOKEN)) throw unauthorized('TELEGRAM_INVALID');
    let user = await prisma.user.findUnique({ where: { telegramId: data.id } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          telegramId: data.id,
          fullName: [data.first_name, data.last_name].filter(Boolean).join(' ') || data.username || 'Telegram user',
          avatarUrl: data.photo_url,
          role: b.role,
          status: 'ACTIVE',
          ...(b.role === 'STUDENT' ? { studentProfile: { create: {} } } : { teacherProfile: { create: {} } }),
        },
      });
    }
    if (user.status === 'SUSPENDED') throw forbidden('ACCOUNT_SUSPENDED');
    const s = await issueSession(req, res, user, true);
    ok(res, await publicMe(user.id, s.id));
  }),
);

authRouter.use('/app-lock', appLockRouter);
