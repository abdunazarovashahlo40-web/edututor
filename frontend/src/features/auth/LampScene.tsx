/**
 * "Bilim chirog'i" — videodagi pull-cord lamp login g'oyasining EduTutor versiyasi.
 * Shiftdan osilgan chiroq soyabon o'rniga bitiruv shapkasi (mortarboard), ip uchida — kistochka.
 * Ipni torting (yoki bosing / Enter) → nur yonadi, shisha forma nur ichida paydo bo'ladi.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Logo } from '../../components/Logo';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { useI18n } from '../../i18n';
import { cn } from '../../utils/cn';

const COLORS = {
  violet: { rgb: '167 139 250', name: 'violet' },
  blue: { rgb: '96 165 250', name: 'blue' },
  gold: { rgb: '251 191 36', name: 'gold' },
} as const;
type ColorKey = keyof typeof COLORS;

const GLYPHS = ['π', '∑', '√x', 'E=mc²', 'Aa', 'H₂O', '∫', '{ }', 'α', 'ABC', 'Δ', '∞', 'DNA', '7×8', '⚛'];

function store<T extends string>(key: string, fallback: T): T {
  try {
    return (sessionStorage.getItem(key) as T) || fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, v: string) {
  try {
    sessionStorage.setItem(key, v);
  } catch {
    /* ignore */
  }
}

const CORD_BASE = 52;

