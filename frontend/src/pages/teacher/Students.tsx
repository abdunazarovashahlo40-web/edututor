import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle, Users } from 'lucide-react';
import { get, post } from '../../services/api';
import { useI18n } from '../../i18n';
import { Avatar, Button, EmptyState, ListSkeleton, PageHeader, ProgressBar } from '../../components/ui';
import { date } from '../../utils/format';

export default function Students() {
  const { t, locale } = useI18n();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['my-students'], queryFn: () => get<any[]>('/teachers/me/students') });
  return (
    <div>
      <PageHeader title={t('menu.students')} subtitle={q.data ? `${q.data.length} ${t('common.students')}` : undefined} />
      {q.isLoading ? <ListSkeleton /> : !q.data?.length ? <EmptyState title={t('common.empty')} icon={<Users className="h-7 w-7" />} /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {q.data.map((s) => (
            <div key={s.student.id} className="rounded-2xl border border-line/70 bg-white p-4 shadow-soft">
              <div className="flex items-center gap-3">
                <Avatar name={s.student.fullName} src={s.student.avatarUrl} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold">{s.student.fullName}</p>
                  <p className="truncate text-xs text-muted">{s.student.studentProfile?.grade ?? ''} {s.student.studentProfile?.goals ? `· ${s.student.studentProfile.goals}` : ''}</p>
                </div>
                <Button size="sm" variant="ghost" icon={<MessageCircle className="h-4 w-4" />} aria-label={t('booking.message')} onClick={async () => {
                  const c = await post<{ id: string }>('/messages/conversations', { userId: s.student.id });
                  nav(`/teacher/messages?c=${c.id}`);
                }} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-surface p-2"><div className="font-extrabold">{s.completedLessons}</div><div className="text-[10px] font-semibold text-muted">{t('common.lessons')}</div></div>
                <div className="rounded-xl bg-surface p-2"><div className="font-extrabold">{s.homeworkDone}/{s.homeworkTotal}</div><div className="text-[10px] font-semibold text-muted">{t('teacher.homeworkDone')}</div></div>
                <div className="rounded-xl bg-surface p-2"><div className="text-xs font-extrabold">{s.lastBookingAt ? date(s.lastBookingAt, locale) : '—'}</div><div className="text-[10px] font-semibold text-muted">{t('teacher.lastLesson')}</div></div>
              </div>
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs font-semibold"><span className="text-muted">{t('teacher.progress')}</span><span>{s.progress ?? 0}%</span></div>
                <ProgressBar value={s.progress ?? 0} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
