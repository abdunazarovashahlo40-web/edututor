import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X, Download } from 'lucide-react';
import { Logo } from '../components/Logo';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { Button } from '../components/ui';
import { useI18n } from '../i18n';
import { homeFor, useAuth } from '../store/auth';
import { cn } from '../utils/cn';

let deferredPrompt: any = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });
}

export function InstallButton({ className }: { className?: string }) {
  const { t } = useI18n();
  const [can, setCan] = useState(!!deferredPrompt);
  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e;
      setCan(true);
    };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  if (!can) return null;
  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      icon={<Download className="h-4 w-4" />}
      onClick={async () => {
        deferredPrompt?.prompt();
        await deferredPrompt?.userChoice;
        deferredPrompt = null;
        setCan(false);
      }}
    >
      {t('landing.installApp')}
    </Button>
  );
}

export function PublicLayout() {
  const { t } = useI18n();
  const { me } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 8);
    h();
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  const links = [
    { to: '/', label: t('nav.home'), end: true },
    { to: '/teachers', label: t('nav.teachers') },
    { to: '/#subjects', label: t('nav.subjects') },
    { to: '/#how', label: t('nav.how') },
    { to: '/#faq', label: t('nav.faq') },
  ];

  return (
    <div className="min-h-[100svh] bg-surface">
      <header className={cn('sticky top-0 z-50 transition-all', scrolled ? 'glass-light border-b border-line/60 shadow-sm' : 'bg-transparent')}>
        <div className="container-x flex h-16 items-center gap-6 md:h-[72px]">
          <Logo />
          <nav className="hidden flex-1 items-center gap-1 lg:flex">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => cn('rounded-xl px-3 py-2 text-sm font-semibold transition', isActive && !l.to.includes('#') ? 'text-brand-700' : 'text-ink/70 hover:text-brand-700')}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitcher />
            <InstallButton className="hidden md:inline-flex" />
            {me ? (
              <Link to={homeFor(me.role)}>
                <Button size="sm">{t('nav.dashboard')}</Button>
              </Link>
            ) : (
              <>
                <Link to="/login" className="hidden sm:block">
                  <Button variant="outline" size="sm">
                    {t('nav.login')}
                  </Button>
                </Link>
                <Link to="/register" className="hidden sm:block">
                  <Button size="sm">{t('nav.register')}</Button>
                </Link>
              </>
            )}
            <button onClick={() => setOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl text-ink lg:hidden" aria-label="menu">
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[60] lg:hidden">
            <motion.div className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.div initial={{ y: '-100%' }} animate={{ y: 0 }} exit={{ y: '-100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} className="absolute inset-x-0 top-0 rounded-b-3xl bg-white p-5 shadow-lift">
              <div className="mb-4 flex items-center justify-between">
                <Logo />
                <button onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl" aria-label="close">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-1">
                {links.map((l) => (
                  <Link key={l.to} to={l.to} className="block rounded-xl px-3 py-3 font-bold text-ink hover:bg-brand-50">
                    {l.label}
                  </Link>
                ))}
              </div>
              {!me && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link to="/login">
                    <Button variant="outline" className="w-full">
                      {t('nav.login')}
                    </Button>
                  </Link>
                  <Link to="/register">
                    <Button className="w-full">{t('nav.register')}</Button>
                  </Link>
                </div>
              )}
              <InstallButton className="mt-3 w-full" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Outlet />

      <footer className="mt-16 border-t border-line bg-white">
        <div className="container-x grid gap-8 py-12 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-3 max-w-sm text-sm text-muted">{t('landing.footerText')}</p>
            <p className="mt-2 text-sm font-semibold text-brand-700">{t('brand.tagline')}</p>
          </div>
          <div>
            <p className="mb-3 text-sm font-extrabold">{t('nav.about')}</p>
            <ul className="space-y-2 text-sm text-muted">
              <li><Link to="/teachers" className="hover:text-brand-700">{t('nav.teachers')}</Link></li>
              <li><Link to="/register?role=teacher" className="hover:text-brand-700">{t('nav.becomeTeacher')}</Link></li>
              <li><a href="/#faq" className="hover:text-brand-700">{t('nav.faq')}</a></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-sm font-extrabold">Kontakt</p>
            <ul className="space-y-2 text-sm text-muted">
              <li>support@edututor.uz</li>
              <li>+998 71 200 00 00</li>
              <li>Toshkent, O'zbekiston</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-line py-5 text-center text-xs text-muted">© {new Date().getFullYear()} EduTutor. {t('landing.rights')}</div>
      </footer>
    </div>
  );
}
