/**
 * Vaqt yordamchilari. O'zbekiston (Asia/Tashkent) UTC+5, yozgi vaqt yo'q —
 * shuning uchun mahalliy vaqtni UTC'ga aylantirish oddiy siljish bilan aniq.
 */
export const TZ = 'Asia/Tashkent';
export const TZ_OFFSET_MIN = 5 * 60;

/** "2026-11-06" + 600 (daqiqa, mahalliy) → UTC Date */
export function localDateMinuteToUtc(dateStr: string, minute: number): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, minute - TZ_OFFSET_MIN));
}

/** UTC Date → mahalliy (Tashkent) sana "YYYY-MM-DD", hafta kuni va daqiqa */
export function utcToLocalParts(date: Date) {
  const local = new Date(date.getTime() + TZ_OFFSET_MIN * 60_000);
  const dateStr = local.toISOString().slice(0, 10);
  return {
    dateStr,
    weekday: local.getUTCDay(),
    minute: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}

export function addDays(dateStr: string, n: number) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

export interface WeeklyWindow {
  weekday: number;
  startMinute: number;
  endMinute: number;
}

/**
 * O'qituvchining haftalik jadvali va band vaqtlaridan bo'sh slotlarni hisoblaydi.
 * @param fromDate mahalliy sana "YYYY-MM-DD"
 * @param days necha kun oldinga
 * @param durationMin dars davomiyligi
 * @param stepMin slotlar qadami (odatda 30)
 * @param busy band oraliqlar (UTC)
 * @param minLeadMin hozirdan kamida necha daqiqa keyin (oxirgi daqiqada bron qilinmasligi uchun)
 */
export function computeSlots(opts: {
  windows: WeeklyWindow[];
  fromDate: string;
  days: number;
  durationMin: number;
  stepMin?: number;
  busy: { startAt: Date; endAt: Date }[];
  now?: Date;
  minLeadMin?: number;
}) {
  const step = opts.stepMin ?? 30;
  const now = opts.now ?? new Date();
  const earliest = new Date(now.getTime() + (opts.minLeadMin ?? 120) * 60_000);
  const result: { date: string; startAt: string; endAt: string; localStart: number }[] = [];
  for (let i = 0; i < opts.days; i++) {
    const dateStr = addDays(opts.fromDate, i);
    const [y, m, d] = dateStr.split('-').map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    for (const w of opts.windows.filter((x) => x.weekday === weekday)) {
      for (let t = w.startMinute; t + opts.durationMin <= w.endMinute; t += step) {
        const startAt = localDateMinuteToUtc(dateStr, t);
        const endAt = new Date(startAt.getTime() + opts.durationMin * 60_000);
        if (startAt < earliest) continue;
        if (opts.busy.some((b) => overlaps(startAt, endAt, b.startAt, b.endAt))) continue;
        result.push({ date: dateStr, startAt: startAt.toISOString(), endAt: endAt.toISOString(), localStart: t });
      }
    }
  }
  return result;
}

/** Slot o'qituvchining haftalik jadvaliga to'liq tushadimi? */
export function fitsAvailability(windows: WeeklyWindow[], startAt: Date, endAt: Date) {
  const s = utcToLocalParts(startAt);
  const e = utcToLocalParts(new Date(endAt.getTime() - 1));
  if (s.dateStr !== e.dateStr) return false;
  const endMinute = e.minute + 1;
  return windows.some((w) => w.weekday === s.weekday && w.startMinute <= s.minute && w.endMinute >= endMinute);
}
