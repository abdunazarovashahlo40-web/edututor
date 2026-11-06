import crypto from 'crypto';

export const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');
export const md5 = (v: string) => crypto.createHash('md5').update(v).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const randomCode = (digits = 6) =>
  crypto.randomInt(0, 10 ** digits).toString().padStart(digits, '0');

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export function receiptNumber() {
  const d = new Date();
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, '');
  return `ET-${ymd}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}
