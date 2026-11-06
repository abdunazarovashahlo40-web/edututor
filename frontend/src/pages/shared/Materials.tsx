import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, FolderOpen, Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import { del, get, upload } from '../../services/api';
import { useI18n } from '../../i18n';
import { useAuth } from '../../store/auth';
import { Badge, Button, Checkbox, EmptyState, Field, Input, ListSkeleton, Modal, PageHeader, Select } from '../../components/ui';
import { date, errorText, fileSize } from '../../utils/format';
import { useToast } from '../../hooks/useToast';

export default function MaterialsPage() {
  const { t, locale } = useI18n();
  const { me } = useAuth();
  const isTeacher = me?.role === 'TEACHER';
  const qc = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const q = useQuery({ queryKey: ['materials', search], queryFn: () => get<any[]>('/materials', { q: search || undefined }) });
  const lessons = useQuery({ queryKey: ['lessons', 'mine'], queryFn: () => get<any[]>('/lessons/mine'), enabled: isTeacher });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: '', lessonId: '', isPublic: false });
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', f.title || file.name);
      if (f.lessonId) fd.append('lessonId', f.lessonId);
      fd.append('isPublic', String(f.isPublic));
      await upload('/materials', fd);
      toast('success', t('common.done'));
      qc.invalidateQueries({ queryKey: ['materials'] });
      setOpen(false);
      setFile(undefined);
      setF({ title: '', lessonId: '', isPublic: false });
    } catch (e) {
      toast('error', errorText(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title={t('menu.materials')} actions={isTeacher && <Button icon={<Upload className="h-4 w-4" />} onClick={() => setOpen(true)}>{t('materials.new')}</Button>} />
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('common.search')} className="mb-4 max-w-sm" />
      {q.isLoading ? <ListSkeleton /> : !q.data?.length ? <EmptyState title={t('common.empty')} icon={<FolderOpen className="h-7 w-7" />} /> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {q.data.map((m) => (
            <div key={m.id} className="flex items-start gap-3 rounded-2xl border border-line/70 bg-white p-4 shadow-soft">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700">{m.mimeType.startsWith('image/') ? <ImageIcon className="h-6 w-6" /> : <FileText className="h-6 w-6" />}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{m.title}</p>
                <p className="truncate text-xs text-muted">{m.fileName} · {fileSize(m.sizeBytes)} · {date(m.createdAt, locale)}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {m.lesson && <Badge tone="brand">{m.lesson.title}</Badge>}
                  {!isTeacher && <Badge>{m.teacher.user.fullName}</Badge>}
                  {isTeacher && m.isPublic && <Badge tone="green">{t('materials.public')}</Badge>}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <a href={m.fileUrl} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-lg text-brand-700 hover:bg-brand-50" aria-label={t('common.download')}><Download className="h-4 w-4" /></a>
                {isTeacher && <button onClick={async () => { await del(`/materials/${m.id}`); qc.invalidateQueries({ queryKey: ['materials'] }); }} className="grid h-9 w-9 place-items-center rounded-lg text-danger hover:bg-red-50" aria-label={t('common.delete')}><Trash2 className="h-4 w-4" /></button>}
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={t('materials.new')} footer={<Button className="w-full" loading={busy} disabled={!file} onClick={submit}>{t('common.upload')}</Button>}>
        <div className="space-y-4">
          <Field label={t('common.file')} hint="PDF, DOCX, PPTX, XLSX, JPG, PNG · ≤10MB"><Input type="file" onChange={(e) => setFile(e.target.files?.[0])} className="py-2" /></Field>
          <Field label={t('lesson.title')}><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={file?.name} /></Field>
          <Field label={t('materials.lesson')}>
            <Select value={f.lessonId} onChange={(e) => setF({ ...f, lessonId: e.target.value })}>
              <option value="">{t('materials.none')}</option>
              {lessons.data?.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </Select>
          </Field>
          <Checkbox label={t('materials.public')} checked={f.isPublic} onChange={(e) => setF({ ...f, isPublic: e.target.checked })} />
        </div>
      </Modal>
    </div>
  );
}
