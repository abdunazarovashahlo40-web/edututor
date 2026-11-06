# EduTutor — arxitektura va qabul qilingan qarorlar

Bu hujjat kurs ishining "Loyihalash" bobi uchun asos bo'la oladi. Unda texnik topshiriqdagi (TZ) talablar
qanday amalga oshirilgani va **qayerda TZ'dan ongli ravishda chetga chiqilgani** (real ishlatish uchun
optimalroq bo'lgani sababli) tushuntiriladi.

## 1. Umumiy sxema

```
Brauzer / telefon (PWA)
   │  HTTPS, HttpOnly cookie, X-CSRF-Token
   ▼
Express API (Node 20, TypeScript) ──── Socket.IO (bildirishnoma, chat, WebRTC signal)
   │  Prisma ORM                         │
   ▼                                     ▼
PostgreSQL (Supabase)              WebRTC P2P (STUN/TURN) ↔ ishtirokchilar
   │
Supabase Storage (fayllar, private bucket)
```

Frontend (React + Vite) build qilinib **backendning o'zi tomonidan** beriladi — bitta domen, bitta Render servisi.

## 2. TZ'dan farqli qarorlar (va sababi)

| TZ talabi | Qaror | Sabab |
|---|---|---|
| Frontend va backend alohida deploy | Bitta servis (API frontend'ni beradi) | Cookie `SameSite=Lax` ishlaydi, CORS/3rd-party cookie muammolari yo'q, Safari'da ham sessiya barqaror; Render free tarifida bitta servis yetadi |
| Redis (kesh va background jobs) | Redis'siz: in-memory kesh + `setInterval` jobs | 100–1000 foydalanuvchi uchun Redis ortiqcha xarajat. Kerak bo'lganda `jobs.ts` BullMQ'ga ko'chiriladi |
| S3 storage | Supabase Storage (S3-mos), private bucket + signed URL | Supabase allaqachon ishlatiladi — alohida AWS hisob kerak emas |
| SMS/email OTP | Email OTP (Resend HTTP API yoki SMTP), SMS uchun arxitektura tayyor | SMS (Eskiz.uz) pullik; Render free SMTP portlarini cheklashi mumkin — HTTP API ishonchliroq |
| Telefon ilovasi | PWA + bank uslubidagi PIN va barmoq izi (WebAuthn) | App Store/Play Market'siz o'rnatiladi; WebAuthn platform authenticator Android barmoq izi va iOS Face ID bilan ishlaydi |
| To'lov: "frontend javobiga ishonmaslik" | Escrow modeli | Pul dars yakunlangandan 24 soat keyin o'qituvchiga ochiladi; nizo bo'lsa admin hal qiladi — firibgarlikdan himoya |
| — (TZ'da yo'q) | Kontaktlarni yashirish | To'lovsiz suhbatda telefon/Telegram yashiriladi — platformani chetlab o'tishning oldini oladi (daromad himoyasi) |
| — (TZ'da yo'q) | Avtomatik qoidalar | To'lanmagan bron 30 daqiqada bekor; o'qituvchi javob bermasa 100% qaytarish; tugatilmagan dars 24 soatda avtomatik yakunlanadi |

## 3. Double booking himoyasi (3 qatlam)

1. `pg_advisory_xact_lock(hashtext(teacherId))` — bitta o'qituvchi uchun parallel bron tranzaksiyalari navbatga turadi.
2. Tranzaksiya ichida kesishma `SELECT` bilan tekshiriladi (aniq xato xabari: `SLOT_TAKEN`).
3. `EXCLUDE USING gist (teacherId WITH =, tstzrange(startAt,endAt) WITH &&)` — DB darajasidagi kafolat (`prisma/constraints.sql`).

## 4. Xavfsizlik

- Parollar: bcrypt (12 round). PIN: bcrypt (10 round), 5 xato → sessiya bekor.
- Sessiya: access JWT (15 daqiqa, HttpOnly cookie) + refresh token (rotatsiya, DB'da SHA-256 xeshi).
- CSRF: double-submit cookie (`et_csrf` + `X-CSRF-Token`). Webhooklar o'z imzosi bilan (Payme Basic auth, Click MD5).
- RBAC: `requireRole()` + har bir resursda egalik tekshiruvi (`ownLesson`, `loadHomework`, `authorizeSession` ...).
- Brute-force: login/OTP uchun rate limit, 5 xato → 15 daqiqa blok, OTP 5 urinish.
- Fayllar: MIME whitelist + magic-byte tekshiruvi, 10 MB limit, tasodifiy nom, ruxsat tekshirilib beriladi.
- Helmet CSP, `X-Content-Type-Options`, HSTS (nginx), Supabase'da RLS yoqilgan (anon kalit bilan jadvallarga kirib bo'lmaydi).
- Audit log: o'qituvchini tasdiqlash, bloklash, qaytarish, payout, sozlamalar, moderatsiya.
- Karta raqami saqlanmaydi (payout kartasi faqat niqoblangan ko'rinishda).

## 5. Daromad modeli

- Har bir to'langan darsdan platforma komissiyasi (standart 15%, admin panelda o'zgaradi).
- Escrow: `held → available → paid_out` (yoki `reversed`).
- Kelajakda: "Premium" profil (qidiruvda yuqorida), guruh kurslari, korporativ (maktab/o'quv markazi) tariflar.

## 6. Ma'lumotlar bazasi

Asosiy modellar: User, StudentProfile, TeacherProfile, Subject, TeacherSubject, TeacherCertificate,
TeacherAvailability, Lesson, LessonSession, Booking, BookingParticipant, Meeting, Homework,
HomeworkSubmission, LearningMaterial, Conversation, Message, Notification, Payment, PaymentTransaction,
Refund, TeacherEarning, TeacherPayout, Review, FavoriteTeacher, Complaint, PlatformSetting, AuditLog
+ AuthSession, OtpCode, AppDevice (PIN/barmoq izi).

Pul — `Decimal(14,2)`, hisob-kitob tiyinlarda (butun son). Vaqt — UTC, ko'rsatish Asia/Tashkent (UTC+5, DST yo'q).
