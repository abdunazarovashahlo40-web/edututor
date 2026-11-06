import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpenCheck, FileText, Plus, Paperclip, Trash2 } from 'lucide-react';
import { del, get, post, upload } from '../../services/api';
import { useI18n } from '../../i18n';
import { useAuth } from '../../store/auth';
import { Avatar, Badge, Button, Card, EmptyState, Field, Input, ListSkeleton, Modal, PageHeader, Tabs, Textarea, statusTone } from '../../components/ui';
import { dateTime, errorText, localInputToIso } from '../../utils/format';
import { useToast } from '../../hooks/useToast';
import { cn } from '../../utils/cn';

export default function HomeworkPage() {
  const { t, locale } = useI18n();
  const { me } = useAuth();
  const isTeacher = me?.role === 'TEACHER';
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<'all' | 'assigned' | 'submitted' | 'completed'>('all');
  const q = useQuery({ queryKey: ['homework', tab], queryFn: () => get<any[]>('/homework', tab === 'all' ? {} : { status: tab }) });
  const [open, setOpen] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<{ text: string; file?: File; score: string; feedback: string }>({ text: '', score: '', feedback: '' });

  const refresh = () => qc.invalidateQueries({ queryKey: ['homework'] });
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      toast('success', t('common.done'));
      refresh();
      setOpen(null);
      setForm({ text: '', score: '', feedback: '' });
    } catch (e) {
      toast('error', errorText(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title={t('menu.homework')} actions={isTeacher && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>{t('hw.new')}</Button>} />
      <Tabs value={tab} onChange={setTab} className="mb-4 w-fit" items={[
        { value: 'all', label: t('common.all') },
        { value: 'assigned', label: t('hw.statuses.assigned') },
        { value: 'submitted', label: t('hw.statuses.submitted') },
        { value: 'completed', label: t('hw.statuses.completed') },
      ]} />
      {q.isLoading ? <ListSkeleton /> : !q.data?.length ? <EmptyState title={t('common.empty')} icon={<BookOpenCheck className="h-7 w-7" />} /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {q.data.map((h) => {
            const overdue = h.dueAt && new Date(h.dueAt) < new Date() && h.status === 'assigned';
            const sub = h.submissions[0];
            return (
              <button key={h.id} onClick={() => setOpen(h)} className="rounded-2xl border border-line/70 bg-white p-4 text-left shadow-soft transition hover:shadow-lift">
                <div className="flex items-center gap-2">
                  <Badge tone={statusTone[h.status]}>{t(`hw.statuses.${h.status}`)}</Badge>
                  {overdue && <Badge tone="red">{t('hw.overdue')}</Badge>}
                  {sub?.score != null && <Badge tone="brand">{sub.score}/{h.maxScore}</Badge>}
                </div>
                <p className="mt-2 font-extrabold">{h.title}</p>
                {h.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{h.description}</p>}
                <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-muted">
                  <Avatar name={isTeacher ? h.student.fullName : h.teacher.user.fullName} src={isTeacher ? h.student.avatarUrl : h.teacher.user.avatarUrl} size={22} />
                  {isTeacher ? h.student.fullName : h.teacher.user.fullName}
                  {h.dueAt && <span className={cn('ml-auto', overdue && 'text-danger')}>{t('hw.dueIn', { date: dateTime(h.dueAt, locale) })}</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Tafsilot / topshirish / baholash */}
      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.title} size="lg">
        {open && (
          <div className="space-y-4">
            {open.description && <p className="whitespace-pre-line text-sm text-ink/80">{open.description}</p>}
            {open.attachmentUrl && <a href={open.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-700"><Paperclip className="h-4 w-4" /> {t('hw.attachment')}</a>}
            {open.dueAt && <p className="text-sm font-semibold text-muted">{t('hw.dueIn', { date: dateTime(open.dueAt, locale) })}</p>}
            {open.submissions.map((s: any) => (
              <div key={s.id} className="rounded-2xl bg-surface p-4">
                <p className="mb-1 text-xs font-bold uppercase text-muted">{t('hw.yourAnswer')} · {dateTime(s.createdAt, locale)}</p>
                {s.text && <p className="whitespace-pre-line text-sm">{s.text}</p>}
                {s.fileUrl && <a href={s.fileUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-brand-700"><FileText className="h-4 w-4" /> {t('common.file')}</a>}
                {s.score != null && (
                  <div className="mt-3 rounded-xl bg-white p-3">
                    <p className="text-sm font-extrabold text-brand-700">{t('hw.score')}: {s.score}/{open.maxScore}</p>
                    {s.feedback && <p className="mt-1 text-sm"><b>{t('hw.teacherFeedback')}:</b> {s.feedback}</p>}
                  </div>
                )}
              </div>
            ))}
            {!isTeacher && open.status !== 'completed' && (
              <div className="space-y-3 border-t border-line pt-4">
                <Field label={t('hw.answer')}><Textarea value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} /></Field>
                <Field label={t('common.file')} hint="PDF, DOCX, JPG, PNG · ≤10MB"><Input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.txt" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] })} className="py-2" /></Field>
                <Button loading={busy} disabled={!form.text && !form.file} onClick={() => run(() => {
                  const fd = new FormData();
                  if (form.text) fd.append('text', form.text);
                  if (form.file) fd.append('file', form.file);
                  return upload(`/homework/${open.id}/submit`, fd);
                })}>{t('hw.submit')}</Button>
              </div>
            )}
            {isTeacher && open.submissions.length > 0 && open.status !== 'completed' && (
              <div className="grid gap-3 border-t border-line pt-4 md:grid-cols-[120px_1fr]">
                <Field label={`${t('hw.score')} / ${open.maxScore}`}><Input type="number" min={0} max={open.maxScore} value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} /></Field>
                <Field label={t('hw.feedback')}><Textarea value={form.feedback} onChange={(e) => setForm({ ...form, feedback: e.target.value })} className="min-h-[44px]" /></Field>
                <Button className="md:col-span-2" loading={busy} disabled={form.score === ''} onClick={() => run(() => post(`/homework/${open.id}/review`, { score: Number(form.score), feedback: form.feedback || undefined, complete: true }))}>{t('hw.reviewAction')}</Button>
              </div>
            )}
            {isTeacher && (
              <Button variant="danger" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => run(() => del(`/homework/${open.id}`))}>{t('common.delete')}</Button>
            )}
          </div>
        )}
      </Modal>
      {isTeacher && <CreateHomework open={creating} onClose={() => setCreating(false)} onDone={refresh} />}
    </div>
  );
}

function CreateHomework({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const students = useQuery({ queryKey: ['my-students'], queryFn: () => get<any[]>('/teachers/me/students'), enabled: open });
  const [sel, setSel] = useState<string[]>([]);
  const [f, setF] = useState({ title: '', description: '', dueAt: '', maxScore: '100' });
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('studentIds', sel.join(','));
      fd.append('title', f.title);
      if (f.description) fd.append('description', f.description);
      if (f.dueAt) fd.append('dueAt', localInputToIso(f.dueAt));
      fd.append('maxScore', f.maxScore);
      if (file) fd.append('file', file);
      await upload('/homework', fd);
      toast('success', t('common.done'));
      onDone();
      onClose();
      setSel([]);
      setF({ title: '', description: '', dueAt: '', maxScore: '100' });
    } catch (e) {
      toast('error', errorText(e, t));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={t('hw.new')} size="lg" footer={<Button className="w-full" loading={busy} disabled={!sel.length || f.title.length < 3} onClick={submit}>{t('common.create')}</Button>}>
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-[13px] font-bold">{t('hw.students')}</p>
          {!students.data?.length ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700">{t('hw.noStudents')}</p> : (
            <div className="flex flex-wrap gap-2">
              {students.data.map((s) => {
                const on = sel.includes(s.student.id);
                return (
                  <button key={s.student.id} onClick={() => setSel(on ? sel.filter((x) => x !== s.student.id) : [...sel, s.student.id])} className={cn('flex items-center gap-2 rounded-full border-2 py-1 pl-1 pr-3 text-sm font-bold', on ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-line')}>
                    <Avatar name={s.student.fullName} src={s.student.avatarUrl} size={26} /> {s.student.fullName}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <Field label={t('hw.title')}><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label={t('hw.description')}><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={t('hw.due')} className="md:col-span-2"><Input type="datetime-local" value={f.dueAt} onChange={(e) => setF({ ...f, dueAt: e.target.value })} /></Field>
          <Field label={t('hw.maxScore')}><Input type="number" value={f.maxScore} onChange={(e) => setF({ ...f, maxScore: e.target.value })} /></Field>
        </div>
        <Field label={t('hw.attachment')} hint="PDF, DOCX, JPG, PNG · ≤10MB"><Input type="file" onChange={(e) => setFile(e.target.files?.[0])} className="py-2" /></Field>
      </div>
    </Modal>
  );
}
