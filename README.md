# 🎓 EduTutor — onlayn repetitorlik platformasi

> **"Bilimingizni yangi bosqichga olib chiqing"**
> O'zbekiston bozori uchun o'qituvchi va o'quvchilarni bog'laydigan to'liq platforma: qidiruv, bron, to'lov
> (Payme/Click), video darslar (WebRTC), uy vazifalari, chat, bildirishnomalar, sharhlar, admin konsoli.
> 3 til (o'zbek, rus, ingliz), telefon uchun PWA ilova — PIN-kod va barmoq izi bilan kirish.

---

## 1. Loyiha tuzilmasi

```
edututor/
├─ backend/                 Express + TypeScript + Prisma
│  ├─ prisma/               schema.prisma, constraints.sql (double-booking), seed.ts
│  ├─ scripts/              db-deploy.mjs, create-admin.ts
│  ├─ src/
│  │  ├─ config/env.ts      muhit o'zgaruvchilari (zod bilan tekshiriladi)
│  │  ├─ common/            xatolar, pul, vaqt (Asia/Tashkent), kripto
│  │  ├─ middleware/        auth (JWT cookie), RBAC, CSRF, rate-limit, upload, error
│  │  ├─ lib/               prisma, storage (local/Supabase), mailer, notify, audit, realtime
│  │  ├─ modules/           auth (+ app-lock), users, teachers, subjects, availability, lessons,
│  │  │                     bookings, meetings, homework, materials, messages, notifications,
│  │  │                     payments (sandbox/Payme/Click), reviews, favorites, complaints, analytics, admin, uploads
│  │  ├─ socket.ts          Socket.IO: bildirishnoma, chat, WebRTC signalizatsiya
│  │  ├─ jobs.ts            fon vazifalari (eslatma, avto-bekor, escrow)
│  │  └─ app.ts, server.ts
│  └─ tests/                unit (logic) + API integratsion testlar
├─ frontend/                React 18 + Vite + Tailwind + TanStack Query + Framer Motion + Recharts
│  ├─ public/               PWA manifest, service worker, ikonlar
│  ├─ src/
│  │  ├─ features/auth/     🪔 "Bilim chirog'i" animatsiyali login/ro'yxat/OTP
│  │  ├─ features/applock/  PIN-pad, barmoq izi (WebAuthn), lock screen
│  │  ├─ features/video/    WebRTC video xona
│  │  ├─ features/booking/  bron va to'lov oynalari
│  │  ├─ layouts/           Student / Teacher / Admin — uch xil kabinet
│  │  ├─ pages/             public, student, teacher, admin, shared
│  │  └─ i18n/              uz.ts, ru.ts, en.ts
│  └─ e2e/                  Playwright testlar
├─ docs/ARCHITECTURE.md     arxitektura va qarorlar (kurs ishi uchun)
├─ nginx/edututor.conf      VPS uchun HTTPS + WebSocket
├─ scripts/                 backup.sh, restore.sh
├─ Dockerfile, docker-compose.yml, render.yaml, docs/github-ci.yml
└─ .env.example
```

## 2. O'rnatish (Windows / macOS / Linux)

Talablar: **Node.js 20+**, **Git**, PostgreSQL (lokal yoki Supabase).

```bash
cd D:\Projects\edututor
npm install
```

> PostgreSQL'ni lokal o'rnatmasangiz ham bo'ladi — to'g'ridan-to'g'ri Supabase bazasidan foydalaning (5-bo'lim),
> yoki Docker bilan: `docker compose up -d db`.

## 3. Muhit sozlamalari

```bash
copy .env.example backend\.env        # Windows
# cp .env.example backend/.env        # macOS/Linux
```

`backend/.env` ichida kamida quyidagilarni to'ldiring:

| O'zgaruvchi | Qiymat |
|---|---|
| `DATABASE_URL`, `DIRECT_URL` | PostgreSQL ulanishi (lokal: `postgresql://postgres:PAROL@localhost:5432/edututor`) |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `EMAIL_PROVIDER` | dev uchun `console` — tasdiqlash kodi terminalga va ekranga chiqadi |
| `PAYMENT_SANDBOX` | `true` — test to'lov sahifasi |

