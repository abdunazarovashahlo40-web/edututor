import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Clock, CreditCard, Hourglass, Wallet } from 'lucide-react';
import { get, post } from '../../services/api';
import { useI18n } from '../../i18n';
import { Badge, Button, Card, EmptyState, ListSkeleton, PageHeader, StatCard, Table, Td, statusTone } from '../../components/ui';
import { dateTime, errorText, money } from '../../utils/format';
import { useToast } from '../../hooks/useToast';

export default function Earnings() {
  const { t, locale, L } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['earnings'], queryFn: () => get<any>('/payments/earnings/me') });
  const [busy, setBusy] = useState(false);
  const s = q.data?.summary;
  const canPayout = s && s.payoutCard && s.available >= s.minPayoutAmount;

  return (
    <div className="space-y-5">
      <PageHeader title={t('menu.earnings')} subtitle={s && `${t('teacher.commission')}: ${s.commissionPercent}%`} actions={
        <Button disabled={!canPayout} loading={busy} icon={<ArrowUpRight className="h-4 w-4" />} onClick={async () => {
          setBusy(true);
          try { await post('/payments/payouts'); toast('success', t('common.done')); qc.invalidateQueries({ queryKey: ['earnings'] }); }
          catch (e) { toast('error', errorText(e, t)); } finally { setBusy(false); }
        }}>{t('teacher.payout')}</Button>} />
      {s && !s.payoutCard && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{t('teacher.noCard')} — <Link to="/teacher/profile" className="underline">{t('menu.profile')}</Link></p>}
      {q.isLoading ? <ListSkeleton /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={<Wallet className="h-5 w-5" />} label={t('teacher.available')} value={money(s?.available, locale)} tone="green" hint={s && t('teacher.minPayout', { sum: money(s.minPayoutAmount, locale) })} />
            <StatCard icon={<Hourglass className="h-5 w-5" />} label={t('teacher.held')} value={money(s?.held, locale)} tone="amber" />
            <StatCard icon={<CreditCard className="h-5 w-5" />} label={t('teacher.paidOut')} value={money(s?.paidOut, locale)} tone="blue" />
            <StatCard icon={<Clock className="h-5 w-5" />} label={t('teacher.monthIncome')} value={money(s?.thisMonth, locale)} />
          </div>
          {!q.data?.items.length ? <EmptyState title={t('common.empty')} /> : (
            <Table head={[t('common.date'), t('lesson.title'), t('booking.student'), t('teacher.gross'), t('teacher.commission'), t('teacher.net'), t('common.status')]}>
              {q.data.items.map((e: any) => (
                <tr key={e.id}>
                  <Td>{dateTime(e.payment.paidAt ?? e.createdAt, locale)}</Td>
                  <Td className="font-semibold">{e.payment.booking.lesson.title}</Td>
                  <Td>{e.payment.booking.student.fullName}</Td>
                  <Td>{money(e.gross, locale)}</Td>
                  <Td className="text-muted">−{money(e.commission, locale)}</Td>
                  <Td className="font-extrabold text-success">{money(e.net, locale)}</Td>
                  <Td><Badge tone={statusTone[e.status]}>{e.status === 'reversed' ? t('pay.statuses.refunded') : t(`teacher.${e.status === 'paid_out' ? 'paidOut' : e.status}`)}</Badge></Td>
                </tr>
              ))}
            </Table>
          )}
          {!!q.data?.payouts.length && (
            <Card>
              <h2 className="mb-3 font-extrabold">{t('admin.payouts')}</h2>
              <div className="divide-y divide-line">
                {q.data.payouts.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                    <span>{dateTime(p.createdAt, locale)} · {p.destination}</span>
                    <span className="flex items-center gap-2 font-bold">{money(p.amount, locale)} <Badge tone={p.status === 'paid' ? 'green' : p.status === 'rejected' ? 'red' : 'yellow'}>{L('payout', p.status)}</Badge></span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
