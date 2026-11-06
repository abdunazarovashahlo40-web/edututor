import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { BookOpen, CalendarPlus, Clock, Copy, Eye, EyeOff, Pencil, Plus, Search, Trash2, Users, X } from 'lucide-react';
import { del, get, patch, post } from '../../services/api';
import { useI18n, subjectName } from '../../i18n';
import { useAuth } from '../../store/auth';
import { Badge, Button, EmptyState, Field, Input, ListSkeleton, Modal, PageHeader, Select, Tabs, Textarea, statusTone } from '../../components/ui';
import { VerificationBanner } from '../../components/VerificationBanner';
import { date, errorText, localInputToIso, money, time } from '../../utils/format';
import { useToast } from '../../hooks/useToast';
import type { Subject } from '../../types';

export default function TeacherLessons() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [sessionFor, setSessionFor] = useState<any | null>(null);
  const [newSession, setNewSession] = useState('');
  const q = useQuery({ queryKey: ['lessons', 'mine', status, search], queryFn: () => get<any[]>('/lessons/mine', { status: status || undefined, q: search || undefined }) });

  useEffect(() => {
    if (sp.get('new')) {
      setEditing(null);
      setFormOpen(true);
      setSp({}, { replace: true });
    }
  }, [sp, setSp]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['lessons'] });
  const mut = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => (refresh(), toast('success', t('common.done'))),
    onError: (e) => toast('error', errorText(e, t)),
  });

  return (
    <div>
      <VerificationBanner />
      <PageHeader title={t('menu.myLessons')} actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => (setEditing(null), setFormOpen(true))}>{t('lesson.new')}</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={status} onChange={setStatus} items={[{ value: '', label: t('common.all') }, { value: 'published', label: t('lesson.statuses.published') }, { value: 'draft', label: t('lesson.statuses.draft') }]} />
        <Input icon={<Search className="h-4 w-4" />} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('common.search')} className="md:w-64" />
      </div>
      {q.isLoading ? <ListSkeleton /> : !q.data?.length ? (
        <EmptyState title={t('lesson.noLessons')} icon={<BookOpen className="h-7 w-7" />} action={<Button size="sm" onClick={() => setFormOpen(true)}>{t('lesson.new')}</Button>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {q.data.map((l, i) => (
            <motion.div key={l.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="flex flex-col rounded-2xl border border-line/70 bg-white p-4 shadow-soft">
              <div className="flex items-center gap-1.5">
                <Badge tone={statusTone[l.status]}>{t(`lesson.statuses.${l.status}`)}</Badge>
                <Badge tone={l.type === 'GROUP' ? 'blue' : l.type === 'TRIAL' ? 'green' : 'brand'}>{t(`lesson.types.${l.type}`)}</Badge>
              </div>
              <p className="mt-2 font-extrabold">{l.title}</p>
              <p className="text-xs font-semibold text-muted">{subjectName(l.subject, locale)}</p>
              <div className="mt-2 flex flex-wrap gap-x-3 text-xs font-semibold text-muted">
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {l.durationMin} {t('common.min')}</span>
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {l.maxStudents}</span>
                <span>{l._count.bookings} {t('lesson.bookingsCount')}</span>
              </div>
              {l.type === 'GROUP' || l.type === 'CONSULTATION' ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {l.sessions.slice(0, 4).map((s: any) => (
                    <span key={s.id} className="group inline-flex items-center gap-1 rounded-lg bg-surface px-2 py-1 text-[11px] font-bold">
                      {date(s.startAt, locale)} {time(s.startAt)}
                      <button onClick={() => confirm(t('booking.cancelConfirm')) && mut.mutate(() => del(`/lessons/${l.id}/sessions/${s.id}`))} className="text-muted hover:text-danger" aria-label="remove"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="mt-auto flex items-center justify-between pt-3">
                <span className="text-lg font-extrabold">{money(l.price, locale)}</span>
                <div className="flex gap-1">
                  {(l.type === 'GROUP' || l.type === 'CONSULTATION') && <IconBtn label={t('lesson.addSession')} onClick={() => setSessionFor(l)}><CalendarPlus className="h-4 w-4" /></IconBtn>}
                  <IconBtn label={l.status === 'published' ? t('lesson.unpublish') : t('lesson.publish')} onClick={() => mut.mutate(() => patch(`/lessons/${l.id}`, { status: l.status === 'published' ? 'draft' : 'published' }))}>
                    {l.status === 'published' ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </IconBtn>
                  <IconBtn label={t('common.copy')} onClick={() => (setEditing({ ...l, id: undefined, title: `${l.title} (2)`, status: 'draft' }), setFormOpen(true))}><Copy className="h-4 w-4" /></IconBtn>
                  <IconBtn label={t('common.edit')} onClick={() => (setEditing(l), setFormOpen(true))}><Pencil className="h-4 w-4" /></IconBtn>
                  <IconBtn label={t('common.delete')} danger onClick={() => confirm(t('lesson.deleteConfirm')) && mut.mutate(() => del(`/lessons/${l.id}`))}><Trash2 className="h-4 w-4" /></IconBtn>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      <LessonForm open={formOpen} lesson={editing} onClose={() => setFormOpen(false)} onSaved={refresh} />
      <Modal open={!!sessionFor} onClose={() => setSessionFor(null)} title={t('lesson.addSession')} size="sm" footer={
        <Button className="w-full" disabled={!newSession} loading={mut.isPending} onClick={() => mut.mutate(async () => { await post(`/lessons/${sessionFor.id}/sessions`, { startAt: localInputToIso(newSession) }); setSessionFor(null); setNewSession(''); })}>{t('common.save')}</Button>}>
        <Field label={t('common.date')} hint="Asia/Tashkent"><Input type="datetime-local" value={newSession} onChange={(e) => setNewSession(e.target.value)} /></Field>
      </Modal>
    </div>
  );
}

function IconBtn({ children, label, onClick, danger }: { children: ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className={danger ? 'grid h-9 w-9 place-items-center rounded-lg text-danger hover:bg-red-50' : 'grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-brand-50 hover:text-brand-700'}>
      {children}
    </button>
  );
}

function LessonForm({ open, lesson, onClose, onSaved }: { open: boolean; lesson: any | null; onClose: () => void; onSaved: () => void }) {
  const { t, locale } = useI18n();
  const { me } = useAuth();
  const toast = useToast();
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: () => get<Subject[]>('/subjects'), staleTime: 300_000 });
  const schema = z.object({
    title: z.string().min(3, t('common.required')).max(140),
    description: z.string().max(4000).optional(),
    subjectId: z.string().min(1, t('common.required')),
    type: z.enum(['INDIVIDUAL', 'GROUP', 'TRIAL', 'CONSULTATION']),
    durationMin: z.coerce.number().int().min(30).max(180),
    price: z.coerce.number().min(0).max(10_000_000),
    maxStudents: z.coerce.number().int().min(1).max(30),
    level: z.string().max(60).optional(),
    meetingMethod: z.enum(['webrtc', 'jitsi']),
    status: z.enum(['draft', 'published']),
    sessions: z.array(z.object({ startAt: z.string().min(1) })),
  });
  type F = z.infer<typeof schema>;
  const defaults: F = {
    title: '', description: '', subjectId: '', type: 'INDIVIDUAL', durationMin: 60, price: Number(me?.teacherProfile?.hourlyPrice ?? 100000),
    maxStudents: 1, level: '', meetingMethod: 'webrtc', status: me?.teacherProfile?.verification === 'APPROVED' ? 'published' : 'draft', sessions: [],
  };
  const { register, handleSubmit, reset, watch, control, setValue, formState } = useForm<F>({ resolver: zodResolver(schema), defaultValues: defaults });
  const sessions = useFieldArray({ control, name: 'sessions' });
  const type = watch('type');
  useEffect(() => {
    if (!open) return;
    reset(lesson ? { ...defaults, ...lesson, description: lesson.description ?? '', level: lesson.level ?? '', price: Number(lesson.price), subjectId: lesson.subject?.id ?? lesson.subjectId, status: lesson.status === 'published' ? 'published' : 'draft', sessions: [] } : defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lesson]);
  useEffect(() => {
    if (type === 'INDIVIDUAL' || type === 'TRIAL') setValue('maxStudents', 1);
    if (type === 'GROUP' && watch('maxStudents') < 2) setValue('maxStudents', 8);
    if (type === 'TRIAL') setValue('durationMin', 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const submit = handleSubmit(async (v) => {
    try {
      const body = { ...v, description: v.description || null, level: v.level || null };
      if (lesson?.id) {
        const { sessions: _s, ...rest } = body;
        await patch(`/lessons/${lesson.id}`, rest);
      } else {
        await post('/lessons', { ...body, sessions: v.sessions.filter((s) => s.startAt).map((s) => ({ startAt: localInputToIso(s.startAt) })) });
      }
      toast('success', t('common.saved'));
      onSaved();
      onClose();
    } catch (e) {
      toast('error', errorText(e, t));
    }
  });

  const err = (k: keyof F) => (formState.errors[k]?.message as string | undefined);
  return (
    <Modal open={open} onClose={onClose} title={lesson?.id ? t('lesson.editTitle') : t('lesson.new')} size="lg" footer={
      <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button loading={formState.isSubmitting} onClick={submit}>{t('common.save')}</Button></div>}>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        <Field label={t('lesson.title')} error={err('title')} className="md:col-span-2"><Input {...register('title')} /></Field>
        <Field label={t('lesson.subject')} error={err('subjectId')}>
          <Select {...register('subjectId')}>
            <option value="">{t('common.select')}</option>
            {subjects.data?.map((s) => <option key={s.id} value={s.id}>{subjectName(s, locale)}</option>)}
          </Select>
        </Field>
        <Field label={t('lesson.type')}>
          <Select {...register('type')} disabled={!!lesson?.id}>
            {(['INDIVIDUAL', 'GROUP', 'TRIAL', 'CONSULTATION'] as const).map((x) => <option key={x} value={x}>{t(`lesson.types.${x}`)}</option>)}
          </Select>
        </Field>
        <Field label={t('lesson.duration')} error={err('durationMin')}>
          <Select {...register('durationMin')}>{[30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m}</option>)}</Select>
        </Field>
        <Field label={t('lesson.price')} error={err('price')}><Input type="number" inputMode="numeric" step={1000} {...register('price')} /></Field>
        <Field label={t('lesson.maxStudents')} error={err('maxStudents')}><Input type="number" {...register('maxStudents')} disabled={type === 'INDIVIDUAL' || type === 'TRIAL'} /></Field>
        <Field label={`${t('lesson.level')} (${t('common.optional')})`}><Input {...register('level')} placeholder="A2, 9-sinf, DTM..." /></Field>
        <Field label={t('lesson.meeting')}>
          <Select {...register('meetingMethod')}><option value="webrtc">{t('lesson.webrtc')}</option><option value="jitsi">{t('lesson.jitsi')}</option></Select>
        </Field>
        <Field label={t('lesson.status')}>
          <Select {...register('status')}><option value="draft">{t('lesson.statuses.draft')}</option><option value="published">{t('lesson.statuses.published')}</option></Select>
        </Field>
        <Field label={t('lesson.description')} className="md:col-span-2"><Textarea {...register('description')} /></Field>
        {!lesson?.id && (type === 'GROUP' || type === 'CONSULTATION') && (
          <div className="md:col-span-2">
            <p className="mb-2 text-[13px] font-bold">{t('lesson.sessions')} <span className="font-normal text-muted">(Asia/Tashkent)</span></p>
            <div className="space-y-2">
              {sessions.fields.map((f, i) => (
                <div key={f.id} className="flex gap-2">
                  <Input type="datetime-local" {...register(`sessions.${i}.startAt` as const)} />
                  <Button type="button" variant="ghost" onClick={() => sessions.remove(i)} icon={<X className="h-4 w-4" />} aria-label="remove" />
                </div>
              ))}
            </div>
            <Button type="button" variant="secondary" size="sm" className="mt-2" icon={<CalendarPlus className="h-4 w-4" />} onClick={() => sessions.append({ startAt: '' })}>{t('lesson.addSession')}</Button>
          </div>
        )}
      </form>
    </Modal>
  );
}
