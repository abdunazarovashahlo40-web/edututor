import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Fingerprint, KeyRound, LogOut, Monitor, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import { del, get, patch, post, upload } from '../../services/api';
import { useI18n, LOCALES, type Locale } from '../../i18n';
import { useAuth } from '../../store/auth';
import { InstallButton } from '../../layouts/PublicLayout';
import { isStandalone } from '../../hooks/useMedia';
import { Avatar, Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Textarea } from '../../components/ui';
import { SetupAppLock } from '../../features/applock/AppLock';
import { biometricAvailable, registerBiometric } from '../../features/applock/biometric';
import { useToast } from '../../hooks/useToast';
import { errorText, relative } from '../../utils/format';

export default function Settings() {
  const { t, locale, setLocale } = useI18n();
  const { me, refetch, logout } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ fullName: '', phone: '', grade: '', goals: '', city: '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [setup, setSetup] = useState(false);
  const [bioOk, setBioOk] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  useEffect(() => {
    if (me) setForm({ fullName: me.fullName, phone: me.phone?.replace('+998', '') ?? '', grade: me.studentProfile?.grade ?? '', goals: me.studentProfile?.goals ?? '', city: me.studentProfile?.city ?? '' });
  }, [me]);
  useEffect(() => void biometricAvailable().then(setBioOk), []);

  const sessions = useQuery({ queryKey: ['sessions'], queryFn: () => get<any[]>('/users/me/sessions') });
  const save = useMutation({
    mutationFn: () =>
      patch('/users/me', {
        fullName: form.fullName,
        phone: form.phone ? '+998' + form.phone.replace(/\D/g, '') : null,
        ...(me?.role === 'STUDENT' ? { student: { grade: form.grade || null, goals: form.goals || null, city: form.city || null } } : {}),
      }),
    onSuccess: () => (toast('success', t('common.saved')), refetch()),
    onError: (e) => toast('error', errorText(e, t)),
  });
  const changePw = useMutation({
    mutationFn: () => post('/auth/change-password', pw),
    onSuccess: () => (toast('success', t('common.saved')), setPw({ currentPassword: '', newPassword: '' })),
    onError: (e) => toast('error', errorText(e, t)),
  });

  const onAvatar = async (f?: File) => {
    if (!f) return;
    const fd = new FormData();
    fd.append('file', f);
    try {
      await upload('/users/me/avatar', fd);
      await refetch();
      toast('success', t('common.saved'));
    } catch (e) {
      toast('error', errorText(e, t));
    }
  };

  if (!me) return null;
  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader title={t('common.settings')} />

      <Card>
        <h2 className="mb-4 text-lg font-extrabold">{t('settings.account')}</h2>
        <div className="mb-5 flex items-center gap-4">
          <div className="relative">
            <Avatar name={me.fullName} src={me.avatarUrl} size={80} />
            <button onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-brand-700 text-white shadow-lg" aria-label={t('settings.avatar')}>
              <Camera className="h-4 w-4" />
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => onAvatar(e.target.files?.[0])} />
          </div>
          <div>
            <div className="font-extrabold">{me.fullName}</div>
            <div className="text-sm text-muted">{me.email}</div>
            <Badge tone="brand" className="mt-1">{t(`roles.${me.role}`)}</Badge>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('auth.fullName')}><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
          <Field label={t('auth.phone')}>
            <div className="flex gap-2"><span className="grid h-11 w-16 shrink-0 place-items-center rounded-xl border border-line text-sm font-bold">+998</span><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" /></div>
          </Field>
          <Field label={t('common.language')}>
            <Select value={locale} onChange={(e) => { setLocale(e.target.value as Locale); patch('/users/me', { locale: e.target.value }); }}>
              {LOCALES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </Select>
          </Field>
          {me.role === 'STUDENT' && (
            <>
              <Field label={t('settings.grade')}><Input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} /></Field>
              <Field label={t('teacher.city')}><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
              <Field label={t('settings.goals')} className="md:col-span-2"><Textarea value={form.goals} onChange={(e) => setForm({ ...form, goals: e.target.value })} /></Field>
            </>
          )}
        </div>
        <Button className="mt-4" loading={save.isPending} onClick={() => save.mutate()}>{t('common.save')}</Button>
      </Card>

      {/* Ilova qulfi */}
      <Card>
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700"><Smartphone className="h-5 w-5" /></span>
          <div className="flex-1">
            <h2 className="text-lg font-extrabold">{t('lock.section')}</h2>
            <p className="text-sm text-muted">{t('lock.sectionText')}</p>
          </div>
          <Badge tone={me.appLock.hasPin ? 'green' : 'gray'}>{me.appLock.hasPin ? t('lock.enabled') : t('lock.disabled')}</Badge>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant={me.appLock.hasPin ? 'outline' : 'primary'} icon={<KeyRound className="h-4 w-4" />} onClick={() => setSetup(true)}>
            {me.appLock.hasPin ? t('lock.change') : t('lock.setupTitle')}
          </Button>
          {me.appLock.hasPin && (bioOk ? (
            me.appLock.hasBiometric ? (
              <Button variant="secondary" icon={<Fingerprint className="h-4 w-4" />} onClick={async () => { await post('/auth/app-lock/biometric/remove'); await refetch(); }}>
                {t('lock.biometricOn')} ✓
              </Button>
            ) : (
              <Button variant="secondary" icon={<Fingerprint className="h-4 w-4" />} onClick={async () => { try { await registerBiometric(); await refetch(); toast('success', t('lock.biometricOn')); } catch (e) { toast('error', errorText(e, t)); } }}>
                {t('lock.enableBiometric')}
              </Button>
            )
          ) : (
            <span className="self-center text-xs text-muted">{t('lock.biometricUnavailable')}</span>
          ))}
          {me.appLock.hasPin && <Button variant="ghost" onClick={async () => { await post('/auth/app-lock/disable'); await refetch(); }}>{t('lock.disable')}</Button>}
        </div>
        {!isStandalone() && (
          <div className="mt-4 flex flex-col gap-2 rounded-xl bg-brand-50/70 px-3 py-2.5 text-xs font-semibold text-brand-800 sm:flex-row sm:items-center">
            <span className="flex-1">{t('lock.installHint')}</span>
            <InstallButton />
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-extrabold"><ShieldCheck className="h-5 w-5 text-brand-600" /> {t('settings.changePassword')}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('settings.current')}><Input type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} autoComplete="current-password" /></Field>
          <Field label={t('auth.newPassword')} hint={t('auth.passwordHint')}><Input type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} autoComplete="new-password" /></Field>
        </div>
        <Button className="mt-4" variant="outline" loading={changePw.isPending} disabled={!pw.currentPassword || pw.newPassword.length < 8} onClick={() => changePw.mutate()}>{t('common.save')}</Button>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-extrabold">{t('settings.sessions')}</h2>
        <div className="divide-y divide-line">
          {sessions.data?.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-3">
              <Monitor className="h-5 w-5 text-muted" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{s.userAgent ?? '—'}</div>
                <div className="text-xs text-muted">{s.ip} · {relative(s.lastActiveAt, locale)}</div>
              </div>
              {s.current ? <Badge tone="green">{t('settings.thisDevice')}</Badge> : (
                <Button size="sm" variant="ghost" icon={<LogOut className="h-4 w-4" />} onClick={async () => { await del(`/users/me/sessions/${s.id}`); qc.invalidateQueries({ queryKey: ['sessions'] }); }} aria-label={t('common.logout')} />
              )}
            </div>
          ))}
        </div>
      </Card>

      {me.role !== 'ADMIN' && (
        <Card className="border-red-100">
          <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDelOpen(true)}>{t('settings.deleteAccount')}</Button>
        </Card>
      )}

      {setup && <SetupAppLock onDone={() => setSetup(false)} onSkip={() => setSetup(false)} />}
      <Modal open={delOpen} onClose={() => setDelOpen(false)} title={t('settings.deleteAccount')} size="sm" footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDelOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="danger" onClick={async () => { await del('/users/me'); await logout(); nav('/'); }}>{t('common.delete')}</Button>
        </div>
      }>
        <p className="text-sm text-muted">{t('settings.deleteConfirm')}</p>
      </Modal>
    </div>
  );
}
