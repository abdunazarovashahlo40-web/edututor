/** Foydalanuvchilar: ro'yxat (filtr URL'da) va batafsil sahifa — admin foydalanuvchi o'zi qiladigan amallarni bajara oladi */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Ban, Copy, KeyRound, LogOut, MailCheck, MessageCircle, Search, ShieldOff, Smartphone, Unlock, UserCheck } from 'lucide-react';
import { get, patch, post } from '../../services/api';
import { useI18n } from '../../i18n';
import { Avatar, Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Skeleton, Textarea, statusTone } from '../../components/ui';
import { date, dateTime, money, relative } from '../../utils/format';
import { Filters, KV, PagedList, ReasonModal, Row, useAct, useUrlFilters } from './shared';
import { useToast } from '../../hooks/useToast';

export function AdminUsers() {
  const { t, L, locale } = useI18n();
  const nav = useNavigate();
  const [f, set] = useUrlFilters({ q: '', role: '', status: '' });
  return (
    <div>
      <PageHeader title={t('menu.users')} />
      <Filters>
        <Input icon={<Search className="h-4 w-4" />} value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder={t('adm.searchUser')} className="sm:w-64" />
        <Select value={f.role} onChange={(e) => set({ role: e.target.value })} className="sm:w-44">
          <option value="">{t('adm.allRoles')}</option>
          {['STUDENT', 'TEACHER', 'ADMIN'].map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
        </Select>
        <Select value={f.status} onChange={(e) => set({ status: e.target.value })} className="sm:w-48">
          <option value="">{t('adm.allStatuses')}</option>
          {['ACTIVE', 'PENDING_VERIFICATION', 'SUSPENDED'].map((s) => <option key={s} value={s}>{L('userStatus', s)}</option>)}
        </Select>
      </Filters>
      <PagedList<any>
        queryKey={['users', f]}
        path="/admin/users"
        query={f}
        render={(u) => (
          <Row key={u.id} onClick={() => nav(`/admin/users/${u.id}`)}>
            <div className="flex items-center gap-3">
              <Avatar name={u.fullName} src={u.avatarUrl} size={42} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <b className="truncate">{u.fullName}</b>
                  <Badge tone="brand">{t(`roles.${u.role}`)}</Badge>
                </div>
                <div className="truncate text-xs text-muted">{[u.email, u.phone].filter(Boolean).join(' · ')}</div>
                <div className="text-[11px] text-muted">{t('adm.joined')}: {date(u.createdAt, locale)}{u.lastLoginAt ? ` · ${t('adm.lastSeen')}: ${relative(u.lastLoginAt, locale)}` : ''}</div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge tone={statusTone[u.status]}>{L('userStatus', u.status)}</Badge>
                {u.teacherProfile && <Badge tone={statusTone[u.teacherProfile.verification]}>{L('verification', u.teacherProfile.verification)}</Badge>}
              </div>
            </div>
          </Row>
        )}
      />
    </div>
  );
}

export function AdminUserDetail() {
  const { id = '' } = useParams();
  const { t, L, locale } = useI18n();
  const nav = useNavigate();
  const act = useAct();
  const toast = useToast();
  const q = useQuery({ queryKey: ['admin', 'user', id], queryFn: () => get<any>(`/admin/users/${id}`) });
  const [edit, setEdit] = useState<any>(null);
  const [suspend, setSuspend] = useState(false);
  const [temp, setTemp] = useState<string | null>(null);
  const u = q.data;
  if (!u) return <Skeleton className="h-96" />;
  const isAdmin = u.role === 'ADMIN';
  const booked = (u.stats.bookings as { status: string; count: number }[]).reduce((a, b) => a + b.count, 0);
  const locked = u.lockedUntil && new Date(u.lockedUntil) > new Date();

  return (
    <div className="space-y-4">
      <button onClick={() => nav(-1)} className="flex items-center gap-1.5 text-sm font-bold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {t('common.back')}
      </button>

      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar name={u.fullName} src={u.avatarUrl} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold">{u.fullName}</h1>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge tone="brand">{t(`roles.${u.role}`)}</Badge>
            <Badge tone={statusTone[u.status]}>{L('userStatus', u.status)}</Badge>
            {u.teacherProfile && <Badge tone={statusTone[u.teacherProfile.verification]}>{L('verification', u.teacherProfile.verification)}</Badge>}
            {locked && <Badge tone="red">{t('adm.signinLocked')}</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {u.teacherProfile && <Link to={`/admin/teachers/${u.teacherProfile.id}`}><Button size="sm" variant="outline">{t('adm.teacherCard')}</Button></Link>}
          <Button size="sm" variant="ghost" icon={<MessageCircle className="h-4 w-4" />} onClick={async () => { const c: any = await act(() => post('/messages/conversations', { userId: u.id }), t('adm.chatOpened')); if (c?.id) nav(`/admin/messages?c=${c.id}`); }}>{t('adm.writeMessage')}</Button>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-extrabold">{t('adm.profileData')}</h2>
            {!isAdmin && <Button size="sm" variant="outline" onClick={() => setEdit({ fullName: u.fullName, email: u.email ?? '', phone: u.phone?.replace('+998', '') ?? '', locale: u.locale, grade: u.studentProfile?.grade ?? '', city: u.studentProfile?.city ?? '', goals: u.studentProfile?.goals ?? '' })}>{t('common.edit')}</Button>}
          </div>
          <KV
            items={[
              ['Email', <span key="e">{u.email ?? '—'} {u.email && (u.emailVerifiedAt ? <Badge tone="green">✓</Badge> : <Badge tone="yellow">{t('adm.notVerified')}</Badge>)}</span>],
              [t('auth.phone'), u.phone ?? '—'],
              [t('common.language'), u.locale.toUpperCase()],
              [t('adm.joined'), dateTime(u.createdAt, locale)],
              [t('adm.lastSeen'), u.lastLoginAt ? relative(u.lastLoginAt, locale) : '—'],
              [t('adm.signinMethods'), [u.googleId && 'Google', u.telegramId && 'Telegram', 'Email'].filter(Boolean).join(', ')],
              ...(u.studentProfile ? ([[t('settings.grade'), u.studentProfile.grade], [t('teacher.city'), u.studentProfile.city], [t('settings.goals'), u.studentProfile.goals]] as [string, string][]) : []),
            ]}
          />
        </Card>

        <Card>
          <h2 className="mb-2 font-extrabold">{t('adm.activity')}</h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Link to={`/admin/bookings?user=${u.id}`} className="rounded-xl bg-surface p-3 hover:bg-brand-50"><div className="text-lg font-extrabold">{booked}</div><div className="text-[11px] font-semibold text-muted">{t('menu.adminBookings')}</div></Link>
            <Link to={`/admin/payments?user=${u.id}`} className="rounded-xl bg-surface p-3 hover:bg-brand-50"><div className="text-lg font-extrabold">{u.stats.paidCount}</div><div className="text-[11px] font-semibold text-muted">{t('menu.adminPayments')}</div></Link>
            <div className="rounded-xl bg-surface p-3"><div className="text-lg font-extrabold">{u.stats.complaints}</div><div className="text-[11px] font-semibold text-muted">{t('menu.complaints')}</div></div>
          </div>
          {u.stats.paidSum > 0 && <p className="mt-2 text-xs text-muted">{t('adm.paidTotal')}: <b className="text-ink">{money(u.stats.paidSum, locale)}</b></p>}
          <h3 className="mb-1 mt-4 text-sm font-extrabold">{t('adm.devices')}</h3>
          {u.sessions.length ? (
            <ul className="space-y-1.5 text-xs">
              {u.sessions.slice(0, 5).map((s: any) => (
                <li key={s.id} className="flex items-center gap-2 rounded-lg bg-surface px-2.5 py-1.5">
                  <Smartphone className="h-3.5 w-3.5 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 truncate">{s.userAgent ?? '—'}</span>
                  <span className="shrink-0 text-muted">{relative(s.lastActiveAt, locale)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">{t('adm.noSessions')}</p>
          )}
          {u.devices.some((d: any) => d.hasPin) && <p className="mt-2 text-xs text-muted">🔒 {t('adm.hasAppLock')}</p>}
        </Card>
      </div>

      {/* Foydalanuvchi uchun amallar — muammo bo'lganda admin bajaradi */}
      {!isAdmin && (
        <Card>
          <h2 className="mb-3 font-extrabold">{t('adm.helpActions')}</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {u.email && !u.emailVerifiedAt && (
              <Button variant="outline" icon={<MailCheck className="h-4 w-4" />} onClick={() => act(() => post(`/admin/users/${u.id}/verify-email`))}>{t('adm.verifyEmail')}</Button>
            )}
            <Button variant="outline" icon={<KeyRound className="h-4 w-4" />} onClick={async () => { const r: any = await act(() => post(`/admin/users/${u.id}/password`)); if (r?.tempPassword) setTemp(r.tempPassword); }}>{t('adm.tempPassword')}</Button>
            {(locked || u.failedLogins > 0) && <Button variant="outline" icon={<Unlock className="h-4 w-4" />} onClick={() => act(() => post(`/admin/users/${u.id}/unlock`))}>{t('adm.unlock')}</Button>}
            {u.devices.length > 0 && <Button variant="outline" icon={<ShieldOff className="h-4 w-4" />} onClick={() => act(() => post(`/admin/users/${u.id}/applock-reset`))}>{t('adm.resetAppLock')}</Button>}
            <Button variant="outline" icon={<LogOut className="h-4 w-4" />} onClick={() => act(() => post(`/admin/users/${u.id}/sessions/revoke`))}>{t('adm.signOutAll')}</Button>
            {u.status === 'SUSPENDED' ? (
              <Button variant="success" icon={<UserCheck className="h-4 w-4" />} onClick={() => act(() => patch(`/admin/users/${u.id}/status`, { status: 'ACTIVE' }))}>{t('admin.activate')}</Button>
            ) : (
              <Button variant="danger" icon={<Ban className="h-4 w-4" />} onClick={() => setSuspend(true)}>{t('admin.suspend')}</Button>
            )}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-2 font-extrabold">{t('menu.audit')}</h2>
        {u.logs.length ? (
          <ul className="divide-y divide-line/70">
            {u.logs.map((l: any) => (
              <li key={l.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="font-semibold">{L('action', l.action)}</span>
                  {l.actor && l.actor.fullName !== u.fullName && <span className="block text-xs text-muted">{l.actor.fullName}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted">{relative(l.createdAt, locale)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t('common.empty')}</p>
        )}
      </Card>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={t('adm.editUser')}
        footer={
          <Button
            className="w-full"
            onClick={async () => {
              const body: any = { fullName: edit.fullName, email: edit.email || null, phone: edit.phone ? '+998' + edit.phone.replace(/\D/g, '') : null, locale: edit.locale };
              if (u.role === 'STUDENT') body.student = { grade: edit.grade || null, city: edit.city || null, goals: edit.goals || null };
              const r = await act(() => patch(`/admin/users/${u.id}`, body));
              if (r) setEdit(null);
            }}
          >
            {t('common.save')}
          </Button>
        }
      >
        {edit && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('auth.fullName')} className="sm:col-span-2"><Input value={edit.fullName} onChange={(e) => setEdit({ ...edit, fullName: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label={t('auth.phone')}>
              <div className="flex gap-2"><span className="grid h-11 w-16 shrink-0 place-items-center rounded-xl border border-line text-sm font-bold">+998</span><Input inputMode="tel" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></div>
            </Field>
            <Field label={t('common.language')}>
              <Select value={edit.locale} onChange={(e) => setEdit({ ...edit, locale: e.target.value })}>
                <option value="uz">O'zbekcha</option><option value="ru">Русский</option><option value="en">English</option>
              </Select>
            </Field>
            {u.role === 'STUDENT' && (
              <>
                <Field label={t('settings.grade')}><Input value={edit.grade} onChange={(e) => setEdit({ ...edit, grade: e.target.value })} /></Field>
                <Field label={t('teacher.city')}><Input value={edit.city} onChange={(e) => setEdit({ ...edit, city: e.target.value })} /></Field>
                <Field label={t('settings.goals')} className="sm:col-span-2"><Textarea value={edit.goals} onChange={(e) => setEdit({ ...edit, goals: e.target.value })} /></Field>
              </>
            )}
            <p className="text-xs text-muted sm:col-span-2">{t('adm.emailChangeNote')}</p>
          </div>
        )}
      </Modal>

      <ReasonModal open={suspend} title={t('admin.suspend')} danger onClose={() => setSuspend(false)} onSubmit={(reason) => act(() => patch(`/admin/users/${u.id}/status`, { status: 'SUSPENDED', reason: reason || undefined }))} />

      <Modal open={!!temp} onClose={() => setTemp(null)} title={t('adm.tempPassword')} size="sm">
        <p className="text-sm text-muted">{t('adm.tempPasswordText')}</p>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-3">
          <code className="flex-1 select-all text-lg font-extrabold tracking-wider text-brand-800">{temp}</code>
          <Button size="sm" variant="ghost" icon={<Copy className="h-4 w-4" />} onClick={() => temp && navigator.clipboard.writeText(temp).then(() => toast('success', t('parent.copied')))} aria-label={t('common.copy')} />
        </div>
      </Modal>
    </div>
  );
}
