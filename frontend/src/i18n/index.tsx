import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import uz, { type Dict } from './uz';
import ru from './ru';
import en from './en';

export type Locale = 'uz' | 'ru' | 'en';
const dicts: Record<Locale, Dict> = { uz, ru, en };
export const LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: 'uz', label: 'O\'zbekcha', flag: 'UZ' },
  { code: 'ru', label: 'Русский', flag: 'RU' },
  { code: 'en', label: 'English', flag: 'EN' },
];

function get(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);
}

type Ctx = { locale: Locale; setLocale: (l: Locale) => void; t: (key: string, vars?: Record<string, string | number>) => string; tr: <T = unknown>(key: string) => T };
const I18nContext = createContext<Ctx | null>(null);

function initial(): Locale {
  try {
    const s = localStorage.getItem('et_locale') as Locale | null;
    if (s && s in dicts) return s;
  } catch {
    /* ignore */
  }
  const nav = navigator.language.slice(0, 2);
  return nav === 'ru' ? 'ru' : nav === 'en' ? 'en' : 'uz';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initial);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem('et_locale', l);
    } catch {
      /* ignore */
    }
  }, []);
  const value = useMemo<Ctx>(() => {
    const d = dicts[locale];
    const t = (key: string, vars?: Record<string, string | number>) => {
      let s = get(d, key) ?? get(uz, key);
      if (typeof s !== 'string') return key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = (s as string).replace(`{${k}}`, String(v));
      return s as string;
    };
    const tr = <T,>(key: string) => (get(d, key) ?? get(uz, key)) as T;
    return { locale, setLocale, t, tr };
  }, [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const c = useContext(I18nContext);
  if (!c) throw new Error('I18nProvider missing');
  return c;
}

/** Fan nomini tanlangan tilda qaytaradi */
export function subjectName(s: { nameUz: string; nameRu: string; nameEn: string } | null | undefined, l: Locale) {
  if (!s) return '';
  return l === 'ru' ? s.nameRu : l === 'en' ? s.nameEn : s.nameUz;
}
