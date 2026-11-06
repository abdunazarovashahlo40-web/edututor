import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Link2, Send, Trash2, Users } from 'lucide-react';
import { del, get, post } from '../../services/api';
import { useI18n } from '../../i18n';
import { Button, Card } from '../../components/ui';
import { useToast } from '../../hooks/useToast';
import { errorText } from '../../utils/format';

/** O'quvchi ota-onasiga natijalarni ko'rsatish uchun faqat o'qiladigan havola yaratadi */
export function ParentLinkCard() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ['parent-link'], queryFn: () => get<{ token: string | null }>('/users/me/parent-link') });
  const token = q.data?.token;
  const url = token ? `${window.location.origin}/p/${token}` : '';

  const run = async (fn: () => Promise<unknown>, okText?: string) => {
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ['parent-link'] });
      if (okText) toast('success', okText);
    } catch (e) {
      toast('error', errorText(e, t));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('success', t('parent.copied'));
    } catch {
      toast('error', url);
    }
  };

  return (
    <Card className="border-brand-100 bg-gradient-to-br from-white to-brand-50/60">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-700">
          <Users className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-extrabold">{t('parent.cardTitle')}</h2>
          <p className="mt-0.5 text-sm text-muted">{t('parent.cardText')}</p>
          {token ? (
            <>
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-line/70 bg-white px-3 py-2 text-xs font-semibold text-ink/80">
                <Link2 className="h-4 w-4 shrink-0 text-brand-600" />
                <span className="truncate">{url}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" icon={<Copy className="h-4 w-4" />} onClick={copy}>{t('parent.copy')}</Button>
                <a href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(t('parent.shareText'))}`} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline" icon={<Send className="h-4 w-4" />}>Telegram</Button>
                </a>
                <Button size="sm" variant="ghost" loading={busy} onClick={() => run(() => post('/users/me/parent-link'), t('parent.renewed'))}>{t('parent.renew')}</Button>
                <Button size="sm" variant="ghost" loading={busy} icon={<Trash2 className="h-4 w-4" />} onClick={() => run(() => del('/users/me/parent-link'), t('parent.revoked'))}>{t('parent.revoke')}</Button>
              </div>
            </>
          ) : (
            <Button size="sm" className="mt-3" loading={busy || q.isLoading} icon={<Link2 className="h-4 w-4" />} onClick={() => run(() => post('/users/me/parent-link'))}>
              {t('parent.create')}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
