/** To'lovlar, qaytarishlar va o'qituvchilarga pul o'tkazish */
import { useQuery } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, Check, Receipt, Search, X } from 'lucide-react';
import { get, post } from '../../services/api';
import { useI18n } from '../../i18n';
import { Badge, Button, EmptyState, Input, ListSkeleton, PageHeader, Select, Tabs, statusTone } from '../../components/ui';
import { dateTime, money } from '../../utils/format';
import { ReceiptModal } from '../../features/receipt/ReceiptView';
import { Filters, PagedList, Row, useAct, useUrlFilters } from './shared';

export function AdminPayments() {
  const { t, L, locale } = useI18n();
  const act = useAct();
  const [f, set] = useUrlFilters({ tab: 'payments', status: '', provider: '', q: '', user: '', open: '' });
  const refunds = useQuery({ queryKey: ['admin', 'refunds'], queryFn: () => get<any[]>('/admin/refunds', { limit: 50 }), enabled: f.tab === 'refunds' });
  const payouts = useQuery({ queryKey: ['admin', 'payouts'], queryFn: () => get<any[]>('/admin/payouts', { limit: 50 }), enabled: f.tab === 'payouts' });
  return (
    <div>
      <PageHeader title={t('menu.adminPayments')} />
      <Tabs
        value={f.tab}
        onChange={(tab) => set({ tab })}
        className="mb-4"
        items={[
          { value: 'payments', label: t('menu.adminPayments') },
          { value: 'refunds', label: t('admin.refunds') },
          { value: 'payouts', label: t('admin.payouts') },
        ]}
      />

      {f.tab === 'payments' && (
        <>
          <Filters>
            <Input icon={<Search className="h-4 w-4" />} value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder={t('adm.searchPayment')} className="sm:w-64" />
            <Select value={f.status} onChange={(e) => set({ status: e.target.value })} className="sm:w-44">
              <option value="">{t('adm.allStatuses')}</option>
              {['paid', 'pending', 'processing', 'failed', 'cancelled', 'refunded'].map((s) => <option key={s} value={s}>{t(`pay.statuses.${s}`)}</option>)}
            </Select>
            <Select value={f.provider} onChange={(e) => set({ provider: e.target.value })} className="sm:w-44">
              <option value="">{t('adm.allMethods')}</option>
              {['payme', 'click', 'sandbox', 'manual'].map((s) => <option key={s} value={s}>{L('provider', s)}</option>)}
            </Select>
            {f.user && <Button size="sm" variant="ghost" onClick={() => set({ user: '' })}>✕ {t('adm.oneUserFilter')}</Button>}
          </Filters>
          <PagedList<any>
            queryKey={['payments', f.status, f.provider, f.q, f.user]}
            path="/admin/payments"
            query={{ status: f.status, provider: f.provider, q: f.q, user: f.user }}
            render={(p) => (
              <Row key={p.id} onClick={() => set({ open: p.id })}>
                <div className="flex items-center gap-3">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${p.status === 'paid' ? 'bg-emerald-100 text-emerald-600' : p.status === 'refunded' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-500'}`}>
                    {p.status === 'refunded' ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{p.user.fullName}</div>
                    <div className="truncate text-xs text-muted">{p.booking.lesson.title}</div>
                    <div className="flex items-center gap-1 text-[11px] text-muted"><Receipt className="h-3 w-3" /> <span className="font-mono">{p.receiptNo}</span> · {L('provider', p.provider)} · {dateTime(p.createdAt, locale)}</div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <b>{money(p.amount, locale)}</b>
                    <Badge tone={statusTone[p.status]}>{t(`pay.statuses.${p.status}`)}</Badge>
                  </div>
                </div>
              </Row>
            )}
          />
          <ReceiptModal admin paymentId={f.open || null} onClose={() => set({ open: '' })} />
        </>
      )}

      {f.tab === 'refunds' &&
        (refunds.isLoading ? <ListSkeleton /> : !refunds.data?.length ? <EmptyState title={t('common.empty')} /> : (
          <div className="space-y-2.5">
            {refunds.data.map((r) => (
              <Row key={r.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold">{r.payment.user.fullName}</div>
                    <div className="truncate text-xs text-muted">{r.payment.booking.lesson.title} · {dateTime(r.createdAt, locale)}</div>
                    {r.reason && <p className="mt-1.5 rounded-xl bg-surface px-3 py-2 text-sm text-ink/80">{r.reason.replace(/^trial_guarantee: /, `🛡 ${t('booking.guarantee')}: `)}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <b>{money(r.amount, locale)}</b>
                    <Badge tone={statusTone[r.status] ?? 'gray'}>{L('refund', r.status)}</Badge>
                  </div>
                </div>
                {['requested', 'approved'].includes(r.status) && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="success" icon={<Check className="h-4 w-4" />} onClick={() => act(() => post(`/admin/refunds/${r.id}/decide`, { approve: true }))}>{t('adm.refundApprove')}</Button>
                    <Button size="sm" variant="danger" icon={<X className="h-4 w-4" />} onClick={() => act(() => post(`/admin/refunds/${r.id}/decide`, { approve: false }))}>{t('admin.rejectT')}</Button>
                  </div>
                )}
              </Row>
            ))}
          </div>
        ))}

      {f.tab === 'payouts' &&
        (payouts.isLoading ? <ListSkeleton /> : !payouts.data?.length ? <EmptyState title={t('common.empty')} /> : (
          <div className="space-y-2.5">
            {payouts.data.map((p) => (
              <Row key={p.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold">{p.teacher.user.fullName}</div>
                    <div className="text-xs text-muted">💳 <span className="font-mono">{p.destination}</span> · {dateTime(p.createdAt, locale)}</div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <b>{money(p.amount, locale)}</b>
                    <Badge tone={p.status === 'paid' ? 'green' : p.status === 'rejected' ? 'red' : 'yellow'}>{L('payout', p.status)}</Badge>
                  </div>
                </div>
                {['requested', 'processing'].includes(p.status) && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="success" icon={<Check className="h-4 w-4" />} onClick={() => act(() => post(`/admin/payouts/${p.id}/decide`, { status: 'paid' }))}>{t('admin.markPaid')}</Button>
                    <Button size="sm" variant="danger" icon={<X className="h-4 w-4" />} onClick={() => act(() => post(`/admin/payouts/${p.id}/decide`, { status: 'rejected' }))}>{t('admin.rejectT')}</Button>
                  </div>
                )}
              </Row>
            ))}
          </div>
        ))}
    </div>
  );
}
