import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarCheck, Star, Users, Wallet, Video, Inbox, ArrowRight } from 'lucide-react';
import { get } from '../../services/api';
import { useI18n } from '../../i18n';
import { useAuth } from '../../store/auth';
import { Avatar, Badge, Button, Card, ProgressRing, Skeleton, StatCard, Stars } from '../../components/ui';
import { VerificationBanner } from '../../components/VerificationBanner';
import { BookingItem } from '../../features/booking/BookingItem';
import { compact, money, time } from '../../utils/format';
import type { Booking } from '../../types';

export default function TeacherOverview() {
  const { t, locale } = useI18n();
  const { me } = useAuth();
  const a = useQuery({ queryKey: ['analytics', 'teacher'], queryFn: () => get<any>('/analytics/teacher') });
  const req = useQuery({ queryKey: ['bookings', 'requests', 1], queryFn: () => get<Booking[]>('/bookings', { scope: 'requests', limit: 3 }) });
  const d = a.data;
  return (
    <div className="space-y-5">
      <VerificationBanner />
      <div>
        <h1 className="text-2xl font-extrabold md:text-[28px]">{t('teacher.hello', { name: me?.fullName.split(' ')[0] ?? '' })}</h1>
        <p className="mt-1 text-sm text-muted">{t('teacher.todayCount', { n: d?.today.length ?? 0 })}</p>
      </div>
      {a.isLoading ? <Skeleton className="h-24" /> : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={<Users className="h-5 w-5" />} label={t('teacher.activeStudents')} value={d?.totalStudents ?? 0} />
          <StatCard icon={<CalendarCheck className="h-5 w-5" />} label={t('teacher.lessonsDone')} value={d?.completedLessons ?? 0} tone="blue" />
          <StatCard icon={<Star className="h-5 w-5" />} label={t('teacher.rating')} value={d?.rating?.toFixed(1) ?? '—'} hint={`${d?.ratingCount ?? 0} ${t('common.reviews')}`} tone="amber" />
          <StatCard icon={<Wallet className="h-5 w-5" />} label={t('teacher.monthIncome')} value={money(d?.monthlyEarnings ?? 0, locale)} tone="green" />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold">{t('teacher.todayLessons')}</h2>
            <Link to="/teacher/schedule" className="text-sm font-bold text-brand-700">{t('menu.schedule')} →</Link>
          </div>
          {!d?.today.length ? <p className="py-8 text-center text-sm text-muted">{t('teacher.noToday')}</p> : (
            <div className="divide-y divide-line">
              {d.today.map((s: any) => (
                <div key={s.id} className="flex items-center gap-3 py-3">
                  <span className="w-14 text-lg font-extrabold text-brand-700">{time(s.startAt)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{s.lesson.title}</p>
                    <div className="flex items-center gap-1 text-xs text-muted">
                      <div className="flex -space-x-2">{s.bookings.slice(0, 4).map((b: any) => <Avatar key={b.id} name={b.student.fullName} src={b.student.avatarUrl} size={20} />)}</div>
                      <span className="ml-1">{s.bookings.length} {t('common.students')} · {t(`lesson.types.${s.lesson.type}`)}</span>
                    </div>
                  </div>
                  <Link to={`/room/${s.id}`}><Button size="sm" variant="secondary" icon={<Video className="h-4 w-4" />}>{t('teacher.room')}</Button></Link>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="flex flex-col">
          <h2 className="mb-2 text-lg font-extrabold">{t('teacher.earningsChart')}</h2>
          <div className="h-48 flex-1">
            <ResponsiveContainer>
              <AreaChart data={d?.earningsByMonth ?? []}>
                <defs><linearGradient id="earn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8B5CF6" stopOpacity={0.4} /><stop offset="1" stopColor="#8B5CF6" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF0F7" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(m) => m.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => compact(v)} />
                <Tooltip formatter={(v: number) => money(v, locale)} contentStyle={{ borderRadius: 12, border: '1px solid #E8E6F5' }} />
                <Area type="monotone" dataKey="net" stroke="#6D28D9" strokeWidth={2.5} fill="url(#earn)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-surface p-3">
            <ProgressRing value={d?.completionRate ?? 0} size={52} stroke={6}><span className="text-xs font-extrabold">{d?.completionRate ?? 0}%</span></ProgressRing>
            <span className="text-sm font-semibold text-muted">{t('teacher.completion')}</span>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-extrabold"><Inbox className="h-5 w-5 text-brand-600" /> {t('teacher.requests')} {d?.pendingRequests ? <Badge tone="yellow">{d.pendingRequests}</Badge> : null}</h2>
            <Link to="/teacher/bookings?tab=requests" className="text-sm font-bold text-brand-700">{t('common.more')} →</Link>
          </div>
          {!req.data?.length ? <Card><p className="py-4 text-center text-sm text-muted">{t('common.empty')}</p></Card> : (
            <div className="space-y-3">{req.data.map((b) => <BookingItem key={b.id} b={b} as="teacher" />)}</div>
          )}
        </div>
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold">{t('teacher.recentReviews')}</h2>
            <Link to="/teacher/reviews"><ArrowRight className="h-5 w-5 text-muted" /></Link>
          </div>
          {!d?.recentReviews.length ? <p className="py-4 text-center text-sm text-muted">{t('search.noReviews')}</p> : (
            <div className="space-y-3">
              {d.recentReviews.map((r: any) => (
                <div key={r.id} className="rounded-2xl bg-surface p-3">
                  <div className="flex items-center gap-2"><Avatar name={r.student.fullName} src={r.student.avatarUrl} size={28} /><b className="text-sm">{r.student.fullName}</b><span className="ml-auto"><Stars value={r.rating} size={12} /></span></div>
                  {r.comment && <p className="mt-1.5 line-clamp-2 text-sm text-ink/80">{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