## 4. Ma'lumotlar bazasi va migratsiyalar

```bash
cd backend
npm run db:migrate      # 1-marta: migratsiya yaratadi (prisma/migrations) + constraints.sql
npm run db:seed         # test ma'lumotlari (fanlar, o'qituvchilar, darslar, bronlar...)
```

Keyingi o'zgarishlarda: `npm run db:migrate`. Production: `npm run db:deploy` (Render buni avtomatik qiladi).
**`prisma/migrations` papkasini Git'ga commit qiling.**

## 5. Ishga tushirish (development)

```bash
cd D:\Projects\edututor
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:4000 · Swagger: http://localhost:4000/api/docs · Health: http://localhost:4000/api/health

Telefonda sinash (bir xil Wi-Fi): `npm run dev --workspace frontend -- --host`, so'ng `http://KOMPYUTER_IP:5173`.
Barmoq izi (WebAuthn) faqat **HTTPS** yoki `localhost`da ishlaydi — telefonda to'liq sinash uchun Render'ga deploy qiling.

## 6. Testlar

```bash
npm test                                   # backend unit + frontend testlar
cd backend && set RUN_API_TESTS=1 && npm test   # API integratsion (alohida test bazasi bilan, backend/test.env.example)
npm run test:e2e                           # Playwright (oldin `npm run dev` va seed)
npm run typecheck                          # TypeScript qat'iy tekshiruv (build tezligi uchun alohida)
```

| Test | Nima tekshiriladi |
|---|---|
| `backend/tests/logic.test.ts` | Toshkent vaqti, bo'sh slotlar, komissiya (tiyin aniqligida), bekor qilish siyosati, kontakt yashirish, Telegram imzosi |
| `backend/tests/api.test.ts` | ro'yxat → OTP → kirish, ADMIN rolini olish taqiqi, CSRF, filtrlar, RBAC, CRUD, **parallel ikki bron → faqat bittasi o'tadi**, sandbox to'lov, video xonaga begona kira olmasligi, boshqa o'quvchi broniga kira olmaslik, 100% qaytarish, takroriy sharh taqiqi, admin tasdiqlashi + audit |
| `frontend/src/__tests__` | 3 tilda kalitlar to'liqligi, sana/pul formatlari, PIN-pad |
| `frontend/e2e` | landing, chiroq animatsiyasi, kirish, RBAC yo'naltirish (desktop + mobil) |

## 7. Development kirish ma'lumotlari (FAQAT dev/seed!)

| Rol | Login | Parol |
|---|---|---|
| Admin | `admin@edututor.uz` | `Admin12345!` |
| O'quvchi | `student@edututor.uz` (yoki `+998 90 123 45 67`) | `Parol123!` |
| O'quvchi 2 | `jasur@edututor.uz` | `Parol123!` |
| O'qituvchi (tasdiqlangan) | `teacher@edututor.uz` | `Parol123!` |
| O'qituvchi (tekshiruvda) | `pending@edututor.uz` | `Parol123!` |

⚠️ Production'da seed ishlatilmaydi (bloklangan). Admin faqat server tomonda yaratiladi:
`npm run admin:create -- --email siz@domen.uz --name "Ism"`.

## 8. Deploy: GitHub → Supabase → Render

