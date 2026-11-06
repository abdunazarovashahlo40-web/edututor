import { useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BookOpen, CalendarCheck, Check, CircleDollarSign, Clock, Eye, EyeOff, FileText, Flag, GraduationCap, Plus, Search, ShieldCheck, Users, X } from 'lucide-react';
import { api, del, get, patch, post, put } from '../../services/api';
import { useI18n, subjectName } from '../../i18n';
import { Avatar, Badge, Button, Card, Checkbox, EmptyState, Field, Input, ListSkeleton, Modal, PageHeader, Pagination, Select, Skeleton, StatCard, Stars, Table, Tabs, Td, Textarea, statusTone } from '../../components/ui';
import { compact, date, dateTime, errorText, money } from '../../utils/format';
import { useToast } from '../../hooks/useToast';

function useAct() {
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  return async (fn: () => Promise<unknown>, keys: string[] = []) => {
    try {
      await fn();
      toast('success', t('common.done'));
      keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      qc.invalidateQueries({ queryKey: ['admin'] });
    } catch (e) {
      toast('error', errorText(e, t));
    }
  };
}

function Paged<T>({ queryKey, path, query, head, row, empty }: { queryKey: unknown[]; path: string; query?: Record<string, unknown>; head: ReactNode[]; row: (r: T) => ReactNode; empty?: string }) {
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['admin', ...queryKey, page], queryFn: () => api<T[]>(path, { query: { ...query, page, limit: 20 } }) });
  if (q.isLoading) return <ListSkeleton />;
  if (!q.data?.data.length) return <EmptyState title={empty ?? t('common.empty')} />;
  return (
    <>
      <Table head={head}>{q.data.data.map(row)}</Table>
      <Pagination page={page} pages={q.data.meta?.pages ?? 1} onChange={setPage} />
    </>
  );
}

/* ============================== DASHBOARD ============================== */
export function AdminDashboard() {
  const { t, locale } = useI18n();
  const q = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => get<any>('/admin/stats') });
  const d = q.data;
  if (q.isLoading) return <div className="grid gap-3 md:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;
  return (
    <div className="space-y-5">
      <PageHeader title={t('admin.title')} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5" />} label={t('admin.totalUsers')} value={compact(d.totalUsers)} />
        <StatCard icon={<GraduationCap className="h-5 w-5" />} label={t('roles.TEACHER')} value={compact(d.teachers)} tone="blue" />
        <StatCard icon={<Users className="h-5 w-5" />} label={t('roles.STUDENT')} value={compact(d.students)} tone="green" />
        <StatCard icon={<Clock className="h-5 w-5" />} label={t('admin.pending')} value={d.pendingTeachers} tone="amber" />
        <StatCard icon={<BookOpen className="h-5 w-5" />} label={t('menu.adminLessons')} value={compact(d.lessons)} tone="pink" />
        <StatCard icon={<CalendarCheck className="h-5 w-5" />} label={t('menu.adminBookings')} value={`${compact(d.completedLessons)} / ${compact(d.bookings)}`} tone="blue" />
        <StatCard icon={<CircleDollarSign className="h-5 w-5" />} label={t('admin.revenue')} value={money(d.platformRevenue, locale)} tone="green" hint={`${t('admin.volume')}: ${money(d.grossVolume, locale)}`} />
        <StatCard icon={<Flag className="h-5 w-5" />} label={t('admin.openComplaints')} value={`${d.openComplaints} · ↩ ${d.refundRequests}`} tone="amber" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <h2 className="mb-3 font-extrabold">{t('admin.growth')}</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={d.growth}>
                <defs>
                  <linearGradient id="gs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7C3AED" stopOpacity={0.35} /><stop offset="1" stopColor="#7C3AED" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3B82F6" stopOpacity={0.3} /><stop offset="1" stopColor="#3B82F6" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF0F7" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} tickLine={false} axisLine={false} minTickGap={20} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
                <Tooltip contentStyle={{ borderRadius: 12 }} />
                <Legend />
                <Area type="monotone" dataKey="students" name={t('roles.STUDENT')} stroke="#7C3AED" fill="url(#gs)" strokeWidth={2} />
                <Area type="monotone" dataKey="teachers" name={t('roles.TEACHER')} stroke="#3B82F6" fill="url(#gt)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 font-extrabold">{t('menu.adminPayments')}</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={d.payments.map((p: any) => ({ ...p, label: t(`pay.statuses.${p.status}`) }))} layout="vertical">
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="label" width={96} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number, n: string) => (n === 'amount' ? money(v, locale) : v)} contentStyle={{ borderRadius: 12 }} />
                <Bar dataKey="count" fill="#8B5CF6" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ============================== USERS ============================== */
