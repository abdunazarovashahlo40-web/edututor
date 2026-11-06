import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { ah, ok } from '../../common/http';
import { forbidden } from '../../common/errors';
import { requireAuth } from '../../middleware/auth';
import { authorizeSession, getOrCreateMeeting, iceServers } from './meetings.service';
import { notify } from '../../lib/notify';
import { completeBooking } from '../bookings/bookings.service';

export const meetingsRouter = Router();
meetingsRouter.use(requireAuth);

/** Xonaga kirish ma'lumotlari — faqat ishtirokchilarga */
meetingsRouter.get(
  '/session/:sessionId',
  ah(async (req, res) => {
    const a = await authorizeSession(req.user!.id, req.user!.role, req.params.sessionId);
    const m = await getOrCreateMeeting(a.session.id, a.session.lesson.meetingMethod);
    ok(res, {
      sessionId: a.session.id,
      roomKey: m.roomKey,
      provider: m.provider,
      externalUrl: m.externalUrl,
      iceServers: iceServers(),
      isTeacher: a.isTeacher,
      status: a.session.status,
      startAt: a.session.startAt,
      endAt: a.session.endAt,
      opensAt: new Date(a.opensAt),
      lesson: a.session.lesson,
      teacher: { userId: a.session.teacher.userId, ...a.session.teacher.user },
      students: a.session.bookings.map((b) => b.student),
    });
  }),
);

meetingsRouter.post(
  '/session/:sessionId/start',
  ah(async (req, res) => {
    const a = await authorizeSession(req.user!.id, req.user!.role, req.params.sessionId);
    if (!a.isTeacher) throw forbidden('ONLY_TEACHER');
    await getOrCreateMeeting(a.session.id, a.session.lesson.meetingMethod);
    await prisma.lessonSession.update({
      where: { id: a.session.id },
      data: { status: 'in_progress', startedAt: a.session.startedAt ?? new Date() },
    });
    await prisma.meeting.update({ where: { sessionId: a.session.id }, data: { openedAt: new Date() } });
    await Promise.all(
      a.session.bookings.map((b) =>
        notify(b.studentId, 'lesson.reminder', 'Dars boshlandi — qo\'shiling!', a.session.lesson.title, `/room/${a.session.id}`),
      ),
    );
    ok(res, { started: true });
  }),
);

/** Darsni yakunlash: barcha tasdiqlangan bronlar "completed" bo'ladi */
meetingsRouter.post(
  '/session/:sessionId/end',
  ah(async (req, res) => {
    const a = await authorizeSession(req.user!.id, req.user!.role, req.params.sessionId);
    if (!a.isTeacher) throw forbidden('ONLY_TEACHER');
    await prisma.meeting.updateMany({ where: { sessionId: a.session.id }, data: { closedAt: new Date() } });
    for (const b of a.session.bookings.filter((x) => x.status === 'confirmed')) {
      await completeBooking(b.id, req.user!.id).catch(() => undefined);
    }
    await prisma.lessonSession.update({ where: { id: a.session.id }, data: { status: 'completed', endedAt: new Date() } });
    ok(res, { ended: true });
  }),
);
