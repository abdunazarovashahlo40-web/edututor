import { describe, expect, it } from 'vitest';
import { addDays, hhmmToMinutes, localDay, localInputToIso, minutesToHHMM, money, time, weekdayOf, initials } from '../utils/format';

describe('format (Asia/Tashkent)', () => {
  it('vaqt Toshkent bo\'yicha ko\'rsatiladi', () => {
    expect(time('2026-11-06T05:00:00Z')).toBe('10:00');
    expect(localDay('2026-11-05T20:30:00Z')).toBe('2026-11-06');
  });
  it('datetime-local → UTC', () => {
    expect(localInputToIso('2026-11-06T10:00')).toBe('2026-11-06T05:00:00.000Z');
  });
  it('sana arifmetikasi', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(weekdayOf('2026-11-06')).toBe(5);
    expect(minutesToHHMM(570)).toBe('09:30');
    expect(hhmmToMinutes('18:45')).toBe(1125);
  });
  it('pul formati', () => {
    expect(money(150000, 'uz').replace(/\s/g, ' ')).toBe('150 000 so\'m');
    expect(money(150000, 'en').replace(/\s/g, ' ')).toBe('150 000 UZS');
    expect(initials('Dilnoza Karimova')).toBe('DK');
  });
});