export function AdminUsers() {
  const { t, locale } = useI18n();
  const act = useAct();
  const [f, setF] = useState({ q: '', role: '', status: '' });
  return (
    <div>
      <PageHeader title={t('menu.users')} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input icon={<Search className="h-4 w-4" />} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder={t('common.search')} className="w-64" />
        <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} className="w-40"><option value="">{t('common.all')}</option>{['STUDENT', 'TEACHER', 'ADMIN'].map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}</Select>
        <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className="w-48"><option value="">{t('common.all')}</option>{['ACTIVE', 'PENDING_VERIFICATION', 'SUSPENDED'].map((r) => <option key={r} value={r}>{r}</option>)}</Select>
      </div>
      <Paged<any> queryKey={['users', f]} path="/admin/users" query={f} head={[t('auth.fullName'), 'Email / tel', t('common.status'), t('common.date'), '']} row={(u) => (
        <tr key={u.id}>
          <Td><div className="flex items-center gap-2"><Avatar name={u.fullName} src={u.avatarUrl} size={32} /><div><div className="font-bold">{u.fullName}</div><Badge tone="brand">{t(`roles.${u.role}`)}</Badge></div></div></Td>
          <Td className="text-xs">{u.email}<br />{u.phone}</Td>
          <Td><Badge tone={statusTone[u.status]}>{u.status}</Badge>{u.teacherProfile && <Badge tone={statusTone[u.teacherProfile.verification]} className="ml-1">{u.teacherProfile.verification}</Badge>}</Td>
          <Td className="text-xs">{date(u.createdAt, locale)}</Td>
          <Td>{u.role !== 'ADMIN' && (u.status === 'SUSPENDED'
            ? <Button size="sm" variant="secondary" onClick={() => act(() => patch(`/admin/users/${u.id}/status`, { status: 'ACTIVE' }))}>{t('admin.activate')}</Button>
            : <Button size="sm" variant="danger" onClick={() => { const reason = prompt(t('common.reason')) ?? undefined; void act(() => patch(`/admin/users/${u.id}/status`, { status: 'SUSPENDED', reason })); }}>{t('admin.suspend')}</Button>)}</Td>
        </tr>
      )} />
    </div>
  );
}

