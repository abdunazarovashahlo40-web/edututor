import { useCallback, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Mail, Phone } from 'lucide-react';
import { LampScene } from './LampScene';
import { AuthButton, AuthError, AuthField, AuthTitle, PasswordInput, PhoneInput, SocialLogin } from './AuthWidgets';
import { ApiError, post } from '../../services/api';
import { useI18n } from '../../i18n';
import { homeFor, useAuth } from '../../store/auth';
import { errorText } from '../../utils/format';
import { cn } from '../../utils/cn';
import type { Me } from '../../types';

export default function LoginPage() {
  const { t } = useI18n();
  const { setMe } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [mode, setMode] = useState<'phone' | 'email'>('phone');
  const [err, setErr] = useState<string | null>(null);

  const schema = z.object({
    login: z.string({ required_error: t('common.required') }).min(5, t('common.required')),
    password: z.string({ required_error: t('common.required') }).min(1, t('common.required')),
    remember: z.boolean().default(true),
  });
  const { register, handleSubmit, formState, setValue } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { remember: true } });

  const done = useCallback(
    (me: Me) => {
      setMe(me);
      nav(loc.state?.from ?? homeFor(me.role), { replace: true });
    },
    [nav, setMe, loc.state?.from],
  );

  const onSubmit = handleSubmit(async (v) => {
    setErr(null);
    const login = mode === 'phone' ? '+998' + v.login.replace(/\D/g, '').replace(/^998/, '') : v.login.trim();
    try {
      done(await post<Me>('/auth/login', { ...v, login }));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'EMAIL_NOT_VERIFIED') {
        nav(`/verify-email?email=${encodeURIComponent(e.details?.email ?? '')}`, { state: { devCode: e.details?.devCode } });
        return;
      }
      setErr(errorText(e, t));
    }
  });

  return (
    <LampScene>
      <AuthTitle title={t('auth.loginTitle')} subtitle={t('auth.loginSubtitle')} />
      <div className="mb-4 grid grid-cols-2 rounded-full border border-white/10 bg-white/5 p-1">
        {(['phone', 'email'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setValue('login', '');
            }}
            className={cn('relative flex h-9 items-center justify-center gap-1.5 rounded-full text-xs font-bold transition', mode === m ? 'text-navy-900' : 'text-white/60')}
          >
            {mode === m && <motion.span layoutId="login-mode" className="absolute inset-0 rounded-full bg-white" />}
            <span className="relative flex items-center gap-1.5">
              {m === 'phone' ? <Phone className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
              {m === 'phone' ? t('auth.phone') : t('auth.email')}
            </span>
          </button>
        ))}
      </div>
      <form onSubmit={onSubmit} className="space-y-3.5" noValidate>
        <AuthField label={mode === 'phone' ? t('auth.phone') : t('auth.email')} error={formState.errors.login?.message}>
          {mode === 'phone' ? (
            <PhoneInput {...register('login')} />
          ) : (
            <input {...register('login')} type="email" autoComplete="email" placeholder="you@example.com" className="auth-input" />
          )}
        </AuthField>
        <AuthField label={t('auth.password')} error={formState.errors.password?.message}>
          <PasswordInput {...register('password')} autoComplete="current-password" placeholder="••••••••" />
        </AuthField>
        <div className="flex items-center justify-between text-sm">
          <label className="flex cursor-pointer items-center gap-2 text-white/70">
            <input type="checkbox" {...register('remember')} className="h-4 w-4 rounded accent-[rgb(var(--lamp))]" />
            {t('auth.remember')}
          </label>
          <Link to="/forgot-password" className="font-semibold text-[rgb(var(--lamp))] hover:underline">
            {t('auth.forgot')}
          </Link>
        </div>
        <AuthError text={err} />
        <AuthButton type="submit" loading={formState.isSubmitting}>
          {t('auth.login')}
        </AuthButton>
      </form>
      <SocialLogin onSuccess={done} />
      <p className="mt-4 text-center text-sm text-white/55">
        {t('auth.noAccount')}{' '}
        <Link to="/register" className="font-bold text-[rgb(var(--lamp))] hover:underline">
          {t('nav.register')}
        </Link>
      </p>
    </LampScene>
  );
}
