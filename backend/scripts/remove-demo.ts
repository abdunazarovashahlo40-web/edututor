/**
 * Haqiqiy foydalanuvchilarga topshirishdan oldin demo (seed) ma'lumotlarni olib tashlash.
 *   npm run demo:remove
 *
 * Nima qiladi:
 *  - demo o'quvchi va o'qituvchilar hisoblarini o'chiradi (anonimlashtiradi, saytdan yo'qoladi);
 *  - ularning darslarini yashiradi, demo sharhlarni yashiradi;
 *  - ochiq parolli admin@edututor.uz hisobini bloklaydi.
 * Bog'langan yozuvlar (to'lov, bron tarixi) buzilmasligi uchun jismoniy o'chirish emas, "soft delete" ishlatiladi.
 *
 * Avval o'zingizga haqiqiy admin yarating:  npm run admin:create -- --email siz@gmail.com --name "Ism"
 */
import '../src/config/env';
import { prisma } from '../src/lib/prisma';

const DEMO = ['student', 'teacher', 'pending', 'malika', 'bobur', 'nilufar', 'sardor', 'elena', 'jasur'].map((n) => `${n}@edututor.uz`);
const DEMO_ADMIN = 'admin@edututor.uz';

async function main() {
  const realAdmins = await prisma.user.count({ where: { role: 'ADMIN', status: 'ACTIVE', deletedAt: null, email: { not: DEMO_ADMIN } } });
  if (!realAdmins) {
    console.error('❌ Avval haqiqiy admin yarating: npm run admin:create -- --email siz@gmail.com --name "Ism"');
    process.exit(1);
  }
  const users = await prisma.user.findMany({ where: { email: { in: [...DEMO, DEMO_ADMIN] } }, select: { id: true, email: true, role: true } });
  const now = new Date();
  for (const u of users) {
    await prisma.$transaction([
      prisma.review.updateMany({ where: { studentId: u.id }, data: { isHidden: true } }),
      prisma.lesson.updateMany({ where: { teacher: { userId: u.id } }, data: { status: 'draft' } }),
      prisma.teacherProfile.updateMany({ where: { userId: u.id }, data: { verification: 'REJECTED', verificationNote: 'demo' } }),
      prisma.authSession.updateMany({ where: { userId: u.id, revokedAt: null }, data: { revokedAt: now } }),
      prisma.user.update({
        where: { id: u.id },
        data: { status: 'SUSPENDED', deletedAt: now, email: `demo-removed+${u.id}@edututor.local`, phone: null, passwordHash: null, fullName: 'Demo (o\'chirilgan)' },
      }),
    ]);
    console.log(`✓ ${u.email} (${u.role}) o'chirildi`);
  }
  // Reytinglarni qayta hisoblash (demo sharhlar yashirildi)
  const teachers = await prisma.teacherProfile.findMany({ select: { id: true } });
  for (const t of teachers) {
    const a = await prisma.review.aggregate({ where: { teacherId: t.id, isHidden: false }, _avg: { rating: true }, _count: { _all: true } });
    await prisma.teacherProfile.update({ where: { id: t.id }, data: { ratingAvg: a._avg.rating ?? 0, ratingCount: a._count._all } });
  }
  console.log(`\nTayyor: ${users.length} ta demo hisob olib tashlandi.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