/* ============================== TEACHER VERIFICATION ============================== */
export function AdminTeachers() {
  const { t, locale } = useI18n();
  const act = useAct();
  const [v, setV] = useState('PENDING');
  const [reject, setReject] = useState<any>(null);
  const [note, setNote] = useState('');
  const q = useQuery({ queryKey: ['admin', 'teachers', v], queryFn: () => get<any[]>('/admin/teachers', { verification: v || undefined, limit: 50 }) });
  return (
    <div>
      <PageHeader title={t('menu.verification')} />
      <Tabs value={v} onChange={setV} className="mb-4 w-fit" items={['PENDING', 'APPROVED', 'REJECTED', 'DRAFT', ''].map((x) => ({ value: x, label: x || t('common.all') }))} />
      {q.isLoading ? <ListSkeleton /> : !q.data?.length ? <EmptyState title={t('common.empty')} icon={<ShieldCheck className="h-7 w-7" />} /> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {q.data.map((tp) => (
            <Card key={tp.id}>
              <div className="flex items-start gap-3">
                <Avatar name={tp.user.fullName} src={tp.user.avatarUrl} size={56} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><b>{tp.user.fullName}</b><Badge tone={statusTone[tp.verification]}>{tp.verification}</Badge></div>
                  <p className="text-xs text-muted">{tp.user.email} · {tp.user.phone} · {date(tp.user.createdAt, locale)}</p>
                  <p className="mt-1 text-sm font-semibold">{tp.headline}</p>
                  <div className="mt-1 flex flex-wrap gap-1">{tp.subjects.map((s: any) => <Badge key={s.subjectId} tone="brand">{subjectName(s.subject, locale)}</Badge>)}</div>
                </div>
              </div>
              <p className="mt-3 line-clamp-3 text-sm text-ink/80">{tp.bio}</p>
              <p className="mt-2 text-xs"><b>{t('teacher.education')}:</b> {tp.education} · <b>{t('teacher.experience')}:</b> {tp.experienceYears} · <b>{t('common.price')}:</b> {money(tp.hourlyPrice, locale)}</p>
              <div className="mt-3 rounded-xl bg-surface p-3">
                <p className="mb-1 text-xs font-bold uppercase text-muted">{t('admin.docs')}</p>
                {tp.certificates.length ? tp.certificates.map((c: any) => (
                  <div key={c.id} className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-brand-600" />{c.title} {c.isVerificationDoc && <Badge tone="yellow">ID</Badge>}
                    {c.fileUrl && <a href={c.fileUrl} target="_blank" rel="noreferrer" className="ml-auto text-xs font-bold text-brand-700">{t('common.open')}</a>}
                  </div>
                )) : <p className="text-sm text-muted">—</p>}
              </div>
              {tp.verificationNote && <p className="mt-2 text-xs text-danger">{tp.verificationNote}</p>}
              <div className="mt-3 flex gap-2">
                {tp.verification !== 'APPROVED' && <Button size="sm" variant="success" icon={<Check className="h-4 w-4" />} onClick={() => act(() => post(`/admin/teachers/${tp.id}/verify`, { decision: 'APPROVED' }))}>{t('admin.approve')}</Button>}
                {tp.verification !== 'REJECTED' && <Button size="sm" variant="danger" icon={<X className="h-4 w-4" />} onClick={() => setReject(tp)}>{t('admin.rejectT')}</Button>}
                <a href={`/teachers/${tp.id}`} target="_blank" rel="noreferrer" className="ml-auto"><Button size="sm" variant="ghost" icon={<Eye className="h-4 w-4" />}>{t('common.view')}</Button></a>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!reject} onClose={() => setReject(null)} title={t('admin.rejectT')} size="sm" footer={
        <Button variant="danger" className="w-full" disabled={!note} onClick={async () => { await act(() => post(`/admin/teachers/${reject.id}/verify`, { decision: 'REJECTED', note })); setReject(null); setNote(''); }}>{t('common.confirm')}</Button>}>
        <Field label={t('admin.rejectNote')}><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </Modal>
    </div>
  );
}

/* ============================== SUBJECTS ============================== */
export function AdminSubjects() {
  const { t } = useI18n();
  const act = useAct();
  const q = useQuery({ queryKey: ['admin', 'subjects'], queryFn: () => get<any[]>('/admin/subjects') });
  const empty = { id: '', slug: '', nameUz: '', nameRu: '', nameEn: '', category: 'general', icon: '', sortOrder: 0, isActive: true };
  const [f, setF] = useState<typeof empty | null>(null);
  return (
    <div>
      <PageHeader title={t('menu.subjects')} actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setF(empty)}>{t('admin.newSubject')}</Button>} />
      {q.isLoading ? <ListSkeleton /> : (
        <Table head={['Slug', "O'zbekcha", 'Русский', 'English', t('menu.users'), t('common.status'), '']}>
          {q.data?.map((s) => (
            <tr key={s.id}>
              <Td className="font-mono text-xs">{s.slug}</Td><Td className="font-semibold">{s.nameUz}</Td><Td>{s.nameRu}</Td><Td>{s.nameEn}</Td>
              <Td className="text-xs">{s._count.teachers} / {s._count.lessons}</Td>
              <Td><Badge tone={s.isActive ? 'green' : 'gray'}>{s.isActive ? 'active' : 'off'}</Badge></Td>
              <Td><div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setF({ ...empty, ...s, icon: s.icon ?? '' })}>{t('common.edit')}</Button><Button size="sm" variant="danger" onClick={() => confirm('?') && act(() => del(`/admin/subjects/${s.id}`))}>{t('common.delete')}</Button></div></Td>
            </tr>
          ))}
        </Table>
      )}
      <Modal open={!!f} onClose={() => setF(null)} title={f?.id ? t('common.edit') : t('admin.newSubject')} footer={
        <Button className="w-full" onClick={async () => { const { id, ...body } = f!; await act(() => (id ? patch(`/admin/subjects/${id}`, body) : post('/admin/subjects', body))); setF(null); }}>{t('common.save')}</Button>}>
        {f && (
          <div className="grid gap-3 md:grid-cols-2">
            {(['slug', 'nameUz', 'nameRu', 'nameEn', 'category', 'icon'] as const).map((k) => <Field key={k} label={k}><Input value={f[k] as string} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>)}
            <Field label="sortOrder"><Input type="number" value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: Number(e.target.value) })} /></Field>
            <div className="flex items-end"><Checkbox label="isActive" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ============================== LESSONS / BOOKINGS ============================== */
export function AdminLessons() {
  const { t, locale } = useI18n();
  const act = useAct();
  const [f, setF] = useState({ q: '', status: '' });
  return (
    <div>
      <PageHeader title={t('menu.adminLessons')} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input icon={<Search className="h-4 w-4" />} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder={t('common.search')} className="w-64" />
        <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className="w-44"><option value="">{t('common.all')}</option>{['published', 'draft', 'cancelled'].map((s) => <option key={s} value={s}>{t(`lesson.statuses.${s}`)}</option>)}</Select>
      </div>
      <Paged<any> queryKey={['lessons', f]} path="/admin/lessons" query={f} head={[t('lesson.title'), t('booking.teacher'), t('lesson.type'), t('common.price'), t('common.status'), '']} row={(l) => (
        <tr key={l.id}>
          <Td><div className="font-bold">{l.title}</div><div className="text-xs text-muted">{l.subject.nameUz} · {l._count.bookings} bron</div></Td>
          <Td>{l.teacher.user.fullName}</Td>
          <Td>{t(`lesson.types.${l.type}`)}</Td>
          <Td>{money(l.price, locale)}</Td>
          <Td><Badge tone={statusTone[l.status]}>{t(`lesson.statuses.${l.status}`)}</Badge></Td>
          <Td>{l.status === 'published'
            ? <Button size="sm" variant="ghost" icon={<EyeOff className="h-4 w-4" />} onClick={() => { const reason = prompt(t('common.reason')) ?? undefined; void act(() => patch(`/admin/lessons/${l.id}/status`, { status: 'draft', reason })); }}>{t('admin.hide')}</Button>
            : <Button size="sm" variant="ghost" icon={<Eye className="h-4 w-4" />} onClick={() => act(() => patch(`/admin/lessons/${l.id}/status`, { status: 'published' }))}>{t('admin.restore')}</Button>}</Td>
        </tr>
      )} />
    </div>
  );
}

export function AdminBookings() {
  const { t, locale } = useI18n();
  const act = useAct();
  const [status, setStatus] = useState('');
  return (
    <div>
      <PageHeader title={t('menu.adminBookings')} />
      <Select value={status} onChange={(e) => setStatus(e.target.value)} className="mb-4 w-52"><option value="">{t('common.all')}</option>{['requested', 'confirmed', 'completed', 'cancelled', 'rejected', 'no_show', 'rescheduled'].map((s) => <option key={s} value={s}>{t(`booking.statuses.${s}`)}</option>)}</Select>
      <Paged<any> queryKey={['bookings', status]} path="/admin/bookings" query={{ status }} head={[t('lesson.title'), t('booking.student'), t('booking.teacher'), t('common.date'), t('common.price'), t('common.status'), '']} row={(b) => (
        <tr key={b.id}>
          <Td className="font-semibold">{b.lesson.title}</Td><Td>{b.student.fullName}</Td><Td>{b.teacher.user.fullName}</Td>
          <Td className="text-xs">{dateTime(b.session.startAt, locale)}</Td>
          <Td>{money(b.price, locale)} {b.payments.map((p: any, i: number) => <Badge key={i} tone={statusTone[p.status]} className="ml-1">{p.status}</Badge>)}</Td>
          <Td><Badge tone={statusTone[b.status]}>{t(`booking.statuses.${b.status}`)}</Badge></Td>
          <Td>{['requested', 'confirmed'].includes(b.status) && <Button size="sm" variant="danger" onClick={() => { const reason = prompt(t('common.reason')); if (reason) void act(() => post(`/bookings/${b.id}/cancel`, { reason })); }}>{t('booking.cancel')}</Button>}</Td>
        </tr>
      )} />
    </div>
  );
}

/* ============================== PAYMENTS / REFUNDS / PAYOUTS ============================== */
export function AdminPayments() {
  const { t, locale } = useI18n();
  const act = useAct();
  const [tab, setTab] = useState<'payments' | 'refunds' | 'payouts'>('payments');
  const [status, setStatus] = useState('');
  const refunds = useQuery({ queryKey: ['admin', 'refunds'], queryFn: () => get<any[]>('/admin/refunds', { limit: 50 }), enabled: tab === 'refunds' });
  const payouts = useQuery({ queryKey: ['admin', 'payouts'], queryFn: () => get<any[]>('/admin/payouts', { limit: 50 }), enabled: tab === 'payouts' });
  return (
    <div>
      <PageHeader title={t('menu.adminPayments')} />
      <Tabs value={tab} onChange={setTab} className="mb-4 w-fit" items={[{ value: 'payments', label: t('menu.adminPayments') }, { value: 'refunds', label: t('admin.refunds') }, { value: 'payouts', label: t('admin.payouts') }]} />
      {tab === 'payments' && (
        <>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="mb-4 w-48"><option value="">{t('common.all')}</option>{['pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded'].map((s) => <option key={s} value={s}>{t(`pay.statuses.${s}`)}</option>)}</Select>
          <Paged<any> queryKey={['payments', status]} path="/admin/payments" query={{ status }} head={[t('pay.receipt'), t('booking.student'), t('lesson.title'), t('pay.method'), t('common.price'), t('common.status'), t('common.date')]} row={(p) => (
            <tr key={p.id}>
              <Td><a className="font-mono text-xs text-brand-700 underline" href={`/api/v1/payments/${p.id}/receipt`} target="_blank" rel="noreferrer">{p.receiptNo}</a></Td>
              <Td>{p.user.fullName}</Td><Td>{p.booking.lesson.title}</Td><Td>{p.provider}</Td>
              <Td className="font-bold">{money(p.amount, locale)}</Td>
              <Td><Badge tone={statusTone[p.status]}>{t(`pay.statuses.${p.status}`)}</Badge></Td>
              <Td className="text-xs">{dateTime(p.createdAt, locale)}</Td>
            </tr>
          )} />
        </>
      )}
      {tab === 'refunds' && (refunds.isLoading ? <ListSkeleton /> : !refunds.data?.length ? <EmptyState title={t('common.empty')} /> : (
        <Table head={[t('booking.student'), t('lesson.title'), t('common.price'), t('common.reason'), t('common.status'), '']}>
          {refunds.data.map((r) => (
            <tr key={r.id}>
              <Td>{r.payment.user.fullName}</Td><Td>{r.payment.booking.lesson.title}</Td><Td className="font-bold">{money(r.amount, locale)}</Td>
              <Td className="max-w-xs text-xs">{r.reason}</Td>
              <Td><Badge tone={statusTone[r.status] ?? 'gray'}>{r.status}</Badge></Td>
              <Td>{['requested', 'approved'].includes(r.status) && <div className="flex gap-1">
                <Button size="sm" variant="success" onClick={() => act(() => post(`/admin/refunds/${r.id}/decide`, { approve: true }), ['refunds'])}>{t('admin.approve')}</Button>
                <Button size="sm" variant="danger" onClick={() => act(() => post(`/admin/refunds/${r.id}/decide`, { approve: false }), ['refunds'])}>{t('admin.rejectT')}</Button>
              </div>}</Td>
            </tr>
          ))}
        </Table>
      ))}
      {tab === 'payouts' && (payouts.isLoading ? <ListSkeleton /> : !payouts.data?.length ? <EmptyState title={t('common.empty')} /> : (
        <Table head={[t('booking.teacher'), t('common.price'), 'Karta', t('common.status'), t('common.date'), '']}>
          {payouts.data.map((p) => (
            <tr key={p.id}>
              <Td className="font-bold">{p.teacher.user.fullName}</Td><Td className="font-bold">{money(p.amount, locale)}</Td><Td className="font-mono text-xs">{p.destination}</Td>
              <Td><Badge tone={p.status === 'paid' ? 'green' : p.status === 'rejected' ? 'red' : 'yellow'}>{p.status}</Badge></Td>
              <Td className="text-xs">{dateTime(p.createdAt, locale)}</Td>
              <Td>{['requested', 'processing'].includes(p.status) && <div className="flex gap-1">
                <Button size="sm" variant="success" onClick={() => act(() => post(`/admin/payouts/${p.id}/decide`, { status: 'paid' }), ['payouts'])}>{t('admin.markPaid')}</Button>
                <Button size="sm" variant="danger" onClick={() => act(() => post(`/admin/payouts/${p.id}/decide`, { status: 'rejected' }), ['payouts'])}>{t('admin.rejectT')}</Button>
              </div>}</Td>
            </tr>
          ))}
        </Table>
      ))}
    </div>
  );
}

/* ============================== REVIEWS / COMPLAINTS ============================== */
export function AdminReviews() {
  const { t, locale } = useI18n();
  const act = useAct();
  const [reported, setReported] = useState('true');
  return (
    <div>
      <PageHeader title={t('menu.reviews')} />
      <Tabs value={reported} onChange={setReported} className="mb-4 w-fit" items={[{ value: 'true', label: t('admin.reported') }, { value: 'false', label: t('common.all') }]} />
      <Paged<any> queryKey={['reviews', reported]} path="/admin/reviews" query={{ reported }} head={[t('booking.student'), t('booking.teacher'), '★', t('review.comment'), 'Flags', '']} row={(r) => (
        <tr key={r.id} className={r.isHidden ? 'opacity-50' : ''}>
          <Td>{r.student.fullName}<div className="text-xs text-muted">{date(r.createdAt, locale)}</div></Td><Td>{r.teacher.user.fullName}</Td>
          <Td><Stars value={r.rating} size={12} /></Td><Td className="max-w-sm text-xs">{r.comment}</Td>
          <Td>{r.reportCount > 0 && <Badge tone="red">{r.reportCount}</Badge>}</Td>
          <Td><Button size="sm" variant={r.isHidden ? 'secondary' : 'danger'} onClick={() => act(() => patch(`/admin/reviews/${r.id}`, { isHidden: !r.isHidden }))}>{r.isHidden ? t('admin.restore') : t('admin.hide')}</Button></Td>
        </tr>
      )} />
    </div>
  );
}

export function AdminComplaints() {
  const { t, locale } = useI18n();
  const act = useAct();
  const [status, setStatus] = useState('open');
  return (
    <div>
      <PageHeader title={t('menu.complaints')} />
      <Tabs value={status} onChange={setStatus} className="mb-4 w-fit" items={[{ value: 'open', label: 'open' }, { value: 'in_review', label: t('admin.inReview') }, { value: 'resolved', label: t('admin.resolve') }, { value: '', label: t('common.all') }]} />
      <Paged<any> queryKey={['complaints', status]} path="/admin/complaints" query={{ status }} head={[t('admin.actor'), t('admin.entity'), t('common.reason'), t('common.status'), '']} row={(c) => (
        <tr key={c.id}>
          <Td>{c.author.fullName}<div className="text-xs text-muted">{t(`roles.${c.author.role}`)} · {dateTime(c.createdAt, locale)}</div></Td>
          <Td className="text-xs">{c.targetType} <span className="font-mono">{c.targetId.slice(-8)}</span></Td>
          <Td className="max-w-md text-sm">{c.reason}{c.resolution && <div className="mt-1 text-xs text-success">→ {c.resolution}</div>}</Td>
          <Td><Badge tone={statusTone[c.status]}>{c.status}</Badge></Td>
          <Td><div className="flex gap-1">
            {c.status === 'open' && <Button size="sm" variant="secondary" onClick={() => act(() => patch(`/admin/complaints/${c.id}`, { status: 'in_review' }))}>{t('admin.inReview')}</Button>}
            {c.status !== 'resolved' && <Button size="sm" variant="success" onClick={() => { const resolution = prompt(t('common.note')) ?? undefined; void act(() => patch(`/admin/complaints/${c.id}`, { status: 'resolved', resolution })); }}>{t('admin.resolve')}</Button>}
          </div></Td>
        </tr>
      )} />
    </div>
  );
}

/* ============================== SETTINGS / AUDIT ============================== */
export function AdminSettings() {
  const { t } = useI18n();
  const act = useAct();
  const q = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => get<any>('/admin/settings') });
  const [f, setF] = useState<any>(null);
  const v = f ?? q.data;
  if (!v) return <ListSkeleton />;
  const fields = [
    ['commissionPercent', t('admin.commission')],
    ['trialDiscountPercent', t('admin.trialDiscount')],
    ['autoCancelUnpaidMinutes', t('admin.autoCancel')],
    ['earningHoldHours', t('admin.hold')],
    ['minPayoutAmount', t('admin.minPayout')],
  ] as const;
  return (
    <div className="max-w-2xl">
      <PageHeader title={t('menu.settings')} />
      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          {fields.map(([k, label]) => <Field key={k} label={label}><Input type="number" value={v[k]} onChange={(e) => setF({ ...v, [k]: Number(e.target.value) })} /></Field>)}
        </div>
        <Button className="mt-5" disabled={!f} onClick={() => act(() => put('/admin/settings', Object.fromEntries(fields.map(([k]) => [k, Number(v[k])]))), ['settings']).then(() => setF(null))}>{t('common.save')}</Button>
      </Card>
    </div>
  );
}

export function AdminAudit() {
  const { t, locale } = useI18n();
  const [action, setAction] = useState('');
  return (
    <div>
      <PageHeader title={t('menu.audit')} />
      <Input icon={<Search className="h-4 w-4" />} value={action} onChange={(e) => setAction(e.target.value)} placeholder="teacher.approved, user.suspend..." className="mb-4 w-72" />
      <Paged<any> queryKey={['audit', action]} path="/admin/audit-logs" query={{ action }} head={[t('common.date'), t('admin.actor'), t('admin.action'), t('admin.entity'), 'IP', 'Meta']} row={(l) => (
        <tr key={l.id}>
          <Td className="whitespace-nowrap text-xs">{dateTime(l.createdAt, locale)}</Td>
          <Td>{l.actor?.fullName ?? 'system'}</Td>
          <Td><Badge tone="brand">{l.action}</Badge></Td>
          <Td className="text-xs">{l.entityType} <span className="font-mono">{l.entityId?.slice(-8)}</span></Td>
          <Td className="font-mono text-xs">{l.ip}</Td>
          <Td className="max-w-xs truncate font-mono text-[11px] text-muted">{l.meta ? JSON.stringify(l.meta) : ''}</Td>
        </tr>
      )} />
    </div>
  );
}
