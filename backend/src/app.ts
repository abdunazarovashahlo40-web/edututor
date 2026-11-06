import express from 'express';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { apiLimiter, csrf, sanitizeBody } from './middleware/security';
import { errorHandler, notFoundHandler } from './middleware/error';
import { buildOpenApi } from './openapi';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { subjectsRouter, publicRouter } from './modules/subjects/subjects.routes';
import { teachersRouter } from './modules/teachers/teachers.routes';
import { availabilityRouter } from './modules/availability/availability.routes';
import { lessonsRouter } from './modules/lessons/lessons.routes';
import { bookingsRouter } from './modules/bookings/bookings.routes';
import { meetingsRouter } from './modules/meetings/meetings.routes';
import { homeworkRouter } from './modules/homework/homework.routes';
import { materialsRouter } from './modules/materials/materials.routes';
import { messagesRouter } from './modules/messages/messages.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { paymentsRouter, paymentWebhooksRouter } from './modules/payments/payments.routes';
import { reviewsRouter } from './modules/reviews/reviews.routes';
import { favoritesRouter } from './modules/favorites/favorites.routes';
import { complaintsRouter } from './modules/complaints/complaints.routes';
import { analyticsRouter } from './modules/analytics/analytics.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { uploadsRouter } from './modules/uploads/uploads.routes';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // Render / Nginx ortida haqiqiy IP uchun
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'script-src': ["'self'", 'https://accounts.google.com', 'https://telegram.org', 'https://oauth.telegram.org'],
          'frame-src': ["'self'", 'https://accounts.google.com', 'https://oauth.telegram.org', 'https://meet.jit.si', env.JITSI_BASE_URL],
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          'media-src': ["'self'", 'blob:'],
          'connect-src': ["'self'", 'wss:', 'ws:', 'https://accounts.google.com'],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://accounts.google.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());
  app.use(cookieParser());

  // CORS: prod'da frontend va API bitta domenda (backend frontend'ni o'zi beradi). Dev'da Vite proxy ishlatiladi.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && env.corsOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.get(['/api/health', '/api/v1/health'], async (_req, res) => {
    let db = 'ok';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'down';
    }
    res.status(db === 'ok' ? 200 : 503).json({ status: db === 'ok' ? 'ok' : 'degraded', db, time: new Date().toISOString(), version: '1.0.0' });
  });

  const spec = buildOpenApi();
  app.get('/api/openapi.json', (_req, res) => res.json(spec));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'EduTutor API' }));

  // Webhooklar — JSON parser bilan, lekin CSRF va cookie auth'siz
  app.use('/api/v1/webhooks', express.json({ limit: '200kb' }), paymentWebhooksRouter);

  const api = express.Router();
  api.use(express.json({ limit: '1mb' }));
  api.use(express.urlencoded({ extended: false, limit: '1mb' }));
  api.use(apiLimiter);
  api.use(csrf());
  api.use(sanitizeBody);

  api.use('/auth', authRouter);
  api.use('/users', usersRouter);
  api.use('/subjects', subjectsRouter);
  api.use('/public', publicRouter);
  api.use('/teachers', teachersRouter);
  api.use('/availability', availabilityRouter);
  api.use('/lessons', lessonsRouter);
  api.use('/bookings', bookingsRouter);
  api.use('/meetings', meetingsRouter);
  api.use('/homework', homeworkRouter);
  api.use('/materials', materialsRouter);
  api.use('/messages', messagesRouter);
  api.use('/notifications', notificationsRouter);
  api.use('/payments', paymentsRouter);
  api.use('/reviews', reviewsRouter);
  api.use('/favorites', favoritesRouter);
  api.use('/complaints', complaintsRouter);
  api.use('/analytics', analyticsRouter);
  api.use('/admin', adminRouter);
  api.use('/uploads', uploadsRouter);
  api.use(notFoundHandler);

  app.use('/api/v1', api);

  // Prod: frontend build (SPA) shu serverdan beriladi → bitta domen, cookie/CORS muammosiz
  const webDist = path.resolve(__dirname, '../../frontend/dist');
  if (fs.existsSync(webDist)) {
    app.use(
      express.static(webDist, {
        index: false,
        setHeaders: (res, file) => {
          if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          else if (file.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
        },
      }),
    );
    app.get(/^(?!\/api\/|\/socket\.io\/).*/, (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
