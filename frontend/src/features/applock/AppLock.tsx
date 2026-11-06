/**
 * Ilova qulfi:
 *  - O'rnatilgan ilovada (PWA standalone) birinchi kirishdan keyin PIN o'rnatish taklif qilinadi
 *  - O'rnatilgan ilova har safar ochilganda, fon rejimidan 30 soniyadan keyin qaytganda yoki server faolsizlik sababli qulflasa — lock screen
 *  - PIN yoki barmoq izi bilan ochiladi; 5 xato — sessiya bekor
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Fingerprint, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../store/auth';
import { useI18n } from '../../i18n';
import { ApiError, post } from '../../services/api';
import { isStandalone } from '../../hooks/useMedia';
import { PinPad } from './PinPad';
import { biometricAvailable, registerBiometric, unlockWithBiometric } from './biometric';
import { Avatar, Button } from '../../components/ui';
import { LogoMark } from '../../components/Logo';

const BG_LOCK_MS = 30_000; // fon rejimida 30 soniyadan ko'p tursa — qulf
const SKIP_KEY = 'et_applock_skip';
const SESSION_KEY = 'et_unlocked'; // ilova oynasi yopilsa o'chadi (sessionStorage)

function markUnlocked() {
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    /* ignore */
  }
}
function wasUnlocked() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function AppLockGate({ children }: { children: ReactNode }) {
  const { me, loading, refetch } = useAuth();
  const hiddenAt = useRef<number | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);

  // Bank ilovalari kabi: o'rnatilgan ilova har safar yangidan ochilganda — avval PIN / barmoq izi.
  // Faqat sahifa ochilgandagi birinchi holat tekshiriladi: shu oynada parol bilan kirilgan bo'lsa qulflanmaydi.
  const bootChecked = useRef(false);
  useEffect(() => {
    if (bootChecked.current || loading) return;
    bootChecked.current = true;
    if (!me) return markUnlocked(); // kirmagan foydalanuvchi keyin parol bilan kiradi
    if (me.appLock.locked || !me.appLock.hasPin || !isStandalone() || wasUnlocked()) return;
    void post('/auth/app-lock/lock')
      .catch(() => undefined)
      .then(() => refetch());
  }, [loading, me, refetch]);

  useEffect(() => {
    if (me && !me.appLock.locked && bootChecked.current) markUnlocked();
  }, [me]);

  // Fon rejimi → qaytganda qulflash
  useEffect(() => {
    if (!me?.appLock.hasPin) return;
    const onVis = async () => {
      if (document.visibilityState === 'hidden') hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current > BG_LOCK_MS) {
        hiddenAt.current = null;
        await post('/auth/app-lock/lock').catch(() => undefined);
        await refetch();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [me?.appLock.hasPin, refetch]);

  // O'rnatilgan ilovada birinchi marta — PIN o'rnatishni taklif qilish
  useEffect(() => {
    if (!me || me.appLock.hasPin || me.appLock.locked) return;
    let skipped = false;
    try {
      skipped = localStorage.getItem(SKIP_KEY) === me.id;
    } catch {
      /* ignore */
    }
    if (isStandalone() && !skipped) setSetupOpen(true);
  }, [me]);

  if (me?.appLock.locked) return <LockScreen />;
  return (
    <>
      {children}
      <AnimatePresence>
        {setupOpen && (
          <SetupAppLock
            onDone={() => setSetupOpen(false)}
            onSkip={() => {
              try {
                localStorage.setItem(SKIP_KEY, me!.id);
              } catch {
                /* ignore */
              }
              setSetupOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex flex-col items-center overflow-y-auto bg-gradient-to-b from-brand-50 via-surface to-white px-6 pb-10 pt-[max(48px,env(safe-area-inset-top))]"
    >
      {children}
    </motion.div>
  );
}

function LockScreen() {
  const { me, refetch, logout } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tried = useRef(false);

  const unlocked = useCallback(async () => {
    await refetch();
    qc.invalidateQueries();
  }, [refetch, qc]);

  const bio = useCallback(async () => {
    try {
      await unlockWithBiometric();
      await unlocked();
    } catch {
      /* foydalanuvchi bekor qildi — PIN bilan davom etadi */
    }
  }, [unlocked]);

  useEffect(() => {
    if (me?.appLock.hasBiometric && !tried.current) {
      tried.current = true;
      void bio();
    }
  }, [me?.appLock.hasBiometric, bio]);

  useEffect(() => {
    if (pin.length !== 4 || busy) return;
    setBusy(true);
    post('/auth/app-lock/unlock', { pin })
      .then(unlocked)
      .catch(async (e) => {
        setPin('');
        if (e instanceof ApiError && e.code === 'PIN_BLOCKED') {
          await logout();
          nav('/login');
          return;
        }
        setError(e instanceof ApiError && e.details?.left !== undefined ? t('lock.attemptsLeft', { n: e.details.left }) : t('lock.wrong'));
      })
      .finally(() => setBusy(false));
  }, [pin, busy, unlocked, logout, nav, t]);

  return (
    <Shell>
      <LogoMark className="mb-6 h-10 w-10" />
      <Avatar name={me?.fullName} src={me?.avatarUrl} size={72} />
      <p className="mt-3 text-lg font-extrabold">{t('lock.hello', { name: me?.fullName.split(' ')[0] ?? '' })}</p>
      <p className="mb-8 mt-1 text-sm text-muted">{t('lock.title')}</p>
      <PinPad value={pin} onChange={(v) => (setError(null), setPin(v))} error={!!error} onBiometric={me?.appLock.hasBiometric ? bio : undefined} disabled={busy} />
      <p className="mt-5 h-5 text-sm font-semibold text-danger">{error}</p>
      <button
        className="mt-4 text-sm font-bold text-brand-700"
        onClick={async () => {
          await logout();
          nav('/login');
        }}
      >
        {t('lock.forgotPin')}
      </button>
    </Shell>
  );
}

export function SetupAppLock({ onDone, onSkip }: { onDone: () => void; onSkip?: () => void }) {
  const { t } = useI18n();
  const { refetch } = useAuth();
  const [stage, setStage] = useState<'pin' | 'repeat' | 'bio'>('pin');
  const [first, setFirst] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [bioOk, setBioOk] = useState(false);

  useEffect(() => {
    void biometricAvailable().then(setBioOk);
  }, []);

  useEffect(() => {
    if (pin.length !== 4) return;
    if (stage === 'pin') {
      setFirst(pin);
      setPin('');
      setStage('repeat');
    } else if (stage === 'repeat') {
      if (pin !== first) {
        setError(t('lock.mismatch'));
        setPin('');
        setStage('pin');
        return;
      }
      post('/auth/app-lock/setup', { pin, deviceName: navigator.userAgent.slice(0, 60) })
        .then(async () => {
          await refetch();
          if (bioOk) setStage('bio');
          else onDone();
        })
        .catch((e) => {
          setError(e?.message ?? t('common.error'));
          setPin('');
          setStage('pin');
        });
    }
  }, [pin, stage, first, bioOk, onDone, refetch, t]);

  return (
    <Shell>
      <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-brand-100 text-brand-700">
        {stage === 'bio' ? <Fingerprint className="h-9 w-9" /> : <ShieldCheck className="h-9 w-9" />}
      </div>
      {stage === 'bio' ? (
        <>
          <h2 className="text-xl font-extrabold">{t('lock.enableBiometric')}</h2>
          <p className="mb-8 mt-2 max-w-xs text-center text-sm text-muted">{t('lock.biometricText')}</p>
          <Button
            size="lg"
            className="w-full max-w-xs"
            icon={<Fingerprint className="h-5 w-5" />}
            onClick={async () => {
              try {
                await registerBiometric();
                await refetch();
              } catch {
                /* ignore */
              }
              onDone();
            }}
          >
            {t('lock.enableBiometric')}
          </Button>
          <Button variant="ghost" className="mt-3" onClick={onDone}>
            {t('lock.skip')}
          </Button>
        </>
      ) : (
        <>
          <h2 className="text-xl font-extrabold">{stage === 'pin' ? t('lock.setupTitle') : t('lock.repeat')}</h2>
          <p className="mb-8 mt-2 max-w-xs text-center text-sm text-muted">{t('lock.setupText')}</p>
          <PinPad value={pin} onChange={(v) => (setError(null), setPin(v))} error={!!error} />
          <p className="mt-5 h-5 text-sm font-semibold text-danger">{error}</p>
          {onSkip && (
            <Button variant="ghost" className="mt-2" onClick={onSkip}>
              {t('lock.skip')}
            </Button>
          )}
        </>
      )}
    </Shell>
  );
}
