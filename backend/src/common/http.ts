import type { NextFunction, Request, Response, RequestHandler } from 'express';
import { z, ZodTypeAny } from 'zod';
import { badRequest } from './errors';

/** async route handler'larda xatolarni error middleware'ga uzatadi */
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

/** Yagona javob formati: { ok: true, data, meta? } */
export function ok(res: Response, data: unknown, meta?: Record<string, unknown>, status = 200) {
  return res.status(status).json({ ok: true, data, ...(meta ? { meta } : {}) });
}

export function parse<T extends ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const r = schema.safeParse(value);
  if (!r.success) throw badRequest('VALIDATION_ERROR', 'Ma\'lumotlar noto\'g\'ri', r.error.flatten());
  return r.data;
}

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export function paginate(page: number, limit: number) {
  return { skip: (page - 1) * limit, take: limit };
}

export function pageMeta(page: number, limit: number, total: number) {
  return { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
}
