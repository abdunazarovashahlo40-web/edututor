import { forwardRef, useEffect, useRef, type HTMLAttributes, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { Loader2, X, Inbox, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { initials } from '../../utils/format';
import { useIsMobile } from '../../hooks/useMedia';

/* ---------------- Button ---------------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
};
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 rounded-xl font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/25 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[.98]',
        size === 'sm' && 'h-9 px-3 text-xs',
        size === 'md' && 'h-11 px-4 text-sm',
        size === 'lg' && 'h-12 px-6 text-[15px]',
        variant === 'primary' && 'bg-gradient-to-r from-brand-700 to-brand-500 text-white shadow-[0_8px_20px_-8px_rgba(109,40,217,.7)] hover:brightness-110',
        variant === 'secondary' && 'bg-brand-50 text-brand-700 hover:bg-brand-100',
        variant === 'outline' && 'border border-line bg-white text-ink hover:border-brand-300 hover:text-brand-700',
        variant === 'ghost' && 'text-muted hover:bg-brand-50 hover:text-brand-700',
        variant === 'danger' && 'bg-danger/10 text-danger hover:bg-danger hover:text-white',
        variant === 'success' && 'bg-success text-white hover:brightness-110',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

/* ---------------- Form fields ---------------- */
export function Field({ label, error, hint, children, className }: { label?: ReactNode; error?: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      {label && <span className="mb-1.5 block text-[13px] font-bold text-ink/80">{label}</span>}
      {children}
      {error ? <span className="mt-1 block text-xs font-semibold text-danger">{error}</span> : hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

const inputCls =
  'w-full rounded-xl border border-line bg-white px-3.5 text-[15px] text-ink placeholder:text-slate-400 transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15 disabled:bg-slate-50';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { icon?: ReactNode; right?: ReactNode }>(function Input(
  { className, icon, right, ...rest },
  ref,
) {
  return (
    <div className="relative">
      {icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">{icon}</span>}
      <input ref={ref} className={cn(inputCls, 'h-11', icon && 'pl-10', right && 'pr-11', className)} {...rest} />
      {right && <span className="absolute right-2 top-1/2 -translate-y-1/2">{right}</span>}
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(inputCls, 'min-h-[96px] py-2.5', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn(inputCls, 'select-chevron h-11 appearance-none pr-9', className)} {...rest}>
      {children}
    </select>
  );
});

export function Checkbox({ label, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink/80">
      <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-line accent-brand-700" {...rest} />
      <span>{label}</span>
    </label>
  );
}

/* ---------------- Card, Badge, Avatar ---------------- */
export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-2xl border border-line/70 bg-white p-5 shadow-soft', className)} {...rest}>
      {children}
    </div>
  );
}

const tone = {
  gray: 'bg-slate-100 text-slate-600',
  brand: 'bg-brand-100 text-brand-700',
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-700',
};
export type Tone = keyof typeof tone;
export function Badge({ children, tone: t = 'gray', className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold', tone[t], className)}>{children}</span>;
}

export const statusTone: Record<string, Tone> = {
  requested: 'yellow', confirmed: 'green', rejected: 'red', cancelled: 'gray', rescheduled: 'blue', completed: 'brand', no_show: 'red',
  pending: 'yellow', processing: 'blue', paid: 'green', failed: 'red', refunded: 'blue',
  draft: 'gray', published: 'green', in_progress: 'blue',
  assigned: 'yellow', submitted: 'blue', reviewed: 'brand',
  DRAFT: 'gray', PENDING: 'yellow', APPROVED: 'green', REJECTED: 'red', ACTIVE: 'green', SUSPENDED: 'red', PENDING_VERIFICATION: 'yellow',
  open: 'yellow', in_review: 'blue', resolved: 'green', requested_refund: 'yellow', approved: 'blue', processed: 'green', held: 'yellow', available: 'green', paid_out: 'brand', reversed: 'gray',
};

const gradients = ['from-brand-500 to-accent', 'from-pink-500 to-brand-600', 'from-amber-400 to-pink-500', 'from-emerald-400 to-cyan-500', 'from-indigo-500 to-purple-500'];
export function Avatar({ name, src, size = 40, className }: { name?: string; src?: string | null; size?: number; className?: string }) {
  const g = gradients[(name?.charCodeAt(0) ?? 0) % gradients.length];
  return src ? (
    <img src={src} alt={name} loading="lazy" width={size} height={size} style={{ width: size, height: size }} className={cn('shrink-0 rounded-full object-cover ring-2 ring-white', className)} />
  ) : (
    <div
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className={cn('grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-extrabold text-white ring-2 ring-white', g, className)}
      aria-label={name}
    >
      {initials(name)}
    </div>
  );
}

/* ---------------- States ---------------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('relative overflow-hidden rounded-xl bg-slate-100 before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent', className)} />;
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-20" />
      ))}
    </div>
  );
}

export function EmptyState({ title, text, action, icon }: { title: string; text?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-brand-200 bg-brand-50/40 px-6 py-12 text-center">
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-white text-brand-600 shadow-soft">{icon ?? <Inbox className="h-7 w-7" />}</div>
      <p className="font-bold text-ink">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ text, onRetry, retryLabel = 'Retry' }: { text: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-red-100 bg-red-50/60 px-6 py-10 text-center">
      <AlertTriangle className="mb-2 h-8 w-8 text-danger" />
      <p className="text-sm font-semibold text-red-700">{text}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-6 w-6 animate-spin text-brand-600', className)} />;
}

export function FullPageSpinner() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

/* ---------------- Modal / bottom sheet ---------------- */
export function Modal({ open, onClose, title, children, size = 'md', footer }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'; footer?: ReactNode }) {
  const mobile = useIsMobile();
  const drag = useDragControls();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', k);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  // Telefondagi "orqaga" tugmasi/ishorasi avval shu oynani yopadi (sahifadan chiqib ketmaydi)
  useEffect(() => {
    if (!open) return;
    const id = Math.random().toString(36).slice(2);
    let byBack = false;
    let pushed = false;
    // setTimeout: React StrictMode effektni ikki marta ishga tushirganda ortiqcha yozuv qolmasin
    const timer = window.setTimeout(() => {
      pushed = true;
      history.pushState({ ...history.state, __modal: id }, '');
    }, 0);
    const onPop = () => {
      if (!pushed || history.state?.__modal === id) return; // ustidagi boshqa oyna yopildi
      byBack = true;
      closeRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('popstate', onPop);
      // Tugma bilan yopilganda tarixdagi belgimizni olib tashlaymiz
      if (pushed && !byBack && history.state?.__modal === id) history.back();
    };
  }, [open]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center md:items-center md:p-6" role="dialog" aria-modal="true">
          <motion.div className="absolute inset-0 bg-navy-900/50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            initial={mobile ? { y: '100%' } : { opacity: 0, scale: 0.96, y: 12 }}
            animate={mobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
            exit={mobile ? { y: '100%' } : { opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            drag={mobile ? 'y' : false}
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, i) => i.offset.y > 120 && onClose()}
            className={cn(
              'relative flex max-h-[92vh] w-full flex-col overflow-hidden bg-white shadow-lift',
              'rounded-t-3xl md:rounded-3xl',
              size === 'sm' && 'md:max-w-md',
              size === 'md' && 'md:max-w-lg',
              size === 'lg' && 'md:max-w-2xl',
              size === 'xl' && 'md:max-w-4xl',
            )}
          >
            {mobile && (
              <div onPointerDown={(e) => drag.start(e)} className="flex cursor-grab touch-none justify-center pb-1 pt-2.5">
                <div className="h-1.5 w-12 rounded-full bg-slate-200" />
              </div>
            )}
            <div onPointerDown={(e) => mobile && drag.start(e)} className="flex touch-none items-center justify-between gap-3 px-5 pb-2 pt-4 md:touch-auto">
              <h3 className="text-lg font-extrabold text-ink">{title}</h3>
              <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-slate-100" aria-label="close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 pb-5 pt-1">{children}</div>
            {footer && <div className="border-t border-line bg-surface/60 px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- Tabs, Pagination ---------------- */
export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode; count?: number }[]; className?: string }) {
  return (
    <div className={cn('no-scrollbar flex max-w-full gap-1 overflow-x-auto overscroll-x-contain rounded-2xl bg-brand-50/70 p-1', className)}>
      {items.map((it) => (
        <button
          key={it.value}
          onClick={() => onChange(it.value)}
          className={cn(
            'relative flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold transition',
            value === it.value ? 'text-brand-700' : 'text-muted hover:text-ink',
          )}
        >
          {value === it.value && <motion.span layoutId={`tab-${items.map((i) => i.value).join()}`} className="absolute inset-0 rounded-xl bg-white shadow-soft" />}
          <span className="relative">{it.label}</span>
          {it.count ? <span className="relative rounded-full bg-brand-600 px-1.5 text-[10px] text-white">{it.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-2">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)} icon={<ChevronLeft className="h-4 w-4" />} aria-label="prev" />
      <span className="text-sm font-bold text-muted">
        {page} / {pages}
      </span>
      <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)} icon={<ChevronRight className="h-4 w-4" />} aria-label="next" />
    </div>
  );
}

/* ---------------- Stats ---------------- */
/** Statistika kartasi. `to` berilsa — bosilganda tegishli bo'limga o'tadi */
export function StatCard({ icon, label, value, hint, tone: t = 'brand', to, onClick, active }: { icon: ReactNode; label: string; value: ReactNode; hint?: ReactNode; tone?: 'brand' | 'blue' | 'green' | 'amber' | 'pink'; to?: string; onClick?: () => void; active?: boolean }) {
  const bg = { brand: 'bg-brand-100 text-brand-700', blue: 'bg-blue-100 text-blue-600', green: 'bg-green-100 text-green-600', amber: 'bg-amber-100 text-amber-600', pink: 'bg-pink-100 text-pink-600' }[t];
  const body = (
    <>
      <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', bg)}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xl font-extrabold text-ink">{value}</div>
        <div className="truncate text-xs font-semibold text-muted">{label}</div>
        {hint && <div className="mt-0.5 truncate text-[11px] font-bold text-success">{hint}</div>}
      </div>
      {(to || onClick) && <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />}
    </>
  );
  const cls = cn('group flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-soft transition', active ? 'border-brand-400 ring-2 ring-brand-200' : 'border-line/70', (to || onClick) && 'hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift active:scale-[.99]');
  if (to) return <Link to={to} className={cls}>{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cn(cls, 'w-full text-left')}>{body}</button>;
  return <div className={cls}>{body}</div>;
}

export function ProgressRing({ value, size = 96, stroke = 10, color = '#22C55E', children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#EEF0F7" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * Math.min(100, Math.max(0, value))) / 100 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children ?? <span className="text-lg font-extrabold">{Math.round(value)}%</span>}</div>
    </div>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('h-2 overflow-hidden rounded-full bg-slate-100', className)}>
      <motion.div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-accent" initial={{ width: 0 }} animate={{ width: `${Math.min(100, value)}%` }} transition={{ duration: 0.9 }} />
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink md:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex" aria-label={`${value}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" className={i <= Math.round(value) ? 'fill-amber-400' : 'fill-slate-200'}>
          <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" />
        </svg>
      ))}
    </span>
  );
}

/* ---------------- Table ---------------- */
export function Table({ head, children, className }: { head: ReactNode[]; children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto rounded-2xl border border-line bg-white', className)}>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-muted">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-4 py-3 font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/70">{children}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => <td className={cn('px-4 py-3 align-middle', className)}>{children}</td>;
