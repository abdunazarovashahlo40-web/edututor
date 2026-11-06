-- Dars yakunidagi o'qituvchi xulosasi
ALTER TABLE "Booking" ADD COLUMN "lessonSummary" TEXT;

-- Ota-ona uchun natijalar havolasi
ALTER TABLE "User" ADD COLUMN "parentShareToken" TEXT;
CREATE UNIQUE INDEX "User_parentShareToken_key" ON "User"("parentShareToken");
