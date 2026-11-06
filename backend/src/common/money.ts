/**
 * Pul hisob-kitoblari. UZS butun so'mlarda yuritiladi (tiyin ishlatilmaydi),
 * lekin DB'da Decimal(14,2). Hisoblashda floating xatolarni oldini olish uchun
 * tiyinlarda (x100) butun sonlar bilan ishlaymiz.
 */
export const toTiyin = (v: number | string | { toString(): string }) =>
  Math.round(Number(v.toString()) * 100);
export const fromTiyin = (t: number) => (t / 100).toFixed(2);

export function splitCommission(gross: number | string, percent: number) {
  const g = toTiyin(gross);
  const commission = Math.round((g * percent) / 100);
  return { gross: fromTiyin(g), commission: fromTiyin(commission), net: fromTiyin(g - commission) };
}

/** Dars narxi: soatlik narx * davomiylik, 1000 so'mgacha yaxlitlanadi */
export function lessonPrice(hourly: number | string, durationMin: number) {
  const raw = (Number(hourly.toString()) * durationMin) / 60;
  return Math.round(raw / 1000) * 1000;
}

/**
 * Bekor qilish siyosati (real bozor uchun moslashtirilgan):
 *  - o'qituvchi bekor qilsa / rad etsa  → 100% qaytariladi
 *  - o'quvchi darsdan 24 soat oldin     → 100%
 *  - o'quvchi 24 soat ichida (2 soatdan ko'p qolganda) → 50%
 *  - o'quvchi 2 soatdan kam qolganda yoki kelmasa      → 0%
 */
export function refundPercent(by: 'student' | 'teacher' | 'admin', startAt: Date, now = new Date()) {
  if (by !== 'student') return 100;
  const hours = (startAt.getTime() - now.getTime()) / 3_600_000;
  if (hours >= 24) return 100;
  if (hours >= 2) return 50;
  return 0;
}

export function percentOf(amount: number | string, percent: number) {
  return fromTiyin(Math.round((toTiyin(amount) * percent) / 100));
}
