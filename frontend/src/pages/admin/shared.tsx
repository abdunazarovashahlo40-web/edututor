/** Admin panelining umumiy qismlari: amal bajarish, sahifalangan ro'yxat, URL filtrlari, sabab so'rovchi oyna */
import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useI18n } from '../../i18n';
import { Button, EmptyState, Field, ListSkeleton, Modal, Pagination, Textarea } from '../../components/ui';
import { useToast } from '../../hooks/useToast';
import { errorText } from '../../utils/format';
import { cn } from '../../utils/cn';

export function useAct() {
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  return async (fn: () => Promise<unknown>, okText?: string) => {
    try {
      const r = await fn();
      toast('success', okText ?? t('common.done'));
      await qc.invalidateQueries({ queryKey: ['admin'] });
      return r;
    } catch (e) {
      toast('error', errorText(e, t));
      return undefined;
    }
  };
}

/** Filtrlar URL'da saqlanadi: statistikadan bosib kelganda tayyor filtr bilan ochiladi, "orqaga" ham ishlaydi */
export function useUrlFilters<T extends Record<string, string>>(defaults: T) {
  const [sp, setSp] = useSearchParams();
  const f = Object.fromEntries(Object.entries(defaults).map(([k, v]) => [k, sp.get(k) ?? v])) as T;
  const set = (patch: Partial<T>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === '' || v === defaults[k]) next.delete(k);
      else next.set(k, String(v));
    }
    setSp(next, { replace: true });
  };
  return [f, set] as const;
}

/** Sahifalangan ro'yxat — har bir yozuv karta: telefonda ham, kompyuterda ham qulay */
export function PagedList<T>({
  queryKey,
  path,
  query,
  render,
  empty,
  className,
}: {
  queryKey: unknown[];
  path: string;
  query?: Record<string, unknown>;
  render: (r: T) => ReactNode;
  empty?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['admin', ...queryKey, page], queryFn: () => api<T[]>(path, { query: { ...query, page, limit: 20 } }) });
  if (q.isLoading) return <ListSkeleton />;
  if (!q.data?.data.length) return <EmptyState title={empty ?? t('common.empty')} />;
  return (
    <>
      <div className={cn('space-y-2.5', className)}>{q.data.data.map(render)}</div>
      <Pagination page={page} pages={q.data.meta?.pages ?? 1} onChange={setPage} />
    </>
  );
}

/** Ro'yxat qatori: chapda asosiy ma'lumot, o'ngda holat, pastda amallar */
export function Row({ children, onClick, className }: { children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => onClick && e.key === 'Enter' && onClick()}
      className={cn(
        'rounded-2xl border border-line/70 bg-white p-3.5 shadow-soft transition md:p-4',
        onClick && 'cursor-pointer hover:border-brand-200 hover:shadow-lift active:scale-[.995]',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Sababni so'raydigan oyna (brauzerning prompt() oynasi telefonda noqulay) */
export function ReasonModal({
  open,
  title,
  required,
  onClose,
  onSubmit,
  danger,
}: {
  open: boolean;
  title: string;
  required?: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<unknown> | void;
  danger?: boolean;
}) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={open}
      onClose={() => (setText(''), onClose())}
      title={title}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => (setText(''), onClose())}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            loading={busy}
            disabled={required && text.trim().length < 3}
            onClick={async () => {
              setBusy(true);
              await onSubmit(text.trim());
              setBusy(false);
              setText('');
              onClose();
            }}
          >
            {t('common.confirm')}
          </Button>
        </div>
      }
    >
      <Field label={required ? t('common.reason') : `${t('common.reason')} (${t('common.optional')})`}>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={300} rows={3} autoFocus />
      </Field>
    </Modal>
  );
}

/** Kalit-qiymat ro'yxati (batafsil ko'rinishlar uchun) */
export function KV({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="divide-y divide-line/70">
      {items.map(([k, v], i) => (
        <div key={i} className="flex items-start justify-between gap-4 py-2.5 text-sm">
          <dt className="shrink-0 text-muted">{k}</dt>
          <dd className="min-w-0 break-words text-right font-semibold text-ink">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Filtr paneli: telefonda ustma-ust, kompyuterda bir qatorda */
export function Filters({ children }: { children: ReactNode }) {
  return <div className="mb-4 grid gap-2 sm:flex sm:flex-wrap sm:items-center [&>*]:min-w-0 sm:[&>*]:w-auto">{children}</div>;
}
