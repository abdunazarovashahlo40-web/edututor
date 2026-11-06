import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpenCheck, CalendarDays, CheckCircle2, Clock, NotebookPen, Timer, Trophy, Award, ShieldCheck } from 'lucide-react';
import { get } from '../../services/api';
import { useI18n, subjectName } from '../../i18n';
import { Avatar, Badge, Card, EmptyState, ProgressBar, ProgressRing, Skeleton, StatCard, statusTone } from '../../components/ui';
import { date, time } from '../../utils/format';

/**
 * Ota-ona sahifasi: o'quvchi ulashgan havola orqali login'siz ochiladi.
 * Faqat o'qish uchun — kontaktlar, to'lovlar va yozishmalar ko'rsatilmaydi.
 */
export default function ParentReport() {
  const { token = '' } = useParams();
  const { t, locale } = useI18n();
  const q = useQuery({ queryKey: ['parent', token], queryFn: () => get<any>(`/public/progress/${token}`), retry: false });

  if (q.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (!q.data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState title={t('parent.notFound')} text={t('parent.notFoundText')} />
      </div>
    );
  }
  const d = q.data;
  const a = d.analytics;
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 md:py-10">
      <Card className="flex flex-col gap-4 bg-gradient-to-br from-brand-700 to-brand-500 text-white md:flex-row md:items-center">
        <Avatar name={d.student.firstName} src={d.student.avatarUrl} size={72} className="ring-4 ring-white/30" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-white/75">{t('parent.title')}</p>
          <h1 className="text-2xl font-extrabold md:text-3xl">{d.student.firstName}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-white/75">
            <ShieldCheck className="h-4 w-4" /> {t('parent.readonly')}
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3">
          <ProgressRing value={a.overallProgress} size={72} stroke={8} color="#FDE68A" />
          <span className="text-sm font-bold">{t('student.mastery')}</span>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={<Trophy className="h-5 w-5" />} label={t('student.completedLessons')} value={a.completedLessons} />
        <StatCard icon={<Timer className="h-5 w-5" />} label={t('student.hours')} value={a.hours} tone="blue" />
        <StatCard icon={<BookOpenCheck className="h-5 w-5" />} label={t('menu.homework')} value={`${a.homework.done}/${a.homework.total}`} tone="green" />
        <StatCard icon={<Award className="h-5 w-5" />} label={t('student.avgScore')} value={a.avgScore != null ? `${a.avgScore}%` : '—'} tone="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 flex items-center gap-2 font-extrabold"><CalendarDays className="h-5 w-5 text-brand-600" /> {t('parent.upcoming')}</h2>
          {d.upcoming.length ? (
            <ul className="space-y-2.5">
              {d.upcoming.map((b: any) => (
                <li key={b.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{b.lesson.title}</p>
                    <p className="text-xs text-muted">{subjectName(b.lesson.subject, locale)} · {b.teacher.user.fullName}</p>
                  </div>
                  <span className="shrink-0 text-right text-xs font-bold text-ink/80">{date(b.session.startAt, locale)}<br />{time(b.session.startAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{t('parent.noUpcoming')}</p>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-extrabold">{t('student.mySubjects')}</h2>
          {a.subjects.length ? (
            <div className="space-y-4">
              {a.subjects.map((s: any) => (
                <div key={s.subject.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <b>{subjectName(s.subject, locale)}</b>
                    <span className="text-muted">{s.lessons} {t('common.lessons')} · {s.avgScore != null ? `${s.avgScore}%` : '—'}</span>
                  </div>
                  <ProgressBar value={s.progress} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">{t('parent.noLessons')}</p>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 flex items-center gap-2 font-extrabold"><NotebookPen className="h-5 w-5 text-brand-600" /> {t('parent.recent')}</h2>
        {d.recent.length ? (
          <ul className="divide-y divide-line/70">
            {d.recent.map((b: any) => (
              <li key={b.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">{b.lesson.title}</p>
                  <div className="flex items-center gap-2">
                    <Badge tone={statusTone[b.status]}>{b.status === 'completed' ? t('parent.attended') : t('parent.missed')}</Badge>
                    <span className="flex items-center gap-1 text-xs font-semibold text-muted"><Clock className="h-3.5 w-3.5" /> {date(b.session.startAt, locale)}</span>
                  </div>
                </div>
                <p className="mt-0.5 text-xs text-muted">{subjectName(b.lesson.subject, locale)} · {b.teacher.user.fullName}</p>
                {b.lessonSummary && <p className="mt-2 whitespace-pre-line rounded-xl bg-brand-50/60 px-3 py-2 text-sm text-ink/80">{b.lessonSummary}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t('parent.noLessons')}</p>
        )}
      </Card>

      {d.homework.length > 0 && (
        <Card>
          <h2 className="mb-3 flex items-center gap-2 font-extrabold"><BookOpenCheck className="h-5 w-5 text-brand-600" /> {t('menu.homework')}</h2>
          <ul className="space-y-2">
            {d.homework.map((h: any) => (
              <li key={h.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2.5 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <CheckCircle2 className={h.status === 'assigned' ? 'h-4 w-4 shrink-0 text-slate-300' : 'h-4 w-4 shrink-0 text-emerald-500'} />
                  <span className="truncate font-semibold">{h.title}</span>
                </span>
                <span className="shrink-0 text-xs font-bold text-ink/80">
                  {h.score != null ? `${h.score}/${h.maxScore}` : t(`hw.statuses.${h.status}`)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
