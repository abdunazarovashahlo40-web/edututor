import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Award, BadgeCheck, Briefcase, CalendarDays, Clock, GraduationCap, Heart, Languages, MapPin, MessageCircle, ShieldCheck, Star, Users, Video } from 'lucide-react';
import { get, post } from '../../services/api';
import { useI18n, subjectName } from '../../i18n';
import { Avatar, Badge, Button, Card, ErrorState, FullPageSpinner, Stars } from '../../components/ui';
import { BookingSheet } from '../../features/booking/BookingSheet';
import { useAuth } from '../../store/auth';
import { date, minutesToHHMM, money, time } from '../../utils/format';
import { cn } from '../../utils/cn';

export default function TeacherProfile() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const { t, locale, tr } = useI18n();
  const { me } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [book, setBook] = useState<{ open: boolean; lessonId?: string }>({ open: false });
  const q = useQuery({ queryKey: ['teacher', id], queryFn: () => get<any>(`/teachers/${id}`) });
  const fav = useMutation({ mutationFn: () => post(`/favorites/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['teacher', id] }) });

  useEffect(() => {
    if (sp.get('book') && q.data) setBook({ open: true });
  }, [sp, q.data]);

  if (q.isLoading) return <FullPageSpinner />;
  if (q.isError || !q.data) return <div className="container-x py-16"><ErrorState text={t('common.error')} onRetry={() => q.refetch()} retryLabel={t('common.retry')} /></div>;
  const d = q.data;
  const days = tr<string[]>('teacher.weekdays');
  const total = d.ratingBreakdown.reduce((a: number, r: any) => a + r.count, 0) || 1;

  const message = async () => {
    if (!me) return nav('/login');
    const c = await post<{ id: string }>('/messages/conversations', { userId: d.user.id });
    nav(`/${me.role.toLowerCase()}/messages?c=${c.id}`);
  };

  return (
    <div className="container-x py-6 md:py-10">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* sarlavha */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="relative overflow-hidden p-0">
              <div className="h-28 bg-gradient-to-r from-brand-700 via-brand-500 to-accent md:h-36" />
              <div className="px-5 pb-6 md:px-8">
                <div className="-mt-12 flex flex-col gap-4 md:-mt-14 md:flex-row md:items-end">
                  <Avatar name={d.user.fullName} src={d.user.avatarUrl} size={112} className="ring-[6px]" />
                  <div className="flex-1">
                    <h1 className="flex items-center gap-2 text-2xl font-extrabold md:text-3xl">
                      {d.user.fullName}
                      {d.verification === 'APPROVED' && <BadgeCheck className="h-6 w-6 text-accent" aria-label="verified" />}
                    </h1>
                    <p className="mt-1 text-muted">{d.headline}</p>
                    {d.online && (
                      <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" /> {t('search.onlineNow')}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {me?.role === 'STUDENT' && (
                      <Button variant="outline" onClick={() => fav.mutate()} icon={<Heart className={cn('h-4 w-4', d.isFavorite && 'fill-current text-pink-500')} />} aria-label={t('search.favorite')} />
                    )}
                    {me?.id !== d.user.id && (
                      <Button variant="outline" onClick={message} icon={<MessageCircle className="h-4 w-4" />}>
                        {t('search.write')}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-ink/80">
                  <span className="flex items-center gap-1.5"><Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {Number(d.ratingAvg).toFixed(1)} ({d.ratingCount})</span>
                  <span className="flex items-center gap-1.5"><Briefcase className="h-4 w-4 text-brand-600" /> {t('search.expYears', { n: d.experienceYears })}</span>
                  <span className="flex items-center gap-1.5"><Users className="h-4 w-4 text-brand-600" /> {d.lessonsCompleted} {t('common.lessons')}</span>
                  <span className="flex items-center gap-1.5"><Languages className="h-4 w-4 text-brand-600" /> {d.languages.map((l: string) => l.toUpperCase()).join(' · ')}</span>
                  {d.city && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-brand-600" /> {d.city}</span>}
                  <span className="flex items-center gap-1.5"><Video className="h-4 w-4 text-brand-600" /> {[d.onlineFormat && t('teacher.online'), d.offlineFormat && t('teacher.offline')].filter(Boolean).join(', ')}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {d.subjects.map((s: any) => (
                    <Badge key={s.subject.id} tone="brand" className="px-3 py-1 text-xs">{subjectName(s.subject, locale)}</Badge>
                  ))}
                </div>
              </div>
            </Card>
          </motion.div>

          <Card>
            <h2 className="mb-3 text-lg font-extrabold">{t('search.about')}</h2>
            <p className="whitespace-pre-line leading-relaxed text-ink/80">{d.bio}</p>
            {d.videoIntroUrl && (
              <a href={d.videoIntroUrl} target="_blank" rel="noreferrer noopener" className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-brand-700">
                <Video className="h-4 w-4" /> YouTube
              </a>
            )}
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-surface p-4">
                <p className="mb-1 flex items-center gap-2 text-sm font-extrabold"><GraduationCap className="h-4 w-4 text-brand-600" /> {t('search.education')}</p>
                <p className="text-sm text-ink/80">{d.education}</p>
              </div>
              <div className="rounded-2xl bg-surface p-4">
                <p className="mb-1 flex items-center gap-2 text-sm font-extrabold"><Award className="h-4 w-4 text-brand-600" /> {t('search.certs')}</p>
                {d.certificates.length ? (
                  <ul className="space-y-1 text-sm text-ink/80">
                    {d.certificates.map((c: any) => (
                      <li key={c.id} className="flex flex-wrap items-center gap-1.5">• {c.title}{c.issuer && `, ${c.issuer}`}{c.year && ` (${c.year})`}{c.checkStatus === 'verified' && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700"><ShieldCheck className="h-3 w-3" /> {t('doc.verifiedBadge')}</span>}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">—</p>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-extrabold">{t('search.lessonsOffered')}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {d.lessons.map((l: any) => (
                <div key={l.id} className="flex flex-col rounded-2xl border border-line p-4">
                  <div className="flex items-center justify-between">
                    <Badge tone={l.type === 'TRIAL' ? 'green' : l.type === 'GROUP' ? 'blue' : 'brand'}>{t(`lesson.types.${l.type}`)}</Badge>
                    <span className="flex items-center gap-1 text-xs font-semibold text-muted"><Clock className="h-3.5 w-3.5" /> {l.durationMin} {t('common.min')}</span>
                  </div>
                  <p className="mt-2 font-extrabold">{l.title}</p>
                  {l.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{l.description}</p>}
                  {l.type === 'GROUP' && l.sessions[0] && (
                    <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-brand-700"><CalendarDays className="h-3.5 w-3.5" /> {date(l.sessions[0].startAt, locale)} · {time(l.sessions[0].startAt)}</p>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <span className="text-lg font-extrabold">{money(l.price, locale)}</span>
                    <Button size="sm" onClick={() => setBook({ open: true, lessonId: l.id })}>{t('search.book')}</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-extrabold">{t('search.allReviews')}</h2>
            <div className="mb-5 grid gap-5 md:grid-cols-[160px_1fr]">
              <div className="text-center">
                <div className="font-display text-5xl font-bold">{Number(d.ratingAvg).toFixed(1)}</div>
                <Stars value={Number(d.ratingAvg)} size={18} />
                <div className="mt-1 text-xs text-muted">{d.ratingCount} {t('common.reviews')}</div>
              </div>
              <div className="space-y-1.5">
                {d.ratingBreakdown.map((r: any) => (
                  <div key={r.rating} className="flex items-center gap-2 text-xs font-semibold">
                    <span className="w-3">{r.rating}</span>
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${(r.count / total) * 100}%` }} />
                    </div>
                    <span className="w-6 text-right text-muted">{r.count}</span>
                  </div>
                ))}
              </div>
            </div>
            {!d.reviews.length && <p className="text-sm text-muted">{t('search.noReviews')}</p>}
            <div className="divide-y divide-line">
              {d.reviews.map((r: any) => (
                <div key={r.id} className="py-4">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={r.student.fullName} src={r.student.avatarUrl} size={36} />
                    <div className="flex-1">
                      <div className="text-sm font-bold">{r.student.fullName}</div>
                      <div className="flex items-center gap-2"><Stars value={r.rating} size={12} /><span className="text-[11px] text-muted">{date(r.createdAt, locale)}</span></div>
                    </div>
                    <Badge tone="green"><BadgeCheck className="h-3 w-3" /> {t('review.verified')}</Badge>
                  </div>
                  {r.comment && <p className="mt-2 text-sm text-ink/80">{r.comment}</p>}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* o'ng panel: narx va jadval */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-6">
            <div className="text-sm font-semibold text-muted">{t('search.from')}</div>
            <div className="text-3xl font-extrabold">{money(d.hourlyPrice, locale)}</div>
            <div className="text-sm text-muted">{t('common.perHour')}</div>
            {d.trialPrice && Number(d.trialPrice) > 0 && <Badge tone="green" className="mt-2">{t('lesson.types.TRIAL')}: {money(d.trialPrice, locale)}</Badge>}
            {d.lessons.some((l: any) => l.type === 'TRIAL') && (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> {t('booking.guaranteeBadge')}
              </p>
            )}
            <Button size="lg" className="mt-5 w-full" onClick={() => setBook({ open: true })} icon={<CalendarDays className="h-4 w-4" />} disabled={!d.lessons.length}>
              {t('booking.book')}
            </Button>
          </Card>
          <Card>
            <p className="mb-3 font-extrabold">{t('search.availability')}</p>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
                const w = d.availability.filter((a: any) => a.weekday === wd);
                return (
                  <div key={wd} className="flex items-start justify-between gap-2 text-sm">
                    <span className="font-semibold text-ink/80">{days[wd]}</span>
                    <span className="text-right text-muted">{w.length ? w.map((a: any) => `${minutesToHHMM(a.startMinute)}–${minutesToHHMM(a.endMinute)}`).join(', ') : '—'}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </aside>
      </div>

      {/* mobil: pastki bron tugmasi */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 pt-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="text-lg font-extrabold">{money(d.hourlyPrice, locale)}</div>
            <div className="text-xs text-muted">{t('common.perHour')}</div>
          </div>
          <Button size="lg" onClick={() => setBook({ open: true })} disabled={!d.lessons.length}>{t('search.book')}</Button>
        </div>
      </div>

      {d.lessons.length > 0 && <BookingSheet open={book.open} onClose={() => setBook({ open: false })} teacherId={d.id} lessons={d.lessons} initialLessonId={book.lessonId} />}
      <div className="h-16 lg:hidden" />
      <p className="sr-only"><Link to="/teachers">{t('nav.teachers')}</Link></p>
    </div>
  );
}
