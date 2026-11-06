import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Check, Clock, CreditCard, MessageCircle, Star, Video, X, UserX } from 'lucide-react';
import { post } from '../../services/api';
import { useI18n, subjectName } from '../../i18n';
import { Avatar, Badge, Button, Field, Input, Modal, Stars, Textarea, statusTone } from '../../components/ui';
import { money, time, errorText, localInputToIso, localDay, weekdayOf } from '../../utils/format';
import { useToast } from '../../hooks/useToast';
import { PaySheet } from './PaySheet';
import { cn } from '../../utils/cn';
import type { Booking } from '../../types';

/** Bron kartasi — o'quvchi va o'qituvchi uchun turli amallar bilan */
export function BookingItem({ b, as }: { b: Booking; as: 'student' | 'teacher' }) {
  const { t, locale, tr } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const [modal, setModal] = useState<'cancel' | 'reschedule' | 'review' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [newTime, setNewTime] = useState('');
  const [rating, setRating] = useState(5);
  const [busy, setBusy] = useState(false);
  const [pay, setPay] = useState(false);

  const paid = b.payments.some((p) => p.status === 'paid');
  const needsPay = as === 'student' && b.status === 'requested' && Number(b.price) > 0 && !paid;
  const start = new Date(b.session.startAt);
  const end = new Date(b.session.endAt);
  const now = Date.now();
  const canJoin = b.status === 'confirmed' && now > start.getTime() - 15 * 60_000 && now < end.getTime() + 30 * 60_000;
  const started = now > start.getTime();
  const other = as === 'student' ? { name: b.teacher.user.fullName, avatar: b.teacher.user.avatarUrl, id: b.teacher.user.id } : { name: b.student.fullName, avatar: b.student.avatarUrl, id: b.student.id };

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast('success', ok);
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      setModal(null);
    } catch (e) {
      toast('error', errorText(e, t));
    } finally {
      setBusy(false);
    }
  };

  const message = async () => {
    const c = await post<{ id: string }>('/messages/conversations', { userId: other.id });
    nav(`/${as}/messages?c=${c.id}`);
  };

  return (
    <div className="rounded-2xl border border-line/70 bg-white p-4 shadow-soft transition hover:shadow-lift md:p-5">
      <div className="flex gap-3 md:gap-4">
        <div className="flex w-14 shrink-0 flex-col items-center rounded-2xl bg-brand-50 py-2 text-brand-700 md:w-16">
          <span className="text-[10px] font-bold uppercase">{tr<string[]>('teacher.weekdaysShort')[weekdayOf(localDay(start))]}</span>
          <span className="text-2xl font-extrabold leading-none">{Number(localDay(start).slice(8))}</span>
          <span className="mt-0.5 text-[11px] font-bold">{time(start)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={statusTone[b.status]}>{t(`booking.statuses.${b.status}`)}</Badge>
            <Badge tone="gray">{t(`lesson.types.${b.lesson.type}`)}</Badge>
            {Number(b.price) > 0 && <Badge tone={paid ? 'green' : 'yellow'}>{paid ? t('booking.paid') : t('booking.unpaid')}</Badge>}
          </div>
          <p className="mt-1.5 truncate font-extrabold text-ink">{b.lesson.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-muted">
            <span className="flex items-center gap-1.5"><Avatar name={other.name} src={other.avatar} size={20} /> {other.name}</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {time(start)}–{time(end)}</span>
            <span>{subjectName(b.lesson.subject, locale)}</span>
            <span className="font-bold text-ink">{money(b.price, locale)}</span>
          </div>
          {b.note && <p className="mt-2 rounded-lg bg-surface px-2.5 py-1.5 text-xs text-ink/70">“{b.note}”</p>}
          {b.review && <div className="mt-2"><Stars value={b.review.rating} /></div>}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-line/60 pt-3">
        {canJoin && (
          <Link to={`/room/${b.session.id}`}>
            <Button size="sm" icon={<Video className="h-4 w-4" />}>{as === 'teacher' ? t('room.start') : t('student.join')}</Button>
          </Link>
        )}
        {needsPay && <Button size="sm" icon={<CreditCard className="h-4 w-4" />} onClick={() => setPay(true)}>{t('booking.payNow')}</Button>}
        {as === 'teacher' && b.status === 'requested' && (
          <>
            <Button size="sm" variant="success" loading={busy} icon={<Check className="h-4 w-4" />} onClick={() => act(() => post(`/bookings/${b.id}/confirm`), t('common.done'))}>{t('booking.accept')}</Button>
            <Button size="sm" variant="danger" icon={<X className="h-4 w-4" />} onClick={() => setModal('reject')}>{t('booking.reject')}</Button>
          </>
        )}
        {as === 'teacher' && b.status === 'confirmed' && started && (
          <>
            <Button size="sm" variant="secondary" loading={busy} icon={<Check className="h-4 w-4" />} onClick={() => act(() => post(`/bookings/${b.id}/complete`), t('common.done'))}>{t('booking.complete')}</Button>
            <Button size="sm" variant="ghost" icon={<UserX className="h-4 w-4" />} onClick={() => act(() => post(`/bookings/${b.id}/no-show`))}>{t('booking.noShow')}</Button>
          </>
        )}
        {['requested', 'confirmed'].includes(b.status) && !started && b.lesson.type !== 'GROUP' && (
          <Button size="sm" variant="outline" icon={<CalendarClock className="h-4 w-4" />} onClick={() => setModal('reschedule')}>{t('booking.reschedule')}</Button>
        )}
        {['requested', 'confirmed'].includes(b.status) && !started && (
          <Button size="sm" variant="ghost" onClick={() => setModal('cancel')}>{t('booking.cancel')}</Button>
        )}
        {as === 'student' && b.status === 'completed' && !b.review && (
          <Button size="sm" variant="secondary" icon={<Star className="h-4 w-4" />} onClick={() => setModal('review')}>{t('booking.review')}</Button>
        )}
        <Button size="sm" variant="ghost" className="ml-auto" icon={<MessageCircle className="h-4 w-4" />} onClick={message}>{t('booking.message')}</Button>
      </div>

      <Modal open={modal === 'cancel' || modal === 'reject'} onClose={() => setModal(null)} title={modal === 'reject' ? t('booking.reject') : t('booking.cancelConfirm')} size="sm"
        footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setModal(null)}>{t('common.back')}</Button><Button variant="danger" loading={busy} onClick={() => act(() => post(`/bookings/${b.id}/${modal === 'reject' ? 'reject' : 'cancel'}`, { reason }), t('common.done'))}>{t('common.confirm')}</Button></div>}>
        {as === 'student' && <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">{t('booking.cancelPolicy')}</p>}
        <Field label={t('common.reason')}><Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /></Field>
      </Modal>

      <Modal open={modal === 'reschedule'} onClose={() => setModal(null)} title={t('booking.reschedule')} size="sm"
        footer={<Button className="w-full" loading={busy} disabled={!newTime} onClick={() => act(() => post(`/bookings/${b.id}/reschedule`, { startAt: localInputToIso(newTime) }), t('common.done'))}>{t('common.save')}</Button>}>
        <Field label={t('booking.newTime')} hint="Asia/Tashkent"><Input type="datetime-local" value={newTime} onChange={(e) => setNewTime(e.target.value)} step={1800} /></Field>
        {as === 'student' && <Link to={`/teachers/${b.teacher.id}`} className="mt-3 block text-sm font-bold text-brand-700">{t('search.availability')} →</Link>}
      </Modal>

      <Modal open={modal === 'review'} onClose={() => setModal(null)} title={t('review.title')} size="sm"
        footer={<Button className="w-full" loading={busy} onClick={() => act(() => post('/reviews', { bookingId: b.id, rating, comment: reason || undefined }), t('review.thanks'))}>{t('common.send')}</Button>}>
        <div className="mb-4 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} onClick={() => setRating(i)} aria-label={`${i}`}>
              <Star className={cn('h-10 w-10 transition', i <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} />
            </button>
          ))}
        </div>
        <Field label={t('review.comment')}><Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} /></Field>
      </Modal>
      <PaySheet open={pay} bookingId={b.id} amount={b.price} onClose={() => setPay(false)} />
    </div>
  );
}
