/**
 * Sozlamalar — har bir mavzu alohida bo'limda (bir-biriga aralashmaydi):
 *  Profil · Xavfsizlik · Ilova qulfi · Bildirishnomalar · Til · Maxfiylik
 * Bo'lim URL'da saqlanadi (?tab=security) — profil menyusidan to'g'ridan-to'g'ri ochiladi.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, ChevronRight, Fingerprint, KeyRound, LogOut, Monitor, Smartphone, Trash2, Download } from 'lucide-react';
import { del, get, patch, post, upload } from '../../services/api';
import { useI18n, LOCALES, type Locale } from '../../i18n';
import { useAuth } from '../../store/auth';
import { InstallButton } from '../../layouts/PublicLayout';
import { isStandalone, useIsMobile } from '../../hooks/useMedia';
import { Avatar, Badge, Button, Card, Field, Input, Modal, PageHeader, Textarea } from '../../components/ui';
import { SetupAppLock } from '../../features/applock/AppLock';
import { biometricAvailable, registerBiometric } from '../../features/applock/biometric';
import { useToast } from '../../hooks/useToast';
import { errorText, relative } from '../../utils/format';
import { cn } from '../../utils/cn';
import { SETTINGS_TABS, TAB_ICONS, type SettingsTab } from './settingsTabs';

type Tab = SettingsTab;

export default function Settings() {
  const { t } = useI18n();
  const mobile = useIsMobile();
  const [sp, setSp] = useSearchParams();
  const raw = sp.get('tab') as Tab | null;
  const tab: Tab | null = raw && SETTINGS_TABS.includes(raw) ? raw : mobile ? null : 'profile';
  const go = (v: Tab | null) => setSp(v ? { tab: v } : {}, { replace: !mobile });

  // Telefonda: avval bo'limlar ro'yxati, keyin tanlangan bo'lim (orqaga — ro'yxatga)
  if (mobile && !tab) {
    return (
      <div>
        <PageHeader title={t('common.settings')} />
        <Card className="divide-y divide-line/70 p-0">
          {SETTINGS_TABS.map((k) => {
            const I = TAB_ICONS[k];
            return (
              <button key={k} onClick={() => go(k)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700"><I className="h-4 w-4" /></span>
                <span className="flex-1">
                  <span className="block text-sm font-bold">{t(`set.${k}`)}</span>
                  <span className="block text-xs text-muted">{t(`set.${k}Hint`)}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </button>
            );
          })}
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <PageHeader title={t('common.settings')} />
      <div className="grid gap-5 md:grid-cols-[220px_1fr]">
        {!mobile && (
          <nav className="space-y-1 self-start md:sticky md:top-24">
            {SETTINGS_TABS.map((k) => {
              const I = TAB_ICONS[k];
              return (
                <button key={k} onClick={() => go(k)} className={cn('flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition', tab === k ? 'bg-brand-600 text-white' : 'text-ink/70 hover:bg-brand-50')}>
                  <I className="h-4 w-4" /> {t(`set.${k}`)}
                </button>
              );
            })}
          </nav>
        )}
        <div className="min-w-0 space-y-4">
          {mobile && (
            <button onClick={() => go(null)} className="-mt-2 mb-1 text-sm font-bold text-brand-700">← {t('common.settings')}</button>
          )}
          {tab === 'profile' && <ProfileSection />}
          {tab === 'security' && <SecuritySection />}
          {tab === 'applock' && <AppLockSection />}
          {tab === 'notifications' && <NotificationsSection />}
          {tab === 'language' && <LanguageSection />}
          {tab === 'privacy' && <PrivacySection />}
        </div>
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card>
      <h2 className="text-lg font-extrabold">{title}</h2>
      {hint && <p className="mb-4 text-sm text-muted">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </Card>
  );
}

/* ---------------- Profil ---------------- */
function ProfileSection() {
  const { t } = useI18n();
  const { me, refetch } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ fullName: '', phone: '', grade: '', goals: '', city: '' });
  useEffect(() => {
    if (me) setForm({ fullName: me.fullName, phone: me.phone?.replace('+998', '') ?? '', grade: me.studentProfile?.grade ?? '', goals: me.studentProfile?.goals ?? '', city: me.studentProfile?.city ?? '' });
  }, [me]);
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
    <Section title={t('set.profile')} hint={t('set.profileHint')}>
      <div className="mb-5 flex items-center gap-4">
        <div className="relative">
          <Avatar name={me.fullName} src={me.avatarUrl} size={80} />
          <button onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-brand-700 text-white shadow-lg" aria-label={t('settings.avatar')}>
            <Camera className="h-4 w-4" />
          </button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => onAvatar(e.target.files?.[0])} />
        </div>
        <div className="min-w-0">
          <div className="truncate font-extrabold">{me.fullName}</div>
          <div className="truncate text-sm text-muted">{me.email}</div>
          <Badge tone="brand" className="mt-1">{t(`roles.${me.role}`)}</Badge>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t('auth.fullName')}><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
        <Field label={t('auth.phone')}>
          <div className="flex gap-2"><span className="grid h-11 w-16 shrink-0 place-items-center rounded-xl border border-line text-sm font-bold">+998</span><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" /></div>
        </Field>
        <Field label="Email" hint={t('set.emailHint')}><Input value={me.email ?? ''} disabled /></Field>
        {me.role === 'STUDENT' && (
          <>
            <Field label={t('settings.grade')}><Input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} /></Field>
            <Field label={t('teacher.city')}><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
            <Field label={t('settings.goals')} className="md:col-span-2"><Textarea value={form.goals} onChange={(e) => setForm({ ...form, goals: e.target.value })} /></Field>
          </>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button loading={save.isPending} onClick={() => save.mutate()}>{t('common.save')}</Button>
        {me.role === 'TEACHER' && <Button variant="outline" onClick={() => nav('/teacher/profile')}>{t('set.teacherPublicProfile')}</Button>}
      </div>
    </Section>
  );
}

