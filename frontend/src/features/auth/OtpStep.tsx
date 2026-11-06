import { useEffect, useState } from 'react';
import { MailCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { AuthButton, AuthError, AuthTitle, OtpInput } from './AuthWidgets';
import { post } from '../../services/api';
import { useI18n } from '../../i18n';
import { errorText } from '../../utils/format';
import type { Me } from '../../types';

export function OtpStep({ email, devCode, onVerified }: { email: string; devCode?: string; onVerified: (me: Me) => void }) {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [left, setLeft] = useState(60);
  const [dev, setDev] = useState(devCode);

  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  const verify = async (c = code) => {
    if (c.length !== 6) return;
    setErr(null);
    setLoading(true);
    try {
      onVerified(await post<Me>('/auth/verify-email', { email, code: c }));
    } catch (e) {
      setErr(errorText(e, t));
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (code.length === 6) void verify(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const resend = async () => {
    setErr(null);
    try {
      const r = await post<{ devCode?: string }>('/auth/resend-otp', { email });
      setDev(r.devCode);
      setLeft(60);
    } catch (e) {
      setErr(errorText(e, t));
    }
  };

  return (
    <div>
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[rgb(var(--lamp)/.18)] text-[rgb(var(--lamp))]">
        <MailCheck className="h-7 w-7" />
      </motion.div>
      <AuthTitle title={t('auth.verifyTitle')} subtitle={`${t('auth.verifyText')} ${email}`} />
      <OtpInput value={code} onChange={setCode} disabled={loading} />
      {dev && <p className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-center text-xs text-white/60">{t('auth.devCode', { code: dev })}</p>}
      <div className="mt-4 space-y-3">
        <AuthError text={err} />
        <AuthButton onClick={() => verify()} loading={loading} disabled={code.length !== 6}>
          {t('auth.verify')}
        </AuthButton>
        <button type="button" disabled={left > 0} onClick={resend} className="w-full text-center text-sm font-semibold text-white/60 hover:text-white disabled:opacity-50">
          {left > 0 ? t('auth.resendIn', { s: left }) : t('auth.resend')}
        </button>
      </div>
    </div>
  );
}
