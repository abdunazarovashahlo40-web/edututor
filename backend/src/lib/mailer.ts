import nodemailer from 'nodemailer';
import { env } from '../config/env';

type Mail = { to: string; subject: string; html: string; text: string };

let transporter: nodemailer.Transporter | null = null;

/** "Ism <email@x.uz>" → { name, email } */
function parseFrom(from: string) {
  const m = /^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/.exec(from);
  return m ? { name: m[1].trim() || 'EduTutor', email: m[2].trim() } : { name: 'EduTutor', email: from.trim() };
}

export async function sendMail(m: Mail) {
  // Brevo (ex-Sendinblue): bepul 300 xat/kun, domen shart emas — tasdiqlangan Gmail manzilidan yuboriladi
  if (env.EMAIL_PROVIDER === 'brevo' && env.BREVO_API_KEY) {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: parseFrom(env.EMAIL_FROM), to: [{ email: m.to }], subject: m.subject, htmlContent: m.html, textContent: m.text }),
    });
    if (!r.ok) console.error('Brevo xatosi', r.status, await r.text());
    else return;
  }
  if (env.EMAIL_PROVIDER === 'resend' && env.RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [m.to], subject: m.subject, html: m.html, text: m.text }),
    });
    if (!r.ok) console.error('Resend xatosi', r.status, await r.text());
    return;
  }
  if (env.EMAIL_PROVIDER === 'smtp' && env.SMTP_HOST) {
    transporter ??= nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      // Gmail App password bo'sh joy bilan ko'rsatiladi — olib tashlaymiz
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: (env.SMTP_PASS ?? '').replace(/\s+/g, '') } : undefined,
      // port yopiq bo'lsa so'rov osilib qolmasin
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 20_000,
    });
    await transporter.sendMail({ from: env.EMAIL_FROM, ...m });
    return;
  }
  // eslint-disable-next-line no-console
  console.log(`\n📧 [EMAIL → ${m.to}] ${m.subject}\n${m.text}\n`);
}

const T = {
  uz: {
    verify: ['EduTutor: tasdiqlash kodi', 'Hisobingizni tasdiqlash kodi'],
    reset: ['EduTutor: parolni tiklash', 'Parolni tiklash kodi'],
    note: 'Kod 10 daqiqa amal qiladi. Agar bu siz bo\'lmasangiz, xatni e\'tiborsiz qoldiring.',
  },
  ru: {
    verify: ['EduTutor: код подтверждения', 'Код подтверждения аккаунта'],
    reset: ['EduTutor: восстановление пароля', 'Код для восстановления пароля'],
    note: 'Код действует 10 минут. Если это были не вы, проигнорируйте письмо.',
  },
  en: {
    verify: ['EduTutor: verification code', 'Your account verification code'],
    reset: ['EduTutor: password reset', 'Your password reset code'],
    note: 'The code is valid for 10 minutes. If this wasn\'t you, ignore this email.',
  },
} as const;

export function otpMail(to: string, code: string, kind: 'verify' | 'reset', locale: 'uz' | 'ru' | 'en' = 'uz'): Mail {
  const t = T[locale] ?? T.uz;
  const [subject, title] = t[kind];
  const html = `<!doctype html><html><body style="margin:0;background:#F8FAFF;font-family:Inter,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
  <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;box-shadow:0 10px 30px rgba(109,40,217,.12);overflow:hidden">
  <tr><td style="background:linear-gradient(135deg,#6D28D9,#3B82F6);padding:24px;color:#fff;font-size:22px;font-weight:700">🎓 EduTutor</td></tr>
  <tr><td style="padding:28px;color:#111827"><p style="margin:0 0 12px;font-size:16px">${title}:</p>
  <p style="margin:0 0 20px;font-size:36px;letter-spacing:10px;font-weight:800;color:#6D28D9">${code}</p>
  <p style="margin:0;color:#64748B;font-size:13px">${t.note}</p></td></tr></table></td></tr></table></body></html>`;
  return { to, subject, html, text: `${title}: ${code}\n${t.note}` };
}
