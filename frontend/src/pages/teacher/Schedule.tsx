import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, Save, Trash2, CalendarRange } from 'lucide-react';
import { get, put } from '../../services/api';
import { useI18n } from '../../i18n';
import { Button, Card, Input, PageHeader, Tabs } from '../../components/ui';
import { addDays, errorText, hhmmToMinutes, localDay, minutesToHHMM, time, weekdayOf } from '../../utils/format';
import { useToast } from '../../hooks/useToast';
import { useIsMobile } from '../../hooks/useMedia';
import { cn } from '../../utils/cn';
import type { Booking } from '../../types';

type W = { weekday: number; startMinute: number; endMinute: number };
const HOURS = Array.from({ length: 15 }).map((_, i) => 8 + i); // 08:00–22:00

export default function Schedule() {
  const { t, tr } = useI18n();
  const [tab, setTab] = useState<'calendar' | 'availability'>('calendar');
  return (
    <div>
      <PageHeader title={t('menu.schedule')} />
      <Tabs value={tab} onChange={setTab} className="mb-4 w-fit" items={[{ value: 'calendar', label: t('teacher.calendar') }, { value: 'availability', label: t('teacher.availability') }]} />
      {tab === 'calendar' ? <WeekCalendar /> : <AvailabilityEditor days={tr<string[]>('teacher.weekdays')} />}
    </div>
  );
}

