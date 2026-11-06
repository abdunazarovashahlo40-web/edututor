import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { ah, ok, parse } from '../../common/http';
import { badRequest } from '../../common/errors';
import { requireAuth, requireRole } from '../../middleware/auth';
import { getTeacherId } from '../../common/owners';

export const availabilityRouter = Router();
availabilityRouter.use(requireAuth, requireRole('TEACHER'));

const windowSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
  })
  .refine((w) => w.endMinute - w.startMinute >= 30, { message: 'Kamida 30 daqiqa' });

availabilityRouter.get(
  '/me',
  ah(async (req, res) => {
    const teacherId = await getTeacherId(req.user!.id);
    const windows = await prisma.teacherAvailability.findMany({
      where: { teacherId },
      orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
    });
    ok(res, windows);
  }),
);

/** Haftalik jadvalni to'liq almashtirish. Bir kundagi oraliqlar kesishmasligi kerak. */
availabilityRouter.put(
  '/me',
  ah(async (req, res) => {
    const b = parse(z.object({ windows: z.array(windowSchema).max(70) }), req.body);
    for (let d = 0; d < 7; d++) {
      const day = b.windows.filter((w) => w.weekday === d).sort((a, c) => a.startMinute - c.startMinute);
      for (let i = 1; i < day.length; i++) {
        if (day[i].startMinute < day[i - 1].endMinute) throw badRequest('AVAILABILITY_OVERLAP', 'Vaqt oraliqlari kesishmoqda');
      }
    }
    const teacherId = await getTeacherId(req.user!.id);
    await prisma.$transaction([
      prisma.teacherAvailability.deleteMany({ where: { teacherId } }),
      prisma.teacherAvailability.createMany({ data: b.windows.map((w) => ({ ...w, teacherId })) }),
    ]);
    ok(res, { saved: b.windows.length });
  }),
);
