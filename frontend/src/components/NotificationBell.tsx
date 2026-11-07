import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { api, post } from '../services/api';
import { useI18n } from '../i18n';
import { relative } from '../utils/format';
import { cn } from '../utils/cn';
import { notifIcon } from '../features/notifications/notifMeta';
import { localizeNotif } from '../features/notifications/notifText';

export function useNotifications(limit = 8) {
  return useQuery({ queryKey: ['notifications', limit], queryFn: () => api<any[]>('/notifications', { query: { limit } }), refetchInterval: 60_000 });
}

export function NotificationBell({ base, dark }: { base: string; dark?: boolean }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const { data } = useNotifications();
  const unread = data?.meta?.unread ?? 0;
  const readAll = useMutation({ mutationFn: () => post('/notifications/read-all'), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className={cn('relative grid h-10 w-10 place-items-center rounded-xl transition', dark ? 'text-white/80 hover:bg-white/10' : 'text-ink/70 hover:bg-brand-50')} aria-label={t('common.notifications')}>
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="fixed inset-x-3 top-[68px] z-50 overflow-hidden rounded-2xl border border-line bg-white shadow-lift md:absolute md:inset-x-auto md:right-0 md:top-12 md:w-[360px]">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-extrabold text-ink">{t('common.notifications')}</span>
              {unread > 0 && (
                <button onClick={() => readAll.mutate()} className="text-xs font-bold text-brand-700">
                  {t('notif.markAll')}
                </button>
              )}
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {!data?.data.length && <p className="px-4 py-8 text-center text-sm text-muted">{t('notif.empty')}</p>}
              {data?.data.map((n) => {
                const I = notifIcon(n.type);
                const tx = localizeNotif(n, t);
                return (
                  <Link key={n.id} to={n.link ?? `${base}/notifications`} onClick={() => (setOpen(false), !n.readAt && post(`/notifications/${n.id}/read`).then(() => qc.invalidateQueries({ queryKey: ['notifications'] })))} className={cn('flex gap-3 px-4 py-3 hover:bg-brand-50/60', !n.readAt && 'bg-brand-50/40')}>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700">
                      <I className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-ink">{tx.title}</span>
                      {tx.body && <span className="block truncate text-xs text-muted">{tx.body}</span>}
                      <span className="text-[11px] text-muted">{relative(n.createdAt, locale)}</span>
                    </span>
                    {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                  </Link>
                );
              })}
            </div>
            <Link to={`${base}/notifications`} onClick={() => setOpen(false)} className="block border-t border-line py-2.5 text-center text-sm font-bold text-brand-700 hover:bg-brand-50">
              {t('common.more')}
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
