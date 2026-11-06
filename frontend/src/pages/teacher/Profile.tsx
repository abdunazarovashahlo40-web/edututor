import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, FileCheck2, Send, Trash2, Upload, ExternalLink } from 'lucide-react';
import { del, get, patch, post, put, upload, ApiError } from '../../services/api';
import { useI18n, subjectName } from '../../i18n';
import { useAuth } from '../../store/auth';
import { Avatar, Badge, Button, Card, Checkbox, Field, FullPageSpinner, Input, PageHeader, Textarea, statusTone } from '../../components/ui';
import { VerificationBanner } from '../../components/VerificationBanner';
import { errorText } from '../../utils/format';
import { useToast } from '../../hooks/useToast';
import { cn } from '../../utils/cn';
import type { Subject } from '../../types';

export default function TeacherProfileEdit() {
  const { t, locale } = useI18n();
  const { refetch } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const avatarRef = useRef<HTMLInputElement>(null);
  const q = useQuery({ queryKey: ['teacher-profile'], queryFn: () => get<any>('/teachers/me/profile') });
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: () => get<Subject[]>('/subjects'), staleTime: 300_000 });
  const [f, setF] = useState<any>(null);
  const [subs, setSubs] = useState<string[]>([]);
  const [cert, setCert] = useState<{ title: string; issuer: string; year: string; isVerificationDoc: boolean; file?: File }>({ title: '', issuer: '', year: '', isVerificationDoc: true });
  const [missing, setMissing] = useState<string[]>([]);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (!q.data) return;
    const p = q.data;
    setF({ headline: p.headline ?? '', bio: p.bio ?? '', education: p.education ?? '', experienceYears: p.experienceYears, hourlyPrice: Number(p.hourlyPrice), trialPrice: p.trialPrice ? Number(p.trialPrice) : '', languages: p.languages, onlineFormat: p.onlineFormat, offlineFormat: p.offlineFormat, city: p.city ?? '', videoIntroUrl: p.videoIntroUrl ?? '', payoutCard: '' });
    setSubs(p.subjects.map((s: any) => s.subjectId));
  }, [q.data]);

  const reload = async () => {
    await qc.invalidateQueries({ queryKey: ['teacher-profile'] });
    await refetch();
  };
  const run = async (key: string, fn: () => Promise<unknown>, okMsg = t('common.saved')) => {
    setBusy(key);
    try {
      await fn();
      toast('success', okMsg);
      await reload();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'PROFILE_INCOMPLETE') setMissing(e.details?.missing ?? []);
      toast('error', errorText(e, t));
    } finally {
      setBusy('');
    }
  };

  if (q.isLoading || !f) return <FullPageSpinner />;
  const p = q.data;
  const fieldNames: Record<string, string> = { bio: t('teacher.bio'), education: t('teacher.education'), hourlyPrice: t('teacher.hourly'), subjects: t('teacher.mySubjects'), verificationDoc: t('teacher.verificationDoc'), avatar: t('teacher.avatar') };

  return (
    <div className="max-w-4xl space-y-5">
      <VerificationBanner />
      <PageHeader title={t('menu.profile')} actions={
        <>
          <a href={`/teachers/${p.id}`} target="_blank" rel="noreferrer"><Button variant="outline" icon={<ExternalLink className="h-4 w-4" />}>{t('common.view')}</Button></a>
          {p.verification !== 'APPROVED' && p.verification !== 'PENDING' && (
            <Button icon={<Send className="h-4 w-4" />} loading={busy === 'verify'} onClick={() => run('verify', () => post('/teachers/me/submit-verification'), t('common.done'))}>{t('teacher.submitVerify')}</Button>
          )}
        </>} />
      {missing.length > 0 && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{t('teacher.missing', { fields: missing.map((m) => fieldNames[m] ?? m).join(', ') })}</p>}

      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <Avatar name={p.user.fullName} src={p.user.avatarUrl} size={96} />
            <button onClick={() => avatarRef.current?.click()} className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full bg-brand-700 text-white shadow-lg" aria-label={t('teacher.changeAvatar')}><Camera className="h-4 w-4" /></button>
            <input ref={avatarRef} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const fd = new FormData();
              fd.append('file', file);
              void run('avatar', () => upload('/users/me/avatar', fd));
            }} />
          </div>
          <div>
            <p className="text-xl font-extrabold">{p.user.fullName}</p>
            <p className="text-sm text-muted">{p.user.email}</p>
            <Badge tone={statusTone[p.verification]} className="mt-1">{p.verification}</Badge>
          </div>
        </div>
      </Card>

      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('teacher.headline')} className="md:col-span-2"><Input value={f.headline} onChange={(e) => setF({ ...f, headline: e.target.value })} maxLength={120} /></Field>
          <Field label={t('teacher.bio')} hint={`${f.bio.length}/3000 · min 50`} className="md:col-span-2"><Textarea value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} className="min-h-[140px]" /></Field>
          <Field label={t('teacher.education')} className="md:col-span-2"><Input value={f.education} onChange={(e) => setF({ ...f, education: e.target.value })} /></Field>
          <Field label={t('teacher.experience')}><Input type="number" min={0} value={f.experienceYears} onChange={(e) => setF({ ...f, experienceYears: Number(e.target.value) })} /></Field>
          <Field label={t('teacher.city')}><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
          <Field label={t('teacher.hourly')}><Input type="number" step={5000} value={f.hourlyPrice} onChange={(e) => setF({ ...f, hourlyPrice: Number(e.target.value) })} /></Field>
          <Field label={t('teacher.trial')}><Input type="number" step={5000} value={f.trialPrice} onChange={(e) => setF({ ...f, trialPrice: e.target.value })} /></Field>
          <div>
            <p className="mb-1.5 text-[13px] font-bold">{t('teacher.languages')}</p>
            <div className="flex gap-2">
              {['uz', 'ru', 'en'].map((l) => (
                <button key={l} type="button" onClick={() => setF({ ...f, languages: f.languages.includes(l) ? f.languages.filter((x: string) => x !== l) : [...f.languages, l] })} className={cn('h-10 rounded-xl border-2 px-4 text-sm font-bold', f.languages.includes(l) ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-line')}>{l.toUpperCase()}</button>
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-end gap-2">
            <Checkbox label={t('teacher.online')} checked={f.onlineFormat} onChange={(e) => setF({ ...f, onlineFormat: e.target.checked })} />
            <Checkbox label={t('teacher.offline')} checked={f.offlineFormat} onChange={(e) => setF({ ...f, offlineFormat: e.target.checked })} />
          </div>
          <Field label={t('teacher.video')}><Input value={f.videoIntroUrl} onChange={(e) => setF({ ...f, videoIntroUrl: e.target.value })} placeholder="https://youtu.be/..." /></Field>
          <Field label={t('teacher.payoutCard')} hint={p.payoutCard ?? undefined}><Input inputMode="numeric" maxLength={16} value={f.payoutCard} onChange={(e) => setF({ ...f, payoutCard: e.target.value.replace(/\D/g, '') })} placeholder="8600 •••• •••• ••••" /></Field>
        </div>
        <Button className="mt-5" loading={busy === 'profile'} onClick={() => run('profile', () => patch('/teachers/me/profile', {
          ...f,
          trialPrice: f.trialPrice === '' ? null : Number(f.trialPrice),
          headline: f.headline || null, city: f.city || null, videoIntroUrl: f.videoIntroUrl || null,
          payoutCard: f.payoutCard ? f.payoutCard : undefined,
        }))}>{t('common.save')}</Button>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-extrabold">{t('teacher.mySubjects')}</h2>
        <div className="flex flex-wrap gap-2">
          {subjects.data?.map((s) => {
            const on = subs.includes(s.id);
            return <button key={s.id} onClick={() => setSubs(on ? subs.filter((x) => x !== s.id) : subs.length < 8 ? [...subs, s.id] : subs)} className={cn('rounded-full border-2 px-3.5 py-1.5 text-sm font-bold transition', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-line hover:border-brand-300')}>{subjectName(s, locale)}</button>;
          })}
        </div>
        <Button className="mt-4" variant="secondary" disabled={!subs.length} loading={busy === 'subjects'} onClick={() => run('subjects', () => put('/teachers/me/subjects', { subjects: subs.map((subjectId) => ({ subjectId })) }))}>{t('common.save')}</Button>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-extrabold">{t('teacher.certificates')}</h2>
        <div className="mb-4 space-y-2">
          {p.certificates.map((c: any) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl bg-surface p-3">
              <FileCheck2 className="h-5 w-5 text-brand-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{c.title}</p>
                <p className="text-xs text-muted">{[c.issuer, c.year].filter(Boolean).join(' · ')} {c.isVerificationDoc && <Badge tone="yellow" className="ml-1">{t('teacher.verificationDoc')}</Badge>}</p>
              </div>
              {c.fileUrl && <a href={c.fileUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-brand-700">{t('common.view')}</a>}
              <button onClick={() => run('cert-del', () => del(`/teachers/me/certificates/${c.id}`))} className="grid h-8 w-8 place-items-center rounded-lg text-danger hover:bg-red-50" aria-label={t('common.delete')}><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
        <div className="grid gap-3 rounded-2xl border border-dashed border-brand-200 p-4 md:grid-cols-2">
          <Field label={t('teacher.certTitle')}><Input value={cert.title} onChange={(e) => setCert({ ...cert, title: e.target.value })} /></Field>
          <Field label={t('teacher.issuer')}><Input value={cert.issuer} onChange={(e) => setCert({ ...cert, issuer: e.target.value })} /></Field>
          <Field label={t('teacher.year')}><Input type="number" value={cert.year} onChange={(e) => setCert({ ...cert, year: e.target.value })} /></Field>
          <Field label={t('common.file')} hint="PDF, JPG, PNG · ≤10MB"><Input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => setCert({ ...cert, file: e.target.files?.[0] })} className="py-2" /></Field>
          <Checkbox label={t('teacher.verificationDoc')} checked={cert.isVerificationDoc} onChange={(e) => setCert({ ...cert, isVerificationDoc: e.target.checked })} />
          <Button variant="secondary" icon={<Upload className="h-4 w-4" />} disabled={cert.title.length < 2} loading={busy === 'cert'} onClick={() => run('cert', async () => {
            const fd = new FormData();
            fd.append('title', cert.title);
            if (cert.issuer) fd.append('issuer', cert.issuer);
            if (cert.year) fd.append('year', cert.year);
            fd.append('isVerificationDoc', String(cert.isVerificationDoc));
            if (cert.file) fd.append('file', cert.file);
            await upload('/teachers/me/certificates', fd);
            setCert({ title: '', issuer: '', year: '', isVerificationDoc: false });
          })}>{t('teacher.addCert')}</Button>
        </div>
      </Card>
    </div>
  );
}
