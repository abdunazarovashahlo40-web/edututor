import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { ah, ok } from '../../common/http';
import { requireAuth, requireRole } from '../../middleware/auth';
import { getTeacherId } from '../../common/owners';
import { TZ_OFFSET_MIN } from '../../common/time';

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

function weekKey(d: Date) {
  const local = new Date(d.getTime() + TZ_OFFSET_MIN * 60_000);
  const day = (local.getUTCDay() + 6) % 7; // dushanba = 0
  local.setUTCDate(local.getUTCDate() - day);
  return local.toISOString().slice(0, 10);
}

function lastWeeks(n: number) {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) keys.push(weekKey(new Date(Date.now() - i * 7 * 86400_000)));
  return keys;
}

function lastMonths(n: number) {
  const keys: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    keys.push(m.toISOString().slice(0, 7));
  }
  return keys;
}

/** O'quvchi natijalari (kabinet va ota-ona havolasi uchun umumiy) */
export async function studentAnalytics(id: string) {
  const [completed, upcoming, homework, submissions] = await Promise.all([
    prisma.booking.findMany({
      where: { studentId: id, status: 'completed' },
      select: { completedAt: true, lesson: { select: { durationMin: true, subject: { select: { id: true, nameUz: true, nameRu: true, nameEn: true, slug: true } } } } },
    }),
    prisma.booking.count({ where: { studentId: id, status: { in: ['requested', 'confirmed'] }, session: { endAt: { gt: new Date() } } } }),
    prisma.homework.groupBy({ by: ['status'], where: { studentId: id }, _count: { _all: true } }),
    prisma.homeworkSubmission.findMany({
      where: { studentId: id, score: { not: null } },
      select: { score: true, homework: { select: { maxScore: true, session: { select: { lesson: { select: { subjectId: true } } } } } } },
    }),
  ]);
  const hwTotal = homework.reduce((a, h) => a + h._count._all, 0);
  const hwDone = homework.filter((h) => ['reviewed', 'completed'].includes(h.status)).reduce((a, h) => a + h._count._all, 0);
  const scores = submissions.map((s) => (s.score! / s.homework.maxScore) * 100);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  const bySubject = new Map<string, { subject: unknown; lessons: number; minutes: number; scores: number[] }>();
  for (const b of completed) {
    const s = b.lesson.subject;
    const cur = bySubject.get(s.id) ?? { subject: s, lessons: 0, minutes: 0, scores: [] };
    cur.lessons++;
    cur.minutes += b.lesson.durationMin;
    bySubject.set(s.id, cur);
  }
  for (const s of submissions) {
    const sid = s.homework.session?.lesson.subjectId;
    if (sid && bySubject.has(sid)) bySubject.get(sid)!.scores.push((s.score! / s.homework.maxScore) * 100);
  }
  const weeks = lastWeeks(8);
  const weekly = weeks.map((w) => ({
    week: w,
    lessons: completed.filter((b) => b.completedAt && weekKey(b.completedAt) === w).length,
  }));
  // Progress: darslar soni (maqsad 20 dars) va vazifa natijalari kombinatsiyasi
  const subjects = [...bySubject.values()].map((s) => {
    const avg = s.scores.length ? s.scores.reduce((a, b) => a + b, 0) / s.scores.length : null;
    const progress = Math.min(100, Math.round(Math.min(s.lessons / 20, 1) * 60 + (avg ?? 50) * 0.4));
    return { subject: s.subject, lessons: s.lessons, hours: Math.round((s.minutes / 60) * 10) / 10, avgScore: avg ? Math.round(avg) : null, progress };
  });
  const overall = subjects.length ? Math.round(subjects.reduce((a, s) => a + s.progress, 0) / subjects.length) : 0;
  return {
    completedLessons: completed.length,
    hours: Math.round((completed.reduce((a, b) => a + b.lesson.durationMin, 0) / 60) * 10) / 10,
    upcoming,
    homework: { total: hwTotal, done: hwDone, pending: hwTotal - hwDone },
    avgScore,
    overallProgress: overall,
    subjects,
    weekly,
  };
}

analyticsRouter.get(
  '/student',
  requireRole('STUDENT'),
  ah(async (req, res) => ok(res, await studentAnalytics(req.user!.id))),
);

/** O'qituvchi analitikasi */
analyticsRouter.get(
  '/teacher',
  requireRole('TEACHER'),
  ah(async (req, res) => {
    const teacherId = await getTeacherId(req.user!.id);
    const now = new Date();
    const local = new Date(now.getTime() + TZ_OFFSET_MIN * 60_000);
    const dayStart = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - TZ_OFFSET_MIN * 60_000);
    const dayEnd = new Date(dayStart.getTime() + 86400_000);
    const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
    const [profile, today, statusGroups, students, earnings, requests, recentReviews] = await Promise.all([
      prisma.teacherProfile.findUniqueOrThrow({ where: { id: teacherId }, select: { ratingAvg: true, ratingCount: true, lessonsCompleted: true, verification: true } }),
      prisma.lessonSession.findMany({
        where: { teacherId, startAt: { gte: dayStart, lt: dayEnd }, status: { not: 'cancelled' } },
        include: {
          lesson: { select: { title: true, type: true } },
          bookings: { where: { status: { in: ['confirmed', 'completed', 'requested'] } }, select: { id: true, status: true, student: { select: { fullName: true, avatarUrl: true } } } },
        },
        orderBy: { startAt: 'asc' },
      }),
      prisma.booking.groupBy({ by: ['status'], where: { teacherId }, _count: { _all: true } }),
      prisma.booking.findMany({ where: { teacherId, status: { in: ['confirmed', 'completed'] } }, select: { studentId: true }, distinct: ['studentId'] }),
      prisma.teacherEarning.findMany({ where: { teacherId, status: { not: 'reversed' }, createdAt: { gte: sixMonthsAgo } }, select: { net: true, createdAt: true } }),
      prisma.booking.count({ where: { teacherId, status: 'requested' } }),
      prisma.review.findMany({
        where: { teacherId, isHidden: false },
        include: { student: { select: { fullName: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
    ]);
    const count = (s: string) => statusGroups.find((g) => g.status === s)?._count._all ?? 0;
    const finished = count('completed') + count('no_show') + count('cancelled');
    const months = lastMonths(6).map((m) => ({
      month: m,
      net: earnings.filter((e) => e.createdAt.toISOString().slice(0, 7) === m).reduce((a, e) => a + Number(e.net), 0),
    }));
    ok(res, {
      verification: profile.verification,
      rating: Number(profile.ratingAvg),
      ratingCount: profile.ratingCount,
      completedLessons: count('completed'),
      upcoming: count('confirmed'),
      pendingRequests: requests,
      totalStudents: students.length,
      monthlyEarnings: months[months.length - 1].net,
      completionRate: finished ? Math.round((count('completed') / finished) * 100) : null,
      earningsByMonth: months,
      today,
      recentReviews,
      statusBreakdown: statusGroups.map((g) => ({ status: g.status, count: g._count._all })),
    });
  }),
);
