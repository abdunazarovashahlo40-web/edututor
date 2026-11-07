/**
 * Admin bosh sahifasi: har bir ko'rsatkich bosiladi va tegishli bo'limga (tayyor filtr bilan) olib boradi.
 * Grafiklar matnsiz ham tushunarli: rangli belgilar, ikonkalar, umumiy summa markazda.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BookOpen, CalendarCheck, CheckCircle2, CircleDollarSign, Clock, Clock3, Flag, GraduationCap, RotateCcw, Users, XCircle, Ban } from 'lucide-react';
import { get } from '../../services/api';
import { useI18n } from '../../i18n';
import { Card, PageHeader, Skeleton, StatCard } from '../../components/ui';
import { compact, money } from '../../utils/format';
import { cn } from '../../utils/cn';

const PAY = {
  paid: { color: '#22C55E', icon: CheckCircle2 },
  pending: { color: '#F59E0B', icon: Clock3 },
  processing: { color: '#3B82F6', icon: Clock },
  failed: { color: '#EF4444', icon: XCircle },
  cancelled: { color: '#94A3B8', icon: Ban },
  refunded: { color: '#A855F7', icon: RotateCcw },
} as const;

const SERIES = [
  { key: 'students', color: '#7C3AED', role: 'STUDENT' },
  { key: 'teachers', color: '#3B82F6', role: 'TEACHER' },
] as const;

export function AdminDashboard() {
  const { t, locale } = useI18n();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => get<any>('/admin/stats') });
  // Grafikda qaysi chiziqlar ko'rinadi (bosib almashtiriladi)
  const [show, setShow] = useState<Record<string, boolean>>({ students: true, teachers: true });
  const d = q.data;
  if (q.isLoading || !d) return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;

  const growthTotals = {
    students: d.growth.reduce((a: number, x: any) => a + x.students, 0),
    teachers: d.growth.reduce((a: number, x: any) => a + x.teachers, 0),
  };
  const pays = (d.payments as { status: keyof typeof PAY; count: number; amount: number }[]).filter((p) => p.count > 0);
  const paidSum = pays.find((p) => p.status === 'paid')?.amount ?? 0;
  const totalPays = pays.reduce((a, p) => a + p.count, 0);
  const monthLabel = (m: string) => new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale === 'ru' ? 'ru-RU' : 'uz-UZ', { month: 'short' }).format(new Date(`${m}-15`));

  return (
    <div className="space-y-5">
      <PageHeader title={t('admin.title')} subtitle={t('adm.tapHint')} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard to="/admin/users" icon={<Users className="h-5 w-5" />} label={t('admin.totalUsers')} value={compact(d.totalUsers)} />
        <StatCard to="/admin/users?role=TEACHER" icon={<GraduationCap className="h-5 w-5" />} label={t('adm.teachers')} value={compact(d.teachers)} tone="blue" />
        <StatCard to="/admin/users?role=STUDENT" icon={<Users className="h-5 w-5" />} label={t('adm.students')} value={compact(d.students)} tone="green" />
        <StatCard to="/admin/teachers?v=PENDING" icon={<Clock className="h-5 w-5" />} label={t('admin.pending')} value={d.pendingTeachers} tone="amber" />
        <StatCard to="/admin/lessons" icon={<BookOpen className="h-5 w-5" />} label={t('menu.adminLessons')} value={compact(d.lessons)} tone="pink" />
        <StatCard to="/admin/bookings" icon={<CalendarCheck className="h-5 w-5" />} label={t('menu.adminBookings')} value={`${compact(d.completedLessons)} / ${compact(d.bookings)}`} hint={t('adm.completedOfAll')} tone="blue" />
        <StatCard to="/admin/payments" icon={<CircleDollarSign className="h-5 w-5" />} label={t('admin.revenue')} value={money(d.platformRevenue, locale)} tone="green" hint={`${t('admin.volume')}: ${money(d.grossVolume, locale)}`} />
        <StatCard to="/admin/complaints" icon={<Flag className="h-5 w-5" />} label={t('admin.openComplaints')} value={d.openComplaints} hint={d.refundRequests ? `↩ ${d.refundRequests} ${t('adm.refundRequests')}` : undefined} tone="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* Foydalanuvchilar o'sishi: belgini bosib faqat o'quvchi yoki o'qituvchini ko'rish */}
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-extrabold">{t('admin.growth')} <span className="text-xs font-semibold text-muted">· 30 {t('adm.days')}</span></h2>
            <div className="flex gap-2">
              {SERIES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setShow((v) => (v[s.key] && Object.values(v).filter(Boolean).length === 1 ? { students: true, teachers: true } : { students: false, teachers: false, [s.key]: true }))}
                  onDoubleClick={() => nav(`/admin/users?role=${s.role}`)}
                  className={cn('flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold transition', show[s.key] ? 'border-transparent bg-slate-900 text-white' : 'border-line text-muted')}
                  aria-pressed={show[s.key]}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                  {t(`adm.${s.key}`)} <span className="opacity-70">+{growthTotals[s.key]}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="h-60">
            <ResponsiveContainer>
              <AreaChart data={d.growth}>
                <defs>
                  {SERIES.map((s) => (
                    <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor={s.color} stopOpacity={0.35} />
                      <stop offset="1" stopColor={s.color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF0F7" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(8) + '.' + v.slice(5, 7)} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={24} />
                <Tooltip contentStyle={{ borderRadius: 12 }} labelFormatter={(v) => String(v).split('-').reverse().join('.')} />
                {SERIES.filter((s) => show[s.key]).map((s) => (
                  <Area key={s.key} type="monotone" dataKey={s.key} name={t(`adm.${s.key}`)} stroke={s.color} fill={`url(#g-${s.key})`} strokeWidth={2.5} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <button onClick={() => nav(`/admin/users${show.students && !show.teachers ? '?role=STUDENT' : !show.students && show.teachers ? '?role=TEACHER' : ''}`)} className="mt-2 text-xs font-bold text-brand-700">
            {t('adm.openList')} →
          </button>
        </Card>

        {/* To'lovlar: donut — markazda tushgan pul, atrofida holatlar */}
        <Card>
          <h2 className="mb-1 font-extrabold">{t('menu.adminPayments')}</h2>
          {!totalPays ? (
            <p className="py-10 text-center text-sm text-muted">{t('common.empty')}</p>
          ) : (
            <>
              <div className="relative h-48">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={pays} dataKey="count" nameKey="status" innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke="none" onClick={(e: any) => nav(`/admin/payments?status=${e.status}`)}>
                      {pays.map((p) => <Cell key={p.status} fill={PAY[p.status]?.color ?? '#CBD5E1'} className="cursor-pointer" />)}
                    </Pie>
                    <Tooltip formatter={(v: number, _n, item: any) => [`${v} · ${money(item.payload.amount, locale)}`, t(`pay.statuses.${item.payload.status}`)]} contentStyle={{ borderRadius: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div>
                    <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-500" />
                    <div className="text-sm font-extrabold">{compact(paidSum)}</div>
                    <div className="text-[10px] font-bold text-muted">{t('common.sum')}</div>
                  </div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {pays.map((p) => {
                  const I = PAY[p.status]?.icon ?? Clock;
                  return (
                    <button key={p.status} onClick={() => nav(`/admin/payments?status=${p.status}`)} className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-slate-50">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `${PAY[p.status]?.color}22`, color: PAY[p.status]?.color }}>
                        <I className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-bold">{t(`pay.statuses.${p.status}`)}</span>
                        <span className="block text-[11px] text-muted">{p.count} · {compact(p.amount)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Oyma-oy tushum: ustunlar — umumiy tushum va platforma ulushi */}
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-extrabold">{t('adm.revenueByMonth')}</h2>
          <div className="flex gap-3 text-xs font-bold text-muted">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-300" />{t('admin.volume')}</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-700" />{t('admin.revenue')}</span>
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={d.revenueByMonth ?? []} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF0F7" />
              <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(v) => compact(v)} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
              <Tooltip formatter={(v: number, n: string) => [money(v, locale), n === 'gross' ? t('admin.volume') : t('admin.revenue')]} labelFormatter={monthLabel} contentStyle={{ borderRadius: 12 }} />
              <Bar dataKey="gross" fill="#C4B5FD" radius={[6, 6, 0, 0]} />
              <Bar dataKey="commission" fill="#6D28D9" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
