import { Link } from 'react-router-dom';
import { ShieldAlert, Clock, XCircle } from 'lucide-react';
import { useAuth } from '../store/auth';
import { useI18n } from '../i18n';
import { Button } from './ui';
import { cn } from '../utils/cn';

export function VerificationBanner() {
  const { me } = useAuth();
  const { t } = useI18n();
  const v = me?.teacherProfile?.verification;
  if (!v || v === 'APPROVED') return null;
  const I = v === 'PENDING' ? Clock : v === 'REJECTED' ? XCircle : ShieldAlert;
  return (
    <div className={cn('mb-5 flex flex-wrap items-center gap-3 rounded-2xl border p-4', v === 'REJECTED' ? 'border-red-200 bg-red-50 text-red-800' : v === 'PENDING' ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-amber-200 bg-amber-50 text-amber-800')}>
      <I className="h-5 w-5 shrink-0" />
      <p className="flex-1 text-sm font-semibold">{t(`teacher.verifyBanner.${v}`, { note: me?.teacherProfile?.verificationNote ?? '' })}</p>
      {v !== 'PENDING' && <Link to="/teacher/profile"><Button size="sm" variant="outline">{t('menu.profile')}</Button></Link>}
    </div>
  );
}
