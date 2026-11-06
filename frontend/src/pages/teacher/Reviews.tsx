import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { get } from '../../services/api';
import { useI18n } from '../../i18n';
import { Avatar, Badge, Card, EmptyState, ListSkeleton, PageHeader, Stars } from '../../components/ui';
import { date } from '../../utils/format';

export default function Reviews() {
  const { t, locale } = useI18n();
  const q = useQuery({ queryKey: ['reviews', 'mine'], queryFn: () => get<any[]>('/reviews/mine') });
  const avg = q.data?.length ? q.data.reduce((a, r) => a + r.rating, 0) / q.data.length : 0;
  return (
    <div>
      <PageHeader title={t('menu.reviews')} subtitle={q.data?.length ? `★ ${avg.toFixed(2)} · ${q.data.length} ${t('common.reviews')}` : undefined} />
      {q.isLoading ? <ListSkeleton /> : !q.data?.length ? <EmptyState title={t('search.noReviews')} icon={<Star className="h-7 w-7" />} /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {q.data.map((r) => (
            <Card key={r.id} className={r.isHidden ? 'opacity-60' : ''}>
              <div className="flex items-center gap-3">
                <Avatar name={r.student.fullName} src={r.student.avatarUrl} size={40} />
                <div className="flex-1">
                  <p className="font-bold">{r.student.fullName}</p>
                  <p className="text-xs text-muted">{r.booking.lesson.title} · {date(r.createdAt, locale)}</p>
                </div>
                <Stars value={r.rating} />
              </div>
              {r.comment && <p className="mt-3 text-sm text-ink/80">{r.comment}</p>}
              {r.isHidden && <Badge tone="red" className="mt-2">{t('admin.hide')}</Badge>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
