/** Fanlar, darslar va bronlar — ko'rish, tahrirlash va boshqarish */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Eye, EyeOff, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { del, get, patch, post } from '../../services/api';
import { useI18n, subjectName } from '../../i18n';
import { Badge, Button, Checkbox, EmptyState, Field, Input, ListSkeleton, Modal, PageHeader, Select, Skeleton, Textarea, statusTone } from '../../components/ui';
import { dateTime, money } from '../../utils/format';
import { Filters, KV, PagedList, ReasonModal, Row, useAct, useUrlFilters } from './shared';

/* ============================== FANLAR ============================== */
export function AdminSubjects() {
  const { t, locale } = useI18n();
  const act = useAct();
  const q = useQuery({ queryKey: ['admin', 'subjects'], queryFn: () => get<any[]>('/admin/subjects') });
  const empty = { id: '', slug: '', nameUz: '', nameRu: '', nameEn: '', category: 'general', icon: '', sortOrder: 0, isActive: true };
  const [f, setF] = useState<typeof empty | null>(null);
  const [more, setMore] = useState(false);
  const [remove, setRemove] = useState<any>(null);
  // Slug avtomatik: o'zbekcha nomdan lotin harflarida
  const slugify = (s: string) => s.toLowerCase().replace(/['‘’`ʻʼ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || `fan-${Date.now().toString(36)}`;
  return (
    <div>
      <PageHeader title={t('menu.subjects')} subtitle={t('adm.subjectsHint')} actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => (setMore(false), setF(empty))}>{t('admin.newSubject')}</Button>} />
      {q.isLoading ? <ListSkeleton /> : !q.data?.length ? <EmptyState title={t('common.empty')} /> : (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {q.data.map((s) => (
            <Row key={s.id} className={s.isActive ? '' : 'opacity-60'}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-extrabold">{subjectName(s, locale)}</div>
                  <div className="truncate text-xs text-muted">{[s.nameUz, s.nameRu, s.nameEn].filter((n, i, a) => n && a.indexOf(n) === i).join(' · ')}</div>
                  <div className="mt-1 text-xs text-muted">{s._count.teachers} {t('adm.teachersCount')} · {s._count.lessons} {t('common.lessons')}</div>
                </div>
                <Badge tone={s.isActive ? 'green' : 'gray'}>{s.isActive ? t('adm.active') : t('adm.hidden')}</Badge>
              </div>
              <div className="mt-2 flex gap-1.5">
                <Button size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => (setMore(!!(s.nameRu || s.nameEn)), setF({ ...empty, ...s, icon: s.icon ?? '' }))}>{t('common.edit')}</Button>
                <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setRemove(s)}>{t('common.delete')}</Button>
              </div>
            </Row>
          ))}
        </div>
      )}
      <Modal
        open={!!f}
        onClose={() => setF(null)}
        title={f?.id ? t('common.edit') : t('admin.newSubject')}
        footer={
          <Button
            className="w-full"
            disabled={!f?.nameUz || f.nameUz.length < 2}
            onClick={async () => {
              const { id, ...rest } = f!;
              // Ruscha/inglizcha kiritilmasa — o'zbekcha nom ishlatiladi
              const body = { ...rest, slug: rest.slug || slugify(rest.nameUz), nameRu: rest.nameRu || rest.nameUz, nameEn: rest.nameEn || rest.nameUz, icon: rest.icon || null };
              const r = await act(() => (id ? patch(`/admin/subjects/${id}`, body) : post('/admin/subjects', body)));
              if (r) setF(null);
            }}
          >
            {t('common.save')}
          </Button>
        }
      >
        {f && (
          <div className="space-y-3">
            <Field label={t('adm.subjectName')}><Input value={f.nameUz} onChange={(e) => setF({ ...f, nameUz: e.target.value })} placeholder="Matematika" /></Field>
            <p className="rounded-xl bg-brand-50/70 px-3 py-2 text-xs font-semibold text-brand-800">{t('adm.subjectLangNote')}</p>
            {!more ? (
              <button className="text-sm font-bold text-brand-700" onClick={() => setMore(true)}>+ {t('adm.addTranslations')}</button>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Русский"><Input value={f.nameRu} onChange={(e) => setF({ ...f, nameRu: e.target.value })} placeholder={f.nameUz} /></Field>
                <Field label="English"><Input value={f.nameEn} onChange={(e) => setF({ ...f, nameEn: e.target.value })} placeholder={f.nameUz} /></Field>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('adm.sortOrder')}><Input type="number" value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: Number(e.target.value) })} /></Field>
              <div className="flex items-end pb-2"><Checkbox label={t('adm.visibleToUsers')} checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /></div>
            </div>
          </div>
        )}
      </Modal>
      <Modal
        open={!!remove}
        onClose={() => setRemove(null)}
        title={t('common.delete')}
        size="sm"
        footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setRemove(null)}>{t('common.cancel')}</Button><Button variant="danger" onClick={async () => { await act(() => del(`/admin/subjects/${remove.id}`)); setRemove(null); }}>{t('common.delete')}</Button></div>}
      >
        <p className="text-sm text-muted">{remove?._count?.lessons ? t('adm.subjectHideNote') : t('adm.subjectDeleteNote')}</p>
      </Modal>
    </div>
  );
}