/* ---------------- Xavfsizlik: parol va qurilmalar ---------------- */
function SecuritySection() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', repeat: '' });
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: () => get<any[]>('/users/me/sessions') });
  const changePw = useMutation({
    mutationFn: () => post('/auth/change-password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword }),
    onSuccess: () => (toast('success', t('set.passwordChanged')), setPw({ currentPassword: '', newPassword: '', repeat: '' }), qc.invalidateQueries({ queryKey: ['sessions'] })),
    onError: (e) => toast('error', errorText(e, t)),
  });
  const others = sessions.data?.filter((s) => !s.current) ?? [];
  return (
    <>
      <Section title={t('settings.changePassword')} hint={t('set.passwordHint')}>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={t('settings.current')}><Input type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} autoComplete="current-password" /></Field>
          <Field label={t('auth.newPassword')} hint={t('auth.passwordHint')}><Input type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} autoComplete="new-password" /></Field>
          <Field label={t('set.repeatPassword')} error={pw.repeat && pw.repeat !== pw.newPassword ? t('set.passwordsDiffer') : undefined}><Input type="password" value={pw.repeat} onChange={(e) => setPw({ ...pw, repeat: e.target.value })} autoComplete="new-password" /></Field>
        </div>
        <Button className="mt-4" loading={changePw.isPending} disabled={!pw.currentPassword || pw.newPassword.length < 8 || pw.newPassword !== pw.repeat} onClick={() => changePw.mutate()}>{t('common.save')}</Button>
      </Section>
      <Section title={t('settings.sessions')} hint={t('set.sessionsHint')}>
        <div className="divide-y divide-line">
          {sessions.data?.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-3">
              <Monitor className="h-5 w-5 shrink-0 text-muted" />
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
        {others.length > 1 && (
          <Button className="mt-3" variant="outline" icon={<LogOut className="h-4 w-4" />} onClick={async () => { await Promise.all(others.map((s) => del(`/users/me/sessions/${s.id}`))); qc.invalidateQueries({ queryKey: ['sessions'] }); toast('success', t('common.done')); }}>
            {t('set.signOutOthers')}
          </Button>
        )}
      </Section>
    </>
  );
}

