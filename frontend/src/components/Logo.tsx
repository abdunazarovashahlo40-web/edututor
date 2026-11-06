import { Link } from 'react-router-dom';
import { cn } from '../utils/cn';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn('h-8 w-8', className)} aria-hidden>
      <defs>
        <linearGradient id="lg-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#5B21B6" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#lg-a)" />
      <path d="M20 9 6 15.2l14 6.2 14-6.2z" fill="#fff" />
      <path d="M11.5 19v6c0 2.4 3.8 4.6 8.5 4.6s8.5-2.2 8.5-4.6v-6L20 22.8z" fill="#fff" opacity=".85" />
      <path d="M32 16.5v8" stroke="#FBBF24" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="32" cy="25.6" r="1.6" fill="#FBBF24" />
    </svg>
  );
}

export function Logo({ light, className, to = '/' }: { light?: boolean; className?: string; to?: string }) {
  return (
    <Link to={to} className={cn('flex items-center gap-2', className)} aria-label="EduTutor">
      <LogoMark />
      <span className={cn('text-[19px] font-extrabold tracking-tight', light ? 'text-white' : 'text-ink')}>
        Edu<span className={light ? 'text-brand-300' : 'text-brand-700'}>Tutor</span>
      </span>
    </Link>
  );
}
