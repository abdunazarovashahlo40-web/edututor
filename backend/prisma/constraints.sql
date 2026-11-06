-- EduTutor: Prisma sxemasida ifodalab bo'lmaydigan DB cheklovlari (idempotent).
-- Ishga tushirish: npm run db:constraints  (migrate deploy'dan keyin avtomatik)

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1) O'qituvchining faol dars sessiyalari vaqt bo'yicha KESISHMASLIGI kerak (double booking himoyasi).
-- Prisma DateTime = timestamp(3) (UTC saqlanadi), shuning uchun IMMUTABLE bo'lgan tsrange ishlatiladi.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lesson_session_no_overlap') THEN
    ALTER TABLE "LessonSession"
      ADD CONSTRAINT lesson_session_no_overlap
      EXCLUDE USING gist (
        "teacherId" WITH =,
        tsrange("startAt", "endAt", '[)') WITH &&
      ) WHERE (status IN ('scheduled', 'in_progress'));
  END IF;
END $$;

-- 2) Vaqt oralig'i to'g'ri bo'lishi
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lesson_session_valid_range') THEN
    ALTER TABLE "LessonSession" ADD CONSTRAINT lesson_session_valid_range CHECK ("endAt" > "startAt");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'review_rating_range') THEN
    ALTER TABLE "Review" ADD CONSTRAINT review_rating_range CHECK (rating BETWEEN 1 AND 5);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'availability_range') THEN
    ALTER TABLE "TeacherAvailability" ADD CONSTRAINT availability_range
      CHECK (weekday BETWEEN 0 AND 6 AND "startMinute" >= 0 AND "endMinute" <= 1440 AND "endMinute" > "startMinute");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_amount_positive') THEN
    ALTER TABLE "Payment" ADD CONSTRAINT payment_amount_positive CHECK (amount >= 0);
  END IF;
END $$;

-- 3) Bitta to'lov uchun faqat bitta muvaffaqiyatli Payme/Click tranzaksiya
CREATE UNIQUE INDEX IF NOT EXISTS payment_tx_one_performed
  ON "PaymentTransaction" ("paymentId") WHERE state = 2;

-- 4) Supabase: jadvallar faqat backend (service) orqali ishlatiladi — anon/REST orqali kirishni yopamiz.
DO $$
DECLARE r record;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    END LOOP;
  END IF;
END $$;
