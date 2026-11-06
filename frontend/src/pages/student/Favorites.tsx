import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { get } from '../../services/api';
import { useI18n } from '../../i18n';
import { Button, EmptyState, ListSkeleton, PageHeader } from '../../components/ui';
import { TeacherCard } from '../../components/TeacherCard';
import type { TeacherCard as TC } from '../../types';

export default function Favorites() {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ['favorites'], queryFn: () => get<TC[]>('/favorites') });
  return (
    <div>
      <PageHeader title={t('menu.favorites')} />
      {q.isLoading ? <ListSkeleton /> : !q.data?.length ? (
        <EmptyState title={t('common.empty')} icon={<Heart className="h-7 w-7" />} action={<Link to="/teachers"><Button size="sm">{t('student.findTutor')}</Button></Link>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{q.data.map((tc, i) => <TeacherCard key={tc.id} t={tc} index={i} />)}</div>
      )}
    </div>
  );
}
