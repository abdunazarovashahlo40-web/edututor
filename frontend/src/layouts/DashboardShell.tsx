import { useState, type ComponentType, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Menu, X, ChevronDown, MoreHorizontal } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Logo, LogoMark } from '../components/Logo';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { NotificationBell } from '../components/NotificationBell';
import { Avatar, Modal } from '../components/ui';
import { useAuth } from '../store/auth';
import { useI18n } from '../i18n';
import { get } from '../services/api';
import { cn } from '../utils/cn';

export type NavItem = { to: string; label: string; icon: ComponentType<{ className?: string }>; badge?: number; end?: boolean };

/**
 * Uch xil kabinet uchun umumiy skelet, lekin har biri o'z uslubida:
 *  - student: yorug', o'yinqaroq "o'quv maydoni" + mobil pastki menyu
 *  - teacher: to'q binafsha gradient sidebar — "ish va biznes maydoni"
 *  - admin:   ixcham, zich "boshqaruv konsoli", guruhlangan menyu
 */
export function DashboardShell({
  variant,
  nav,
  mobileNav,
  topExtra,
}: {
  variant: 'student' | 'teacher' | 'admin';
  nav: (NavItem | { group: string })[];
  mobileNav: NavItem[];
  topExtra?: ReactNode;
}) {
  const { me, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const loc = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [more, setMore] = useState(false);
  const base = `/${variant}`;
  const unread = useQuery({ queryKey: ['unread'], queryFn: () => get<{ count: number }>('/messages/unread-count'), refetchInterval: 60_000 });
  const withBadges = (items: typeof nav) =>
    items.map((i) => ('to' in i && i.to.endsWith('/messages') ? { ...i, badge: unread.data?.count } : i));

  const doLogout = async () => {
    await logout();
    navigate('/login');
  };

  const sidebarCls = {
    student: 'bg-white border-r border-line/70',
    teacher: 'bg-gradient-to-b from-[#2E1065] via-brand-900 to-brand-800 text-white',
    admin: 'bg-[#0F172A] text-slate-300',
  }[variant];

  const linkCls = (active: boolean) =>
    ({
      student: cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition', active ? 'bg-gradient-to-r from-brand-700 to-brand-500 text-white shadow-[0_8px_20px_-10px_rgba(109,40,217,.8)]' : 'text-ink/70 hover:bg-brand-50 hover:text-brand-700'),
      teacher: cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition', active ? 'bg-white text-brand-800 shadow-lg' : 'text-white/70 hover:bg-white/10 hover:text-white'),
      admin: cn('flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition', active ? 'bg-brand-600/90 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'),
    })[variant];

  const Side = (
    <div className="flex h-full flex-col">
      <div className={cn('px-5', variant === 'admin' ? 'py-4' : 'py-6')}>
        {variant === 'student' ? (
          <Logo to={base} />
        ) : (
          <a href={base} className="flex items-center gap-2">
            <LogoMark />
            <span className="text-lg font-extrabold text-white">
              EduTutor <span className={cn('ml-1 rounded-md px-1.5 py-0.5 text-[10px] uppercase tracking-wider', variant === 'admin' ? 'bg-brand-600 text-white' : 'bg-white/15 text-white')}>{variant === 'admin' ? 'Admin' : 'Pro'}</span>
            </span>
          </a>
        )}
      </div>
      <nav className={cn('no-scrollbar flex-1 space-y-1 overflow-y-auto', variant === 'admin' ? 'px-3' : 'px-4')}>
        {withBadges(nav).map((item, i) =>
          'group' in item ? (
            <div key={i} className="px-2.5 pb-1 pt-4 text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">
              {item.group}
            </div>
          ) : (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setDrawer(false)} className={({ isActive }) => linkCls(isActive)}>
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {!!item.badge && <span className="rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">{item.badge}</span>}
            </NavLink>
          ),
        )}
      </nav>
      <div className={cn('m-3 rounded-2xl p-3', variant === 'student' ? 'bg-brand-50' : 'bg-white/10')}>
        <div className="flex items-center gap-2.5">
          <Avatar name={me?.fullName} src={me?.avatarUrl} size={36} />
          <div className="min-w-0 flex-1">
            <div className={cn('truncate text-sm font-bold', variant === 'student' ? 'text-ink' : 'text-white')}>{me?.fullName}</div>
            <div className={cn('text-[11px] font-semibold', variant === 'student' ? 'text-muted' : 'text-white/60')}>{t(`roles.${me?.role}`)}</div>
          </div>
          <button onClick={doLogout} className={cn('grid h-8 w-8 place-items-center rounded-lg', variant === 'student' ? 'text-muted hover:bg-white' : 'text-white/70 hover:bg-white/10')} aria-label={t('common.logout')}>
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  const mainBg = { student: 'bg-surface', teacher: 'bg-[#F6F5FB]', admin: 'bg-slate-50' }[variant];
  const sideW = variant === 'admin' ? 'md:w-[232px]' : 'md:w-[256px]';
  const padL = variant === 'admin' ? 'md:pl-[232px]' : 'md:pl-[256px]';

  return (
    <div className={cn('min-h-[100svh]', mainBg)}>
      <aside className={cn('fixed inset-y-0 left-0 z-40 hidden md:block', sideW, sidebarCls)}>{Side}</aside>

      {/* mobil drawer (admin va "yana" menyusi uchun) */}
      <AnimatePresence>
        {drawer && (
          <div className="fixed inset-0 z-50 md:hidden">
            <motion.div className="absolute inset-0 bg-navy-900/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
            <motion.aside initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} className={cn('absolute inset-y-0 left-0 w-[280px]', sidebarCls)}>
              <button onClick={() => setDrawer(false)} className="absolute right-3 top-5 grid h-9 w-9 place-items-center rounded-lg opacity-70" aria-label="close">
                <X className="h-5 w-5" />
              </button>
              {Side}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className={padL}>
        <header className={cn('sticky top-0 z-30 flex h-16 items-center gap-2 px-4 md:px-8', variant === 'admin' ? 'border-b border-slate-200 bg-white' : 'glass-light border-b border-line/50')}>
          {variant === 'admin' ? (
            <button onClick={() => setDrawer(true)} className="grid h-10 w-10 place-items-center rounded-xl text-ink md:hidden" aria-label="menu">
              <Menu className="h-5 w-5" />
            </button>
          ) : (
            <div className="md:hidden">
              <Logo to={base} />
            </div>
          )}
          <div className="hidden flex-1 md:block">{topExtra}</div>
          <div className="ml-auto flex items-center gap-1">
            <LanguageSwitcher compact />
            <NotificationBell base={base} />
            <button onClick={() => navigate(variant === 'admin' ? '/admin/account' : `${base}/settings`)} className="ml-1 flex items-center gap-1 rounded-xl p-1 hover:bg-brand-50" aria-label={t('common.profile')}>
              <Avatar name={me?.fullName} src={me?.avatarUrl} size={34} />
              <ChevronDown className="hidden h-4 w-4 text-muted md:block" />
            </button>
          </div>
        </header>

        <main className="px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-7">
          <motion.div key={loc.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <Outlet />
          </motion.div>
        </main>
      </div>

      {/* mobil pastki navigatsiya (student, teacher) */}
      {variant !== 'admin' && (
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-white/95 px-2 pt-1.5 backdrop-blur md:hidden">
          <div className="grid grid-cols-5">
            {mobileNav.slice(0, 4).map((i) => (
              <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => cn('flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-bold', isActive ? 'text-brand-700' : 'text-muted')}>
                {({ isActive }) => (
                  <>
                    <span className={cn('grid h-8 w-12 place-items-center rounded-full transition', isActive && 'bg-brand-100')}>
                      <i.icon className="h-5 w-5" />
                    </span>
                    <span className="max-w-full truncate">{i.label}</span>
                  </>
                )}
              </NavLink>
            ))}
            <button onClick={() => setMore(true)} className="flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-bold text-muted">
              <span className="grid h-8 w-12 place-items-center">
                <MoreHorizontal className="h-5 w-5" />
              </span>
              {t('menu.more')}
            </button>
          </div>
        </nav>
      )}
      <Modal open={more} onClose={() => setMore(false)} title={t('menu.more')}>
        <div className="grid grid-cols-3 gap-2">
          {(nav.filter((n) => 'to' in n) as NavItem[]).map((i) => (
            <NavLink key={i.to} to={i.to} onClick={() => setMore(false)} className="flex flex-col items-center gap-1.5 rounded-2xl bg-brand-50/60 p-3 text-center text-xs font-bold text-ink">
              <i.icon className="h-6 w-6 text-brand-600" />
              {i.label}
            </NavLink>
          ))}
          <button onClick={doLogout} className="flex flex-col items-center gap-1.5 rounded-2xl bg-red-50 p-3 text-xs font-bold text-danger">
            <LogOut className="h-6 w-6" />
            {t('common.logout')}
          </button>
        </div>
      </Modal>
    </div>
  );
}
