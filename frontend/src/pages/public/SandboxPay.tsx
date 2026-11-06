import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CheckCircle2, FlaskConical, XCircle } from 'lucide-react';
import { get, post } from '../../services/api';
import { useI18n } from '../../i18n';
import { Button, Card, FullPageSpinner } from '../../components/ui';
import { money, errorText } from '../../utils/format';
import { useToast } from '../../hooks/useToast';

/** Sandbox to'lov sahifasi — haqiqiy karta ma'lumotlari SO'RALMAYDI. Natija serverda tasdiqlanadi. */
export default function SandboxPay() {
  const { id } = useParams();
  const { t, locale } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const q = useQuery({ queryKey: ['payment', id], queryFn: () => get<any>(`/payments/${id}`) });
  const [busy, setBusy] = useState<'ok' | 'fail' | null>(null);
  const [done, setDone] = useState<'paid' | 'failed' | null>(null);

  const finish = async (success: boolean) => {
    setBusy(success ? 'ok' : 'fail');
    try {
      const r = await post<{ status: 'paid' | 'failed' }>(`/payments/sandbox/${id}/complete`, { success });
      setDone(r.status);
      setTimeout(() => nav('/student/lessons'), 1800);
    } catch (e) {
      toast('error', errorText(e, t));
    } finally {
      setBusy(null);
    }
  };

  if (q.isLoading) return <FullPageSpinner />;
  return (
    <div className="grid min-h-[70vh] place-items-center px-4 py-10">
      <Card className="w-full max-w-md p-7 text-center">
        {done ? (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            {done === 'paid' ? <CheckCircle2 className="mx-auto h-16 w-16 text-success" /> : <XCircle className="mx-auto h-16 w-16 text-danger" />}
            <p className="mt-3 text-xl font-extrabold">{done === 'paid' ? t('pay.paidOk') : t('pay.paidFail')}</p>
          </motion.div>
        ) : (
          <>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-100 text-brand-700"><FlaskConical className="h-7 w-7" /></div>
            <h1 className="mt-4 text-xl font-extrabold">{t('pay.sandboxTitle')}</h1>
            <p className="mt-1 text-sm text-muted">{q.data?.booking.lesson.title}</p>
            <div className="my-5 font-display text-3xl font-bold">{money(q.data?.amount, locale)}</div>
            <p className="mb-5 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">{t('pay.sandboxText')}</p>
            <div className="grid gap-2">
              <Button size="lg" variant="success" loading={busy === 'ok'} onClick={() => finish(true)}>{t('pay.paySuccess')}</Button>
              <Button variant="danger" loading={busy === 'fail'} onClick={() => finish(false)}>{t('pay.payFail')}</Button>
            </div>
            <p className="mt-4 text-xs text-muted">{t('pay.noCardNote')}</p>
          </>
        )}
      </Card>
    </div>
  );
}
