/** Sharhlar va shikoyatlar: nima haqida ekanligi aniq ko'rinadi, holatlar tartibli */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Eye, EyeOff, Flag, MessageSquareWarning, XCircle } from 'lucide-react';
import { api, patch } from '../../services/api';
import { useI18n } from '../../i18n';
import { Badge, Button, EmptyState, Field, ListSkeleton, Modal, PageHeader, Pagination, Stars, Tabs, Textarea, statusTone } from '../../components/ui';
import { date, dateTime } from '../../utils/format';
import { PagedList, Row, useAct, useUrlFilters } from './shared';

export function AdminReviews() {
  const { t, locale } = useI18n();
  const act = useAct();
  const [f, set] = useUrlFilters({ reported: 'true' });
  return (
    <div>
      <PageHeader title={t('menu.reviews')} />
      <Tabs value={f.reported} onChange={(reported) => set({ reported })} className="mb-4" items={[{ value: 'true', label: t('admin.reported') }, { value: 'false', label: t('common.all') }]} />
      <PagedList<any>
        queryKey={['reviews', f.reported]}
        path="/admin/reviews"
        query={{ reported: f.reported }}
        render={(r) => (
          <Row key={r.id} className={r.isHidden ? 'opacity-60' : ''}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><Stars value={r.rating} size={13} />{r.reportCount > 0 && <Badge tone="red"><Flag className="mr-1 inline h-3 w-3" />{r.reportCount}</Badge>}{r.isHidden && <Badge>{t('adm.hidden')}</Badge>}</div>
                <p className="mt-1.5 text-sm text-ink/85">{r.comment || '—'}</p>
                <p className="mt-1 text-xs text-muted">{r.student.fullName} → {r.teacher.user.fullName} · {date(r.createdAt, locale)}</p>
              </div>
              <Button size="sm" variant={r.isHidden ? 'secondary' : 'danger'} icon={r.isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} onClick={() => act(() => patch(`/admin/reviews/${r.id}`, { isHidden: !r.isHidden }))}>
                {r.isHidden ? t('admin.restore') : t('admin.hide')}
              </Button>
            </div>
          </Row>
        )}
      />
    </div>
  );
}

const ORDER = ['', 'open', 'in_review', 'resolved', 'rejected'] as const;

export function AdminComplaints() {
  const { t, L, locale } = useI18n();
  const act = useAct();
  const [f, set] = useUrlFilters({ status: '' });
  const [page, setPage] = useState(1);
  const [resolve, setResolve] = useState<{ id: string; status: 'resolved' | 'rejected' } | null>(null);
  const [text, setText] = useState('');
  const q = useQuery({ queryKey: ['admin', 'complaints', f.status, page], queryFn: () => api<any[]>('/admin/complaints-full', { query: { status: f.status, page, limit: 20 } }) });
  const counts = (q.data?.meta as any)?.counts ?? {};
  const total = Object.values(counts as Record<string, number>).reduce((a, b) => a + b, 0);

  const targetLink = (c: any) => {
    const tg = c.target;
    if (!tg) return null;
    if (tg.userId) return `/admin/users/${tg.userId}`;
    if (tg.lessonId) return `/admin/lessons?open=${tg.lessonId}`;
    if (tg.bookingId) return `/admin/bookings?open=${tg.bookingId}`;
    if (c.targetType === 'review') return '/admin/reviews?reported=true';
    return null;
  };

  return (
    <div>
      <PageHeader title={t('menu.complaints')} />
      <Tabs
        value={f.status}
        onChange={(status) => (setPage(1), set({ status }))}
        className="mb-4"
        items={ORDER.map((s) => ({ value: s, label: s ? L('complaint', s) : t('common.all'), count: s ? counts[s] : total }))}
      />
      {q.isLoading ? <ListSkeleton /> : !q.data?.data.length ? <EmptyState title={t('common.empty')} icon={<MessageSquareWarning className="h-7 w-7" />} /> : (
        <div className="space-y-2.5">
          {q.data.data.map((c) => {
            const link = targetLink(c);
            return (
              <Row key={c.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={statusTone[c.status]}>{L('complaint', c.status)}</Badge>
                    <Badge tone="brand">{L('target', c.targetType)}</Badge>
                  </div>
                  <span className="text-xs text-muted">{dateTime(c.createdAt, locale)}</span>
                </div>
                {/* Kim, kimga/nimaga, nima deb */}
                <div className="mt-2 grid gap-1 text-sm">
                  <p><span className="text-muted">{t('adm.complaintFrom')}:</span> <Link to={`/admin/users/${c.author.id}`} className="font-bold text-brand-700">{c.author.fullName}</Link> <span className="text-xs text-muted">({t(`roles.${c.author.role}`)})</span></p>
                  <p>
                    <span className="text-muted">{t('adm.complaintAbout')}:</span>{' '}
                    {c.target ? (link ? <Link to={link} className="font-bold text-brand-700">{c.target.label}</Link> : <b>{c.target.label}</b>) : <span className="text-muted">{t('adm.targetGone')}</span>}
                    {c.target?.rating && <span className="ml-1 text-xs">★{c.target.rating}</span>}
                  </p>
                  {c.target?.text && <p className="rounded-lg bg-surface px-2.5 py-1.5 text-xs text-ink/70">“{c.target.text}”</p>}
                </div>
                <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-ink/85">{c.reason}</p>
                {c.resolution && <p className="mt-1.5 text-xs font-semibold text-success">→ {c.resolution}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {c.status === 'open' && <Button size="sm" variant="secondary" onClick={() => act(() => patch(`/admin/complaints/${c.id}`, { status: 'in_review' }))}>{t('adm.takeToReview')}</Button>}
                  {!['resolved', 'rejected'].includes(c.status) && (
                    <>
                      <Button size="sm" variant="success" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => setResolve({ id: c.id, status: 'resolved' })}>{t('admin.resolve')}</Button>
                      <Button size="sm" variant="ghost" icon={<XCircle className="h-4 w-4" />} onClick={() => setResolve({ id: c.id, status: 'rejected' })}>{L('complaint', 'rejected')}</Button>
                    </>
                  )}
                </div>
              </Row>
            );
          })}
          <Pagination page={page} pages={q.data.meta?.pages ?? 1} onChange={setPage} />
        </div>
      )}
      <Modal
        open={!!resolve}
        onClose={() => (setResolve(null), setText(''))}
        title={resolve?.status === 'resolved' ? t('admin.resolve') : L('complaint', 'rejected')}
        size="sm"
        footer={<Button className="w-full" disabled={text.trim().length < 3} onClick={async () => { await act(() => patch(`/admin/complaints/${resolve!.id}`, { status: resolve!.status, resolution: text.trim() })); setResolve(null); setText(''); }}>{t('common.confirm')}</Button>}
      >
        <Field label={t('adm.answerToAuthor')}><Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={1000} /></Field>
      </Modal>
    </div>
  );
}
