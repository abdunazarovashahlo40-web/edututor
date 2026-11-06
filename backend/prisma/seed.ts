/**
 * DEV seed ma'lumotlari. PRODUCTION'DA ISHLATMANG — parollar README'da ochiq yozilgan.
 *   npm run db:seed
 */
import '../src/config/env';
import bcrypt from 'bcryptjs';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_SEED !== 'true') {
  console.error('⛔ Seed production muhitida bloklangan (ALLOW_PROD_SEED=true bilan majburlash mumkin — tavsiya etilmaydi).');
  process.exit(1);
}

const H = 3600_000;
const D = 24 * H;
const TZ = 5 * 60 * 60_000;

/** Bugundan n kun keyin, Toshkent vaqti bilan soat h:m → UTC */
function at(dayOffset: number, h: number, m = 0) {
  const now = new Date(Date.now() + TZ);
  const d = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset, h, m);
  return new Date(d - TZ);
}

const subjects = [
  ['matematika', 'Matematika', 'Математика', 'Mathematics', 'exact', 'calculator'],
  ['ingliz-tili', 'Ingliz tili', 'Английский язык', 'English', 'languages', 'languages'],
  ['fizika', 'Fizika', 'Физика', 'Physics', 'exact', 'atom'],
  ['kimyo', 'Kimyo', 'Химия', 'Chemistry', 'science', 'flask-conical'],
  ['biologiya', 'Biologiya', 'Биология', 'Biology', 'science', 'dna'],
  ['informatika', 'Informatika', 'Информатика', 'Computer Science', 'it', 'monitor'],
  ['dasturlash', 'Dasturlash', 'Программирование', 'Programming', 'it', 'code'],
  ['ona-tili', 'Ona tili va adabiyot', 'Узбекский язык', 'Uzbek language', 'languages', 'book-open'],
  ['rus-tili', 'Rus tili', 'Русский язык', 'Russian', 'languages', 'message-circle'],
  ['tarix', 'Tarix', 'История', 'History', 'humanities', 'landmark'],
  ['ielts', 'IELTS tayyorlov', 'Подготовка к IELTS', 'IELTS prep', 'exams', 'award'],
  ['sat', 'SAT / DTM tayyorlov', 'Подготовка к SAT / DTM', 'SAT / DTM prep', 'exams', 'graduation-cap'],
] as const;

