import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env } from '../config/env';

export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

export interface StoredFile {
  url: string;
  key: string;
}

function makeKey(folder: string, originalName: string) {
  const ext = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 8);
  return `${folder}/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}${ext}`;
}

/**
 * Fayl saqlash adapteri:
 *  - local: backend/uploads (dev, VPS)
 *  - supabase: Supabase Storage (Render — disk vaqtinchalik bo'lgani uchun prod'da shu tavsiya etiladi)
 */
export async function saveFile(folder: string, file: { originalname: string; buffer: Buffer; mimetype: string }): Promise<StoredFile> {
  const key = makeKey(folder, file.originalname);
  if (env.STORAGE_DRIVER === 'supabase') {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase storage sozlanmagan');
    const r = await fetch(`${env.SUPABASE_URL}/storage/v1/object/${env.SUPABASE_BUCKET}/${key}`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': file.mimetype,
        'x-upsert': 'false',
      },
      body: file.buffer,
    });
    if (!r.ok) throw new Error(`Supabase upload xatosi: ${r.status} ${await r.text()}`);
    // Bucket private: fayl /api/v1/uploads/<key> orqali (ruxsat tekshirilib) beriladi
    return { key, url: `/api/v1/uploads/${key}` };
  }
  const full = path.join(UPLOAD_DIR, key);
  await fs.promises.mkdir(path.dirname(full), { recursive: true });
  await fs.promises.writeFile(full, file.buffer);
  return { key, url: `/api/v1/uploads/${key}` };
}

/** Faylni o'qish uchun oqim yoki Supabase signed URL qaytaradi */
export async function getFile(key: string): Promise<{ type: 'path'; path: string } | { type: 'redirect'; url: string } | null> {
  if (key.includes('..')) return null;
  if (env.STORAGE_DRIVER === 'supabase') {
    const r = await fetch(`${env.SUPABASE_URL}/storage/v1/object/sign/${env.SUPABASE_BUCKET}/${key}`, {
      method: 'POST',
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 300 }),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { signedURL?: string };
    if (!j.signedURL) return null;
    return { type: 'redirect', url: `${env.SUPABASE_URL}/storage/v1${j.signedURL}` };
  }
  const full = path.join(UPLOAD_DIR, key);
  if (!full.startsWith(UPLOAD_DIR) || !fs.existsSync(full)) return null;
  return { type: 'path', path: full };
}
