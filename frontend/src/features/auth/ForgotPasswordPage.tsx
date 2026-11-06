import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { LampScene } from './LampScene';
import { AuthButton, AuthError, AuthField, AuthTitle, OtpInput, PasswordInput } from './AuthWidgets';
import { post } from '../../services/api';
import { useI18n } from '../../i18n';
import { errorText } from '../../utils/format';

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [step, setStep] = useState<'email' | 'code' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [dev, setDev] = useState<string>();
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setErr(null);
    setLoading(true);
    try {
      await fn();
    } catch (e) {
      setErr(errorText(e, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LampScene>
      {step === 'done' ? (
        <div className="text-center">
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-400" />
          <p className="mb-6 font-semibold">{t('auth.resetDone')}</p>
          <Link to="/login">
            <AuthButton>{t('auth.login')}</AuthButton>
          </Link>
        </div>
      ) : (
        <>
          <AuthTitle title={t('auth.forgotTitle')} subtitle={t('auth.forgotText')} />
          {step === 'email' ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const r = await post<{ devCode?: string }>('/auth/forgot-password', { email });
                  setDev(r.devCode);
                  setStep('code');
                });
              }}
            >
              <AuthField label={t('auth.email')}>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="auth-input" autoComplete="email" />
              </AuthField>
              <AuthError text={err} />
              <AuthButton type="submit" loading={loading}>
                {t('auth.sendCode')}
              </AuthButton>
            </form>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await post('/auth/reset-password', { email, code, password: pw });
                  setStep('done');
                });
              }}
            >
              <OtpInput value={code} onChange={setCode} />
              {dev && <p className="text-center text-xs text-white/60">{t('auth.devCode', { code: dev })}</p>}
              <AuthField label={t('auth.newPassword')}>
                <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" minLength={8} required />
              </AuthField>
              <p className="text-xs text-white/45">{t('auth.passwordHint')}</p>
              <AuthError text={err} />
              <AuthButton type="submit" loading={loading} disabled={code.length !== 6}>
                {t('common.save')}
              </AuthButton>
            </form>
          )}
          <p className="mt-6 text-center text-sm">
            <Link to="/login" className="font-bold text-[rgb(var(--lamp))] hover:underline">
              ← {t('auth.login')}
            </Link>
          </p>
        </>
      )}
    </LampScene>
  );
}
