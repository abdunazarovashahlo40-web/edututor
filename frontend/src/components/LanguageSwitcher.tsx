import { useState, useRef, useEffect } from 'react';
import { Globe, Check } from 'lucide-react';
import { LOCALES, useI18n, type Locale } from '../i18n';
import { useAuth } from '../store/auth';
import { patch } from '../services/api';
import { cn } from '../utils/cn';

export function LanguageSwitcher({ dark, compact }: { dark?: boolean; compact?: boolean }) {
  const { locale, setLocale } = useI18n();
  const { me } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const choose = (l: Locale) => {
    setLocale(l);
    setOpen(false);
    if (me && !me.appLock.locked) patch('/users/me', { locale: l }).catch(() => undefined);
  };
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-extrabold transition',
          dark ? 'text-white/80 hover:bg-white/10' : 'text-ink/70 hover:bg-brand-50 hover:text-brand-700',
        )}
        aria-label="language"
      >
        <Globe className="h-4 w-4" />
        {!compact && locale.toUpperCase()}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-40 overflow-hidden rounded-2xl border border-line bg-white p-1 shadow-lift">
          {LOCALES.map((l) => (
            <button key={l.code} onClick={() => choose(l.code)} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-ink hover:bg-brand-50">
              <span>
                <span className="mr-2 text-[10px] font-extrabold text-muted">{l.flag}</span>
                {l.label}
              </span>
              {locale === l.code && <Check className="h-4 w-4 text-brand-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
