/**
 * To'lov cheki: telefonga moslashgan ko'rinish, chop etish, rasm (PNG) sifatida yuklab olish.
 * Hamma matnlar tanlangan tilda. Admin uchun — chekni foydalanuvchiga yuborish tugmasi.
 */
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Download, Printer, Send, Clock3, XCircle } from 'lucide-react';
import { get, post } from '../../services/api';
import { useI18n } from '../../i18n';
import { Button, Modal, Skeleton } from '../../components/ui';
import { useToast } from '../../hooks/useToast';
import { dateTime, errorText, money } from '../../utils/format';
import { cn } from '../../utils/cn';

type P = {
  id: string;
  receiptNo: string;
  status: string;
  provider: string;
  amount: string;
  paidAt: string | null;
  createdAt: string;
  user: { fullName: string; email?: string | null };
  booking: { lesson: { title: string }; teacher: { user: { fullName: string } }; session: { startAt: string } };
};

export function ReceiptModal({ paymentId, onClose, admin }: { paymentId: string | null; onClose: () => void; admin?: boolean }) {
  const { t, L, locale } = useI18n();
  const toast = useToast();
  const q = useQuery({ queryKey: ['payment', paymentId], queryFn: () => get<P>(`/payments/${paymentId}`), enabled: !!paymentId });
  const p = q.data;

  const rows: [string, string][] = p
    ? [
        [t('receipt.no'), p.receiptNo],
        [t('receipt.payer'), p.user.fullName],
        [t('receipt.lesson'), p.booking.lesson.title],
        [t('receipt.teacher'), p.booking.teacher.user.fullName],
        [t('receipt.lessonTime'), dateTime(p.booking.session.startAt, locale)],
        [t('receipt.method'), L('provider', p.provider)],
        [t('receipt.paidAt'), p.paidAt ? dateTime(p.paidAt, locale) : '—'],
      ]
    : [];

  const paid = p?.status === 'paid';
  const StatusIcon = paid ? CheckCircle2 : p?.status === 'failed' || p?.status === 'cancelled' ? XCircle : Clock3;

  const downloadPng = () => {
    if (!p) return;
    const W = 720;
    const H = 260 + rows.length * 64 + 120;
    const c = document.createElement('canvas');
    const dpr = 2;
    c.width = W * dpr;
    c.height = H * dpr;
    const x = c.getContext('2d')!;
    x.scale(dpr, dpr);
    // Eski brauzerlarda roundRect yo'q — oddiy to'rtburchak bilan almashtiramiz
    if (!x.roundRect) (x as any).roundRect = (a: number, b: number, w: number, h: number) => x.rect(a, b, w, h);
    x.fillStyle = '#F5F3FF';
    x.fillRect(0, 0, W, H);
    // karta
    const r = 28;
    x.fillStyle = '#FFFFFF';
    x.beginPath();
    x.roundRect(24, 24, W - 48, H - 48, r);
    x.fill();
    const g = x.createLinearGradient(24, 24, W - 24, 220);
    g.addColorStop(0, '#6D28D9');
    g.addColorStop(1, '#8B5CF6');
    x.fillStyle = g;
    x.beginPath();
    x.roundRect(24, 24, W - 48, 210, [r, r, 0, 0]);
    x.fill();
    x.fillStyle = '#fff';
    x.font = '800 30px Inter, Arial, sans-serif';
    x.fillText('🎓 EduTutor', 56, 80);
    x.font = '500 20px Inter, Arial, sans-serif';
    x.globalAlpha = 0.85;
    x.fillText(t('receipt.title'), 56, 112);
    x.globalAlpha = 1;
    x.font = '800 44px Inter, Arial, sans-serif';
    x.fillText(money(p.amount, locale), 56, 172);
    x.font = '700 20px Inter, Arial, sans-serif';
    x.fillText(`${paid ? '✓ ' : ''}${t(`pay.statuses.${p.status}`)}`, 56, 210);
    let y = 290;
    for (const [k, v] of rows) {
      x.fillStyle = '#64748B';
      x.font = '500 20px Inter, Arial, sans-serif';
      x.fillText(k, 56, y);
      x.fillStyle = '#111827';
      x.font = '700 20px Inter, Arial, sans-serif';
      const text = v.length > 36 ? v.slice(0, 35) + '…' : v;
      x.textAlign = 'right';
      x.fillText(text, W - 56, y);
      x.textAlign = 'left';
      x.strokeStyle = '#E5E7EB';
      x.setLineDash([6, 6]);
      x.beginPath();
      x.moveTo(56, y + 22);
      x.lineTo(W - 56, y + 22);
      x.stroke();
      x.setLineDash([]);
      y += 64;
    }
    x.fillStyle = '#94A3B8';
    x.font = '500 17px Inter, Arial, sans-serif';
    x.fillText(t('receipt.note'), 56, y + 20);
    const a = document.createElement('a');
    a.download = `EduTutor-${p.receiptNo}.png`;
    a.href = c.toDataURL('image/png');
    a.click();
  };

  const sendToUser = async () => {
    try {
      const r = await post<{ emailed: boolean }>(`/admin/payments/${paymentId}/send-receipt`);
      toast('success', r.emailed ? t('receipt.sentEmail') : t('receipt.sentApp'));
    } catch (e) {
      toast('error', errorText(e, t));
    }
  };

  return (
    <Modal
      open={!!paymentId}
      onClose={onClose}
      title={t('receipt.title')}
      size="sm"
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()} disabled={!p}>
            {t('receipt.print')}
          </Button>
          <Button icon={<Download className="h-4 w-4" />} onClick={downloadPng} disabled={!p}>
            {t('common.download')}
          </Button>
          {admin && (
            <Button className="col-span-2" variant="secondary" icon={<Send className="h-4 w-4" />} onClick={sendToUser} disabled={!p || !['paid', 'refunded'].includes(p.status)}>
              {t('receipt.sendToUser')}
            </Button>
          )}
        </div>
      }
    >
      {!p ? (
        <Skeleton className="h-80" />
      ) : (
        <div className="print-area overflow-hidden rounded-2xl border border-line">
          <div className="bg-gradient-to-br from-brand-700 to-brand-500 px-5 py-5 text-white">
            <div className="text-sm font-extrabold">🎓 EduTutor</div>
            <div className="mt-3 text-3xl font-extrabold tracking-tight">{money(p.amount, locale)}</div>
            <div className={cn('mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold', paid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}>
              <StatusIcon className="h-3.5 w-3.5" /> {t(`pay.statuses.${p.status}`)}
            </div>
          </div>
          <dl className="divide-y divide-dashed divide-line px-5">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-4 py-3 text-sm">
                <dt className="shrink-0 text-muted">{k}</dt>
                <dd className="min-w-0 break-words text-right font-semibold text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="px-5 pb-4 text-xs text-muted">{t('receipt.note')}</p>
        </div>
      )}
    </Modal>
  );
}
