import { forwardRef, useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { get, post } from '../../services/api';
import { useI18n } from '../../i18n';
import { cn } from '../../utils/cn';
import type { Me } from '../../types';

export function AuthTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h1 className="font-display text-xl font-bold uppercase tracking-[.12em] text-white md:text-[22px]">{title}</h1>
      {subtitle && <p className="mt-1.5 text-sm text-white/55">{subtitle}</p>}
    </div>
  );
}

export function AuthField({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.18em] text-white/55">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs font-semibold text-red-300">{error}</span>}
    </label>
  );
}

/** forwardRef — react-hook-form register() ref'ni input'ga ulashi uchun shart */
export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function PasswordInput(props, ref) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...props} ref={ref} type={show ? 'text' : 'password'} className={cn('auth-input pr-12', props.className)} />
      <button type="button" tabIndex={-1} onClick={() => setShow((s) => !s)} className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-white/60 hover:text-white" aria-label="toggle password">
        {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
      </button>
    </div>
  );
});

/** +998 prefiksli telefon maydoni: "90 123 45 67" formatida avtomatik bo'shliq qo'yiladi */
export const PhoneInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function PhoneInput({ onChange, className, ...props }, ref) {
  return (
    <div className={cn('auth-input flex items-center gap-2 px-0 focus-within:border-[rgb(var(--lamp)/.9)] focus-within:shadow-[0_0_0_4px_rgb(var(--lamp)/.22)]', className)}>
      <span className="flex h-full shrink-0 items-center gap-1.5 border-r border-white/15 pl-4 pr-3 text-[15px] font-bold text-white/85">
        <span aria-hidden>🇺🇿</span>+998
      </span>
      <input
        {...props}
        ref={ref}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="90 123 45 67"
        maxLength={12}
        onChange={(e) => {
          const d = e.target.value.replace(/\D/g, '').replace(/^998/, '').slice(0, 9);
          e.target.value = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ');
          onChange?.(e);
        }}
        className="h-full min-w-0 flex-1 bg-transparent pr-4 text-[15px] tracking-wide text-white placeholder:text-white/40 focus:outline-none"
      />
    </div>
  );
});

export function AuthButton({ loading, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={loading || rest.disabled}
      className={cn(
        'flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-extrabold uppercase tracking-[.2em] text-navy-900 transition hover:shadow-[0_0_30px_rgb(var(--lamp)/.55)] active:scale-[.98] disabled:opacity-60',
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function AuthError({ text }: { text?: string | null }) {
  if (!text) return null;
  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-200">
      {text}
    </motion.div>
  );
}

/** 6 xonali OTP kiritish — har bir katak alohida, paste qo'llab-quvvatlanadi */
export function OtpInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, ' ').slice(0, 6).split('');
  const set = (i: number, d: string) => {
    const arr = digits.map((x) => (x === ' ' ? '' : x));
    arr[i] = d;
    onChange(arr.join('').slice(0, 6));
  };
  return (
    <div className="flex justify-between gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          value={d.trim()}
          aria-label={`digit ${i + 1}`}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '');
            if (!v) return set(i, '');
            set(i, v[v.length - 1]);
            refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !d.trim()) refs.current[i - 1]?.focus();
          }}
          onPaste={(e) => {
            const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
            if (p) {
              e.preventDefault();
              onChange(p);
              refs.current[Math.min(5, p.length)]?.focus();
            }
          }}
          className="auth-input h-12 w-full px-0 text-center text-xl font-extrabold"
        />
      ))}
    </div>
  );
}

declare global {
  interface Window {
    google?: any;
    onTelegramAuth?: (u: Record<string, string>) => void;
  }
}

/** Google va Telegram orqali kirish — faqat server sozlangan bo'lsa ko'rinadi */
export function SocialLogin({ role = 'STUDENT', onSuccess }: { role?: 'STUDENT' | 'TEACHER'; onSuccess: (me: Me) => void }) {
  const { t } = useI18n();
  const { data } = useQuery({ queryKey: ['providers'], queryFn: () => get<{ google: boolean; telegram: boolean; telegramBot: string | null }>('/auth/providers'), staleTime: Infinity });
  const gRef = useRef<HTMLDivElement>(null);
  const tgRef = useRef<HTMLDivElement>(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    if (!data?.google || !clientId || !gRef.current) return;
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: clientId,
        callback: async (r: { credential: string }) => onSuccess(await post<Me>('/auth/google', { credential: r.credential, role })),
      });
      window.google?.accounts.id.renderButton(gRef.current, { theme: 'filled_black', size: 'large', shape: 'pill', width: 300, text: 'continue_with' });
    };
    document.body.appendChild(s);
    return () => s.remove();
  }, [data?.google, clientId, role, onSuccess]);

  useEffect(() => {
    if (!data?.telegram || !data.telegramBot || !tgRef.current) return;
    window.onTelegramAuth = async (u) => onSuccess(await post<Me>('/auth/telegram', { data: u, role }));
    const s = document.createElement('script');
    s.src = 'https://telegram.org/js/telegram-widget.js?22';
    s.async = true;
    s.setAttribute('data-telegram-login', data.telegramBot);
    s.setAttribute('data-size', 'large');
    s.setAttribute('data-radius', '20');
    s.setAttribute('data-onauth', 'onTelegramAuth(user)');
    s.setAttribute('data-request-access', 'write');
    tgRef.current.innerHTML = '';
    tgRef.current.appendChild(s);
  }, [data?.telegram, data?.telegramBot, role, onSuccess]);

  if (!data?.google && !data?.telegram) return null;
  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.2em] text-white/35">
        <span className="h-px flex-1 bg-white/15" />
        {t('auth.or')}
        <span className="h-px flex-1 bg-white/15" />
      </div>
      <div className="flex flex-col items-center gap-3">
        {data?.google && <div ref={gRef} />}
        {data?.telegram && <div ref={tgRef} />}
      </div>
    </div>
  );
}
