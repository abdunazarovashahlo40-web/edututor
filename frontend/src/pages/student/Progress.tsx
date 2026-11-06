import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Award, BookOpenCheck, Timer, Trophy } from 'lucide-react';
import { get } from '../../services/api';
import { useI18n, subjectName } from '../../i18n';
import { Card, EmptyState, PageHeader, ProgressBar, ProgressRing, Skeleton, StatCard } from '../../components/ui';
import { date } from '../../utils/format';
import { ParentLinkCard } from '../../features/parent/ParentLinkCard';

export default function Progress() {
  const { t, locale } = useI18n();
  const q = useQuery({ queryKey: ['analytics', 'student'], queryFn: () => get<any>('/analytics/student') });
  if (q.isLoading) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-72" /></div>;
  const d = q.data;
  if (!d) return <EmptyState title={t('common.error')} />;
  const radar = d.subjects.map((s: any) => ({ subject: subjectName(s.subject, locale), value: s.progress }));
  return (
    <div className="space-y-5">
      <PageHeader title={t('menu.progress')} />
      <ParentLinkCard />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={<Trophy className="h-5 w-5" />} label={t('student.completedLessons')} value={d.completedLessons} />
        <StatCard icon={<Timer className="h-5 w-5" />} label={t('student.hours')} value={d.hours} tone="blue" />
        <StatCard icon={<BookOpenCheck className="h-5 w-5" />} label={t('menu.homework')} value={`${d.homework.done}/${d.homework.total}`} tone="green" />
        <StatCard icon={<Award className="h-5 w-5" />} label={t('student.avgScore')} value={d.avgScore != null ? `${d.avgScore}%` : '—'} tone="amber" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card className="flex flex-col items-center justify-center py-8">
          <ProgressRing value={d.overallProgress} size={160} stroke={14} />
          <p className="mt-3 font-extrabold">{t('student.mastery')}</p>
        </Card>
        <Card>
          <h2 className="mb-3 font-extrabold">{t('student.weekly')}</h2>
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={d.weekly.map((w: any) => ({ ...w, label: date(w.week, locale) }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF0F7" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={24} />
                <Tooltip cursor={{ fill: '#F5F3FF' }} contentStyle={{ borderRadius: 12, border: '1px solid #E8E6F5' }} />
                <Bar dataKey="lessons" name={t('common.lessons')} fill="#7C3AED" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      {d.subjects.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {radar.length >= 3 && (
            <Card>
              <div className="h-72">
                <ResponsiveContainer>
                  <RadarChart data={radar}>
                    <PolarGrid stroke="#E8E6F5" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                    <Radar dataKey="value" stroke="#6D28D9" fill="#8B5CF6" fillOpacity={0.35} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
          <Card className={radar.length < 3 ? 'lg:col-span-2' : ''}>
            <h2 className="mb-4 font-extrabold">{t('student.mySubjects')}</h2>
            <div className="space-y-4">
              {d.subjects.map((s: any) => (
                <div key={s.subject.id}>
                  <div className="mb-1 flex justify-between text-sm"><b>{subjectName(s.subject, locale)}</b><span className="text-muted">{s.lessons} {t('common.lessons')} · {s.hours}h · {s.avgScore != null ? `${s.avgScore}%` : '—'}</span></div>
                  <ProgressBar value={s.progress} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