export function LampScene({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const { t } = useI18n();
  const [on, setOn] = useState(() => store<string>('et_lamp', '0') === '1');
  const [color, setColor] = useState<ColorKey>(() => store<ColorKey>('et_lamp_color', 'violet'));
  const [flicker, setFlicker] = useState(0);
  const y = useMotionValue(0);
  const cordLen = useTransform(y, (v) => CORD_BASE + Math.max(0, v));

  const toggle = useCallback(() => {
    setOn((o) => {
      const n = !o;
      save('et_lamp', n ? '1' : '0');
      if (n) setFlicker((f) => f + 1);
      return n;
    });
    try {
      navigator.vibrate?.(12);
    } catch {
      /* ignore */
    }
  }, []);

  const pull = useCallback(() => {
    animate(y, [0, 34, 0], { duration: 0.45, ease: 'easeOut' });
    setTimeout(toggle, 160);
  }, [toggle, y]);

  const cycleColor = () => {
    const keys = Object.keys(COLORS) as ColorKey[];
    const next = keys[(keys.indexOf(color) + 1) % keys.length];
    setColor(next);
    save('et_lamp_color', next);
  };

  // Klaviatura: L tugmasi chiroqni yoqadi/o'chiradi
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key.toLowerCase() === 'l') pull();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [pull]);

  const dust = useMemo(
    () =>
      Array.from({ length: 22 }).map((_, i) => ({
        left: 30 + Math.random() * 40,
        top: 35 + Math.random() * 60,
        size: 1.5 + Math.random() * 2.5,
        delay: Math.random() * 6,
        dur: 5 + Math.random() * 6,
        dx: `${(Math.random() - 0.5) * 60}px`,
        key: i,
      })),
    [],
  );
  const glyphs = useMemo(
    () => GLYPHS.map((g, i) => ({ g, left: (i * 67) % 100, top: 10 + ((i * 41) % 85), size: 14 + ((i * 7) % 18), delay: i * 0.7 })),
    [],
  );

  const rgb = COLORS[color].rgb;

  return (
    <div
      className="relative min-h-[100svh] overflow-hidden bg-navy-900 text-white"
      style={{ ['--lamp' as string]: rgb, backgroundImage: 'radial-gradient(1200px 600px at 50% -10%, rgba(76,29,149,.35), transparent 60%), radial-gradient(800px 500px at 100% 100%, rgba(59,130,246,.12), transparent 60%)' }}
    >
      {/* doska (chalkboard) setkasi */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[.07]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)', backgroundSize: '48px 48px', maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)' }}
      />

      {/* suzuvchi ta'lim belgilari */}
      {glyphs.map((x, i) => (
        <span
          key={i}
          className="pointer-events-none absolute select-none font-display font-bold transition-opacity duration-1000"
          style={{
            left: `${x.left}%`,
            top: `${x.top}%`,
            fontSize: x.size,
            color: on ? `rgb(${rgb} / .22)` : 'rgba(255,255,255,.06)',
            animation: `drift ${9 + (i % 5)}s ease-in-out ${x.delay}s infinite`,
          }}
          aria-hidden
        >
          {x.g}
        </span>
      ))}

      {/* yuqori panel */}
      <div className="relative z-30 flex items-center justify-between px-4 py-3 md:px-8">
        <Logo light />
        <div className="flex items-center gap-2">
          <LanguageSwitcher dark />
          <button
            onClick={cycleColor}
            className="flex h-9 items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2"
            aria-label={t('auth.lightColor')}
            title={t('auth.lightColor')}
          >
            {(Object.keys(COLORS) as ColorKey[]).map((k) => (
              <span
                key={k}
                className={cn('h-4 w-4 rounded-full transition', color === k ? 'scale-110 ring-2 ring-white' : 'opacity-50')}
                style={{ background: `rgb(${COLORS[k].rgb})` }}
              />
            ))}
          </button>
        </div>
      </div>

      {/* chiroq va nur */}
      <div className="pointer-events-none absolute left-1/2 top-0 z-10 w-full max-w-[1100px] -translate-x-1/2">
        {/* shiftdan sim */}
        <div className="absolute left-1/2 top-0 h-[44px] w-[2px] -translate-x-1/2 bg-gradient-to-b from-white/5 to-white/40 md:h-[50px]" />
        {/* nur konusi */}
        <AnimatePresence>
          {on && (
            <motion.div
              key={`cone-${flicker}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.9, 0.25, 1, 0.7, 1] }}
              exit={{ opacity: 0, transition: { duration: 0.35 } }}
              transition={{ duration: 0.9, times: [0, 0.15, 0.3, 0.5, 0.7, 1] }}
              className="absolute left-1/2 top-[92px] h-[92vh] w-[min(1100px,180vw)] -translate-x-1/2 md:top-[100px]"
              style={{
                clipPath: 'polygon(46% 0, 54% 0, 100% 100%, 0 100%)',
                background: `linear-gradient(to bottom, rgb(${rgb} / .55), rgb(${rgb} / .18) 45%, rgb(${rgb} / 0) 92%)`,
                filter: 'blur(6px)',
                mixBlendMode: 'screen',
              }}
            >
              {dust.map((d) => (
                <span
                  key={d.key}
                  className="absolute rounded-full"
                  style={{
                    left: `${d.left}%`,
                    top: `${d.top}%`,
                    width: d.size,
                    height: d.size,
                    background: `rgb(${rgb})`,
                    boxShadow: `0 0 8px rgb(${rgb})`,
                    animation: `dust ${d.dur}s linear ${d.delay}s infinite`,
                    ['--dx' as string]: d.dx,
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        {/* yorug'lik dog'i (polda) */}
        <motion.div
          animate={{ opacity: on ? 1 : 0 }}
          transition={{ duration: 0.6 }}
          className="absolute left-1/2 top-[78vh] h-40 w-[min(900px,150vw)] -translate-x-1/2 rounded-[50%]"
          style={{ background: `radial-gradient(ellipse at center, rgb(${rgb} / .28), transparent 70%)` }}
        />
      </div>

      {/* chiroq tanasi: bitiruv shapkasi */}
      <div className="absolute left-1/2 top-[40px] z-20 -translate-x-1/2 md:top-[46px]">
        <svg width="170" height="64" viewBox="0 0 170 64" className="scale-[.8] md:scale-100" aria-hidden>
          <defs>
            <linearGradient id="cap-top" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#2A3350" />
              <stop offset="1" stopColor="#151B2E" />
            </linearGradient>
            <radialGradient id="bulb" cx="50%" cy="40%" r="60%">
              <stop offset="0" stopColor="#fff" />
              <stop offset="1" stopColor={`rgb(${rgb})`} />
            </radialGradient>
          </defs>
          {/* lampochka nuri */}
          <motion.ellipse cx="85" cy="54" rx="34" ry="10" fill={`rgb(${rgb})`} animate={{ opacity: on ? 0.9 : 0 }} style={{ filter: 'blur(8px)' }} />
          {/* shapka "kallak" qismi */}
          <path d="M45 22 L45 40 Q85 58 125 40 L125 22 Z" fill="#1B2238" stroke="rgba(255,255,255,.12)" />
          {/* lampochka */}
          <motion.ellipse cx="85" cy="48" rx="14" ry="6" fill="url(#bulb)" animate={{ opacity: on ? 1 : 0.25 }} />
          {/* shapka taxtasi (romb) */}
          <path d="M85 2 L166 20 L85 38 L4 20 Z" fill="url(#cap-top)" stroke="rgba(255,255,255,.18)" />
          <motion.path d="M85 2 L166 20 L85 38 L4 20 Z" fill={`rgb(${rgb})`} animate={{ opacity: on ? 0.12 : 0 }} />
          <circle cx="85" cy="20" r="3.5" fill="#F5C451" />
        </svg>
      </div>

      {/* tortiladigan ip + kistochka */}
      <div className="absolute left-1/2 top-[56px] z-30 ml-[54px] md:top-[64px] md:ml-[78px]">
        <motion.div className="absolute -left-px top-0 w-[2px] rounded bg-gradient-to-b from-amber-300 to-amber-500" style={{ height: cordLen }} />
        <div className="absolute -left-[11px]" style={{ top: CORD_BASE - 4 }}>
        <motion.button
          type="button"
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.9 }}
          dragSnapToOrigin
          style={{ y }}
          onDragEnd={(_, info) => info.offset.y > 26 && toggle()}
          onTap={pull}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), pull())}
          aria-pressed={on}
          aria-label={t('auth.pullCord')}
          className="relative block cursor-grab touch-none rounded-full outline-none focus-visible:ring-4 focus-visible:ring-amber-300/40 active:cursor-grabbing"
        >
          <svg width="22" height="40" viewBox="0 0 22 40" aria-hidden>
            <circle cx="11" cy="5" r="5" fill="#FBBF24" />
            <path d="M5 9 h12 l2 28 q-8 4 -16 0 z" fill="#F59E0B" />
            {[7, 10, 13, 16].map((x) => (
              <path key={x} d={`M${x} 12 L${x - 1} 36`} stroke="#B45309" strokeWidth=".8" opacity=".6" />
            ))}
          </svg>
          {!on && <span className="absolute -inset-3 animate-ping rounded-full border border-amber-300/40" />}
        </motion.button>
        </div>
      </div>

      {/* kontent: forma */}
      <div className={cn('auth-stage relative z-20 mx-auto px-4 pb-8 pt-[132px] md:pt-[150px]', wide ? 'max-w-[540px]' : 'max-w-[420px]')}>
        <AnimatePresence mode="wait">
          {on ? (
            <motion.div
              key="panel"
              initial={{ opacity: 0, y: 24, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: 12, filter: 'blur(8px)', transition: { duration: 0.25 } }}
              transition={{ duration: 0.6, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="glass rounded-3xl p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,.8)] md:px-7 md:py-6"
              style={{ boxShadow: `0 30px 80px -30px rgba(0,0,0,.8), 0 0 60px -20px rgb(${rgb} / .45)` }}
            >
              {children}
            </motion.div>
          ) : (
            <motion.button
              key="hint"
              type="button"
              onClick={pull}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mx-auto mt-24 block text-center text-xs font-bold uppercase tracking-[.35em] text-white/35 hover:text-white/60"
            >
              {t('auth.pullCord')}
              <span className="mt-2 block text-[10px] tracking-[.2em] text-white/20">( L )</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
