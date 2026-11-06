import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CalendarCheck2, Clock, Users } from 'lucide-react';
import { get, post } from '../../services/api';
import { useI18n } from '../../i18n';
import { Badge, Button, Modal, Skeleton, Textarea } from '../../components/ui';
import { addDays, date, localDay, money, time, weekdayOf, errorText } from '../../utils/format';
import { useAuth } from '../../store/auth';
import { useToast } from '../../hooks/useToast';
import { cn } from '../../utils/cn';
import { PaySheet } from './PaySheet';

type Lesson = {
  id: string;
  title: string;
  type: 'INDIVIDUAL' | 'GROUP' | 'TRIAL' | 'CONSULTATION';
  durationMin: number;
  price: string;
  maxStudents: number;
  sessions: { id: string; startAt: string; endAt: string; capacity: number; _count?: { bookings: number } }[];
};

export function BookingSheet({ open, onClose, teacherId, lessons, initialLessonId }: { open: boolean; onClose: () => void; teacherId: string; lessons: Lesson[]; initialLessonId?: string }) {
  const { t, tr, locale } = useI18n();
  const { me } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [lessonId, setLessonId] = useState(initialLessonId ?? lessons[0]?.id);
  const lesson = lessons.find((l) => l.id === lessonId);
  const today = localDay();
  const [day, setDay] = useState(today);
  const [slot, setSlot] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [pay, setPay] = useState<{ id: string; amount: string } | null>(null);

  useEffect(() => {
    if (initialLessonId) setLessonId(initialLessonId);
  }, [initialLessonId]);
  useEffect(() => {
    setSlot(null);
    setSessionId(null);
  }, [lessonId, day]);

  const slots = useQuery({
    queryKey: ['slots', teacherId, lesson?.durationMin],
    queryFn: () => get<{ date: string; startAt: string }[]>(`/teachers/${teacherId}/slots`, { from: today, days: 14, duration: lesson!.durationMin }),
    enabled: open && !!lesson && lesson.type !== 'GROUP',
  });
  const days = useMemo(() => Array.from({ length: 14 }).map((_, i) => addDays(today, i)), [today]);
  const daySlots = slots.data?.filter((s) => s.date === day) ?? [];
  const short = tr<string[]>('teacher.weekdaysShort');

  const book = async () => {
    if (!me) return nav('/login', { state: { from: location.pathname + location.search } });
    if (!lesson) return;
    setBusy(true);
    try {
      const r = await post<{ booking: { id: string; price: string }; needsPayment: boolean }>('/bookings', {
        lessonId: lesson.id,
        ...(lesson.type === 'GROUP' ? { sessionId } : { startAt: slot }),
        note: note || undefined,
      });
      qc.invalidateQueries({ queryKey: ['slots'] });
      qc.invalidateQueries({ queryKey: ['bookings'] });
      toast('success', t('booking.success'));
      onClose();
      if (r.needsPayment) setPay({ id: r.booking.id, amount: r.booking.price });
      else nav('/student/lessons');
    } catch (e) {
      toast('error', errorText(e, t));
      qc.invalidateQueries({ queryKey: ['slots'] });
    } finally {
      setBusy(false);
    }
  };

  const ready = lesson && (lesson.type === 'GROUP' ? !!sessionId : !!slot);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={t('booking.book')}
        size="lg"
        footer={
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="text-lg font-extrabold">{lesson ? money(lesson.price, locale) : '—'}</div>
              <div className="text-xs text-muted">{lesson && `${lesson.durationMin} ${t('common.min')}`}</div>
            </div>
            {me && me.role !== 'STUDENT' ? (
              <Badge tone="yellow">{t('roles.STUDENT')}</Badge>
            ) : (
              <Button size="lg" disabled={!ready && !!me} loading={busy} onClick={book} icon={<CalendarCheck2 className="h-4 w-4" />}>
                {me ? t('booking.confirmBook') : t('booking.loginToBook')}
              </Button>
            )}
          </div>
        }
      >
        <p className="mb-2 text-sm font-bold">{t('booking.chooseLesson')}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {lessons.map((l) => (
            <button key={l.id} onClick={() => setLessonId(l.id)} className={cn('rounded-2xl border-2 p-3 text-left transition', lessonId === l.id ? 'border-brand-600 bg-brand-50' : 'border-line hover:border-brand-200')}>
              <div className="flex items-center justify-between gap-2">
                <Badge tone={l.type === 'TRIAL' ? 'green' : l.type === 'GROUP' ? 'blue' : 'brand'}>{t(`lesson.types.${l.type}`)}</Badge>
                <span className="text-sm font-extrabold">{money(l.price, locale)}</span>
              </div>
              <div className="mt-1.5 line-clamp-1 text-sm font-bold">{l.title}</div>
              <div className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                <Clock className="h-3.5 w-3.5" /> {l.durationMin} {t('common.min')}
                {l.type === 'GROUP' && (
                  <>
                    <Users className="ml-2 h-3.5 w-3.5" /> {l.maxStudents}
                  </>
                )}
              </div>
            </button>
          ))}
        </div>

        {lesson?.type === 'GROUP' ? (
          <div className="mt-5">
            <p className="mb-2 text-sm font-bold">{t('booking.chooseSession')}</p>
            {!lesson.sessions.length && <p className="text-sm text-muted">{t('booking.noSlots')}</p>}
            <div className="space-y-2">
              {lesson.sessions.map((s) => {
                const left = s.capacity - (s._count?.bookings ?? 0);
                return (
                  <button key={s.id} disabled={left <= 0} onClick={() => setSessionId(s.id)} className={cn('flex w-full items-center justify-between rounded-2xl border-2 px-4 py-3 text-left disabled:opacity-50', sessionId === s.id ? 'border-brand-600 bg-brand-50' : 'border-line')}>
                    <span className="font-bold">
                      {date(s.startAt, locale, true)} · {time(s.startAt)}
                    </span>
                    <Badge tone={left > 0 ? 'green' : 'red'}>{left > 0 ? t('booking.seatsLeft', { n: left }) : t('booking.groupFull')}</Badge>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            <p className="mb-2 mt-5 text-sm font-bold">{t('booking.chooseDate')}</p>
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
              {days.map((d) => {
                const n = slots.data?.filter((s) => s.date === d).length ?? 0;
                return (
                  <button key={d} onClick={() => setDay(d)} className={cn('flex w-14 shrink-0 flex-col items-center rounded-2xl border-2 py-2 transition', day === d ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white', !n && day !== d && 'opacity-45')}>
                    <span className="text-[10px] font-bold uppercase">{short[weekdayOf(d)]}</span>
                    <span className="text-lg font-extrabold">{Number(d.slice(8))}</span>
                    <span className={cn('mt-0.5 h-1.5 w-1.5 rounded-full', n ? (day === d ? 'bg-white' : 'bg-success') : 'bg-transparent')} />
                  </button>
                );
              })}
            </div>
            <p className="mb-2 mt-5 text-sm font-bold">{t('booking.chooseTime')}</p>
            {slots.isLoading ? (
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : daySlots.length ? (
              <motion.div layout className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {daySlots.map((s) => (
                  <button key={s.startAt} onClick={() => setSlot(s.startAt)} className={cn('h-11 rounded-xl border-2 text-sm font-bold transition', slot === s.startAt ? 'border-brand-600 bg-brand-600 text-white' : 'border-line hover:border-brand-300')}>
                    {time(s.startAt)}
                  </button>
                ))}
              </motion.div>
            ) : (
              <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-muted">{t('booking.noSlots')}</p>
            )}
          </>
        )}
        <label className="mt-5 block">
          <span className="mb-1.5 block text-sm font-bold">{t('booking.note')}</span>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="min-h-[72px]" />
        </label>
        <p className="mt-3 text-xs text-muted">{t('booking.cancelPolicy')}</p>
      </Modal>
      <PaySheet open={!!pay} bookingId={pay?.id ?? null} amount={pay?.amount} onClose={() => (setPay(null), nav('/student/lessons'))} />
    </>
  );
}
