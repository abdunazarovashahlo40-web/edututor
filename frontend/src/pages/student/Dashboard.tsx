import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpenCheck, CalendarDays, Clock, Video, Search, Trophy, Timer } from 'lucide-react';
import { api, get } from '../../services/api';
import { useI18n, subjectName } from '../../i18n';
import { useAuth } from '../../store/auth';
import { Avatar, Badge, Button, Card, EmptyState, ProgressBar, ProgressRing, Skeleton, StatCard, statusTone } from '../../components/ui';
import { TeacherCard } from '../../components/TeacherCard';
import { addDays, date, localDay, time, weekdayOf } from '../../utils/format';
import { cn } from '../../utils/cn';
import type { Booking, TeacherCard as TC } from '../../types';

export default function StudentDashboard() {
  const { t, locale, tr } = useI18n();
  const { me } = useAuth();
  const upcoming = useQuery({ queryKey: ['bookings', 'upcoming'], queryFn: () => get<Booking[]>('/bookings', { scope: 'upcoming', limit: 30 }) });
  const past = useQuery({ queryKey: ['bookings', 'past-dash'], queryFn: () => get<Booking[]>('/bookings', { scope: 'past', limit: 4, status: 'completed' }) });
  const stats = useQuery({ queryKey: ['analytics', 'student'], queryFn: () => get<any>('/analytics/student') });
  const hw = useQuery({ queryKey: ['homework', 'dash'], queryFn: () => get<any[]>('/homework', { status: 'assigned' }) });
  const rec = useQuery({ queryKey: ['teachers', 'rec'], queryFn: () => api<TC[]>('/teachers', { query: { sort: 'rating', limit: 3 } }) });

  const next = upcoming.data?.find((b) => b.status === 'confirmed') ?? upcoming.data?.[0];
  const today = localDay();
  const week = Array.from({ length: 7 }).map((_, i) => addDays(today, i));
  const short = tr<string[]>('teacher.weekdaysShort');
  const weekly = stats.data?.weekly ?? [];
  const lastW = weekly[weekly.length - 1]?.lessons ?? 0;
  const prevW = weekly[weekly.length - 2]?.lessons ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold md:text-[28px]">{t('student.hello', { name: me?.fullName.split(' ')[0] ?? '' })}</h1>
        <p className="mt-1 text-sm text-muted">{t('student.helloSub')}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* keyingi dars */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-accent p-6 text-white shadow-lift">
          <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 right-16 h-40 w-40 rounded-full bg-white/5" />
          <p className="relative text-sm font-semibold text-white/75">{t('student.nextLesson')}</p>
          {upcoming.isLoading ? (
            <Skeleton className="mt-3 h-20 bg-white/20" />
          ) : next ? (
            <div className="relative">
              <h2 className="mt-1 text-2xl font-extrabold">{subjectName(next.lesson.subject, locale)}</h2>
              <p className="text-white/85">{next.lesson.title}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-semibold">
                <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> {date(next.session.startAt, locale, true)}</span>
                <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {time(next.session.startAt)}</span>
                <span className="flex items-center gap-1.5"><Avatar name={next.teacher.user.fullName} src={next.teacher.user.avatarUrl} size={22} /> {next.teacher.user.fullName}</span>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link to={`/room/${next.session.id}`}>
                  <Button className="bg-white text-brand-700 shadow-none hover:brightness-95" icon={<Video className="h-4 w-4" />}>{t('student.join')}</Button>
                </Link>
                <Badge tone={statusTone[next.status]} className="self-center">{t(`booking.statuses.${next.status}`)}</Badge>
              </div>
            </div>
          ) : (
            <div className="relative mt-2">
              <p className="text-lg font-bold">{t('student.noNext')}</p>
              <Link to="/teachers"><Button className="mt-4 bg-white text-brand-700" icon={<Search className="h-4 w-4" />}>{t('student.findTutor')}</Button></Link>
            </div>
          )}
        </motion.div>

        {/* o'zlashtirish */}
        <Card className="flex items-center gap-5">
          <ProgressRing value={stats.data?.overallProgress ?? 0} size={112} stroke={11} />
          <div>
            <p className="text-sm font-semibold text-muted">{t('student.mastery')}</p>
            <p className="text-3xl font-extrabold">{stats.data?.overallProgress ?? 0}%</p>
            <p className={cn('mt-1 text-xs font-bold', lastW >= prevW ? 'text-success' : 'text-danger')}>
              {lastW - prevW >= 0 ? '+' : ''}{lastW - prevW} {t('common.lessons')} · {t('student.vsLastWeek')}
            </p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard to="/student/lessons?tab=past" icon={<Trophy className="h-5 w-5" />} label={t('student.completedLessons')} value={stats.data?.completedLessons ?? '—'} />
        <StatCard to="/student/progress" icon={<Timer className="h-5 w-5" />} label={t('student.hours')} value={stats.data?.hours ?? '—'} tone="blue" />
        <StatCard to="/student/homework" icon={<BookOpenCheck className="h-5 w-5" />} label={t('menu.homework')} value={stats.data ? `${stats.data.homework.done}/${stats.data.homework.total}` : '—'} tone="green" />
        <StatCard to="/student/lessons" icon={<CalendarDays className="h-5 w-5" />} label={t('student.upcoming')} value={stats.data?.upcoming ?? '—'} tone="amber" />
      </div>

      {/* haftalik jadval */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">{t('student.weekly')}</h2>
          <Link to="/student/lessons" className="text-sm font-bold text-brand-700">{t('common.more')} →</Link>
        </div>
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {week.map((d) => {
            const items = upcoming.data?.filter((b) => localDay(b.session.startAt) === d) ?? [];
            return (
              <div key={d} className={cn('min-w-[132px] flex-1 rounded-2xl border p-3', d === today ? 'border-brand-300 bg-brand-50' : 'border-line')}>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-xs font-bold uppercase text-muted">{short[weekdayOf(d)]}</span>
                  <span className={cn('text-lg font-extrabold', d === today && 'text-brand-700')}>{Number(d.slice(8))}</span>
                </div>
                <div className="space-y-1.5">
                  {items.length ? items.map((b) => (
                    <Link key={b.id} to={`/room/${b.session.id}`} className="block rounded-lg bg-white px-2 py-1.5 text-[11px] font-bold shadow-sm">
                      <span className="text-brand-700">{time(b.session.startAt)}</span> · <span className="line-clamp-1">{subjectName(b.lesson.subject, locale)}</span>
                    </Link>
                  )) : <div className="h-6" />}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-extrabold">{t('student.mySubjects')}</h2>
          {!stats.data?.subjects.length ? (
            <EmptyState title={t('common.empty')} action={<Link to="/teachers"><Button size="sm">{t('student.findTutor')}</Button></Link>} />
          ) : (
            <div className="space-y-4">
              {stats.data.subjects.map((s: any) => (
                <div key={s.subject.id}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-bold">{subjectName(s.subject, locale)}</span>
                    <span className="text-xs font-semibold text-muted">{s.lessons} {t('common.lessons')} · {s.progress}%</span>
                  </div>
                  <ProgressBar value={s.progress} />
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-extrabold">{t('student.assignments')}</h2>
            <Link to="/student/homework" className="text-sm font-bold text-brand-700">{t('common.more')} →</Link>
          </div>
          {!hw.data?.length ? <p className="py-6 text-center text-sm text-muted">{t('common.empty')}</p> : (
            <div className="space-y-2">
              {hw.data.slice(0, 4).map((h) => {
                const overdue = h.dueAt && new Date(h.dueAt) < new Date();
                return (
                  <Link key={h.id} to="/student/homework" className="flex items-center gap-3 rounded-2xl border border-line p-3 hover:border-brand-200">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-600"><BookOpenCheck className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{h.title}</div>
                      <div className={cn('text-xs font-semibold', overdue ? 'text-danger' : 'text-muted')}>{h.dueAt ? t('hw.dueIn', { date: `${date(h.dueAt, locale)} ${time(h.dueAt)}` }) : h.teacher.user.fullName}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted" />
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {!!past.data?.length && (
        <Card>
          <h2 className="mb-4 text-lg font-extrabold">{t('student.recent')}</h2>
          <div className="grid gap-2 md:grid-cols-2">
            {past.data.map((b) => (
              <div key={b.id} className="flex items-center gap-3 rounded-2xl bg-surface p-3">
                <Avatar name={b.teacher.user.fullName} src={b.teacher.user.avatarUrl} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{b.lesson.title}</div>
                  <div className="text-xs text-muted">{date(b.session.startAt, locale)} · {b.teacher.user.fullName}</div>
                </div>
                {!b.review && <Link to="/student/lessons?tab=past"><Badge tone="yellow">{t('booking.review')}</Badge></Link>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div>
        <h2 className="mb-3 text-lg font-extrabold">{t('student.recommended')}</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rec.data?.data.map((tc, i) => <TeacherCard key={tc.id} t={tc} compact index={i} />)}
        </div>
      </div>
    </div>
  );
}
