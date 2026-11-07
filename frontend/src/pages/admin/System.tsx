/** Platforma sozlamalari va audit jurnali */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Percent, Search, Timer, Wallet, BadgePercent, Hourglass, ChevronDown } from 'lucide-react';
import { api, get, put } from '../../services/api';
import { useI18n } from '../../i18n';
import { Badge, Button, Card, EmptyState, Input, ListSkeleton, PageHeader, Pagination, Select } from '../../components/ui';
import { dateTime } from '../../utils/format';
import { Filters, useAct, useUrlFilters } from './shared';
import { cn } from '../../utils/cn';

export function AdminSettings() {
  const { t } = useI18n();
  const act = useAct();
  const q = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => get<any>('/admin/settings') });
  const [f, setF] = useState<any>(null);
  const v = f ?? q.data;
  if (!v) return <ListSkeleton />;
  // Har bir sozlama alohida, izohi bilan — bir-biriga aralashmaydi
  const groups = [
    {
      title: t('adm.setMoney'),
      items: [
        { k: 'commissionPercent', icon: Percent, label: t('admin.commission'), hint: t('adm.hintCommission') },
        { k: 'trialDiscountPercent', icon: BadgePercent, label: t('admin.trialDiscount'), hint: t('adm.hintTrial') },
        { k: 'minPayoutAmount', icon: Wallet, label: t('admin.minPayout'), hint: t('adm.hintMinPayout') },
      ],
    },
    {
      title: t('adm.setTiming'),
      items: [
        { k: 'earningHoldHours', icon: Hourglass, label: t('admin.hold'), hint: t('adm.hintHold') },
        { k: 'autoCancelUnpaidMinutes', icon: Timer, label: t('admin.autoCancel'), hint: t('adm.hintAutoCancel') },
      ],
    },
  ];
  const keys = groups.flatMap((g) => g.items.map((i) => i.k));
  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title={t('adm.platformSettings')} subtitle={t('adm.platformSettingsHint')} />
      {groups.map((g) => (
        <Card key={g.title}>
          <h2 className="mb-3 font-extrabold">{g.title}</h2>
          <div className="space-y-4">
            {g.items.map(({ k, icon: I, label, hint }) => (
              <div key={k} className="grid gap-2 sm:grid-cols-[1fr_160px] sm:items-center">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><I className="h-4 w-4" /></span>
                  <div>
                    <div className="text-sm font-bold">{label}</div>
                    <div className="text-xs text-muted">{hint}</div>
                  </div>
                </div>
                <Input type="number" inputMode="decimal" value={v[k]} onChange={(e) => setF({ ...v, [k]: e.target.value })} />
              </div>
            ))}
          </div>
        </Card>
      ))}
      <div className="sticky bottom-3 flex justify-end">
        <Button size="lg" disabled={!f} onClick={() => act(() => put('/admin/settings', Object.fromEntries(keys.map((k) => [k, Number(v[k])])))).then((r) => r && setF(null))}>
          {t('common.save')}
        </Button>
      </div>
      <p className="text-xs text-muted">{t('adm.ownAccountHint')} <Link to="/admin/account" className="font-bold text-brand-700">{t('adm.myAccount')}</Link></p>
    </div>
  );
}

const GROUPS = ['auth', 'admin', 'user', 'teacher', 'applock', 'booking', 'payment', 'refund', 'payout', 'lesson', 'subject', 'review', 'complaint', 'settings'] as const;

export function AdminAudit() {
  const { t, L, locale } = useI18n();
  const [f, set] = useUrlFilters({ group: '', actor: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['admin', 'audit', f, page], queryFn: () => api<any[]>('/admin/audit', { query: { ...f, page, limit: 30 } }) });
  const tone = (a: string): 'red' | 'green' | 'yellow' | 'blue' | 'brand' | 'gray' =>
    /failed|lockout|blocked|suspend|reject|delete|duplicate/.test(a) ? 'red' : /approve|paid|activate|verified|login$/.test(a) ? 'green' : a.startsWith('admin.') ? 'yellow' : 'brand';
  const entityLink = (l: any) =>
    l.entityType === 'User' ? `/admin/users/${l.entityId}` : l.entityType === 'TeacherProfile' ? `/admin/teachers/${l.entityId}` : l.entityType === 'Lesson' ? `/admin/lessons?open=${l.entityId}` : l.entityType === 'Booking' ? `/admin/bookings?open=${l.entityId}` : l.entityType === 'Payment' ? `/admin/payments?open=${l.entityId}` : null;

  return (
    <div>
      <PageHeader title={t('menu.audit')} subtitle={t('adm.auditHint')} />
      <Filters>
        <Select value={f.group} onChange={(e) => (setPage(1), set({ group: e.target.value }))} className="sm:w-52">
          <option value="">{t('adm.allEvents')}</option>
          {GROUPS.map((g) => <option key={g} value={g}>{t(`adm.auditGroup.${g}`)}</option>)}
        </Select>
        <Input icon={<Search className="h-4 w-4" />} value={f.actor} onChange={(e) => (setPage(1), set({ actor: e.target.value }))} placeholder={t('adm.whoDid')} className="sm:w-56" />
        <div className="flex items-center gap-2">
          <Input type="date" value={f.from} onChange={(e) => (setPage(1), set({ from: e.target.value }))} aria-label={t('common.from')} />
          <span className="text-muted">—</span>
          <Input type="date" value={f.to} onChange={(e) => (setPage(1), set({ to: e.target.value }))} aria-label={t('common.to')} />
        </div>
      </Filters>
      {q.isLoading ? <ListSkeleton /> : !q.data?.data.length ? <EmptyState title={t('common.empty')} /> : (
        <>
          <ul className="divide-y divide-line/70 overflow-hidden rounded-2xl border border-line/70 bg-white">
            {q.data.data.map((l) => {
              const link = l.entityId ? entityLink(l) : null;
              const meta = l.meta && Object.keys(l.meta).length ? l.meta : null;
              return (
                <li key={l.id} className="px-3.5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Badge tone={tone(l.action)}>{L('action', l.action)}</Badge>
                      <div className="mt-1 text-sm">
                        <b>{l.actor?.fullName ?? t('adm.system')}</b>
                        {l.actor?.role && <span className="text-xs text-muted"> · {t(`roles.${l.actor.role}`)}</span>}
                      </div>
                      <div className="text-xs text-muted">
                        {L('entity', l.entityType)}
                        {link ? <Link to={link} className="ml-1 font-bold text-brand-700">{t('common.open')} →</Link> : null}
                        {l.ip && <span className="ml-2 font-mono">{l.ip}</span>}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-xs text-muted">{dateTime(l.createdAt, locale)}</div>
                  </div>
                  {meta && (
                    <>
                      <button onClick={() => setOpen(open === l.id ? null : l.id)} className="mt-1 flex items-center gap-1 text-xs font-bold text-muted">
                        {t('adm.details')} <ChevronDown className={cn('h-3.5 w-3.5 transition', open === l.id && 'rotate-180')} />
                      </button>
                      {open === l.id && (
                        <dl className="mt-1.5 grid gap-1 rounded-xl bg-surface p-2.5 text-xs">
                          {Object.entries(meta).map(([k, val]) => (
                            <div key={k} className="flex gap-2">
                              <dt className="shrink-0 text-muted">{t(`adm.metaKey.${k}`) === `adm.metaKey.${k}` ? k : t(`adm.metaKey.${k}`)}:</dt>
                              <dd className="min-w-0 break-words font-semibold">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          <Pagination page={page} pages={q.data.meta?.pages ?? 1} onChange={setPage} />
        </>
      )}
    </div>
  );
}
