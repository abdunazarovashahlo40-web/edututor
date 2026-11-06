import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { randomToken, safeEqual } from '../common/crypto';
import { forbidden } from '../common/errors';
import { env } from '../config/env';
import { CSRF_COOKIE } from './auth';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF himoyasi (double-submit cookie). Brauzer cookie'ni o'qib X-CSRF-Token sarlavhasida
 * qaytaradi. Boshqa saytlar bu cookie'ni o'qiy olmaydi. To'lov webhooklari o'z imzosi bilan himoyalangan.
 */
export function csrf(exemptPrefixes: string[] = []) {
  return (req: Request, res: Response, next: NextFunction) => {
    let token = req.cookies?.[CSRF_COOKIE] as string | undefined;
    if (!token) {
      token = randomToken(24);
      res.cookie(CSRF_COOKIE, token, {
        httpOnly: false,
        sameSite: 'lax',
        secure: env.isProd,
        path: '/',
      });
    }
    if (SAFE.has(req.method)) return next();
    if (exemptPrefixes.some((p) => req.originalUrl.startsWith(p))) return next();
    const header = req.get('x-csrf-token') ?? '';
    if (!req.cookies?.[CSRF_COOKIE] || !safeEqual(header, req.cookies[CSRF_COOKIE])) {
      return next(forbidden('CSRF_INVALID'));
    }
    next();
  };
}

const json429 = { ok: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Juda ko\'p so\'rov. Birozdan keyin urinib ko\'ring.' } };

export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.isTest ? 10_000 : 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: json429,
});

/** Login/OTP/parol tiklash uchun qattiq cheklov (brute-force himoyasi) */
export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: env.isTest ? 10_000 : 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: json429,
});

/** Matnli maydonlardan HTML teglarni olib tashlash (XSS ga qarshi qo'shimcha qatlam; React o'zi ham escape qiladi) */
export function stripTags(input: unknown): unknown {
  if (typeof input === 'string') return input.replace(/<\/?[a-zA-Z!][^>]*>/g, '').trim();
  if (Array.isArray(input)) return input.map(stripTags);
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) out[k] = k.toLowerCase().includes('password') ? v : stripTags(v);
    return out;
  }
  return input;
}

export const sanitizeBody = (req: Request, _res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) req.body = stripTags(req.body);
  next();
};
