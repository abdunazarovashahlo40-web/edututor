import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { homeFor, useAuth } from '../store/auth';
import { FullPageSpinner } from '../components/ui';
import type { Role } from '../types';

/** Faqat kirgan va kerakli rolga ega foydalanuvchi (frontend himoyasi; asosiy tekshiruv backendda) */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { me, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <FullPageSpinner />;
  if (!me) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  if (!roles.includes(me.role)) return <Navigate to={homeFor(me.role)} replace />;
  return <>{children}</>;
}

/** Kirgan foydalanuvchini auth sahifalaridan kabinetga yo'naltirish */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (me) return <Navigate to={homeFor(me.role)} replace />;
  return <>{children}</>;
}
