/** O'qituvchilar tekshiruvi: ro'yxat va admin ichidagi batafsil sahifa (ommaviy profilga chiqib ketmasdan) */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Check, ExternalLink, Eye, FileText, Search, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { get, post } from '../../services/api';
import { useI18n, subjectName } from '../../i18n';
import { Avatar, Badge, Button, Card, EmptyState, Field, Input, ListSkeleton, Modal, PageHeader, Skeleton, Stars, Tabs, Textarea, statusTone } from '../../components/ui';
import { date, money, relative } from '../../utils/format';
import { Filters, KV, ReasonModal, Row, useAct, useUrlFilters } from './shared';
import { cn } from '../../utils/cn';

const SOURCES: Record<string, { name: string; url: string }[]> = {
  diploma: [{ name: 'diplom.edu.uz', url: 'https://diplom.edu.uz' }],
  language: [{ name: 'my.uzbmb.uz', url: 'https://my.uzbmb.uz' }, { name: 'IELTS (ielts.org)', url: 'https://ielts.org/organisations/results-verification-service' }],
  certificate: [{ name: 'uzbmb.uz', url: 'https://uzbmb.uz' }],
  category: [{ name: 'my.gov.uz', url: 'https://my.gov.uz' }],
  other: [{ name: 'my.gov.uz', url: 'https://my.gov.uz' }],
};

const CHECK_TONE: Record<string, 'green' | 'red' | 'yellow' | 'gray'> = { verified: 'green', not_found: 'red', mismatch: 'red', unchecked: 'gray' };

