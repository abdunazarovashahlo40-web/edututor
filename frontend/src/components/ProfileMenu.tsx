/**
 * Profil menyusi (yuqoridagi rasm bosilganda): ism, rol va sozlamalar bo'limlariga tezkor kirish.
 * Sozlamalar ko'payib ketsa ham chalkash bo'lmasligi uchun har biri alohida bo'lim sifatida ochiladi.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, LogOut, UserCircle } from 'lucide-react';
import { useAuth } from '../store/auth';
import { useI18n } from '../i18n';
import { Avatar } from './ui';
import { SETTINGS_TABS, TAB_ICONS } from '../pages/shared/settingsTabs';

export function ProfileMenu({ settingsPath, onLogout }: { settingsPath: string; onLogout: () => void }) {
  const { me } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  if (!me) return null;
  const short = me.fullName.split(' ').slice(0, 2).map((p, i) => (i === 0 ? p : `${p[0]}.`)).join(' ');
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="ml-1 flex items-center gap-1.5 rounded-xl p-1 hover:bg-brand-50" aria-label={t('common.profile')} aria-expanded={open}>
        <Avatar name={me.fullName} src={me.avatarUrl} size={34} />
        <span className="hidden max-w-[120px] truncate text-sm font-bold text-ink lg:block">{short}</span>
        <ChevronDown className="hidden h-4 w-4 text-muted md:block" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="fixed inset-x-3 top-[68px] z-50 overflow-hidden rounded-2xl border border-line bg-white shadow-lift md:absolute md:inset-x-auto md:right-0 md:top-12 md:w-72"
          >
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <Avatar name={me.fullName} src={me.avatarUrl} size={40} />
              <div className="min-w-0">
                <div className="truncate font-extrabold text-ink">{me.fullName}</div>
                <div className="truncate text-xs text-muted">{t(`roles.${me.role}`)} · {me.email}</div>
              </div>
            </div>
            <nav className="py-1.5">
              {me.role === 'TEACHER' && (
                <Link to="/teacher/profile" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-ink hover:bg-brand-50">
                  <UserCircle className="h-4 w-4 text-brand-600" /> {t('set.teacherPublicProfile')}
                </Link>
              )}
              {SETTINGS_TABS.map((k) => {
                const I = TAB_ICONS[k];
                return (
                  <Link key={k} to={`${settingsPath}?tab=${k}`} onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-ink hover:bg-brand-50">
                    <I className="h-4 w-4 text-brand-600" /> {t(`set.${k}`)}
                  </Link>
                );
              })}
            </nav>
            <button onClick={onLogout} className="flex w-full items-center gap-3 border-t border-line px-4 py-3 text-sm font-bold text-danger hover:bg-red-50">
              <LogOut className="h-4 w-4" /> {t('common.logout')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
