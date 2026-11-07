/**
 * Telefondagi "orqaga" (tugma yoki chetdan tortish) bank ilovalaridagidek ishlashi uchun:
 *  - ochiq oyna/menyu bo'lsa — avval o'sha yopiladi (buni Modal o'zi bajaradi, ui/index.tsx);
 *  - ichki sahifada — oldingi sahifaga qaytadi (oddiy brauzer tarixi);
 *  - bosh sahifada (kabinet) — darhol chiqib ketmaydi: "Chiqish uchun yana bir marta bosing".
 * Faqat o'rnatilgan ilovada (PWA) va telefon brauzerida ishlaydi.
 */
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { useToast } from '../../hooks/useToast';

const ROOTS = new Set(['/', '/student', '/teacher', '/admin']);
const GUARD = '__exitGuard';

export function BackButtonGuard() {
  const loc = useLocation();
  const { t } = useI18n();
  const toast = useToast();
  const armed = useRef(false);
  const timer = useRef<number>();

  const enabled = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(pointer: coarse)').matches);

  // Bosh sahifaga kelganda tarixga bitta "to'siq" yozuv qo'yamiz
  useEffect(() => {
    if (!enabled || !ROOTS.has(loc.pathname)) return;
    if (history.state?.[GUARD]) return;
    history.pushState({ ...history.state, [GUARD]: true }, '');
  }, [enabled, loc.pathname]);

  useEffect(() => {
    if (!enabled) return;
    const onPop = () => {
      if (!ROOTS.has(location.pathname) || history.state?.[GUARD] || history.state?.__modal) return;
      // To'siq yozuvi olib tashlandi — bu "orqaga" bosilganini bildiradi
      if (armed.current) return; // ikkinchi marta: brauzer o'zi chiqib ketadi
      armed.current = true;
      toast('info', t('nav.pressAgainToExit'));
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        armed.current = false;
        if (ROOTS.has(location.pathname) && !history.state?.[GUARD]) history.pushState({ ...history.state, [GUARD]: true }, '');
      }, 2000);
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.clearTimeout(timer.current);
    };
  }, [enabled, t, toast]);

  return null;
}
