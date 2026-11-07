import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight, PlayCircle, Search, Users, GraduationCap, Video, ShieldCheck, Wallet, LineChart, CheckCircle2, ChevronDown, Star,
  Calculator, Languages, Atom, FlaskConical, Dna, Monitor, Code, BookOpen, MessageCircle, Landmark, Award, Sparkles, Mic, Camera, PhoneOff,
} from 'lucide-react';
import { get } from '../../services/api';
import { useI18n, subjectName } from '../../i18n';
import { Avatar, Button, ProgressRing, Select, Skeleton, Stars } from '../../components/ui';
import { TeacherCard } from '../../components/TeacherCard';
import { compact } from '../../utils/format';
import type { Subject, TeacherCard as TC } from '../../types';
import { cn } from '../../utils/cn';

const ICONS: Record<string, any> = {
  calculator: Calculator, languages: Languages, atom: Atom, 'flask-conical': FlaskConical, dna: Dna, monitor: Monitor, code: Code,
  'book-open': BookOpen, 'message-circle': MessageCircle, landmark: Landmark, award: Award, 'graduation-cap': GraduationCap,
};
const SUBJECT_COLORS = ['from-violet-500 to-purple-600', 'from-sky-500 to-blue-600', 'from-emerald-400 to-teal-600', 'from-amber-400 to-orange-500', 'from-pink-500 to-rose-500', 'from-indigo-500 to-violet-600'];

const fade = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-60px' }, transition: { duration: 0.55 } };

function Section({ id, title, subtitle, children, className }: { id?: string; title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cn('container-x scroll-mt-24 py-14 md:py-20', className)}>
      <motion.div {...fade} className="mb-8 max-w-2xl md:mb-10">
        <h2 className="text-[28px] font-extrabold leading-tight tracking-tight text-ink md:text-4xl">{title}</h2>
        {subtitle && <p className="mt-2 text-muted md:text-lg">{subtitle}</p>}
      </motion.div>
      {children}
    </section>
  );
}

