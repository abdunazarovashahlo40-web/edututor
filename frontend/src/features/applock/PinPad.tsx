import { motion, useAnimationControls } from 'framer-motion';
import { Delete, Fingerprint } from 'lucide-react';
import { useEffect, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

/** Bank ilovalaridagidek PIN klaviatura */
export function PinPad({
  value,
  onChange,
  length = 4,
  error,
  onBiometric,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  error?: boolean;
  onBiometric?: () => void;
  disabled?: boolean;
}) {
  const controls = useAnimationControls();
  useEffect(() => {
    if (error) void controls.start({ x: [0, -14, 12, -8, 6, 0], transition: { duration: 0.45 } });
  }, [error, controls]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (disabled) return;
      if (/^\d$/.test(e.key) && value.length < length) onChange(value + e.key);
      if (e.key === 'Backspace') onChange(value.slice(0, -1));
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [value, onChange, length, disabled]);

  const press = (d: string) => {
    if (disabled || value.length >= length) return;
    try {
      navigator.vibrate?.(8);
    } catch {
      /* ignore */
    }
    onChange(value + d);
  };

  return (
    <div className="select-none">
      <motion.div animate={controls} className="mb-8 flex justify-center gap-4" aria-live="polite">
        {Array.from({ length }).map((_, i) => (
          <motion.span
            key={i}
            animate={{ scale: i < value.length ? 1.15 : 1 }}
            className={cn('h-4 w-4 rounded-full border-2 transition-colors', error ? 'border-danger bg-danger' : i < value.length ? 'border-brand-600 bg-brand-600' : 'border-brand-200')}
          />
        ))}
      </motion.div>
      <div className="mx-auto grid max-w-[300px] grid-cols-3 gap-4">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <Key key={d} onClick={() => press(d)}>
            {d}
          </Key>
        ))}
        {onBiometric ? (
          <Key onClick={onBiometric} aria-label="fingerprint" className="text-brand-600">
            <Fingerprint className="h-8 w-8" />
          </Key>
        ) : (
          <span />
        )}
        <Key onClick={() => press('0')}>0</Key>
        <Key onClick={() => onChange(value.slice(0, -1))} aria-label="delete" className="text-muted">
          <Delete className="h-7 w-7" />
        </Key>
      </div>
    </div>
  );
}

function Key({ children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.9, backgroundColor: '#EDE9FE' }}
      className={cn('mx-auto grid h-[72px] w-[72px] place-items-center rounded-full bg-white text-[28px] font-bold text-ink shadow-soft', className)}
      {...(rest as any)}
    >
      {children}
    </motion.button>
  );
}
