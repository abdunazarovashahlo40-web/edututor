import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, FlaskConical, ShieldCheck } from 'lucide-react';
import { get, post } from '../../services/api';
import { useI18n } from '../../i18n';
import { Button, Modal } from '../../components/ui';
import { money, errorText } from '../../utils/format';
import { cn } from '../../utils/cn';
import { useToast } from '../../hooks/useToast';

/** To'lov usulini tanlash va provayder sahifasiga yo'naltirish */
export function PaySheet({ bookingId, amount, open, onClose }: { bookingId: string | null; amount?: string | number; open: boolean; onClose: () => void }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const providers = useQuery({ queryKey: ['pay-providers'], queryFn: () => get<{ sandbox: boolean; payme: boolean; click: boolean }>('/payments/providers'), enabled: open });
  const [choice, setChoice] = useState<'payme' | 'click' | 'sandbox' | null>(null);
  const [busy, setBusy] = useState(false);
  const opts = [
    { id: 'payme' as const, label: 'Payme', on: providers.data?.payme, cls: 'text-[#00CCCC]' },
    { id: 'click' as const, label: 'Click', on: providers.data?.click, cls: 'text-[#0084FF]' },
    { id: 'sandbox' as const, label: t('booking.sandbox'), on: providers.data?.sandbox, cls: 'text-brand-600' },
  ].filter((o) => o.on);
  const selected = choice ?? opts[0]?.id ?? null;

  const pay = async () => {
    if (!bookingId || !selected) return;
    setBusy(true);
    try {
      const r = await post<{ redirectUrl: string }>('/payments/checkout', { bookingId, provider: selected });
      window.location.href = r.redirectUrl;
    } catch (e) {
      toast('error', errorText(e, t));
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('booking.payWith')}
      size="sm"
      footer={
        <Button className="w-full" size="lg" loading={busy} disabled={!selected} onClick={pay} icon={<CreditCard className="h-4 w-4" />}>
          {t('booking.payNow')} {amount !== undefined && `· ${money(amount, locale)}`}
        </Button>
      }
    >
      <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">{t('booking.needPay')}</p>
      <div className="space-y-2">
        {opts.map((o) => (
          <button key={o.id} onClick={() => setChoice(o.id)} className={cn('flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition', selected === o.id ? 'border-brand-600 bg-brand-50' : 'border-line hover:border-brand-200')}>
            <span className={cn('grid h-10 w-10 place-items-center rounded-xl bg-white font-extrabold shadow-soft', o.cls)}>{o.id === 'sandbox' ? <FlaskConical className="h-5 w-5" /> : o.label[0]}</span>
            <span className="flex-1 font-bold">{o.label}</span>
            <span className={cn('h-5 w-5 rounded-full border-2', selected === o.id ? 'border-[6px] border-brand-600' : 'border-line')} />
          </button>
        ))}
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted">
        <ShieldCheck className="h-4 w-4 text-success" /> {t('pay.noCardNote')}
      </p>
    </Modal>
  );
}