export default function Landing() {
  const { t, locale } = useI18n();
  const nav = useNavigate();
  const hero = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: hero, offset: ['start start', 'end start'] });
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -140]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, 60]);

  const subjects = useQuery({ queryKey: ['subjects'], queryFn: () => get<Subject[]>('/subjects'), staleTime: 300_000 });
  const featured = useQuery({ queryKey: ['teachers', 'featured'], queryFn: () => get<TC[]>('/teachers', { sort: 'rating', limit: 6 }) });
  const stats = useQuery({ queryKey: ['public-stats'], queryFn: () => get<{ teachers: number; students: number; lessons: number; rating: number }>('/public/stats'), staleTime: 300_000 });
  const reviews = useQuery({ queryKey: ['public-reviews'], queryFn: () => get<{ id: string; rating: number; comment: string; student: { name: string; avatarUrl: string | null }; teacher: { id: string; user: { fullName: string } } }[]>('/public/reviews'), staleTime: 300_000 });

  const [q, setQ] = useState('');
  const [subject, setSubject] = useState('');
  const [price, setPrice] = useState('');
  const [faq, setFaq] = useState<number | null>(0);

  const search = (e: FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (subject) p.set('subject', subject);
    if (price) p.set('maxPrice', price);
    nav(`/teachers?${p}`);
  };

  const statItems = [
    { icon: Users, value: stats.data ? compact(stats.data.teachers) + '+' : '—', label: t('landing.statTeachers') },
    { icon: GraduationCap, value: stats.data ? compact(stats.data.students) + '+' : '—', label: t('landing.statStudents') },
    { icon: Video, value: stats.data ? compact(stats.data.lessons) + '+' : '—', label: t('landing.statLessons') },
  ];

  return (
    <div className="overflow-x-hidden">
      {/* ================= HERO ================= */}
      <div ref={hero} className="relative">
        <div className="pointer-events-none absolute inset-0 -top-24 bg-[radial-gradient(900px_500px_at_80%_10%,rgba(139,92,246,.22),transparent_60%),radial-gradient(700px_400px_at_10%_30%,rgba(59,130,246,.12),transparent_60%)]" />
        <div className="container-x relative grid items-center gap-10 pb-10 pt-6 md:pt-12 lg:grid-cols-[1.05fr_1fr] lg:pb-20">
          <div>
            <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-bold text-brand-700 shadow-soft">
              <Sparkles className="h-3.5 w-3.5" /> {t('landing.badge')}
            </motion.span>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mt-5 text-[clamp(28px,8.4vw,38px)] font-extrabold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-[58px]">
              {t('landing.title1')} <span className="text-gradient">{t('landing.title2')}</span> {t('landing.title3')}
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted">
              {t('landing.subtitle')}
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="mt-7 flex flex-wrap gap-3">
              <Link to="/teachers">
                <Button size="lg">
                  {t('landing.ctaFind')} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/register?role=teacher">
                <Button size="lg" variant="outline">
                  {t('landing.ctaTeach')}
                </Button>
              </Link>
              <a href="#how" className="hidden sm:block">
                <Button size="lg" variant="ghost" icon={<PlayCircle className="h-5 w-5" />}>
                  {t('landing.ctaHow')}
                </Button>
              </a>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="mt-9 flex flex-wrap gap-6">
              {statItems.map((s) => (
                <div key={s.label} className="flex items-center gap-2.5">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-brand-600 shadow-soft">
                    <s.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-lg font-extrabold leading-none">{s.value}</div>
                    <div className="text-xs font-semibold text-muted">{s.label}</div>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* hero vizual kompozitsiyasi */}
          <div className="relative mx-auto h-[420px] w-full max-w-[560px] sm:h-[480px]">
            <motion.div style={{ y: y3 }} className="absolute inset-x-6 bottom-0 top-10 rounded-[40px] bg-gradient-to-br from-brand-200 via-brand-100 to-blue-100" />
            <motion.div style={{ y: y3 }} className="absolute right-8 top-0 h-40 w-40 rounded-full bg-brand-400/30 blur-3xl" />
            {/* video dars kartasi */}
            <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, type: 'spring' }} className="absolute left-[11%] top-16 w-[78%] overflow-hidden rounded-3xl border border-white bg-navy-800 shadow-lift">
              <div className="relative aspect-[16/11] bg-gradient-to-br from-[#1E1B4B] to-[#312E81] p-5">
                <div className="font-display text-[15px] leading-8 text-white/85 sm:text-lg">
                  x² + 2x = 0<br />x(x + 2) = 0<br />x = 0, x = −2
                </div>
                <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-black/30 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> LIVE · 24:16
                </div>
                <div className="absolute right-4 top-4 h-20 w-16 overflow-hidden rounded-xl border-2 border-white/60 bg-gradient-to-br from-pink-300 to-brand-400 sm:h-24 sm:w-20">
                  <div className="grid h-full place-items-center text-xl font-extrabold text-white">DK</div>
                </div>
                <div className="absolute bottom-6 right-1/2 grid h-24 w-24 translate-x-1/2 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-brand-500 text-2xl font-extrabold text-white ring-4 ring-white/20 sm:h-28 sm:w-28">AR</div>
              </div>
              <div className="flex items-center justify-center gap-3 bg-navy-900 py-3">
                {[Mic, Camera].map((I, i) => (
                  <span key={i} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white">
                    <I className="h-4 w-4" />
                  </span>
                ))}
                <span className="grid h-9 w-9 place-items-center rounded-full bg-red-500 text-white">
                  <PhoneOff className="h-4 w-4" />
                </span>
              </div>
            </motion.div>
            {/* dars kartasi */}
            <motion.div style={{ y: y1 }} className="absolute -left-1 top-6 sm:left-0">
              <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 5, repeat: Infinity }} className="flex items-center gap-3 rounded-2xl border border-white bg-white/95 p-3 pr-5 shadow-lift">
                <Avatar name="Azizbek Rahimov" size={40} />
                <div>
                  <div className="text-sm font-extrabold">Matematika</div>
                  <div className="text-[11px] text-muted">{t('landing.individual')}</div>
                  <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {t('landing.liveNow')}
                  </div>
                </div>
              </motion.div>
            </motion.div>
            {/* progress kartasi */}
            <motion.div style={{ y: y2 }} className="absolute -right-1 bottom-16 sm:right-0">
              <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 6, repeat: Infinity }} className="flex items-center gap-3 rounded-2xl border border-white bg-white/95 p-3.5 shadow-lift">
                <ProgressRing value={85} size={64} stroke={7}>
                  <span className="text-sm font-extrabold">85%</span>
                </ProgressRing>
                <div>
                  <div className="text-[11px] font-semibold text-muted">{t('landing.progress')}</div>
                  <div className="flex items-end gap-1 pt-1">
                    {[10, 16, 12, 22, 28].map((h, i) => (
                      <motion.span key={i} initial={{ height: 0 }} animate={{ height: h }} transition={{ delay: 0.6 + i * 0.1 }} className="w-2 rounded-sm bg-gradient-to-t from-green-500 to-green-300" />
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>
            {/* reyting kartasi */}
            <motion.div style={{ y: y1 }} className="absolute bottom-2 left-4 sm:left-10">
              <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 4.5, repeat: Infinity, delay: 1 }} className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-lift">
                <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                <span className="text-sm font-extrabold">{stats.data?.rating || 4.9}</span>
                <span className="text-xs text-muted">{t('landing.statRating')}</span>
              </motion.div>
            </motion.div>
            {/* suzuvchi ikonkalar */}
            {[
              { I: Calculator, c: 'left-[42%] top-0', d: 0 },
              { I: Atom, c: 'right-2 top-24', d: 0.6 },
              { I: Languages, c: 'left-2 bottom-36', d: 1.2 },
            ].map(({ I, c, d }, i) => (
              <motion.span key={i} animate={{ y: [0, -12, 0], rotate: [0, 8, 0] }} transition={{ duration: 5 + i, repeat: Infinity, delay: d }} className={cn('absolute grid h-11 w-11 place-items-center rounded-2xl bg-white text-brand-600 shadow-lift', c)}>
                <I className="h-5 w-5" />
              </motion.span>
            ))}
          </div>
        </div>

        {/* qidiruv paneli */}
        <div className="container-x relative">
          <motion.form {...fade} onSubmit={search} className="grid gap-3 rounded-3xl border border-line/70 bg-white p-3 shadow-lift md:grid-cols-[1.4fr_1fr_1fr_auto] md:p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('landing.searchPlaceholder')} className="h-12 w-full rounded-2xl bg-surface pl-11 pr-3 text-[15px] outline-none focus:ring-4 focus:ring-brand-500/15" />
            </div>
            <Select value={subject} onChange={(e) => setSubject(e.target.value)} className="h-12 rounded-2xl border-0 bg-surface" aria-label={t('landing.searchSubject')}>
              <option value="">{t('landing.searchSubject')}: {t('common.all')}</option>
              {subjects.data?.map((s) => (
                <option key={s.id} value={s.slug}>
                  {subjectName(s, locale)}
                </option>
              ))}
            </Select>
            <Select value={price} onChange={(e) => setPrice(e.target.value)} className="h-12 rounded-2xl border-0 bg-surface" aria-label={t('landing.searchPrice')}>
              <option value="">{t('landing.searchPrice')}: {t('landing.anyPrice')}</option>
              <option value="100000">≤ 100 000</option>
              <option value="150000">≤ 150 000</option>
              <option value="200000">≤ 200 000</option>
            </Select>
            <Button size="lg" className="h-12 rounded-2xl px-7" type="submit" icon={<Search className="h-4 w-4" />}>
              {t('common.search')}
            </Button>
          </motion.form>
        </div>
      </div>

      {/* ================= FANLAR ================= */}
      <Section id="subjects" title={t('landing.popularSubjects')} subtitle={t('landing.popularSubtitle')}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {subjects.isLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-3xl" />)}
          {subjects.data?.slice(0, 12).map((s, i) => {
            const I = ICONS[s.icon ?? ''] ?? BookOpen;
            return (
              <motion.div key={s.id} {...fade} transition={{ delay: (i % 6) * 0.05 }}>
                <Link to={`/teachers?subject=${s.slug}`} className="group block rounded-3xl border border-line/70 bg-white p-4 shadow-soft transition hover:-translate-y-1 hover:shadow-lift">
                  <span className={cn('grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br text-white transition group-hover:scale-110', SUBJECT_COLORS[i % SUBJECT_COLORS.length])}>
                    <I className="h-6 w-6" />
                  </span>
                  <div className="mt-3 truncate font-extrabold text-ink">{subjectName(s, locale)}</div>
                  <div className="text-xs font-semibold text-muted">
                    {s.teacherCount ?? 0} {t('landing.statTeachers').toLowerCase()}
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </Section>

      {/* ================= TAVSIYA ETILGAN O'QITUVCHILAR ================= */}
      <Section title={t('landing.featured')} subtitle={t('landing.featuredSubtitle')} className="pt-0 md:pt-0">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {featured.isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-3xl" />)}
          {featured.data?.map((tc, i) => <TeacherCard key={tc.id} t={tc} index={i} />)}
        </div>
        <div className="mt-6 text-center">
          <Link to="/teachers">
            <Button variant="secondary" size="lg">
              {t('nav.teachers')} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </Section>

      {/* ================= QANDAY ISHLAYDI ================= */}
      <section id="how" className="scroll-mt-24 bg-white py-14 md:py-20">
        <div className="container-x">
          <motion.h2 {...fade} className="mb-10 text-[28px] font-extrabold tracking-tight md:text-4xl">
            {t('landing.howTitle')}
          </motion.h2>
          <div className="relative grid gap-5 md:grid-cols-4">
            <div className="absolute left-0 right-0 top-8 hidden h-0.5 bg-gradient-to-r from-brand-200 via-brand-400 to-blue-300 md:block" />
            {[
              [Search, t('landing.how1'), t('landing.how1d')],
              [Wallet, t('landing.how2'), t('landing.how2d')],
              [Video, t('landing.how3'), t('landing.how3d')],
              [LineChart, t('landing.how4'), t('landing.how4d')],
            ].map(([I, title, d], i) => {
              const Icon = I as typeof Search;
              return (
                <motion.div key={i} {...fade} transition={{ delay: i * 0.1 }} className="relative">
                  <div className="relative z-10 mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-700 to-brand-500 text-white shadow-lift">
                    <Icon className="h-7 w-7" />
                    <span className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-amber-400 text-xs font-extrabold text-navy-900">{i + 1}</span>
                  </div>
                  <h3 className="text-lg font-extrabold">{title as string}</h3>
                  <p className="mt-1 text-sm text-muted">{d as string}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= AFZALLIKLAR ================= */}
      <Section title={t('landing.benefitsTitle')}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [ShieldCheck, t('landing.b1'), t('landing.b1d'), 'bg-green-100 text-green-600'],
            [Wallet, t('landing.b2'), t('landing.b2d'), 'bg-amber-100 text-amber-600'],
            [Video, t('landing.b3'), t('landing.b3d'), 'bg-blue-100 text-blue-600'],
            [LineChart, t('landing.b4'), t('landing.b4d'), 'bg-brand-100 text-brand-700'],
          ].map(([I, title, d, c], i) => {
            const Icon = I as typeof Search;
            return (
              <motion.div key={i} {...fade} transition={{ delay: i * 0.08 }} className="rounded-3xl border border-line/70 bg-white p-6 shadow-soft">
                <span className={cn('grid h-12 w-12 place-items-center rounded-2xl', c as string)}>
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-4 font-extrabold">{title as string}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{d as string}</p>
              </motion.div>
            );
          })}
        </div>
      </Section>

      {/* ================= NATIJALAR + STATISTIKA ================= */}
      <section className="container-x">
        <motion.div {...fade} className="relative overflow-hidden rounded-[36px] bg-gradient-to-br from-brand-800 via-brand-700 to-accent p-8 text-white md:p-12">
          <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <h2 className="text-2xl font-extrabold md:text-3xl">{t('landing.successTitle')}</h2>
          <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
            {[
              [stats.data ? compact(stats.data.teachers) + '+' : '—', t('landing.statTeachers')],
              [stats.data ? compact(stats.data.students) + '+' : '—', t('landing.statStudents')],
              [stats.data ? compact(stats.data.lessons) + '+' : '—', t('landing.statLessons')],
              [stats.data?.rating ? `${stats.data.rating}/5` : '—', t('landing.statRating')],
            ].map(([v, l]) => (
              <div key={l}>
                <div className="font-display text-3xl font-bold md:text-4xl">{v}</div>
                <div className="mt-1 text-sm text-white/70">{l}</div>
              </div>
            ))}
          </div>
          {/* Faqat platformadagi haqiqiy sharhlar ko'rsatiladi; hali yo'q bo'lsa — bo'lim chiqmaydi */}
          {!!reviews.data?.length && (
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {reviews.data.map((r) => (
                <Link key={r.id} to={`/teachers/${r.teacher.id}`} className="rounded-2xl bg-white/10 p-5 backdrop-blur transition hover:bg-white/15">
                  <Stars value={r.rating} />
                  <p className="mt-2 line-clamp-4 text-sm text-white/90">“{r.comment}”</p>
                  <div className="mt-3 flex items-center gap-2">
                    <Avatar name={r.student.name} src={r.student.avatarUrl} size={32} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold">{r.student.name}</div>
                      <div className="truncate text-xs font-bold text-amber-300">{t('landing.reviewAbout', { name: r.teacher.user.fullName })}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </motion.div>
      </section>

      {/* ================= FAQ ================= */}
      <Section id="faq" title={t('landing.faqTitle')}>
        <div className="mx-auto max-w-3xl space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-line/70 bg-white shadow-soft">
              <button onClick={() => setFaq(faq === i ? null : i)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left font-bold" aria-expanded={faq === i}>
                {t(`landing.q${i}`)}
                <ChevronDown className={cn('h-5 w-5 shrink-0 text-brand-600 transition', faq === i && 'rotate-180')} />
              </button>
              <AnimatePresence initial={false}>
                {faq === i && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    <p className="px-5 pb-4 text-sm leading-relaxed text-muted">{t(`landing.a${i}`)}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </Section>

      {/* ================= O'QITUVCHI BO'LISH ================= */}
      <section className="container-x">
        <motion.div {...fade} className="grid items-center gap-8 rounded-[36px] border border-brand-100 bg-gradient-to-br from-white to-brand-50 p-8 md:grid-cols-2 md:p-12">
          <div>
            <h2 className="text-2xl font-extrabold md:text-4xl">{t('landing.teachTitle')}</h2>
            <p className="mt-3 text-muted">{t('landing.teachText')}</p>
            <ul className="mt-5 space-y-2.5">
              {[t('landing.teachPoint1'), t('landing.teachPoint2'), t('landing.teachPoint3')].map((p) => (
                <li key={p} className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-5 w-5 text-success" /> {p}
                </li>
              ))}
            </ul>
            <Link to="/register?role=teacher" className="mt-7 inline-block">
              <Button size="lg">
                {t('landing.ctaTeach')} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['12', t('teacher.activeStudents'), 'bg-brand-100 text-brand-700'],
              ['28', t('teacher.lessonsDone'), 'bg-blue-100 text-blue-700'],
              ['4.9', t('teacher.rating'), 'bg-amber-100 text-amber-700'],
              ['2.4M', t('teacher.monthIncome'), 'bg-green-100 text-green-700'],
            ].map(([v, l, c], i) => (
              <motion.div key={l} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="rounded-2xl bg-white p-5 shadow-soft">
                <div className={cn('inline-block rounded-lg px-2 py-0.5 text-xs font-bold', c)}>{l}</div>
                <div className="mt-2 font-display text-2xl font-bold">{v}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>
    </div>
  );
}
