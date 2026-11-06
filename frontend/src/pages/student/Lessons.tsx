import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Search } from 'lucide-react';
import { api } from '../../services/api';
import { useI18n } from '../../i18n';
import { Button, EmptyState, ErrorState, ListSkeleton, PageHeader, Pagination, Tabs } from '../../components/ui';
import { BookingItem } from '../../features/booking/BookingItem';
import type { Booking } from '../../types';

/** O'quvchi va o'qituvchi uchun bronlar ro'yxati (tabs bilan) */
export function BookingsList({ as }: { as: 'student' | 'teacher' }) {
  const { t } = useI18n();
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get('tab') as 'upcoming' | 'past' | 'requests') ?? (as === 'teacher' ? 'requests' : 'upcoming');
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['bookings', tab, page], queryFn: () => api<Booking[]>('/bookings', { query: { scope: tab, page, limit: 20 } }) });
  const reqCount = useQuery({ queryKey: ['bookings', 'requests-count'], queryFn: () => api<Booking[]>('/bookings', { query: { scope: 'requests', limit: 1 } }), enabled: as === 'teacher' });
  const items = [
    ...(as === 'teacher' ? [{ value: 'requests' as const, label: t('booking.requests'), count: reqCount.data?.meta?.total }] : []),
    { value: 'upcoming' as const, label: t('booking.upcoming') },
    { value: 'past' as const, label: t('booking.past') },
  ];
  return (
    <div>
      <PageHeader
        title={as === 'teacher' ? t('menu.bookings') : t('menu.lessons')}
        actions={as === 'student' && <Link to="/teachers"><Button icon={<Search className="h-4 w-4" />}>{t('student.findTutor')}</Button></Link>}
      />
      <Tabs value={tab} onChange={(v) => { setPage(1); setSp({ tab: v }); }} items={items} className="mb-4 w-fit" />
      {q.isLoading ? (
        <ListSkeleton rows={4} />
      ) : q.isError ? (
        <ErrorState text={t('common.error')} onRetry={() => q.refetch()} retryLabel={t('common.retry')} />
      ) : !q.data?.data.length ? (
        <EmptyState title={t('common.empty')} icon={<CalendarDays className="h-7 w-7" />} action={as === 'student' && <Link to="/teachers"><Button size="sm">{t('student.findTutor')}</Button></Link>} />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {q.data.data.map((b) => <BookingItem key={b.id} b={b} as={as} />)}
        </div>
      )}
      <Pagination page={page} pages={q.data?.meta?.pages ?? 1} onChange={setPage} />
    </div>
  );
}

export default function StudentLessons() {
  return <BookingsList as="student" />;
}