async function main() {
  console.log('🌱 Seed boshlandi...');
  // Tozalash (bog'liqlik tartibida)
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.complaint.deleteMany(),
    prisma.review.deleteMany(),
    prisma.teacherEarning.deleteMany(),
    prisma.teacherPayout.deleteMany(),
    prisma.refund.deleteMany(),
    prisma.paymentTransaction.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.message.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.homeworkSubmission.deleteMany(),
    prisma.homework.deleteMany(),
    prisma.learningMaterial.deleteMany(),
    prisma.bookingParticipant.deleteMany(),
    prisma.booking.deleteMany(),
    prisma.meeting.deleteMany(),
    prisma.lessonSession.deleteMany(),
    prisma.lesson.deleteMany(),
    prisma.teacherAvailability.deleteMany(),
    prisma.teacherCertificate.deleteMany(),
    prisma.teacherSubject.deleteMany(),
    prisma.favoriteTeacher.deleteMany(),
    prisma.teacherProfile.deleteMany(),
    prisma.studentProfile.deleteMany(),
    prisma.appDevice.deleteMany(),
    prisma.authSession.deleteMany(),
    prisma.otpCode.deleteMany(),
    prisma.user.deleteMany(),
    prisma.subject.deleteMany(),
    prisma.platformSetting.deleteMany(),
  ]);

  const subj: Record<string, string> = {};
  for (const [i, s] of subjects.entries()) {
    const r = await prisma.subject.create({
      data: { slug: s[0], nameUz: s[1], nameRu: s[2], nameEn: s[3], category: s[4], icon: s[5], sortOrder: i },
    });
    subj[s[0]] = r.id;
  }

  const pw = await bcrypt.hash('Parol123!', 12);
  const adminPw = await bcrypt.hash('Admin12345!', 12);
  const verified = { status: 'ACTIVE' as const, emailVerifiedAt: new Date() };

  await prisma.user.create({ data: { email: 'admin@edututor.uz', fullName: 'Bosh administrator', role: 'ADMIN', passwordHash: adminPw, ...verified } });

  const student = await prisma.user.create({
    data: {
      email: 'student@edututor.uz',
      phone: '+998901234567',
      fullName: 'Dilnoza Karimova',
      role: 'STUDENT',
      passwordHash: pw,
      ...verified,
      studentProfile: { create: { grade: '11-sinf', goals: 'DTM imtihoniga 180+ ball, IELTS 7.0', city: 'Toshkent' } },
    },
  });
  const student2 = await prisma.user.create({
    data: {
      email: 'jasur@edututor.uz',
      fullName: 'Jasur Toshmatov',
      role: 'STUDENT',
      passwordHash: pw,
      ...verified,
      studentProfile: { create: { grade: '10-sinf', city: 'Samarqand' } },
    },
  });

  type T = {
    email: string; name: string; headline: string; bio: string; edu: string; exp: number; price: number;
    langs: string[]; subjects: string[]; city: string;
  };
  const teachers: T[] = [
    {
      email: 'teacher@edututor.uz', name: 'Azizbek Rahimov', headline: 'Matematika va DTM tayyorlov — 9 yillik tajriba',
      bio: 'Toshkentdagi ixtisoslashtirilgan maktab o\'qituvchisi. 300 dan ortiq o\'quvchim DTM\'dan yuqori ball oldi. Har bir darsda mavzuni sodda misollar bilan tushuntiraman va uy vazifalarini shaxsan tekshiraman.',
      edu: 'O\'zMU, Matematika fakulteti (magistr)', exp: 9, price: 150000, langs: ['uz', 'ru'], subjects: ['matematika', 'sat'], city: 'Toshkent',
    },
    {
      email: 'malika@edututor.uz', name: 'Malika Yusupova', headline: 'IELTS 8.5 · Speaking va Writing bo\'yicha mutaxassis',
      bio: 'CELTA sertifikatiga ega ingliz tili o\'qituvchisi. IELTS imtihoniga 4 oy ichida tayyorlayman: individual reja, haftalik mock test va batafsil feedback.',
      edu: 'O\'zDJTU, Ingliz filologiyasi; CELTA (Cambridge)', exp: 7, price: 180000, langs: ['uz', 'en', 'ru'], subjects: ['ingliz-tili', 'ielts'], city: 'Toshkent',
    },
    {
      email: 'bobur@edututor.uz', name: 'Bobur Aliyev', headline: 'Fizika olimpiadalari murabbiyi',
      bio: 'Respublika fizika olimpiadasi g\'oliblari murabbiyi. Murakkab masalalarni bosqichma-bosqich yechishni o\'rgataman.',
      edu: 'TATU, Fizika-texnika', exp: 6, price: 120000, langs: ['uz'], subjects: ['fizika', 'matematika'], city: 'Samarqand',
    },
    {
      email: 'nilufar@edututor.uz', name: 'Nilufar Saidova', headline: 'Kimyo va biologiya — tibbiyotga tayyorlov',
      bio: 'Tibbiyot institutiga kirish uchun kimyo va biologiyadan tayyorlayman. Test strategiyasi va mavzular bo\'yicha konspektlar beraman.',
      edu: 'Toshkent tibbiyot akademiyasi', exp: 5, price: 100000, langs: ['uz', 'ru'], subjects: ['kimyo', 'biologiya'], city: 'Buxoro',
    },
    {
      email: 'sardor@edututor.uz', name: 'Sardor Qodirov', headline: 'Python va web dasturlash — noldan junior darajagacha',
      bio: 'Senior dasturchi, 8 yil tajriba. Amaliy loyihalar orqali Python, JavaScript va algoritmlarni o\'rgataman.',
      edu: 'INHA University in Tashkent, Computer Science', exp: 8, price: 200000, langs: ['uz', 'en'], subjects: ['dasturlash', 'informatika'], city: 'Toshkent',
    },
    {
      email: 'elena@edututor.uz', name: 'Elena Kim', headline: 'Rus tili — so\'zlashuv va grammatika',
      bio: 'Rus tilini erkin so\'zlashish darajasigacha o\'rgataman. Bolalar va kattalar uchun individual dasturlar.',
      edu: 'TDPU, Rus filologiyasi', exp: 11, price: 90000, langs: ['ru', 'uz'], subjects: ['rus-tili'], city: 'Toshkent',
    },
  ];

  const tp: { id: string; userId: string; email: string }[] = [];
  for (const t of teachers) {
    const u = await prisma.user.create({
      data: {
        email: t.email,
        fullName: t.name,
        role: 'TEACHER',
        passwordHash: pw,
        ...verified,
        teacherProfile: {
          create: {
            headline: t.headline, bio: t.bio, education: t.edu, experienceYears: t.exp, hourlyPrice: t.price,
            trialPrice: Math.round(t.price / 2), languages: t.langs, city: t.city, verification: 'APPROVED', verifiedAt: new Date(),
            offlineFormat: t.city === 'Toshkent',
            subjects: { create: t.subjects.map((s) => ({ subjectId: subj[s] })) },
            certificates: { create: [{ title: 'Malaka oshirish sertifikati', issuer: 'XTV', year: 2023 }] },
            // Dushanba–Shanba 09:00–13:00 va 15:00–20:00
            availability: {
              create: [1, 2, 3, 4, 5, 6].flatMap((wd) => [
                { weekday: wd, startMinute: 9 * 60, endMinute: 13 * 60 },
                { weekday: wd, startMinute: 15 * 60, endMinute: 20 * 60 },
              ]),
            },
          },
        },
      },
      include: { teacherProfile: true },
    });
    tp.push({ id: u.teacherProfile!.id, userId: u.id, email: t.email });
  }

  // Tasdiqlanishi kutilayotgan o'qituvchi
  await prisma.user.create({
    data: {
      email: 'pending@edututor.uz', fullName: 'Kamola Ergasheva', role: 'TEACHER', passwordHash: pw, ...verified,
      teacherProfile: {
        create: {
          headline: 'Tarix va huquq asoslari', bio: 'Tarix fanidan 4 yillik tajribaga ega o\'qituvchiman. DTM testlari bo\'yicha tayyorlayman.',
          education: 'O\'zMU, Tarix fakulteti', experienceYears: 4, hourlyPrice: 80000, verification: 'PENDING',
          subjects: { create: [{ subjectId: subj['tarix'] }] },
          certificates: { create: [{ title: 'Diplom nusxasi', isVerificationDoc: true, year: 2021 }] },
        },
      },
    },
  });

  // Darslar
  const [aziz, malika, bobur, nilufar, sardor, elena] = tp;
  const mk = (teacherId: string, subjectId: string, title: string, type: any, price: number, durationMin = 60, maxStudents = 1, description?: string) =>
    prisma.lesson.create({ data: { teacherId, subjectId, title, type, price, durationMin, maxStudents, status: 'published', description } });

  const lAlgebra = await mk(aziz.id, subj['matematika'], 'Algebra va geometriya (individual)', 'INDIVIDUAL', 150000, 60, 1, 'DTM va maktab dasturi asosida individual mashg\'ulot.');
  const lTrial = await mk(aziz.id, subj['matematika'], 'Sinov darsi — darajani aniqlash', 'TRIAL', 50000, 30);
  const lGroup = await mk(aziz.id, subj['sat'], 'DTM matematika: intensiv guruh', 'GROUP', 60000, 90, 8, 'Haftasiga 2 marta, test yechish strategiyalari.');
  const lIelts = await mk(malika.id, subj['ielts'], 'IELTS Speaking intensive', 'INDIVIDUAL', 180000, 60);
  const lWriting = await mk(malika.id, subj['ielts'], 'IELTS Writing Task 2 — konsultatsiya', 'CONSULTATION', 120000, 45);
  await mk(bobur.id, subj['fizika'], 'Mexanika: olimpiada masalalari', 'INDIVIDUAL', 120000);
  await mk(nilufar.id, subj['kimyo'], 'Organik kimyo asoslari', 'INDIVIDUAL', 100000);
  await mk(nilufar.id, subj['biologiya'], 'Biologiya: tibbiyotga tayyorlov guruhi', 'GROUP', 50000, 90, 10);
  await mk(sardor.id, subj['dasturlash'], 'Python: noldan boshlab', 'INDIVIDUAL', 200000, 90);
  await mk(elena.id, subj['rus-tili'], 'Rus tili: so\'zlashuv amaliyoti', 'INDIVIDUAL', 90000);
  await prisma.lesson.create({
    data: { teacherId: aziz.id, subjectId: subj['matematika'], title: 'Trigonometriya (qoralama)', type: 'INDIVIDUAL', price: 150000, durationMin: 60, status: 'draft' },
  });

  // Guruh sessiyalari
  const g1 = await prisma.lessonSession.create({ data: { teacherId: aziz.id, lessonId: lGroup.id, startAt: at(2, 18), endAt: at(2, 19, 30), capacity: 8 } });
  await prisma.lessonSession.create({ data: { teacherId: aziz.id, lessonId: lGroup.id, startAt: at(5, 18), endAt: at(5, 19, 30), capacity: 8 } });

  const commission = 15;
  async function paidBooking(opts: {
    studentId: string; teacherId: string; lessonId: string; startAt: Date; durationMin: number; price: number;
    status: 'confirmed' | 'completed' | 'requested'; sessionId?: string; earning?: 'held' | 'available';
  }) {
    const sessionId =
      opts.sessionId ??
      (
        await prisma.lessonSession.create({
          data: {
            teacherId: opts.teacherId, lessonId: opts.lessonId, startAt: opts.startAt,
            endAt: new Date(opts.startAt.getTime() + opts.durationMin * 60_000), capacity: 1,
            status: opts.status === 'completed' ? 'completed' : 'scheduled',
          },
        })
      ).id;
    const b = await prisma.booking.create({
      data: {
        studentId: opts.studentId, teacherId: opts.teacherId, lessonId: opts.lessonId, sessionId, price: opts.price, status: opts.status,
        confirmedAt: opts.status !== 'requested' ? new Date() : null, completedAt: opts.status === 'completed' ? opts.startAt : null,
        participants: { create: [{ userId: opts.studentId, attended: opts.status === 'completed' }] },
      },
    });
    const p = await prisma.payment.create({
      data: {
        userId: opts.studentId, bookingId: b.id, amount: opts.price, provider: 'sandbox', status: 'paid', paidAt: new Date(opts.startAt.getTime() - D),
        receiptNo: `ET-SEED-${b.id.slice(-6).toUpperCase()}`,
        transactions: { create: { provider: 'sandbox', externalId: `seed_${b.id}`, state: 2, amount: opts.price, performedAt: new Date() } },
      },
    });
    const c = new Prisma.Decimal(opts.price).mul(commission).div(100);
    await prisma.teacherEarning.create({
      data: {
        teacherId: opts.teacherId, paymentId: p.id, gross: opts.price, commission: c, net: new Prisma.Decimal(opts.price).sub(c),
        status: opts.earning ?? 'held', availableAt: opts.earning === 'available' ? new Date() : null, createdAt: p.paidAt!,
      },
    });
    return b;
  }

  // O'tgan (yakunlangan) darslar — progress va sharhlar uchun
  const pastDays = [-21, -18, -14, -11, -7, -4];
  const completed = [];
  for (const [i, d] of pastDays.entries()) {
    completed.push(
      await paidBooking({
        studentId: student.id, teacherId: i % 2 ? malika.id : aziz.id, lessonId: i % 2 ? lIelts.id : lAlgebra.id,
        startAt: at(d, 16), durationMin: 60, price: i % 2 ? 180000 : 150000, status: 'completed', earning: 'available',
      }),
    );
  }
  await prisma.teacherProfile.update({ where: { id: aziz.id }, data: { lessonsCompleted: 3 } });
  await prisma.teacherProfile.update({ where: { id: malika.id }, data: { lessonsCompleted: 3 } });

  // Kelgusi darslar
  const upcoming = await paidBooking({ studentId: student.id, teacherId: aziz.id, lessonId: lAlgebra.id, startAt: at(1, 16), durationMin: 60, price: 150000, status: 'confirmed' });
  await paidBooking({ studentId: student.id, teacherId: malika.id, lessonId: lWriting.id, startAt: at(3, 10), durationMin: 45, price: 120000, status: 'confirmed' });
  await paidBooking({ studentId: student.id, teacherId: aziz.id, lessonId: lGroup.id, startAt: g1.startAt, durationMin: 90, price: 60000, status: 'confirmed', sessionId: g1.id });
  await paidBooking({ studentId: student2.id, teacherId: aziz.id, lessonId: lGroup.id, startAt: g1.startAt, durationMin: 90, price: 60000, status: 'confirmed', sessionId: g1.id });
  // O'qituvchi javobini kutayotgan so'rov (to'langan)
  await paidBooking({ studentId: student2.id, teacherId: aziz.id, lessonId: lTrial.id, startAt: at(4, 11), durationMin: 30, price: 50000, status: 'requested' });

  // Sharhlar
  const reviewTexts = [
    [5, 'Juda tushunarli tushuntiradi! Bir oyda testdan 40 ball ko\'tarildim.'],
    [5, 'Speaking darslari zo\'r, har darsda aniq feedback beradi.'],
    [4, 'Yaxshi o\'qituvchi, uy vazifalari biroz ko\'p :)'],
  ] as const;
  for (const [i, b] of completed.slice(0, 3).entries()) {
    await prisma.review.create({ data: { bookingId: b.id, studentId: student.id, teacherId: b.teacherId, rating: reviewTexts[i][0], comment: reviewTexts[i][1] } });
  }
  for (const t of tp) {
    const agg = await prisma.review.aggregate({ where: { teacherId: t.id }, _avg: { rating: true }, _count: { _all: true } });
    const base = agg._count._all ? agg._avg.rating! : 4.6 + Math.random() * 0.4;
    await prisma.teacherProfile.update({
      where: { id: t.id },
      data: { ratingAvg: Math.round(base * 100) / 100, ratingCount: agg._count._all || Math.floor(8 + Math.random() * 40) },
    });
  }

  // Uy vazifalari
  const hw1 = await prisma.homework.create({
    data: {
      teacherId: aziz.id, studentId: student.id, title: 'Kvadrat tenglamalar: 20 ta masala', description: 'Darslikning 45–47-betlaridagi masalalarni yeching. Yechimni rasm yoki PDF qilib yuklang.',
      dueAt: at(2, 23, 59), maxScore: 100,
    },
  });
  const hw2 = await prisma.homework.create({
    data: { teacherId: malika.id, studentId: student.id, title: 'Writing Task 2: Technology essay', description: '250+ so\'z. Mavzu: "Technology makes people less social".', dueAt: at(-2, 23, 59), status: 'completed', maxScore: 9 },
  });
  await prisma.homeworkSubmission.create({ data: { homeworkId: hw2.id, studentId: student.id, text: 'Essay matni...', score: 7, feedback: 'Coherence yaxshi. Lexical resource ustida ishlang.', reviewedAt: new Date() } });
  const hw3 = await prisma.homework.create({
    data: { teacherId: aziz.id, studentId: student.id, title: 'Logarifmlar: test', dueAt: at(-5, 23, 59), status: 'completed', maxScore: 100 },
  });
  await prisma.homeworkSubmission.create({ data: { homeworkId: hw3.id, studentId: student.id, text: 'Javoblar: 1B 2C 3A 4D 5B', score: 85, feedback: 'Ajoyib! 4-misolda xato bor.', reviewedAt: new Date() } });

  // Xabarlar
  const [a, b2] = [student.id, aziz.userId].sort();
  const conv = await prisma.conversation.create({ data: { userAId: a, userBId: b2 } });
  await prisma.message.createMany({
    data: [
      { conversationId: conv.id, senderId: student.id, body: 'Assalomu alaykum! Ertangi darsga qaysi mavzuni tayyorlab kelay?', createdAt: new Date(Date.now() - 3 * H) },
      { conversationId: conv.id, senderId: aziz.userId, body: 'Va alaykum assalom! Kvadrat tenglamalarni takrorlab keling, Viet teoremasini o\'tamiz.', createdAt: new Date(Date.now() - 2 * H), bookingId: upcoming.id },
    ],
  });
  await prisma.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: new Date(Date.now() - 2 * H) } });

  // Bildirishnomalar
  await prisma.notification.createMany({
    data: [
      { userId: student.id, type: 'booking.confirmed', title: 'Dars tasdiqlandi', body: 'Algebra va geometriya — ertaga 16:00', link: '/student/lessons' },
      { userId: student.id, type: 'homework.assigned', title: 'Yangi uy vazifasi', body: hw1.title, link: '/student/homework' },
      { userId: student.id, type: 'homework.reviewed', title: 'Vazifangiz tekshirildi', body: 'Logarifmlar: test — 85/100', link: '/student/homework', readAt: new Date() },
      { userId: aziz.userId, type: 'booking.new', title: 'Yangi bron so\'rovi', body: 'Sinov darsi — Jasur Toshmatov', link: '/teacher/bookings' },
    ],
  });

  // Materiallar (fayl sifatida dev uchun matnli placeholder)
  const fs = await import('fs');
  const path = await import('path');
  const dir = path.resolve(process.cwd(), 'uploads/materials/seed');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'formulalar.txt'), 'Kvadrat tenglama: ax^2 + bx + c = 0\nD = b^2 - 4ac\nx = (-b ± √D) / 2a\n');
  await prisma.learningMaterial.create({
    data: {
      teacherId: aziz.id, lessonId: lAlgebra.id, title: 'Asosiy formulalar to\'plami', fileUrl: '/api/v1/uploads/materials/seed/formulalar.txt',
      fileName: 'formulalar.txt', mimeType: 'text/plain', sizeBytes: 70,
    },
  });

  await prisma.platformSetting.create({ data: { key: 'commissionPercent', value: commission } });
  console.log('✅ Seed tugadi. Kirish ma\'lumotlari README.md da.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
