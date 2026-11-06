import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AnimatePresence, motion } from 'framer-motion';
import { GraduationCap, Presentation, Check, ArrowLeft } from 'lucide-react';
import { LampScene } from './LampScene';
import { AuthButton, AuthError, AuthField, AuthTitle, PasswordInput, PhoneInput, SocialLogin } from './AuthWidgets';
import { OtpStep } from './OtpStep';
import { post } from '../../services/api';
import { useI18n } from '../../i18n';
import { homeFor, useAuth } from '../../store/auth';
import { errorText } from '../../utils/format';
import { cn } from '../../utils/cn';
import type { Me } from '../../types';

type Role = 'STUDENT' | 'TEACHER';

export default function RegisterPage() {
  const { t, locale } = useI18n();
  const { setMe } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<Role>(sp.get('role') === 'teacher' ? 'TEACHER' : 'STUDENT');
  const [email, setEmail] = useState('');
  const [devCode, setDevCode] = useState<string | undefined>();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (sp.get('role') === 'teacher') setRole('TEACHER');
  }, [sp]);

  const schema = z
    .object({
      fullName: z.string().min(3, t('common.required')).max(100),
      email: z.string().email(t('auth.invalidEmail')),
      phone: z.string().optional(),
      password: z.string().min(8, t('auth.passwordHint')).regex(/[A-Za-z]/, t('auth.passwordHint')).regex(/\d/, t('auth.passwordHint')),
      confirm: z.string(),
      acceptTerms: z.boolean().refine((v) => v, t('auth.mustAccept')),
    })
    .refine((v) => v.password === v.confirm, { path: ['confirm'], message: t('auth.passwordsMismatch') });
  type F = z.infer<typeof schema>;
  const { register, handleSubmit, formState } = useForm<F>({ resolver: zodResolver(schema), defaultValues: { acceptTerms: false } });

  const finish = useCallback(
    (me: Me) => {
      setMe(me);
      nav(me.role === 'TEACHER' ? '/teacher/profile' : homeFor(me.role), { replace: true });
    },
    [nav, setMe],
  );

  const onSubmit = handleSubmit(async (v) => {
    setErr(null);
    try {
      const digits = (v.phone ?? '').replace(/\D/g, '').replace(/^998/, '');
      const r = await post<{ email: string; devCode?: string }>('/auth/register', {
        fullName: v.fullName,
        email: v.email,
        phone: digits ? '+998' + digits : undefined,
        password: v.password,
        role,
        acceptTerms: true,
        locale,
      });
      setEmail(r.email);
      setDevCode(r.devCode);
      setStep(2);
    } catch (e) {
      setErr(errorText(e, t));
    }
  });

  const steps = [t('auth.stepRole'), t('auth.stepAccount'), t('auth.stepVerify')];

  return (
    <LampScene wide={step === 0}>
      {/* progress indikatori */}
      <div className="mb-4 flex items-center gap-2" aria-label="progress">
        {steps.map((s, i) => (
          <div key={s} className="flex flex-1 flex-col gap-1.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div className="h-full rounded-full bg-[rgb(var(--lamp))]" animate={{ width: i <= step ? '100%' : '0%' }} transition={{ duration: 0.5 }} />
            </div>
            <span className={cn('text-[10px] font-bold uppercase tracking-[.18em]', i <= step ? 'text-white/80' : 'text-white/30')}>{s}</span>
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="s0" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
            <AuthTitle title={t('auth.registerTitle')} />
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['STUDENT', GraduationCap, t('auth.student'), t('auth.studentDesc')],
                  ['TEACHER', Presentation, t('auth.teacher'), t('auth.teacherDesc')],
                ] as const
              ).map(([r, Icon, title, desc], i) => (
                <motion.button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.1 }}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'relative rounded-2xl border p-5 text-left transition',
                    role === r ? 'border-[rgb(var(--lamp))] bg-[rgb(var(--lamp)/.14)] shadow-[0_0_40px_-12px_rgb(var(--lamp))]' : 'border-white/10 bg-white/5 hover:border-white/30',
                  )}
                  aria-pressed={role === r}
                >
                  <motion.div
                    animate={role === r ? { rotate: [0, -8, 8, 0], scale: [1, 1.1, 1] } : {}}
                    transition={{ duration: 0.6 }}
                    className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-white/10 text-[rgb(var(--lamp))]"
                  >
                    <Icon className="h-6 w-6" />
                  </motion.div>
                  <div className="font-extrabold">{title}</div>
                  <div className="mt-1 text-sm text-white/55">{desc}</div>
                  <span className={cn('absolute right-4 top-4 grid h-6 w-6 place-items-center rounded-full border transition', role === r ? 'border-transparent bg-[rgb(var(--lamp))] text-navy-900' : 'border-white/25')}>
                    {role === r && <Check className="h-4 w-4" />}
                  </span>
                </motion.button>
              ))}
            </div>
            <AuthButton className="mt-6" onClick={() => setStep(1)}>
              {t('common.next')} →
            </AuthButton>
            <SocialLogin role={role} onSuccess={finish} />
          </motion.div>
        )}

        {step === 1 && (
          <motion.form key="s1" onSubmit={onSubmit} noValidate className="space-y-3" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
            <button type="button" onClick={() => setStep(0)} className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-white/50 hover:text-white">
              <ArrowLeft className="h-4 w-4" /> {role === 'STUDENT' ? t('auth.student') : t('auth.teacher')}
            </button>
            <AuthField label={t('auth.fullName')} error={formState.errors.fullName?.message}>
              <input {...register('fullName')} autoComplete="name" className="auth-input" placeholder="Ism Familiya" />
            </AuthField>
            <AuthField label={t('auth.email')} error={formState.errors.email?.message}>
              <input {...register('email')} type="email" autoComplete="email" className="auth-input" placeholder="you@example.com" />
            </AuthField>
            <AuthField label={`${t('auth.phone')} (${t('common.optional')})`}>
              <PhoneInput {...register('phone')} />
            </AuthField>
            <div className="grid gap-4 sm:grid-cols-2">
              <AuthField label={t('auth.password')} error={formState.errors.password?.message}>
                <PasswordInput {...register('password')} autoComplete="new-password" />
              </AuthField>
              <AuthField label={t('auth.confirmPassword')} error={formState.errors.confirm?.message}>
                <PasswordInput {...register('confirm')} autoComplete="new-password" />
              </AuthField>
            </div>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-white/70">
              <input type="checkbox" {...register('acceptTerms')} className="mt-0.5 h-4 w-4 accent-[rgb(var(--lamp))]" />
              <span>{t('auth.terms')}</span>
            </label>
            {formState.errors.acceptTerms && <p className="text-xs font-semibold text-red-300">{formState.errors.acceptTerms.message}</p>}
            <AuthError text={err} />
            <AuthButton type="submit" loading={formState.isSubmitting}>
              {t('auth.createAccount')}
            </AuthButton>
          </motion.form>
        )}

        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}>
            <OtpStep email={email} devCode={devCode} onVerified={finish} />
          </motion.div>
        )}
      </AnimatePresence>

      {step < 2 && (
        <p className="mt-4 text-center text-sm text-white/55">
          {t('auth.haveAccount')}{' '}
          <Link to="/login" className="font-bold text-[rgb(var(--lamp))] hover:underline">
            {t('auth.login')}
          </Link>
        </p>
      )}
    </LampScene>
  );
}