function WeekCalendar() {
  const { t, tr, locale } = useI18n();
  const mobile = useIsMobile();
  const today = localDay();
  const monday = addDays(today, -((weekdayOf(today) + 6) % 7));
  const [offset, setOffset] = useState(0);
  const start = addDays(monday, offset * 7);
  const days = Array.from({ length: 7 }).map((_, i) => addDays(start, i));
  const from = new Date(start + 'T00:00:00+05:00').toISOString();
  const to = new Date(addDays(start, 7) + 'T00:00:00+05:00').toISOString();
  const q = useQuery({ queryKey: ['bookings', 'calendar', start], queryFn: () => get<Booking[]>('/bookings', { scope: 'all', from, to, limit: 100 }) });
  const avail = useQuery({ queryKey: ['availability'], queryFn: () => get<W[]>('/availability/me') });
  const short = tr<string[]>('teacher.weekdaysShort');
  const items = (q.data ?? []).filter((b) => !['cancelled', 'rejected', 'rescheduled'].includes(b.status));
  const [selDay, setSelDay] = useState(today);

  const header = (
    <div className="mb-3 flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => setOffset(offset - 1)} icon={<ChevronLeft className="h-4 w-4" />} aria-label="prev" />
      <Button variant="outline" size="sm" onClick={() => setOffset(0)}>{t('teacher.thisWeek')}</Button>
      <Button variant="outline" size="sm" onClick={() => setOffset(offset + 1)} icon={<ChevronRight className="h-4 w-4" />} aria-label="next" />
      <span className="ml-2 text-sm font-bold text-muted">{days[0].slice(5).replace('-', '.')} – {days[6].slice(5).replace('-', '.')}</span>
    </div>
  );

  if (mobile) {
    const dayItems = items.filter((b) => localDay(b.session.startAt) === selDay);
    return (
      <div>
        {header}
        <div className="mb-3 grid grid-cols-7 gap-1">
          {days.map((d) => {
            const n = items.filter((b) => localDay(b.session.startAt) === d).length;
            return (
              <button key={d} onClick={() => setSelDay(d)} className={cn('flex flex-col items-center rounded-xl py-2', selDay === d ? 'bg-brand-600 text-white' : d === today ? 'bg-brand-50' : 'bg-white')}>
                <span className="text-[10px] font-bold">{short[weekdayOf(d)]}</span>
                <span className="font-extrabold">{Number(d.slice(8))}</span>
                <span className={cn('mt-0.5 h-1.5 w-1.5 rounded-full', n ? (selDay === d ? 'bg-white' : 'bg-brand-600') : 'bg-transparent')} />
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {!dayItems.length && <Card><p className="py-4 text-center text-sm text-muted">{t('teacher.noToday')}</p></Card>}
          {dayItems.map((b) => (
            <Link key={b.id} to={`/room/${b.session.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3">
              <span className="w-14 text-center font-extrabold text-brand-700">{time(b.session.startAt)}</span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{b.lesson.title}</p><p className="truncate text-xs text-muted">{b.student.fullName}</p></div>
              <span className={cn('h-2.5 w-2.5 rounded-full', b.status === 'confirmed' ? 'bg-success' : b.status === 'requested' ? 'bg-warning' : 'bg-brand-400')} />
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const HOUR_PX = 56;
  return (
    <div>
      {header}
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <div className="grid min-w-[860px]" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
          <div className="border-b border-line" />
          {days.map((d) => (
            <div key={d} className={cn('border-b border-l border-line py-2 text-center', d === today && 'bg-brand-50')}>
              <div className="text-[11px] font-bold uppercase text-muted">{short[weekdayOf(d)]}</div>
              <div className={cn('text-lg font-extrabold', d === today && 'text-brand-700')}>{Number(d.slice(8))}</div>
            </div>
          ))}
          <div>
            {HOURS.map((h) => <div key={h} style={{ height: HOUR_PX }} className="pr-2 pt-1 text-right text-[11px] font-semibold text-muted">{String(h).padStart(2, '0')}:00</div>)}
          </div>
          {days.map((d) => {
            const wd = weekdayOf(d);
            return (
              <div key={d} className="relative border-l border-line" style={{ height: HOURS.length * HOUR_PX }}>
                {HOURS.map((h) => <div key={h} style={{ top: (h - 8) * HOUR_PX }} className="absolute inset-x-0 border-t border-line/60" />)}
                {avail.data?.filter((w) => w.weekday === wd).map((w, i) => (
                  <div key={i} className="absolute inset-x-0 bg-green-50/70" style={{ top: ((w.startMinute - 480) / 60) * HOUR_PX, height: ((w.endMinute - w.startMinute) / 60) * HOUR_PX }} />
                ))}
                {items.filter((b) => localDay(b.session.startAt) === d).map((b) => {
                  const s = hhmmToMinutes(time(b.session.startAt));
                  const e = hhmmToMinutes(time(b.session.endAt)) || 1440;
                  return (
                    <Link key={b.id} to={`/room/${b.session.id}`} className={cn('absolute inset-x-1 overflow-hidden rounded-lg border-l-4 px-1.5 py-1 text-[11px] font-bold shadow-sm', b.status === 'requested' ? 'border-warning bg-amber-50 text-amber-800' : b.status === 'completed' ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-brand-600 bg-brand-100 text-brand-900')}
                      style={{ top: ((s - 480) / 60) * HOUR_PX + 1, height: Math.max(22, ((e - s) / 60) * HOUR_PX - 2) }}>
                      {time(b.session.startAt)} {b.lesson.title}
                      <div className="truncate font-semibold opacity-75">{b.student.fullName}</div>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted"><span className="mr-1 inline-block h-3 w-3 rounded bg-green-100 align-middle" /> {t('teacher.availability')} · {locale.toUpperCase()} · Asia/Tashkent</p>
    </div>
  );
}

function AvailabilityEditor({ days }: { days: string[] }) {
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['availability'], queryFn: () => get<W[]>('/availability/me') });
  const [w, setW] = useState<W[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (q.data) setW(q.data.map(({ weekday, startMinute, endMinute }) => ({ weekday, startMinute, endMinute })));
  }, [q.data]);
  const order = [1, 2, 3, 4, 5, 6, 0];
  const total = useMemo(() => w.reduce((a, x) => a + (x.endMinute - x.startMinute), 0) / 60, [w]);

  const save = async () => {
    setBusy(true);
    try {
      await put('/availability/me', { windows: w });
      toast('success', t('common.saved'));
      qc.invalidateQueries({ queryKey: ['availability'] });
      qc.invalidateQueries({ queryKey: ['slots'] });
    } catch (e) {
      toast('error', errorText(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-muted"><CalendarRange className="h-4 w-4" /> {total} h / {t('teacher.thisWeek').toLowerCase()} · Asia/Tashkent</p>
        <Button loading={busy} onClick={save} icon={<Save className="h-4 w-4" />}>{t('common.save')}</Button>
      </div>
      <div className="divide-y divide-line">
        {order.map((wd) => {
          const list = w.map((x, i) => ({ ...x, i })).filter((x) => x.weekday === wd);
          return (
            <div key={wd} className="flex flex-col gap-2 py-3 md:flex-row md:items-start">
              <div className="w-32 pt-2 font-bold">{days[wd]}</div>
              <div className="flex-1 space-y-2">
                {!list.length && <p className="pt-2 text-sm text-muted">—</p>}
                {list.map((x) => (
                  <div key={x.i} className="flex items-center gap-2">
                    <Input type="time" step={1800} value={minutesToHHMM(x.startMinute)} onChange={(e) => setW(w.map((y, j) => (j === x.i ? { ...y, startMinute: hhmmToMinutes(e.target.value) } : y)))} className="w-32" />
                    <span className="text-muted">—</span>
                    <Input type="time" step={1800} value={minutesToHHMM(x.endMinute === 1440 ? 1439 : x.endMinute)} onChange={(e) => setW(w.map((y, j) => (j === x.i ? { ...y, endMinute: hhmmToMinutes(e.target.value) } : y)))} className="w-32" />
                    <button onClick={() => setW(w.filter((_, j) => j !== x.i))} className="grid h-10 w-10 place-items-center rounded-lg text-danger hover:bg-red-50" aria-label={t('common.delete')}><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
              <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => {
                const last = list[list.length - 1];
                const s = last ? Math.min(last.endMinute + 60, 1380) : 540;
                setW([...w, { weekday: wd, startMinute: s, endMinute: Math.min(s + 180, 1440) }]);
              }}>{t('teacher.addInterval')}</Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
