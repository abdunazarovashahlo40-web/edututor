import type { Locale } from '../i18n';

const TZ = 'Asia/Tashkent';
const intlLocale = (l: Locale) => (l === 'ru' ? 'ru-RU' : l === 'en' ? 'en-GB' : 'uz-UZ');

export function money(v: number | string | null | undefined, l: Locale = 'uz') {
  const n = Number(v ?? 0);
  const s = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n);
  return `${s} ${l === 'en' ? 'UZS' : l === 'ru' ? 'сум' : 'so\'m'}`;
}

export function compact(v: number) {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
}

/** Uzbek Intl ba'zi brauzerlarda to'liq emas — oy nomlarini qo'lda beramiz */
const UZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const UZ_DAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

function parts(d: Date) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { y: +p.year, m: +p.month, d: +p.day, hh: p.hour === '24' ? '00' : p.hour, mm: p.minute, wd };
}

export function time(v: string | Date) {
  const p = parts(new Date(v));
  return `${p.hh}:${p.mm}`;
}

export function date(v: string | Date, l: Locale = 'uz', withWeekday = false) {
  const d = new Date(v);
  if (l === 'uz') {
    const p = parts(d);
    return `${withWeekday ? UZ_DAYS[p.wd] + ', ' : ''}${p.d}-${UZ_MONTHS[p.m - 1]}`;
  }
  return new Intl.DateTimeFormat(intlLocale(l), { timeZone: TZ, day: 'numeric', month: 'long', ...(withWeekday ? { weekday: 'long' } : {}) }).format(d);
}

export function dateTime(v: string | Date, l: Locale = 'uz') {
  return `${date(v, l)}, ${time(v)}`;
}

/** Toshkent vaqtida "YYYY-MM-DD" */
export function localDay(v: string | Date = new Date()) {
  const p = parts(new Date(v));
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

export function addDays(day: string, n: number) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function weekdayOf(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** <input type="datetime-local"> qiymatini (Toshkent vaqti deb) ISO UTC ga */
export function localInputToIso(v: string) {
  return new Date(v + ':00+05:00').toISOString();
}

export function isoToLocalInput(v: string | Date) {
  const p = parts(new Date(v));
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}T${p.hh}:${p.mm}`;
}

export function minutesToHHMM(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function hhmmToMinutes(s: string) {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

export function relative(v: string | Date, l: Locale = 'uz') {
  const diff = (new Date(v).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(l === 'uz' ? 'uz' : intlLocale(l), { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}

export function fileSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function initials(name?: string) {
  return (name ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');
}

export function errorText(e: unknown, t: (k: string) => string) {
  const err = e as { code?: string; message?: string };
  if (err?.code) {
    const k = `errors.${err.code}`;
    const tr = t(k);
    if (tr !== k) return tr;
  }
  return err?.message || t('common.error');
}
