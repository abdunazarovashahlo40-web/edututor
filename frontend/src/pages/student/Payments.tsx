import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Receipt, RotateCcw } from 'lucide-react';
import { api, post } from '../../services/api';
import { useI18n } from '../../i18n';
import { Badge, Button, EmptyState, Field, ListSkeleton, Modal, PageHeader, Pagination, Table, Td, Textarea, statusTone } from '../../components/ui';
import { dateTime, errorText, money } from '../../utils/format';
import { useToast } from '../../hooks/useToast';
import { useIsMobile } from '../../hooks/useMedia';
import { ReceiptModal } from '../../features/receipt/ReceiptView';

export default function Payments() {
  const { t, locale, L } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const mobile = useIsMobile();
  const [sp] = useSearchParams();
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['payments', page], queryFn: () => api<any[]>('/payments', { query: { page } }) });
  const [refund, setRefund] = useState<any>(null);
  const [receipt, setReceipt] = useState<string | null>(sp.get('receipt'));
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (sp.get('paid')) toast('info', t('pay.statuses.processing'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = q.data?.data ?? [];
  const Actions = ({ p }: { p: any }) => (
    <div className="flex gap-1">
      <Button size="sm" variant="ghost" icon={<Receipt className="h-4 w-4" />} onClick={() => setReceipt(p.id)}>{t('pay.receipt')}</Button>
      {p.status === 'paid' && !p.refunds.length && <Button size="sm" variant="ghost" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setRefund(p)}>{t('pay.refund')}</Button>}
    </div>
  );

  return (
    <div>
      <PageHeader title={t('pay.history')} />
      {q.isLoading ? <ListSkeleton /> : !rows.length ? <EmptyState title={t('common.empty')} icon={<CreditCard className="h-7 w-7" />} /> : mobile ? (
        <div className="space-y-3">
          {rows.map((p) => (
            <div key={p.id} className="rounded-2xl border border-line bg-white p-4 shadow-soft">
              <div className="flex items-center justify-between"><b>{money(p.amount, locale)}</b><Badge tone={statusTone[p.status]}>{t(`pay.statuses.${p.status}`)}</Badge></div>
              <p className="mt-1 text-sm">{p.booking.lesson.title}</p>
              <p className="text-xs text-muted">{p.receiptNo} · {L('provider', p.provider)} · {dateTime(p.createdAt, locale)}</p>
              <div className="mt-2"><Actions p={p} /></div>
            </div>
          ))}
        </div>
      ) : (
        <Table head={[t('pay.receipt'), t('lesson.title'), t('pay.method'), t('common.date'), t('common.price'), t('common.status'), '']}>
          {rows.map((p) => (
            <tr key={p.id}>
              <Td className="font-mono text-xs">{p.receiptNo}</Td>
              <Td className="font-semibold">{p.booking.lesson.title}</Td>
              <Td>{L('provider', p.provider)}</Td>
              <Td>{dateTime(p.createdAt, locale)}</Td>
              <Td className="font-bold">{money(p.amount, locale)}</Td>
              <Td><Badge tone={statusTone[p.status]}>{t(`pay.statuses.${p.status}`)}</Badge>{p.refunds.map((r: any) => <Badge key={r.id} tone="blue" className="ml-1">↩ {money(r.amount, locale)}</Badge>)}</Td>
              <Td><Actions p={p} /></Td>
            </tr>
          ))}
        </Table>
      )}
      <Pagination page={page} pages={q.data?.meta?.pages ?? 1} onChange={setPage} />
      <ReceiptModal paymentId={receipt} onClose={() => setReceipt(null)} />
      <Modal open={!!refund} onClose={() => setRefund(null)} title={t('pay.refund')} size="sm" footer={
        <Button className="w-full" disabled={reason.length < 10} onClick={async () => {
          try { await post(`/payments/${refund.id}/refund-request`, { reason }); toast('success', t('common.done')); setRefund(null); setReason(''); qc.invalidateQueries({ queryKey: ['payments'] }); }
          catch (e) { toast('error', errorText(e, t)); }
        }}>{t('common.send')}</Button>}>
        <Field label={t('pay.refundReason')}><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </Modal>
    </div>
  );
}
