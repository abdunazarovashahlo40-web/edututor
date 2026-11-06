/**
 * API integratsion testlari — haqiqiy PostgreSQL talab qiladi.
 *   1) bo'sh test bazasi yarating:  createdb edututor_test
 *   2) DATABASE_URL=postgresql://.../edututor_test npx prisma migrate deploy && npm run db:constraints && npm run db:seed
 *   3) RUN_API_TESTS=1 npm test
 */
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

const enabled = process.env.RUN_API_TESTS === '1';
const d = enabled ? describe : describe.skip;

process.env.NODE_ENV = 'test';
process.env.PAYMENT_SANDBOX = 'true';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-test-access-secret-123';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-test-refresh-secret-123';

type Agent = ReturnType<typeof request.agent>;

async function agentFor(app: any, login?: string, password = 'Parol123!') {
  const a = request.agent(app);
  const r = await a.get('/api/v1/auth/csrf');
  const csrf = /et_csrf=([^;]+)/.exec(String(r.headers['set-cookie']))?.[1] ?? '';
  const wrap = {
    a,
    csrf,
    get: (u: string) => a.get(u),
    post: (u: string, body?: object) => a.post(u).set('X-CSRF-Token', csrf).send(body ?? {}),
    patch: (u: string, body?: object) => a.patch(u).set('X-CSRF-Token', csrf).send(body ?? {}),
  };
  if (login) {
    const res = await wrap.post('/api/v1/auth/login', { login, password });
    expect(res.status).toBe(200);
  }
  return wrap;
}