/* ---------------- Ilova qulfi ---------------- */
function AppLockSection() {
  const { t } = useI18n();
  const { me, refetch } = useAuth();
  const toast = useToast();
  const [setup, setSetup] = useState(false);
  const [bioOk, setBioOk] = useState(false);
  useEffect(() => void biometricAvailable().then(setBioOk), []);
  if (!me) return null;
  return (
    <Section title={t('lock.section')} hint={t('lock.sectionText')}>
      <div className="flex items-center gap-2">
        <Smartphone className="h-5 w-5 text-brand-600" />
        <Badge tone={me.appLock.hasPin ? 'green' : 'gray'}>{me.appLock.hasPin ? t('lock.enabled') : t('lock.disabled')}</Badge>
        {me.appLock.hasBiometric && <Badge tone="brand"><Fingerprint className="mr-1 inline h-3 w-3" />{t('lock.biometricOn')}</Badge>}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant={me.appLock.hasPin ? 'outline' : 'primary'} icon={<KeyRound className="h-4 w-4" />} onClick={() => setSetup(true)}>
          {me.appLock.hasPin ? t('lock.change') : t('lock.setupTitle')}
        </Button>
        {me.appLock.hasPin &&
          (bioOk ? (
            me.appLock.hasBiometric ? (
              <Button variant="ghost" icon={<Fingerprint className="h-4 w-4" />} onClick={async () => { await post('/auth/app-lock/biometric/remove'); await refetch(); }}>{t('set.biometricOff')}</Button>
            ) : (
              <Button variant="secondary" icon={<Fingerprint className="h-4 w-4" />} onClick={async () => { try { await registerBiometric(); await refetch(); toast('success', t('lock.biometricOn')); } catch (e) { toast('error', errorText(e, t)); } }}>{t('lock.enableBiometric')}</Button>
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
      <p className="mt-3 text-xs text-muted">{t('set.forgotPinHint')}</p>
      {setup && <SetupAppLock onDone={() => setSetup(false)} onSkip={() => setSetup(false)} />}
    </Section>
  );
}

/* ---------------- Bildirishnomalar ---------------- */
function NotificationsSection() {
  const { t } = useI18n();
  const { me, refetch } = useAuth();
  const toast = useToast();
  const prefs = { email: true, reminders: true, messages: true, ...(me?.notifyPrefs ?? {}) };
  const toggle = async (k: 'email' | 'reminders' | 'messages') => {
    try {
      await patch('/users/me', { notifyPrefs: { ...prefs, [k]: !prefs[k] } });
      await refetch();
    } catch (e) {
      toast('error', errorText(e, t));
    }
  };
  const items: { k: 'email' | 'reminders' | 'messages'; title: string; hint: string }[] = [
    { k: 'reminders', title: t('set.nReminders'), hint: t('set.nRemindersHint') },
    { k: 'messages', title: t('set.nMessages'), hint: t('set.nMessagesHint') },
    { k: 'email', title: t('set.nEmail'), hint: t('set.nEmailHint') },
  ];
  return (
    <Section title={t('set.notifications')} hint={t('set.notificationsHint')}>
      <div className="divide-y divide-line/70">
        {items.map((i) => (
          <label key={i.k} className="flex cursor-pointer items-center gap-3 py-3">
            <span className="flex-1">
              <span className="block text-sm font-bold">{i.title}</span>
              <span className="block text-xs text-muted">{i.hint}</span>
            </span>
            <button type="button" role="switch" aria-checked={prefs[i.k]} onClick={() => toggle(i.k)} className={cn('relative h-7 w-12 shrink-0 rounded-full transition', prefs[i.k] ? 'bg-brand-600' : 'bg-slate-300')}>
              <span className={cn('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all', prefs[i.k] ? 'left-6' : 'left-1')} />
            </button>
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">{t('set.nAlwaysHint')}</p>
    </Section>
  );
}

/* ---------------- Til ---------------- */
function LanguageSection() {
  const { t, locale, setLocale } = useI18n();
  return (
    <Section title={t('set.language')} hint={t('set.languageHint')}>
      <div className="grid gap-2 sm:grid-cols-3">
        {LOCALES.map((l) => (
          <button
            key={l.code}
            onClick={() => {
              setLocale(l.code as Locale);
              void patch('/users/me', { locale: l.code });
            }}
            className={cn('flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition', locale === l.code ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200' : 'border-line hover:border-brand-200')}
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-xs font-extrabold shadow-soft">{l.flag}</span>
            <span className="font-bold">{l.label}</span>
          </button>
        ))}
      </div>
    </Section>
  );
}

/* ---------------- Maxfiylik ---------------- */
function PrivacySection() {
  const { t } = useI18n();
  const { me, logout } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [delOpen, setDelOpen] = useState(false);
  if (!me) return null;
  // Shaxsiy ma'lumotlar nusxasi — foydalanuvchi o'z ma'lumotini yuklab olishi mumkin
  const exportData = async () => {
    try {
      const [profile, sessions] = await Promise.all([get('/auth/me'), get('/users/me/sessions')]);
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), profile, sessions }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'edututor-mening-malumotlarim.json';
      a.click();
    } catch (e) {
      toast('error', errorText(e, t));
    }
  };
  return (
    <>
      <Section title={t('set.privacy')} hint={t('set.privacyHint')}>
        <Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={exportData}>{t('set.exportData')}</Button>
      </Section>
      {me.role !== 'ADMIN' && (
        <Card className="border-red-100">
          <h2 className="text-lg font-extrabold text-danger">{t('settings.deleteAccount')}</h2>
          <p className="mb-4 text-sm text-muted">{t('set.deleteHint')}</p>
          <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDelOpen(true)}>{t('settings.deleteAccount')}</Button>
        </Card>
      )}
      <Modal open={delOpen} onClose={() => setDelOpen(false)} title={t('settings.deleteAccount')} size="sm" footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDelOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="danger" onClick={async () => { await del('/users/me'); await logout(); nav('/'); }}>{t('common.delete')}</Button>
        </div>
      }>
        <p className="text-sm text-muted">{t('settings.deleteConfirm')}</p>
      </Modal>
    </>
  );
}
