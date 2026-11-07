/**
 * O'qituvchi hujjatlarini rasmiy bazadan qidirish.
 * JSHSHIR va pasport — ikkalasi ham ixtiyoriy; faqat to'ldirilgani tekshiriladi.
 * Topilsa — "Yuklab olinsinmi?" deb so'raladi va hujjat "tasdiqlangan" belgisi bilan profilga qo'shiladi.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ExternalLink, FileSearch, IdCard, Search, ShieldCheck } from 'lucide-react';
import { post } from '../../services/api';
import { useI18n } from '../../i18n';
import { Badge, Button, Card, Field, Input, Modal, Select } from '../../components/ui';
import { useToast } from '../../hooks/useToast';
import { errorText } from '../../utils/format';

type Found = { title: string; issuer?: string; year?: number; number?: string; source: string; token: string };
type Result = { configured: boolean; found: Found[]; sources: { name: string; url: string }[] };

export function DocVerify({ identityType, identityLast4 }: { identityType?: string | null; identityLast4?: string | null }) {
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const [f, setF] = useState({ pinfl: '', passport: '', docType: 'diploma', docNumber: '' });
  const [busy, setBusy] = useState('');
  const [res, setRes] = useState<Result | null>(null);
  const [confirm, setConfirm] = useState<Found | null>(null);

  const pinflOk = !f.pinfl || /^\d{14}$/.test(f.pinfl);
  const passOk = !f.passport || /^[A-Z]{2}\d{7}$/.test(f.passport);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      return await fn();
    } catch (e) {
      toast('error', errorText(e, t));
    } finally {
      setBusy('');
    }
  };

  const saveIdentity = () =>
    run('id', async () => {
      await post('/teachers/me/identity', { pinfl: f.pinfl || undefined, passport: f.passport || undefined });
      toast('success', t('common.saved'));
      qc.invalidateQueries({ queryKey: ['teacher-profile'] });
    });

  const search = () =>
    run('search', async () => {
      const r = await post<Result>('/teachers/me/documents/lookup', { docType: f.docType, docNumber: f.docNumber || undefined, pinfl: f.pinfl || undefined, passport: f.passport || undefined });
      setRes(r);
      if (r.found.length === 1) setConfirm(r.found[0]);
    });

  const importDoc = (d: Found) =>
    run('import', async () => {
      await post('/teachers/me/documents/import', { token: d.token });
      toast('success', t('doc.imported'));
      setConfirm(null);
      setRes(null);
      qc.invalidateQueries({ queryKey: ['teacher-profile'] });
    });

  return (
    <Card>
      <h2 className="flex items-center gap-2 text-lg font-extrabold"><ShieldCheck className="h-5 w-5 text-brand-600" /> {t('doc.title')}</h2>
      <p className="mb-4 text-sm text-muted">{t('doc.subtitle')}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={`${t('doc.pinfl')} (${t('common.optional')})`} error={!pinflOk ? t('errors.PINFL_INVALID') : undefined} hint={t('doc.pinflHint')}>
          <Input inputMode="numeric" maxLength={14} value={f.pinfl} onChange={(e) => setF({ ...f, pinfl: e.target.value.replace(/\D/g, '') })} placeholder="12345678901234" icon={<IdCard className="h-4 w-4" />} />
        </Field>
        <Field label={`${t('doc.passport')} (${t('common.optional')})`} error={!passOk ? t('errors.PASSPORT_INVALID') : undefined}>
          <Input maxLength={9} value={f.passport} onChange={(e) => setF({ ...f, passport: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} placeholder="AA1234567" />
        </Field>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" loading={busy === 'id'} disabled={!pinflOk || !passOk || (!f.pinfl && !f.passport)} onClick={saveIdentity}>{t('doc.saveId')}</Button>
        {identityType && <Badge tone="green">✓ {identityType === 'pinfl' ? t('doc.pinfl') : t('doc.passport')} •••• {identityLast4}</Badge>}
      </div>
      <p className="mt-1.5 text-xs text-muted">{t('doc.privacy')}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
        <Field label={t('doc.type')}>
          <Select value={f.docType} onChange={(e) => setF({ ...f, docType: e.target.value })}>
            {['diploma', 'language', 'certificate', 'category', 'other'].map((k) => <option key={k} value={k}>{t(`doc.types.${k}`)}</option>)}
          </Select>
        </Field>
        <Field label={`${t('doc.number')} (${t('common.optional')})`}>
          <Input value={f.docNumber} onChange={(e) => setF({ ...f, docNumber: e.target.value })} placeholder="B 1234567" />
        </Field>
        <Button icon={<Search className="h-4 w-4" />} loading={busy === 'search'} disabled={!pinflOk || !passOk || (!f.docNumber && !f.pinfl && !f.passport)} onClick={search}>
          {t('common.search')}
        </Button>
      </div>

      {res && (
        <div className="mt-4 rounded-2xl border border-line/70 bg-surface p-4">
          {res.found.length > 0 ? (
            <ul className="space-y-2">
              {res.found.map((d) => (
                <li key={d.token} className="flex items-center gap-3 rounded-xl bg-white p-3">
                  <FileSearch className="h-5 w-5 shrink-0 text-emerald-600" />
                  <div className="min-w-0 flex-1 text-sm">
                    <b className="block truncate">{d.title}</b>
                    <span className="text-xs text-muted">{[d.issuer, d.year, d.number].filter(Boolean).join(' · ')}</span>
                  </div>
                  <Button size="sm" onClick={() => setConfirm(d)}>{t('doc.add')}</Button>
                </li>
              ))}
            </ul>
          ) : (
            <>
              <p className="text-sm font-semibold">{res.configured ? t('doc.notFound') : t('doc.notConnected')}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {res.sources.map((s) => (
                  <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline" icon={<ExternalLink className="h-3.5 w-3.5" />}>{s.name}</Button>
                  </a>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">{t('doc.uploadInstead')}</p>
            </>
          )}
        </div>
      )}

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={t('doc.foundTitle')}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(null)}>{t('common.no')}</Button>
            <Button loading={busy === 'import'} onClick={() => confirm && importDoc(confirm)}>{t('doc.yesAdd')}</Button>
          </div>
        }
      >
        {confirm && (
          <div className="rounded-xl bg-emerald-50 p-3 text-sm">
            <b>{confirm.title}</b>
            <div className="text-xs text-muted">{[confirm.issuer, confirm.year, confirm.number].filter(Boolean).join(' · ')}</div>
            <p className="mt-2 text-xs">{t('doc.foundText', { source: confirm.source })}</p>
          </div>
        )}
      </Modal>
    </Card>
  );
}
