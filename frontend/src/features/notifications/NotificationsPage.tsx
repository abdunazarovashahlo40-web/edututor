import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, post } from '../../services/api';
import { useI18n } from '../../i18n';
import { Button, Card, EmptyState, ErrorState, ListSkeleton, PageHeader, Pagination } from '../../components/ui';
import { dateTime } from '../../utils/format';
import { cn } from '../../utils/cn';
import { notifIcon } from './notifMeta';

export default function NotificationsPage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['notifications', 'page', page], queryFn: () => api<any[]>('/notifications', { query: { page, limit: 20 } }) });
  const readAll = useMutation({ mutationFn: () => post('/notifications/read-all'), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  return (
    <div>
      <PageHeader title={t('common.notifications')} actions={<Button variant="secondary" onClick={() => readAll.mutate()} loading={readAll.isPending}>{t('notif.markAll')}</Button>} />
      {q.isLoading ? (
        <ListSkeleton rows={5} />
      ) : q.isError ? (
        <ErrorState text={t('common.error')} onRetry={() => q.refetch()} retryLabel={t('common.retry')} />
      ) : !q.data?.data.length ? (
        <EmptyState title={t('notif.empty')} />
      ) : (
        <Card className="divide-y divide-line p-0">
          {q.data.data.map((n) => {
            const I = notifIcon(n.type);
            const body = (
              <div className={cn('flex gap-3 px-5 py-4', !n.readAt && 'bg-brand-50/50')}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700">
                  <I className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-ink">{n.title}</p>
                  {n.body && <p className="text-sm text-muted">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted">{dateTime(n.createdAt, locale)}</p>
                </div>
              </div>
            );
            return n.link ? (
              <Link key={n.id} to={n.link} onClick={() => !n.readAt && post(`/notifications/${n.id}/read`)}>
                {body}
              </Link>
            ) : (
              <div key={n.id}>{body}</div>
            );
          })}
        </Card>
      )}
      <Pagination page={page} pages={q.data?.meta?.pages ?? 1} onChange={setPage} />
    </div>
  );
}
