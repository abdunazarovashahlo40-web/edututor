import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { SlidersHorizontal, Search, X } from 'lucide-react';
import { api, get } from '../../services/api';
import { useI18n, subjectName } from '../../i18n';
import { Button, EmptyState, ErrorState, Input, Modal, Pagination, Select, Skeleton } from '../../components/ui';
import { TeacherCard } from '../../components/TeacherCard';
import type { Subject, TeacherCard as TC } from '../../types';
import { cn } from '../../utils/cn';

const KEYS = ['q', 'subject', 'minPrice', 'maxPrice', 'minRating', 'minExperience', 'language', 'format', 'weekday', 'online', 'sort', 'page'] as const;

export default function Teachers() {
  const { t, locale, tr } = useI18n();
  const [sp, setSp] = useSearchParams();
  const [sheet, setSheet] = useState(false);
  const f = Object.fromEntries(KEYS.map((k) => [k, sp.get(k) ?? ''])) as Record<(typeof KEYS)[number], string>;
  const [q, setQ] = useState(f.q);
  const set = (patch: Partial<typeof f>) => {
    const n = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) v ? n.set(k, v) : n.delete(k);
    if (!('page' in patch)) n.delete('page');
    setSp(n, { replace: true });
  };
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: () => get<Subject[]>('/subjects'), staleTime: 300_000 });
  const list = useQuery({
    queryKey: ['teachers', f],
    queryFn: () => api<TC[]>('/teachers', { query: { ...f, page: f.page || 1, limit: 12 } }),
    placeholderData: keepPreviousData,
  });
  const active = KEYS.filter((k) => !['q', 'sort', 'page'].includes(k) && f[k]).length;
  const days = tr<string[]>('teacher.weekdays');

  const Filters = (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{t('landing.searchSubject')}</p>
        <div className="flex flex-wrap gap-1.5">
          <Chip on={!f.subject} onClick={() => set({ subject: '' })}>
            {t('common.all')}
          </Chip>
          {subjects.data?.map((s) => (
            <Chip key={s.id} on={f.subject === s.slug} onClick={() => set({ subject: s.slug })}>
              {subjectName(s, locale)}
            </Chip>
          ))}
        </div>
      </div>
      <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-line/70 bg-white px-3.5 py-2.5">
        <span className="flex items-center gap-2 text-sm font-bold text-ink">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,.18)]" />
          {t('search.onlineNow')}
        </span>
        <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={f.online === '1'} onChange={(e) => set({ online: e.target.checked ? '1' : '' })} />
      </label>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{t('landing.searchPrice')}</p>
        <div className="grid grid-cols-2 gap-2">
          <Input type="number" inputMode="numeric" placeholder={t('common.from')} value={f.minPrice} onChange={(e) => set({ minPrice: e.target.value })} />
          <Input type="number" inputMode="numeric" placeholder={t('common.to')} value={f.maxPrice} onChange={(e) => set({ maxPrice: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{t('search.minRating')}</p>
          <Select value={f.minRating} onChange={(e) => set({ minRating: e.target.value })}>
            <option value="">{t('search.any')}</option>
            {['4.5', '4', '3'].map((r) => (
              <option key={r} value={r}>
                ★ {r}+
              </option>
            ))}
          </Select>
        </label>
        <label>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{t('search.experience')}</p>
          <Select value={f.minExperience} onChange={(e) => set({ minExperience: e.target.value })}>
            <option value="">{t('search.any')}</option>
            {['1', '3', '5', '10'].map((r) => (
              <option key={r} value={r}>
                {r}+ {t('common.years')}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{t('search.language')}</p>
          <Select value={f.language} onChange={(e) => set({ language: e.target.value })}>
            <option value="">{t('search.any')}</option>
            <option value="uz">O'zbekcha</option>
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </Select>
        </label>
        <label>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{t('search.format')}</p>
          <Select value={f.format} onChange={(e) => set({ format: e.target.value })}>
            <option value="">{t('search.any')}</option>
            <option value="online">{t('teacher.online')}</option>
            <option value="offline">{t('teacher.offline')}</option>
          </Select>
        </label>
      </div>
      <label className="block">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{t('search.weekday')}</p>
        <Select value={f.weekday} onChange={(e) => set({ weekday: e.target.value })}>
          <option value="">{t('search.any')}</option>
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <option key={d} value={d}>
              {days[d]}
            </option>
          ))}
        </Select>
      </label>
      {active > 0 && (
        <Button variant="ghost" className="w-full" icon={<X className="h-4 w-4" />} onClick={() => setSp(new URLSearchParams(f.q ? { q: f.q } : {}), { replace: true })}>
          {t('common.reset')}
        </Button>
      )}
    </div>
  );

  return (
    <div className="container-x py-6 md:py-10">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{t('search.title')}</h1>
          {list.data?.meta && <p className="mt-1 text-sm text-muted">{t('search.found', { n: list.data.meta.total })}</p>}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            set({ q });
          }}
          className="flex w-full gap-2 md:w-auto"
        >
          <Input icon={<Search className="h-4 w-4" />} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('landing.searchPlaceholder')} className="md:w-80" />
          <Button type="submit">{t('common.search')}</Button>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-3xl border border-line/70 bg-white p-5 shadow-soft">{Filters}</div>
        </aside>
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Button variant="outline" size="sm" className="lg:hidden" icon={<SlidersHorizontal className="h-4 w-4" />} onClick={() => setSheet(true)}>
              {t('common.filter')} {active > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[10px] text-white">{active}</span>}
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden text-sm font-semibold text-muted sm:block">{t('search.sort')}:</span>
              <Select value={f.sort || 'rating'} onChange={(e) => set({ sort: e.target.value })} className="h-9 w-auto text-sm">
                <option value="rating">{t('search.sortRating')}</option>
                <option value="price_asc">{t('search.sortPriceAsc')}</option>
                <option value="price_desc">{t('search.sortPriceDesc')}</option>
                <option value="experience">{t('search.sortExperience')}</option>
                <option value="popular">{t('search.sortPopular')}</option>
                <option value="newest">{t('search.sortNewest')}</option>
              </Select>
            </div>
          </div>
          {list.isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-72 rounded-3xl" />
              ))}
            </div>
          ) : list.isError ? (
            <ErrorState text={t('common.error')} onRetry={() => list.refetch()} retryLabel={t('common.retry')} />
          ) : !list.data?.data.length ? (
            <EmptyState title={t('search.noResults')} icon={<Search className="h-7 w-7" />} />
          ) : (
            <div className={cn('grid gap-4 transition-opacity md:grid-cols-2 xl:grid-cols-3', list.isFetching && 'opacity-60')}>
              {list.data.data.map((tc, i) => (
                <TeacherCard key={tc.id} t={tc} index={i} />
              ))}
            </div>
          )}
          <Pagination page={Number(f.page || 1)} pages={list.data?.meta?.pages ?? 1} onChange={(p) => set({ page: String(p) })} />
        </div>
      </div>
      <Modal open={sheet} onClose={() => setSheet(false)} title={t('common.filter')} footer={<Button className="w-full" onClick={() => setSheet(false)}>{t('search.found', { n: list.data?.meta?.total ?? 0 })}</Button>}>
        {Filters}
      </Modal>
    </div>
  );
}

function Chip({ on, children, onClick }: { on: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn('rounded-full border px-3 py-1.5 text-xs font-bold transition', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-ink/70 hover:border-brand-300')}>
      {children}
    </button>
  );
}