### 8.1 GitHub
```bash
git init
git add .
git commit -m "EduTutor: birinchi versiya"
git branch -M main
git remote add origin https://github.com/USERNAME/edututor.git
git push -u origin main
```
GitHub Actions CI'ni yoqish uchun `docs/github-ci.yml` faylini `.github/workflows/ci.yml` ga ko'chiring
(har push'da build + testlar avtomatik ishlaydi). `.env` fayllari `.gitignore`da — sirlar GitHub'ga chiqmaydi. `package-lock.json` va `backend/prisma/migrations` ni albatta commit qiling.

### 8.2 Supabase (PostgreSQL + fayllar)
1. https://supabase.com → **New project** (region: Frankfurt — O'zbekistonga yaqin). Parolni saqlang.
2. **Project Settings → Database → Connection string**:
   - `DATABASE_URL` = *Transaction pooler* (port **6543**) + oxiriga `?pgbouncer=true&connection_limit=5`
   - `DIRECT_URL` = *Session pooler* yoki direct (port **5432**)
3. **Storage → New bucket** → nomi `edututor`, **Public: OFF** (fayllar faqat ruxsat bilan beriladi).
4. **Project Settings → API** → `URL` → `SUPABASE_URL`, `service_role` kalit → `SUPABASE_SERVICE_ROLE_KEY` (faqat serverda!).
5. Lokal kompyuterdan birinchi migratsiya: `backend/.env`ga Supabase URL'larni qo'yib `npm run db:migrate`, keyin `npm run admin:create -- --email ...`.

### 8.3 Render
1. https://render.com → **New + → Blueprint** → GitHub repo'ni tanlang (`render.yaml` avtomatik o'qiladi).
2. So'ralgan o'zgaruvchilarni kiriting:
   - `APP_URL`, `CORS_ORIGINS` = `https://SIZNING-SERVIS.onrender.com`
   - `WEBAUTHN_RP_ID` = `SIZNING-SERVIS.onrender.com` (https:// siz — barmoq izi shu domenga bog'lanadi)
   - `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `BREVO_API_KEY`, `EMAIL_FROM` (https://brevo.com, bepul 300 xat/kun; domen shart emas — Gmail'ingizni "Sender" sifatida tasdiqlang)
3. Deploy tugagach: `https://.../api/health` → `{"status":"ok"}`.
4. Telefonda saytni oching → brauzer menyusi → **"Bosh ekranga qo'shish / Install app"** → ilova o'rnatiladi.
   Birinchi kirishdan keyin **PIN-kod** o'rnatish va **barmoq izi**ni yoqish taklif qilinadi.

> Render free tarifda servis 15 daqiqa faolsizlikdan keyin "uxlaydi" (birinchi so'rov ~30–50 s).
> Real ishlatishda Starter ($7/oy) tavsiya etiladi.

### 8.4 Ubuntu VPS (ixtiyoriy, HTTPS bilan)
```bash
sudo apt install docker.io docker-compose-plugin certbot
git clone https://github.com/USERNAME/edututor.git /opt/edututor && cd /opt/edututor
cp .env.example backend/.env && nano backend/.env        # APP_URL=https://edututor.uz ...
sudo certbot certonly --standalone -d edututor.uz -d www.edututor.uz
docker compose --profile proxy up -d --build
docker compose exec app npm run admin:create -- --email admin@edututor.uz
crontab -e   # 0 3 * * * /opt/edututor/scripts/backup.sh
```

## 9. Integratsiyalangan servislar

| Servis | Holat | Izoh |
|---|---|---|
| PostgreSQL / Supabase | ✅ | Prisma, exclusion constraint, RLS |
| Supabase Storage | ✅ | `STORAGE_DRIVER=supabase`, signed URL |
| Email OTP | ✅ | console (dev) / Brevo / Resend / SMTP |
| WebRTC video | ✅ (kod) | STUN Google; TURN — sozlanadi |
| Jitsi Meet | ✅ | darsda "Video usuli: Jitsi" tanlansa |
| Payme Merchant API | ✅ (kod) | `/api/v1/webhooks/payme` — merchant kalitlari kerak |
| Click SHOP API | ✅ (kod) | `/api/v1/webhooks/click/prepare|complete` |
| Sandbox to'lov | ✅ | `PAYMENT_SANDBOX=true` |
| Google / Telegram login | ✅ (kod) | client ID / bot token kerak |
| PWA + PIN + barmoq izi | ✅ | WebAuthn (HTTPS) |
| Swagger | ✅ | `/api/docs` |

## 10. Yetishmayotgan tashqi kalitlar (siz olishingiz kerak)

- **Payme**: biznes kabinet → `PAYME_MERCHANT_ID`, `PAYME_SECRET_KEY`; endpoint: `https://DOMEN/api/v1/webhooks/payme`. Test: test.paycom.uz.
- **Click**: merchant.click.uz → `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, `CLICK_SECRET_KEY`; Prepare/Complete URL'lar yuqorida.
- **Brevo** (tavsiya): `BREVO_API_KEY` + Brevo'da tasdiqlangan `EMAIL_FROM`. Muqobil: Resend (domen kerak) yoki SMTP.
- **TURN server** (mobil internet/NAT orqasidagi foydalanuvchilar uchun muhim): metered.ca (bepul 50GB) yoki o'z coturn → `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL`.
- **Google OAuth**: `GOOGLE_CLIENT_ID` = `VITE_GOOGLE_CLIENT_ID`. **Telegram**: @BotFather → `/setdomain`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `VITE_TELEGRAM_BOT_USERNAME`.
- SMS (Eskiz.uz) — arxitektura tayyor (`lib/notify.ts`), provayder ulanmagan.

## 11. Funksiyalar ro'yxati (tekshiruv)

- [x] Ro'yxatdan o'tish (O'quvchi/O'qituvchi), email OTP, kirish (email yoki telefon), "meni eslab qol", parolni tiklash, chiqish, token rotatsiyasi
- [x] Animatsiyali "bilim chirog'i" login/ro'yxat/OTP sahifalari (ip tortiladi, nur rangi tanlanadi)
- [x] Telefon ilovasi (PWA): PIN-kod, barmoq izi/Face ID, fonda qulflash, 5 xato → chiqarish
- [x] RBAC + resurs egaligi backendda; ADMIN faqat CLI orqali
- [x] O'qituvchi tasdiqlash (hujjatlar, admin qarori, audit)
- [x] O'qituvchi profili, fanlar, sertifikatlar, haftalik jadval
- [x] Dars CRUD (individual, guruh, sinov, konsultatsiya), arxivlash, sanalar
- [x] Qidiruv + 9 ta filtr + 6 xil saralash, sahifalash
- [x] Bron: slot tanlash, tasdiqlash/rad etish, ko'chirish, bekor qilish siyosati, kalendar
- [x] Double booking: advisory lock + tranzaksiya + EXCLUDE constraint
- [x] Video dars (WebRTC mesh, ekran ulashish, chat, ishtirokchilar, holat) yoki Jitsi
- [x] Uy vazifalari (fayl, muddat, topshirish, baholash), materiallar
- [x] Chat (realtime, o'qildi belgisi, fayl, kontaktlarni yashirish), bildirishnomalar (realtime)
- [x] To'lov: sandbox, Payme, Click, chek, qaytarish, escrow, komissiya, payout
- [x] Sharhlar (faqat yakunlangan dars, 1 ta), reyting, shikoyat, moderatsiya
- [x] Admin: statistika, foydalanuvchilar, tasdiqlash, fanlar, darslar, bronlar, to'lovlar, qaytarishlar, payoutlar, sharhlar, shikoyatlar, sozlamalar, audit
- [x] 3 til, UZS, Asia/Tashkent, +998 format
- [x] Mobil: pastki menyu, bottom-sheet, mobil kalendar, sensorli video boshqaruv
- [x] Loading / empty / error holatlari, Swagger, Docker, CI, backup/restore

## 12. Ma'lum cheklovlar

- Kod ishlab chiqish muhitida `npm install` qilish imkoni bo'lmagani sababli **to'liq build va API testlar sizning kompyuteringizda birinchi marta ishga tushiriladi**. Mantiqiy unit testlar (vaqt, pul, siyosat, xavfsizlik) alohida tekshirilgan.
- Video: WebRTC mesh 2–8 ishtirokchi uchun mo'ljallangan; katta guruhlar uchun SFU (LiveKit/mediasoup) kerak. Haqiqiy media ulanishi ikki qurilmada sinab ko'rilishi kerak; NAT orqasida TURN'siz ulanmasligi mumkin.
- Payme/Click kodi rasmiy protokol bo'yicha yozilgan, lekin haqiqiy merchant kalitlari bilan test kabinetda sinalmagan.
- Payme/Click orqali qaytarishlar provayder kabinetida qo'lda bajariladi (admin "processed" qiladi); sandbox'da avtomatik.
- Fon vazifalari bitta instansiyada ishlaydi (`RUN_JOBS=false` boshqalarida).
- iOS'da PWA push-bildirishnomalar va barmoq izi iOS 16.4+ talab qiladi.
