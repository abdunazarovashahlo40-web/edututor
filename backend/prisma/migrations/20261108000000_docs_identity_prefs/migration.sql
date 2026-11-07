-- O'qituvchi hujjatlarini tekshirish
ALTER TABLE "TeacherCertificate" ADD COLUMN "docType" TEXT;
ALTER TABLE "TeacherCertificate" ADD COLUMN "docNumber" TEXT;
ALTER TABLE "TeacherCertificate" ADD COLUMN "checkStatus" TEXT NOT NULL DEFAULT 'unchecked';
ALTER TABLE "TeacherCertificate" ADD COLUMN "checkSource" TEXT;
ALTER TABLE "TeacherCertificate" ADD COLUMN "checkNote" TEXT;
ALTER TABLE "TeacherCertificate" ADD COLUMN "checkedAt" TIMESTAMP(3);
ALTER TABLE "TeacherCertificate" ADD COLUMN "checkedBy" TEXT;

-- Shaxsni tasdiqlash (to'liq raqam saqlanmaydi)
ALTER TABLE "TeacherProfile" ADD COLUMN "identityType" TEXT;
ALTER TABLE "TeacherProfile" ADD COLUMN "identityLast4" TEXT;
ALTER TABLE "TeacherProfile" ADD COLUMN "identityHash" TEXT;
CREATE INDEX "TeacherProfile_identityHash_idx" ON "TeacherProfile"("identityHash");

-- Bildirishnoma sozlamalari
ALTER TABLE "User" ADD COLUMN "notifyPrefs" JSONB;