export function AdminTeachers() {
  const { t, L, locale } = useI18n();
  const nav = useNavigate();
  const [f, set] = useUrlFilters({ v: 'PENDING', q: '' });
  const q = useQuery({ queryKey: ['admin', 'teachers', f], queryFn: () => get<any[]>('/admin/teachers', { verification: f.v === 'ALL' ? undefined : f.v, q: f.q || undefined, limit: 50 }) });
  return (
    <div>
      <PageHeader title={t('menu.verification')} />
      <Filters>
        <Tabs
          value={f.v}
          onChange={(v) => set({ v })}
          items={['PENDING', 'APPROVED', 'REJECTED', 'DRAFT', 'ALL'].map((x) => ({ value: x, label: x === 'ALL' ? t('common.all') : L('verification', x) }))}
        />
        <Input icon={<Search className="h-4 w-4" />} value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder={t('adm.searchUser')} className="sm:w-60" />
      </Filters>
      {q.isLoading ? (
        <ListSkeleton />
      ) : !q.data?.length ? (
        <EmptyState title={t('common.empty')} icon={<ShieldCheck className="h-7 w-7" />} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {q.data.map((tp) => {
            const docs = tp.certificates.length;
            const checked = tp.certificates.filter((c: any) => c.checkStatus === 'verified').length;
            return (
              <Row key={tp.id} onClick={() => nav(`/admin/teachers/${tp.id}`)}>
                <div className="flex items-start gap-3">
                  <Avatar name={tp.user.fullName} src={tp.user.avatarUrl} size={52} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <b className="truncate">{tp.user.fullName}</b>
                      <Badge tone={statusTone[tp.verification]}>{L('verification', tp.verification)}</Badge>
                    </div>
                    <p className="truncate text-sm font-semibold text-ink/80">{tp.headline ?? '—'}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {tp.subjects.slice(0, 3).map((s: any) => <Badge key={s.subjectId} tone="brand">{subjectName(s.subject, locale)}</Badge>)}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
                      <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {checked}/{docs} {t('adm.docsChecked')}</span>
                      <span>{tp.hasIdentity ? `🪪 ${t('adm.idGiven')}` : `🪪 ${t('adm.idMissing')}`}</span>
                      <span>{date(tp.updatedAt, locale)}</span>
                    </div>
                  </div>
                </div>
              </Row>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AdminTeacherDetail() {
  const { id = '' } = useParams();
  const { t, L, locale } = useI18n();
  const nav = useNavigate();
  const act = useAct();
  const q = useQuery({ queryKey: ['admin', 'teacher', id], queryFn: () => get<any>(`/admin/teachers/${id}`) });
  const [reject, setReject] = useState(false);
  const [check, setCheck] = useState<any>(null);
  const tp = q.data;
  if (!tp) return <Skeleton className="h-96" />;
  const DAYS = t('adm.weekdaysShort').split(',');
  const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  return (
    <div className="space-y-4">
      <button onClick={() => nav(-1)} className="flex items-center gap-1.5 text-sm font-bold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {t('common.back')}
      </button>

      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar name={tp.user.fullName} src={tp.user.avatarUrl} size={80} />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold">{tp.user.fullName}</h1>
          <p className="text-sm text-muted">{tp.headline}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone={statusTone[tp.verification]}>{L('verification', tp.verification)}</Badge>
            {Number(tp.ratingCount) > 0 && <span className="flex items-center gap-1 text-xs font-bold"><Stars value={Number(tp.ratingAvg)} size={12} /> {Number(tp.ratingAvg).toFixed(1)} ({tp.ratingCount})</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {tp.verification !== 'APPROVED' && <Button variant="success" icon={<Check className="h-4 w-4" />} onClick={() => act(() => post(`/admin/teachers/${tp.id}/verify`, { decision: 'APPROVED' }))}>{t('admin.approve')}</Button>}
          {tp.verification !== 'REJECTED' && <Button variant="danger" icon={<X className="h-4 w-4" />} onClick={() => setReject(true)}>{t('admin.rejectT')}</Button>}
          <Link to={`/admin/users/${tp.user.id}`}><Button variant="outline">{t('adm.userCard')}</Button></Link>
          <a href={`/teachers/${tp.id}`} target="_blank" rel="noreferrer"><Button variant="ghost" icon={<Eye className="h-4 w-4" />}>{t('adm.publicView')}</Button></a>
        </div>
      </Card>
      {tp.verificationNote && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{tp.verificationNote}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-extrabold">{t('adm.profileData')}</h2>
          <KV
            items={[
              ['Email', tp.user.email],
              [t('auth.phone'), tp.user.phone],
              [t('teacher.education'), tp.education],
              [t('teacher.experience'), `${tp.experienceYears} ${t('common.years')}`],
              [t('common.price'), money(tp.hourlyPrice, locale)],
              [t('adm.subjects'), tp.subjects.map((s: any) => subjectName(s.subject, locale)).join(', ')],
              [t('adm.languages'), (tp.languages ?? []).map((l: string) => l.toUpperCase()).join(' · ')],
              [t('adm.earned'), money(tp.earnings.gross, locale)],
              [t('adm.lastSeen'), tp.user.lastLoginAt ? relative(tp.user.lastLoginAt, locale) : '—'],
            ]}
          />
          {tp.bio && <p className="mt-3 whitespace-pre-line rounded-xl bg-surface p-3 text-sm text-ink/80">{tp.bio}</p>}
        </Card>

        <Card>
          <h2 className="mb-1 flex items-center gap-2 font-extrabold"><ShieldCheck className="h-5 w-5 text-brand-600" /> {t('adm.identity')}</h2>
          {tp.identityType ? (
            <p className="text-sm">{tp.identityType === 'pinfl' ? t('adm.pinfl') : t('adm.passport')}: <b>•••• {tp.identityLast4}</b></p>
          ) : (
            <p className="text-sm text-muted">{t('adm.idMissing')}</p>
          )}
          {tp.identityDuplicates?.length > 0 && (
            <p className="mt-2 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-danger">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t('adm.idDuplicate')}: {tp.identityDuplicates.map((d: any) => <Link key={d.id} to={`/admin/teachers/${d.id}`} className="underline">{d.user.fullName}</Link>)}</span>
            </p>
          )}
          <p className="mt-2 text-xs text-muted">{t('adm.idPrivacy')}</p>

          <h3 className="mb-2 mt-4 font-extrabold">{t('admin.docs')}</h3>
          {tp.certificates.length ? (
            <ul className="space-y-2">
              {tp.certificates.map((c: any) => (
                <li key={c.id} className="rounded-xl border border-line/70 p-3">
                  <div className="flex items-start gap-2">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
                        {c.title}
                        {c.isVerificationDoc && <Badge tone="yellow">ID</Badge>}
                        <Badge tone={CHECK_TONE[c.checkStatus] ?? 'gray'}>{t(`adm.check.${c.checkStatus}`)}</Badge>
                      </div>
                      <div className="text-xs text-muted">{[c.issuer, c.year, c.docNumber && `№ ${c.docNumber}`].filter(Boolean).join(' · ')}</div>
                      {c.checkNote && <div className="mt-1 text-xs text-ink/70">{c.checkSource ? `${c.checkSource}: ` : ''}{c.checkNote}</div>}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.fileUrl && <a href={c.fileUrl} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost" icon={<Eye className="h-4 w-4" />}>{t('common.open')}</Button></a>}
                    {(SOURCES[c.docType ?? 'other'] ?? SOURCES.other).map((s) => (
                      <a key={s.url} href={s.url} target="_blank" rel="noreferrer"><Button size="sm" variant="outline" icon={<ExternalLink className="h-3.5 w-3.5" />}>{s.name}</Button></a>
                    ))}
                    <Button size="sm" onClick={() => setCheck({ id: c.id, status: c.checkStatus === 'unchecked' ? 'verified' : c.checkStatus, source: c.checkSource ?? (SOURCES[c.docType ?? 'other'] ?? SOURCES.other)[0].name, note: c.checkNote ?? '' })}>{t('adm.markCheck')}</Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">—</p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-extrabold">{t('menu.adminLessons')}</h2>
          {tp.lessons.length ? (
            <ul className="divide-y divide-line/70">
              {tp.lessons.map((l: any) => (
                <li key={l.id}>
                  <Link to={`/admin/lessons?open=${l.id}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-brand-700">
                    <span className="min-w-0 truncate font-semibold">{l.title}</span>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs"><b>{money(l.price, locale)}</b><Badge tone={statusTone[l.status]}>{t(`lesson.statuses.${l.status}`)}</Badge></span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">—</p>}
        </Card>
        <Card>
          <h2 className="mb-2 font-extrabold">{t('adm.schedule')}</h2>
          {tp.availability.length ? (
            <div className="flex flex-wrap gap-1.5">
              {tp.availability.map((a: any) => <span key={a.id} className="rounded-lg bg-surface px-2 py-1 text-xs font-semibold">{DAYS[a.weekday]} {hm(a.startMinute)}–{hm(a.endMinute)}</span>)}
            </div>
          ) : <p className="text-sm text-muted">—</p>}
          {tp.reviews.length > 0 && (
            <>
              <h3 className="mb-1 mt-4 text-sm font-extrabold">{t('menu.reviews')}</h3>
              <ul className="space-y-2">
                {tp.reviews.map((r: any) => (
                  <li key={r.id} className="rounded-xl bg-surface p-2.5 text-sm"><Stars value={r.rating} size={11} /> <span className="text-xs text-muted">{r.student.fullName}</span><p className="mt-1 text-ink/80">{r.comment}</p></li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <ReasonModal open={reject} required danger title={t('admin.rejectT')} onClose={() => setReject(false)} onSubmit={(note) => act(() => post(`/admin/teachers/${tp.id}/verify`, { decision: 'REJECTED', note }))} />

      <Modal
        open={!!check}
        onClose={() => setCheck(null)}
        title={t('adm.markCheck')}
        size="sm"
        footer={<Button className="w-full" onClick={async () => { const r = await act(() => post(`/admin/certificates/${check.id}/check`, { status: check.status, source: check.source || undefined, note: check.note || undefined })); if (r) setCheck(null); }}>{t('common.save')}</Button>}
      >
        {check && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {['verified', 'not_found', 'mismatch', 'unchecked'].map((s) => (
                <button key={s} onClick={() => setCheck({ ...check, status: s })} className={cn('rounded-xl border px-3 py-2.5 text-sm font-bold', check.status === s ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-line')}>
                  {t(`adm.check.${s}`)}
                </button>
              ))}
            </div>
            <Field label={t('adm.checkSource')}><Input value={check.source} onChange={(e) => setCheck({ ...check, source: e.target.value })} /></Field>
            <Field label={t('common.note')}><Textarea value={check.note} onChange={(e) => setCheck({ ...check, note: e.target.value })} rows={2} /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

