/**
 * O'qituvchi hujjatlarini rasmiy reyestrlardan qidirish.
 *
 * Muhim: davlat bazalari (diplom.edu.uz, my.uzbmb.uz, OneID/MyID) ochiq API bermaydi — ulanish
 * tegishli idora bilan shartnoma asosida beriladi. Ulanish berilganda faqat .env da
 * REGISTRY_API_URL va REGISTRY_API_KEY to'ldiriladi, qolgan oqim (qidirish → "topildi, yuklab olinsinmi?"
 * → profilga qo'shish) tayyor. Ungacha foydalanuvchi va admin rasmiy tekshiruv sahifalariga yo'naltiriladi.
 */
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { safeEqual } from '../common/crypto';
import crypto from 'node:crypto';

export type DocType = 'diploma' | 'certificate' | 'language' | 'category' | 'other';

export type RegistryQuery = { docType: DocType; docNumber?: string; pinfl?: string; passport?: string };
export type FoundDoc = { title: string; issuer?: string; year?: number; number?: string; fileUrl?: string; source: string };

/** Qo'lda tekshirish uchun rasmiy manbalar */
export const OFFICIAL_SOURCES: Record<DocType, { name: string; url: string }[]> = {
  diploma: [{ name: 'Diplomlar reyestri (diplom.edu.uz, OneID orqali)', url: 'https://diplom.edu.uz' }],
  language: [
    { name: 'Bilim va malakalarni baholash agentligi (my.uzbmb.uz)', url: 'https://my.uzbmb.uz' },
    { name: 'IELTS natijasini tekshirish (ielts.org)', url: 'https://ielts.org/organisations/results-verification-service' },
  ],
  certificate: [{ name: 'Bilim va malakalarni baholash agentligi (uzbmb.uz)', url: 'https://uzbmb.uz' }],
  category: [{ name: 'Yagona interaktiv davlat xizmatlari portali (my.gov.uz)', url: 'https://my.gov.uz' }],
  other: [{ name: 'Yagona interaktiv davlat xizmatlari portali (my.gov.uz)', url: 'https://my.gov.uz' }],
};

export const PINFL_RE = /^\d{14}$/;
export const PASSPORT_RE = /^[A-Z]{2}\d{7}$/;

/** JSHSHIR/pasportni to'liq saqlamaslik uchun: takrorlarni aniqlashga yetadigan HMAC xesh */
export function identityHash(value: string) {
  return crypto.createHmac('sha256', env.JWT_ACCESS_SECRET).update(`identity:${value}`).digest('hex');
}

export function registryConfigured() {
  return !!(env.REGISTRY_API_URL && env.REGISTRY_API_KEY);
}

export async function lookupDocuments(q: RegistryQuery): Promise<{ configured: boolean; found: FoundDoc[] }> {
  if (!registryConfigured()) return { configured: false, found: [] };
  const r = await fetch(env.REGISTRY_API_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.REGISTRY_API_KEY}` },
    body: JSON.stringify(q),
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`registry ${r.status}`);
  const j = (await r.json()) as { documents?: Omit<FoundDoc, 'source'>[]; source?: string };
  return { configured: true, found: (j.documents ?? []).slice(0, 10).map((d) => ({ ...d, source: j.source ?? 'registry' })) };
}

/** Topilgan hujjat ma'lumotini mijozga imzolab beramiz — import paytida o'zgartirib bo'lmasin */
export function signFound(teacherId: string, d: FoundDoc) {
  return jwt.sign({ t: teacherId, d }, env.JWT_ACCESS_SECRET, { expiresIn: '15m', issuer: 'edututor-registry' });
}

export function verifyFound(teacherId: string, token: string): FoundDoc | null {
  try {
    const p = jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: 'edututor-registry' }) as { t: string; d: FoundDoc };
    return safeEqual(p.t, teacherId) ? p.d : null;
  } catch {
    return null;
  }
}
