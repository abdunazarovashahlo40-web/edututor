import { describe, expect, it } from 'vitest';
import { computeSlots, fitsAvailability, localDateMinuteToUtc, utcToLocalParts, overlaps } from '../src/common/time';
import { lessonPrice, refundPercent, splitCommission, percentOf } from '../src/common/money';
import { maskContacts } from '../src/common/contacts';
import { verifyTelegram } from '../src/common/telegram';
import crypto from 'crypto';

describe('vaqt (Asia/Tashkent)', () => {
  it('mahalliy vaqtni UTC ga to\'g\'ri aylantiradi', () => {
    expect(localDateMinuteToUtc('2026-11-06', 10 * 60).toISOString()).toBe('2026-11-06T05:00:00.000Z');
    expect(localDateMinuteToUtc('2026-11-06', 2 * 60).toISOString()).toBe('2026-11-05T21:00:00.000Z');
  });
  it('UTC → mahalliy qismlar', () => {
    const p = utcToLocalParts(new Date('2026-11-05T21:30:00Z'));
    expect(p).toEqual({ dateStr: '2026-11-06', weekday: 5, minute: 150 });
  });
  it('kesishma', () => {
    const d = (h: number) => new Date(Date.UTC(2026, 0, 1, h));
    expect(overlaps(d(10), d(11), d(10), d(12))).toBe(true);
    expect(overlaps(d(10), d(11), d(11), d(12))).toBe(false);
  });
  it('bo\'sh slotlar band vaqtlarni chiqarib tashlaydi', () => {
    const windows = [{ weekday: 5, startMinute: 9 * 60, endMinute: 12 * 60 }]; // juma 09–12
    const busy = [{ startAt: localDateMinuteToUtc('2026-11-06', 10 * 60), endAt: localDateMinuteToUtc('2026-11-06', 11 * 60) }];
    const slots = computeSlots({ windows, fromDate: '2026-11-06', days: 1, durationMin: 60, busy, now: new Date('2026-11-01T00:00:00Z') });
    expect(slots.map((s) => s.localStart)).toEqual([540, 660]); // 09:00 va 11:00
  });
  it('minimal oldindan bron muddati (2 soat)', () => {
    const windows = [{ weekday: 5, startMinute: 9 * 60, endMinute: 12 * 60 }];
    const now = localDateMinuteToUtc('2026-11-06', 8 * 60);
    const slots = computeSlots({ windows, fromDate: '2026-11-06', days: 1, durationMin: 60, busy: [], now });
    expect(slots[0].localStart).toBe(600);
  });
  it('slot jadvalga tushadimi', () => {
    const w = [{ weekday: 5, startMinute: 540, endMinute: 720 }];
    expect(fitsAvailability(w, localDateMinuteToUtc('2026-11-06', 660), localDateMinuteToUtc('2026-11-06', 720))).toBe(true);
    expect(fitsAvailability(w, localDateMinuteToUtc('2026-11-06', 690), localDateMinuteToUtc('2026-11-06', 750))).toBe(false);
    expect(fitsAvailability(w, localDateMinuteToUtc('2026-11-07', 600), localDateMinuteToUtc('2026-11-07', 660))).toBe(false);
  });
});

describe('pul hisob-kitobi', () => {
  it('komissiya tiyingacha aniq', () => {
    expect(splitCommission(150000, 15)).toEqual({ gross: '150000.00', commission: '22500.00', net: '127500.00' });
    expect(splitCommission('99999.99', 15)).toEqual({ gross: '99999.99', commission: '15000.00', net: '84999.99' });
  });
  it('dars narxi 1000 ga yaxlitlanadi', () => {
    expect(lessonPrice(150000, 45)).toBe(113000);
    expect(lessonPrice(100000, 90)).toBe(150000);
  });
  it('bekor qilish siyosati', () => {
    const now = new Date('2026-11-06T00:00:00Z');
    const h = (n: number) => new Date(now.getTime() + n * 3600_000);
    expect(refundPercent('student', h(30), now)).toBe(100);
    expect(refundPercent('student', h(10), now)).toBe(50);
    expect(refundPercent('student', h(1), now)).toBe(0);
    expect(refundPercent('teacher', h(1), now)).toBe(100);
    expect(percentOf('150000', 50)).toBe('75000.00');
  });
});

describe('xavfsizlik', () => {
  it('to\'lovsiz suhbatda kontaktlar yashiriladi', () => {
    const t = maskContacts('Menga +998 90 123 45 67 ga yozing yoki @azizbek_math ga, t.me/aziz');
    expect(t).not.toMatch(/123/);
    expect(t).not.toMatch(/@azizbek/);
    expect(t).not.toMatch(/t\.me/);
    expect(maskContacts('x^2 + 5x - 6 = 0, javob 2026')).toBe('x^2 + 5x - 6 = 0, javob 2026');
  });
  it('Telegram login imzosi tekshiriladi', () => {
    const token = '123:ABC';
    const data: Record<string, string> = { id: '42', first_name: 'Ali', auth_date: String(Math.floor(Date.now() / 1000)) };
    const check = Object.keys(data).sort().map((k) => `${k}=${data[k]}`).join('\n');
    const hash = crypto.createHmac('sha256', crypto.createHash('sha256').update(token).digest()).update(check).digest('hex');
    expect(verifyTelegram({ ...data, hash }, token)).toBe(true);
    expect(verifyTelegram({ ...data, first_name: 'Vali', hash }, token)).toBe(false);
  });
});
