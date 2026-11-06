/**
 * Production DB yangilash:
 *  - prisma/migrations mavjud bo'lsa → `prisma migrate deploy` (tavsiya etiladi)
 *  - hali migratsiya yaratilmagan bo'lsa → `prisma db push` (birinchi deploy uchun zaxira yo'l)
 *  - so'ng constraints.sql (double-booking EXCLUDE cheklovi, CHECK'lar, RLS) qo'llanadi
 */
import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';

const run = (cmd) => {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
};

const dir = new URL('../prisma/migrations', import.meta.url);
const hasMigrations = existsSync(dir) && readdirSync(dir).some((f) => /^\d+_/.test(f));

if (hasMigrations) run('npx prisma migrate deploy');
else {
  console.warn('⚠️  prisma/migrations topilmadi — `prisma db push` ishlatilmoqda. Lokal `npm run db:migrate` qilib migratsiyani commit qiling.');
  run('npx prisma db push --skip-generate');
}
run('npx prisma db execute --file prisma/constraints.sql --schema prisma/schema.prisma');
console.log('✅ Ma\'lumotlar bazasi tayyor');
