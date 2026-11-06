import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Briefcase, Languages, Star } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar, Badge, Button } from './ui';
import { useI18n, subjectName } from '../i18n';
import { money } from '../utils/format';
import { post } from '../services/api';
import { useAuth } from '../store/auth';
import { cn } from '../utils/cn';
import type { TeacherCard as T } from '../types';

export function TeacherCard({ t: teacher, compact, index = 0 }: { t: T; compact?: boolean; index?: number }) {
  const { t, locale, tr } = useI18n();
  const { me } = useAuth();
  const qc = useQueryClient();
  const fav = useMutation({
    mutationFn: () => post<{ isFavorite: boolean }>(`/favorites/${teacher.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teachers'] });
      qc.invalidateQueries({ queryKey: ['favorites'] });
    },
  });
  const days = [...new Set(teacher.availability.map((a) => a.weekday))].sort();
  const short = tr<string[]>('teacher.weekdaysShort');
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: (index % 6) * 0.05 }}
      whileHover={{ y: -4 }}
      className="group relative flex flex-col rounded-3xl border border-line/70 bg-white p-5 shadow-soft transition-shadow hover:shadow-lift"
    >
      {me?.role === 'STUDENT' && (
        <button onClick={() => fav.mutate()} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-brand-600 transition hover:scale-110" aria-label={t('search.favorite')}>
          <Heart className={cn('h-4 w-4', teacher.isFavorite && 'fill-current')} />
        </button>
      )}
      <div className="flex items-start gap-3.5">
        <Avatar name={teacher.user.fullName} src={teacher.user.avatarUrl} size={64} className="ring-4 ring-brand-50" />
        <div className="min-w-0 flex-1 pr-8">
          <Link to={`/teachers/${teacher.id}`} className="block truncate text-[17px] font-extrabold text-ink hover:text-brand-700">
            {teacher.user.fullName}
          </Link>
          <div className="mt-1 flex items-center gap-1.5 text-sm">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <b>{Number(teacher.ratingAvg).toFixed(1)}</b>
            <span className="text-muted">({teacher.ratingCount} {t('common.reviews')})</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {teacher.subjects.slice(0, 3).map((s) => (
              <Badge key={s.subject.id} tone="brand">
                {subjectName(s.subject, locale)}
              </Badge>
            ))}
          </div>
        </div>
      </div>
      {!compact && teacher.headline && <p className="mt-3 line-clamp-2 text-sm text-ink/80">{teacher.headline}</p>}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-muted">
        <span className="flex items-center gap-1">
          <Briefcase className="h-3.5 w-3.5" /> {t('search.expYears', { n: teacher.experienceYears })}
        </span>
        <span className="flex items-center gap-1">
          <Languages className="h-3.5 w-3.5" /> {teacher.languages.map((l) => l.toUpperCase()).join(' · ')}
        </span>
      </div>
      {!compact && days.length > 0 && (
        <div className="mt-3 flex gap-1">
          {short.map((d, i) => (
            <span key={i} className={cn('grid h-6 w-7 place-items-center rounded-md text-[10px] font-bold', days.includes(i) ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400')}>
              {d}
            </span>
          ))}
        </div>
      )}
      <div className="mt-auto flex items-end justify-between gap-2 pt-4">
        <div>
          <div className="text-lg font-extrabold text-ink">{money(teacher.hourlyPrice, locale)}</div>
          <div className="text-[11px] font-semibold text-muted">{t('common.perHour')}</div>
        </div>
        <div className="flex gap-2">
          <Link to={`/teachers/${teacher.id}`}>
            <Button variant="outline" size="sm">
              {t('search.viewProfile')}
            </Button>
          </Link>
          <Link to={`/teachers/${teacher.id}?book=1`}>
            <Button size="sm">{t('search.book')}</Button>
          </Link>
        </div>
      </div>
    </motion.article>
  );
}