d('EduTutor API', () => {
  let app: any;
  let student: Awaited<ReturnType<typeof agentFor>>;
  let student2: Awaited<ReturnType<typeof agentFor>>;
  let teacher: Awaited<ReturnType<typeof agentFor>>;
  let admin: Awaited<ReturnType<typeof agentFor>>;

  beforeAll(async () => {
    const { createApp } = await import('../src/app');
    app = createApp();
    student = await agentFor(app, 'student@edututor.uz');
    student2 = await agentFor(app, 'jasur@edututor.uz');
    teacher = await agentFor(app, 'teacher@edututor.uz');
    admin = await agentFor(app, 'admin@edututor.uz', 'Admin12345!');
  });

  it('1. ro\'yxatdan o\'tish → OTP → kirish', async () => {
    const g = await agentFor(app);
    const email = `new${Date.now()}@test.uz`;
    const r = await g.post('/api/v1/auth/register', { fullName: 'Test User', email, password: 'Parol123!', role: 'STUDENT', acceptTerms: true });
    expect(r.status).toBe(201);
    expect(r.body.data.devCode).toHaveLength(6);
    const v = await g.post('/api/v1/auth/verify-email', { email, code: r.body.data.devCode });
    expect(v.status).toBe(200);
    expect(v.body.data.role).toBe('STUDENT');
  });

  it('ADMIN rolini ro\'yxatdan o\'tish orqali olib bo\'lmaydi', async () => {
    const g = await agentFor(app);
    const r = await g.post('/api/v1/auth/register', { fullName: 'Hacker', email: `h${Date.now()}@t.uz`, password: 'Parol123!', role: 'ADMIN', acceptTerms: true });
    expect(r.status).toBe(400);
  });

  it('CSRF tokensiz POST rad etiladi', async () => {
    const r = await request(app).post('/api/v1/auth/login').send({ login: 'student@edututor.uz', password: 'Parol123!' });
    expect(r.status).toBe(403);
  });

  it('5. o\'qituvchilarni qidirish va filtrlash', async () => {
    const r = await request(app).get('/api/v1/teachers?subject=matematika&minRating=4&sort=price_asc');
    expect(r.status).toBe(200);
    expect(r.body.data.length).toBeGreaterThan(0);
    const prices = r.body.data.map((t: any) => Number(t.hourlyPrice));
    expect([...prices].sort((x, y) => x - y)).toEqual(prices);
  });

  it('RBAC: o\'quvchi dars yarata olmaydi, admin paneliga kira olmaydi', async () => {
    expect((await student.post('/api/v1/lessons', { title: 'x' })).status).toBe(403);
    expect((await student.get('/api/v1/admin/stats')).status).toBe(403);
  });

  let lessonId = '';
  it('4. o\'qituvchi dars yaratadi va tahrirlaydi', async () => {
    const subjects = (await request(app).get('/api/v1/subjects')).body.data;
    const r = await teacher.post('/api/v1/lessons', {
      title: 'Test darsi', subjectId: subjects[0].id, type: 'INDIVIDUAL', durationMin: 60, price: 100000, maxStudents: 1, status: 'published',
    });
    expect(r.status).toBe(201);
    lessonId = r.body.data.id;
    const u = await teacher.patch(`/api/v1/lessons/${lessonId}`, { price: 110000 });
    expect(Number(u.body.data.price)).toBe(110000);
  });

  let bookingId = '';
  it('6–7. bron qilish va bir vaqtning o\'zida ikki bron — faqat bittasi o\'tadi', async () => {
    const lesson = (await request(app).get(`/api/v1/lessons/${lessonId}`)).body.data;
    const slots = (await request(app).get(`/api/v1/teachers/${lesson.teacher.id}/slots?days=14&duration=60`)).body.data;
    expect(slots.length).toBeGreaterThan(0);
    const startAt = slots[slots.length - 1].startAt;
    const [r1, r2] = await Promise.all([
      student.post('/api/v1/bookings', { lessonId, startAt }),
      student2.post('/api/v1/bookings', { lessonId, startAt }),
    ]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]);
    bookingId = (r1.status === 201 ? r1 : r2).body.data.booking.id;
    if (r2.status === 201) student = student2; // bronni kim olgan bo'lsa
  });

  it('9. sandbox to\'lov → 8. o\'qituvchi tasdiqlaydi', async () => {
    expect((await teacher.post(`/api/v1/bookings/${bookingId}/confirm`)).status).toBe(409); // to'lovsiz
    const c = await student.post('/api/v1/payments/checkout', { bookingId, provider: 'sandbox' });
    expect(c.status).toBe(200);
    const p = await student.post(`/api/v1/payments/sandbox/${c.body.data.paymentId}/complete`, { success: true });
    expect(p.body.data.status).toBe('paid');
    expect((await teacher.post(`/api/v1/bookings/${bookingId}/confirm`)).status).toBe(200);
  });

  it('10. video xona: begona foydalanuvchi kira olmaydi', async () => {
    const b = (await student.get(`/api/v1/bookings/${bookingId}`)).body.data;
    const other = student === student2 ? await agentFor(app, 'student@edututor.uz') : student2;
    const r = await other.get(`/api/v1/meetings/session/${b.session.id}`);
    expect(r.status).toBe(403);
    const t = await teacher.get(`/api/v1/meetings/session/${b.session.id}`);
    expect(t.status).toBe(200);
    expect(t.body.data.roomKey).toBeTruthy();
  });

  it('13. boshqa o\'quvchining broni va to\'lovini ko\'rib bo\'lmaydi', async () => {
    const other = student === student2 ? await agentFor(app, 'student@edututor.uz') : student2;
    expect((await other.get(`/api/v1/bookings/${bookingId}`)).status).toBe(403);
  });

  it('14. o\'quvchi 24 soatdan oldin bekor qilsa — 100% qaytariladi', async () => {
    const r = await student.post(`/api/v1/bookings/${bookingId}/cancel`, { reason: 'test' });
    expect(r.status).toBe(200);
    expect(r.body.data.refundPercent).toBe(100);
  });

  it('12. sharh: faqat yakunlangan dars, takroriy sharh yo\'q', async () => {
    const s = await agentFor(app, 'student@edututor.uz');
    const past = (await s.get('/api/v1/bookings?scope=past')).body.data.filter((b: any) => b.status === 'completed');
    const reviewed = past.find((b: any) => b.review);
    if (reviewed) {
      const r = await s.post('/api/v1/reviews', { bookingId: reviewed.id, rating: 5 });
      expect(r.status).toBe(409);
    }
  });

  it('3. admin o\'qituvchini tasdiqlaydi (audit log bilan)', async () => {
    const list = (await admin.get('/api/v1/admin/teachers?verification=PENDING')).body.data;
    expect(list.length).toBeGreaterThan(0);
    const r = await admin.post(`/api/v1/admin/teachers/${list[0].id}/verify`, { decision: 'APPROVED' });
    expect(r.status).toBe(200);
    const logs = (await admin.get('/api/v1/admin/audit-logs?action=teacher.approved')).body.data;
    expect(logs.length).toBeGreaterThan(0);
  });
});
