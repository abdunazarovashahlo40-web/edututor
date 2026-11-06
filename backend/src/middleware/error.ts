import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { MulterError } from 'multer';
import { AppError } from '../common/errors';
import { env } from '../config/env';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ ok: false, error: { code: 'ROUTE_NOT_FOUND', message: `${req.method} ${req.path}` } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res
      .status(err.status)
      .json({ ok: false, error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err instanceof MulterError) {
    return res.status(400).json({ ok: false, error: { code: 'UPLOAD_' + err.code, message: err.message } });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ ok: false, error: { code: 'DUPLICATE', message: 'Bunday yozuv allaqachon mavjud' } });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Topilmadi' } });
    }
  }
  // Postgres exclusion constraint (double booking) — 23P01
  const msg = (err as Error)?.message ?? '';
  if (msg.includes('lesson_session_no_overlap') || msg.includes('23P01')) {
    return res.status(409).json({ ok: false, error: { code: 'SLOT_TAKEN', message: 'Bu vaqt allaqachon band' } });
  }
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({
    ok: false,
    error: { code: 'INTERNAL', message: env.isProd ? 'Serverda xatolik' : msg },
  });
}
