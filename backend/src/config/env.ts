import { z } from 'zod';
import path from 'path';
import fs from 'fs';

// .env faylini yuklash (Node 20.12+). Render/Docker'da o'zgaruvchilar to'g'ridan-to'g'ri beriladi.
for (const p of [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '..', '.env')]) {
  if (fs.existsSync(p)) {
    try {
      (process as any).loadEnvFile?.(p);
    } catch {
      /* ignore */
    }
    break;
  }
}

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  APP_URL: z.string().default('http://localhost:5173'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL kerak'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET kamida 32 belgi'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET kamida 32 belgi'),
  WEBAUTHN_RP_ID: z.string().default('localhost'),
  WEBAUTHN_RP_NAME: z.string().default('EduTutor'),
  EMAIL_PROVIDER: z.enum(['console', 'brevo', 'resend', 'smtp', 'gmail_script']).default('console'),
  // Google Apps Script "ko'prik": Gmail orqali HTTPS bilan yuborish (SMTP porti yopiq hostinglar uchun)
  GMAIL_SCRIPT_URL: z.string().optional(),
  GMAIL_SCRIPT_TOKEN: z.string().optional(),
  BREVO_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('EduTutor <no-reply@edututor.uz>'),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  // Davlat reyestri (diplom/sertifikat) bilan rasmiy ulanish berilganda to'ldiriladi — bo'sh bo'lsa qo'lda tekshiruv
  REGISTRY_API_URL: z.string().url().optional(),
  REGISTRY_API_KEY: z.string().optional(),
  STORAGE_DRIVER: z.enum(['local', 'supabase']).default('local'),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_BUCKET: z.string().default('edututor'),
  MAX_UPLOAD_MB: z.coerce.number().default(10),
  PAYMENT_SANDBOX: bool,
  PLATFORM_COMMISSION_PERCENT: z.coerce.number().min(0).max(50).default(15),
  PAYME_MERCHANT_ID: z.string().optional(),
  PAYME_SECRET_KEY: z.string().optional(),
  PAYME_CHECKOUT_URL: z.string().default('https://checkout.paycom.uz'),
  CLICK_SERVICE_ID: z.string().optional(),
  CLICK_MERCHANT_ID: z.string().optional(),
  CLICK_SECRET_KEY: z.string().optional(),
  VIDEO_PROVIDER: z.enum(['webrtc', 'jitsi']).default('webrtc'),
  JITSI_BASE_URL: z.string().default('https://meet.jit.si'),
  TURN_URL: z.string().optional(),
  TURN_USERNAME: z.string().optional(),
  TURN_CREDENTIAL: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_BOT_USERNAME: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Muhit o\'zgaruvchilari xato:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
};

if (env.isProd && env.EMAIL_PROVIDER === 'console') {
  // eslint-disable-next-line no-console
  console.warn('⚠️  EMAIL_PROVIDER=console production rejimida — tasdiqlash kodlari faqat logga yoziladi.');
}
