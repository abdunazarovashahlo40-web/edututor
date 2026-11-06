import { createContext, useCallback, useContext, useEffect, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, get, post } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';
import { useI18n } from '../i18n';
import type { Me } from '../types';

type AuthCtx = {
  me: Me | null;
  loading: boolean;
  setMe: (m: Me | null) => void;
  refetch: () => Promise<unknown>;
  logout: () => Promise<void>;
};
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { setLocale } = useI18n();
  const q = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await get<Me>('/auth/me');
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return null;
        throw e;
      }
    },
    staleTime: 60_000,
    retry: 1,
  });
  const me = q.data ?? null;

  const setMe = useCallback((m: Me | null) => qc.setQueryData(['me'], m), [qc]);

  useEffect(() => {
    const onLocked = () => void q.refetch();
    window.addEventListener('et:locked', onLocked);
    return () => window.removeEventListener('et:locked', onLocked);
  }, [q.refetch]);

  // Realtime: faqat qulf ochiq bo'lganda ulanamiz
  useEffect(() => {
    if (!me || me.appLock.locked) return;
    const s = connectSocket();
    const onNotif = () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['bookings'] });
    };
    const onMsg = () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['unread'] });
    };
    s.on('notification', onNotif);
    s.on('message:new', onMsg);
    return () => {
      s.off('notification', onNotif);
      s.off('message:new', onMsg);
    };
  }, [me?.id, me?.appLock.locked, qc]);

  // Ilova qulfi o'rnatilgan qurilma id'sini eslab qolamiz (qayta login'da PIN saqlanishi uchun)
  useEffect(() => {
    if (!me?.appLock.hasPin || !me.appLock.deviceId) return;
    try {
      localStorage.setItem('et_device', me.appLock.deviceId);
    } catch {
      /* ignore */
    }
  }, [me?.appLock.hasPin, me?.appLock.deviceId]);

  useEffect(() => {
    if (me?.locale) setLocale(me.locale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  const logout = useCallback(async () => {
    await post('/auth/logout').catch(() => undefined);
    disconnectSocket();
    qc.clear();
    qc.setQueryData(['me'], null);
    // To'liq qayta yuklash: xotiradagi holat, ochiq so'rovlar va parallel token yangilash
    // jarayoni qolib ketib, foydalanuvchini yana "kiritib qo'ymasligi" uchun.
    window.location.replace('/login');
  }, [qc]);

  return <Ctx.Provider value={{ me, loading: q.isLoading, setMe, refetch: q.refetch, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('AuthProvider missing');
  return c;
}

export function homeFor(role?: string) {
  return role === 'ADMIN' ? '/admin' : role === 'TEACHER' ? '/teacher' : '/student';
}