/* ============================== DARSLAR ============================== */
export function AdminLessons() {
  const { t, locale } = useI18n();
  const [f, set] = useUrlFilters({ q: '', status: '', open: '' });
  return (
    <div>
      <PageHeader title={t('menu.adminLessons')} />
      <Filters>
        <Input icon={<Search className="h-4 w-4" />} value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder={t('common.search')} className="sm:w-64" />
        <Select value={f.status} onChange={(e) => set({ status: e.target.value })} className="sm:w-44">
          <option value="">{t('adm.allStatuses')}</option>
          {['published', 'draft', 'cancelled'].map((s) => <option key={s} value={s}>{t(`lesson.statuses.${s}`)}</option>)}
        </Select>
      </Filters>
      <PagedList<any>
        queryKey={['lessons', f.q, f.status]}
        path="/admin/lessons"
        query={{ q: f.q, status: f.status }}
        render={(l) => (
          <Row key={l.id} onClick={() => set({ open: l.id })}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-bold">{l.title}</div>
                <div className="truncate text-xs text-muted">{subjectName(l.subject, locale)} · {l.teacher.user.fullName}</div>
                <div className="mt-1 text-xs text-muted">{t(`lesson.types.${l.type}`)} · {l.durationMin} {t('common.min')} · {l._count.bookings} {t('adm.bookingsCount')}</div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <b className="text-sm">{money(l.price, locale)}</b>
                <Badge tone={statusTone[l.status]}>{t(`lesson.statuses.${l.status}`)}</Badge>
              </div>
            </div>
          </Row>
        )}
      />
      <LessonModal id={f.open || null} onClose={() => set({ open: '' })} />
    </div>
  );
}

function LessonModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t, locale } = useI18n();
  const act = useAct();
  const q = useQuery({ queryKey: ['admin', 'lesson', id], queryFn: () => get<any>(`/admin/lessons/${id}`), enabled: !!id });
  const [edit, setEdit] = useState<any>(null);
  const [hide, setHide] = useState(false);
  const l = q.data;
  useEffect(() => setEdit(null), [id]);
  return (
    <>
      <Modal
        open={!!id}
        onClose={onClose}
        title={l?.title ?? t('menu.adminLessons')}
        size="lg"
        footer={
          l && (
            <div className="flex flex-wrap justify-end gap-2">
              {edit ? (
                <>
                  <Button variant="ghost" onClick={() => setEdit(null)}>{t('common.cancel')}</Button>
                  <Button onClick={async () => { const r = await act(() => patch(`/admin/lessons/${l.id}`, { title: edit.title, description: edit.description || null, price: Number(edit.price), level: edit.level || null, maxStudents: Number(edit.maxStudents), reason: edit.reason || undefined })); if (r) setEdit(null); }}>{t('common.save')}</Button>
                </>
              ) : (
                <>
                  <Button variant="outline" icon={<Pencil className="h-4 w-4" />} onClick={() => setEdit({ title: l.title, description: l.description ?? '', price: Number(l.price), level: l.level ?? '', maxStudents: l.maxStudents, reason: '' })}>{t('common.edit')}</Button>
                  {l.status === 'published' ? (
                    <Button variant="danger" icon={<EyeOff className="h-4 w-4" />} onClick={() => setHide(true)}>{t('admin.hide')}</Button>
                  ) : (
                    <Button variant="success" icon={<Eye className="h-4 w-4" />} onClick={() => act(() => patch(`/admin/lessons/${l.id}`, { status: 'published' }))}>{t('admin.restore')}</Button>
                  )}
                </>
              )}
            </div>
          )
        }
      >
        {!l ? (
          <Skeleton className="h-60" />
        ) : edit ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('lesson.title')} className="sm:col-span-2"><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
            <Field label={t('common.price')}><Input type="number" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} /></Field>
            <Field label={t('adm.level')}><Input value={edit.level} onChange={(e) => setEdit({ ...edit, level: e.target.value })} /></Field>
            {l.type === 'GROUP' && <Field label={t('adm.maxStudents')}><Input type="number" value={edit.maxStudents} onChange={(e) => setEdit({ ...edit, maxStudents: e.target.value })} /></Field>}
            <Field label={t('adm.description')} className="sm:col-span-2"><Textarea rows={4} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <Field label={`${t('common.reason')} (${t('adm.teacherWillSee')})`} className="sm:col-span-2"><Input value={edit.reason} onChange={(e) => setEdit({ ...edit, reason: e.target.value })} /></Field>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={statusTone[l.status]}>{t(`lesson.statuses.${l.status}`)}</Badge>
              <Badge tone="brand">{t(`lesson.types.${l.type}`)}</Badge>
            </div>
            <KV
              items={[
                [t('booking.teacher'), <Link key="t" to={`/admin/teachers/${l.teacher.id}`} className="text-brand-700 underline">{l.teacher.user.fullName}</Link>],
                [t('adm.subject'), subjectName(l.subject, locale)],
                [t('common.price'), money(l.price, locale)],
                [t('adm.duration'), `${l.durationMin} ${t('common.min')}`],
                [t('adm.level'), l.level],
                [t('adm.bookingsCount'), l._count.bookings],
                [t('adm.created'), dateTime(l.createdAt, locale)],
              ]}
            />
            {l.description && <p className="whitespace-pre-line rounded-xl bg-surface p-3 text-sm text-ink/80">{l.description}</p>}
            {l.bookings.length > 0 && (
              <div>
                <h3 className="mb-1.5 text-sm font-extrabold">{t('adm.recentBookings')}</h3>
                <ul className="space-y-1.5">
                  {l.bookings.map((b: any) => (
                    <li key={b.id}><Link to={`/admin/bookings?open=${b.id}`} className="flex items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2 text-xs hover:bg-brand-50"><span className="truncate font-semibold">{b.student.fullName}</span><span className="flex shrink-0 items-center gap-1.5">{dateTime(b.session.startAt, locale)}<Badge tone={statusTone[b.status]}>{t(`booking.statuses.${b.status}`)}</Badge></span></Link></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
      <ReasonModal open={hide} title={t('admin.hide')} danger onClose={() => setHide(false)} onSubmit={(reason) => act(() => patch(`/admin/lessons/${l.id}`, { status: 'draft', reason: reason || undefined }))} />
    </>
  );
}

/* ============================== BRONLAR ============================== */
export function AdminBookings() {
  const { t, locale } = useI18n();
  const [f, set] = useUrlFilters({ status: '', q: '', user: '', open: '' });
  return (
    <div>
      <PageHeader title={t('menu.adminBookings')} />
      <Filters>
        <Input icon={<Search className="h-4 w-4" />} value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder={t('adm.searchBooking')} className="sm:w-64" />
        <Select value={f.status} onChange={(e) => set({ status: e.target.value })} className="sm:w-52">
          <option value="">{t('adm.allStatuses')}</option>
          {['requested', 'confirmed', 'completed', 'cancelled', 'rejected', 'no_show', 'rescheduled'].map((s) => <option key={s} value={s}>{t(`booking.statuses.${s}`)}</option>)}
        </Select>
        {f.user && <Button size="sm" variant="ghost" onClick={() => set({ user: '' })}>✕ {t('adm.oneUserFilter')}</Button>}
      </Filters>
      <PagedList<any>
        queryKey={['bookings', f.status, f.q, f.user]}
        path="/admin/bookings"
        query={{ status: f.status, q: f.q, user: f.user }}
        render={(b) => (
          <Row key={b.id} onClick={() => set({ open: b.id })}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-bold">{b.lesson.title}</div>
                <div className="truncate text-xs text-muted">{b.student.fullName} → {b.teacher.user.fullName}</div>
                <div className="mt-1 flex items-center gap-1 text-xs text-muted"><CalendarClock className="h-3.5 w-3.5" /> {dateTime(b.session.startAt, locale)}</div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <b className="text-sm">{money(b.price, locale)}</b>
                <Badge tone={statusTone[b.status]}>{t(`booking.statuses.${b.status}`)}</Badge>
                {b.payments.map((p: any, i: number) => <Badge key={i} tone={statusTone[p.status]}>{t(`pay.statuses.${p.status}`)}</Badge>)}
              </div>
            </div>
          </Row>
        )}
      />
      <BookingModal id={f.open || null} onClose={() => set({ open: '' })} />
    </div>
  );
}

function BookingModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t, L, locale } = useI18n();
  const act = useAct();
  const q = useQuery({ queryKey: ['admin', 'booking', id], queryFn: () => get<any>(`/admin/bookings/${id}`), enabled: !!id });
  const [cancel, setCancel] = useState(false);
  const b = q.data;
  return (
    <>
      <Modal
        open={!!id}
        onClose={onClose}
        title={t('adm.bookingDetail')}
        size="lg"
        footer={b && ['requested', 'confirmed'].includes(b.status) && <Button variant="danger" className="w-full" onClick={() => setCancel(true)}>{t('booking.cancel')}</Button>}
      >
        {!b ? (
          <Skeleton className="h-60" />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <b className="mr-1">{b.lesson.title}</b>
              <Badge tone={statusTone[b.status]}>{t(`booking.statuses.${b.status}`)}</Badge>
              <Badge tone="brand">{t(`lesson.types.${b.lesson.type}`)}</Badge>
            </div>
            <KV
              items={[
                [t('booking.student'), <Link key="s" to={`/admin/users/${b.student.id}`} className="text-brand-700 underline">{b.student.fullName}</Link>],
                [t('booking.teacher'), <Link key="t" to={`/admin/teachers/${b.teacher.id}`} className="text-brand-700 underline">{b.teacher.user.fullName}</Link>],
                [t('adm.subject'), subjectName(b.lesson.subject, locale)],
                [t('adm.when'), `${dateTime(b.session.startAt, locale)} (${b.lesson.durationMin} ${t('common.min')})`],
                [t('common.price'), money(b.price, locale)],
                [t('adm.created'), dateTime(b.createdAt, locale)],
                ...(b.cancelReason ? ([[t('common.reason'), b.cancelReason]] as [string, string][]) : []),
              ]}
            />
            {b.payments.length > 0 && (
              <div>
                <h3 className="mb-1.5 text-sm font-extrabold">{t('menu.adminPayments')}</h3>
                {b.payments.map((p: any) => (
                  <Link key={p.id} to={`/admin/payments?open=${p.id}`} className="mb-1.5 flex items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2 text-xs hover:bg-brand-50">
                    <span className="font-mono">{p.receiptNo}</span>
                    <span className="flex items-center gap-1.5">{L('provider', p.provider)} · <b>{money(p.amount, locale)}</b><Badge tone={statusTone[p.status]}>{t(`pay.statuses.${p.status}`)}</Badge></span>
                  </Link>
                ))}
              </div>
            )}
            {b.review && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm">★ {b.review.rating} — {b.review.comment}</p>}
            {b.lessonSummary && <p className="whitespace-pre-line rounded-xl bg-brand-50 px-3 py-2 text-sm">{b.lessonSummary}</p>}
          </div>
        )}
      </Modal>
      <ReasonModal open={cancel} required danger title={t('booking.cancel')} onClose={() => setCancel(false)} onSubmit={(reason) => act(() => post(`/bookings/${b.id}/cancel`, { reason }))} />
    </>
  );
}
