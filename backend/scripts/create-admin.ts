/**
 * Admin faqat server tomonda yaratiladi (ro'yxatdan o'tish orqali emas):
 *   npm run admin:create -- --email admin@edututor.uz --name "Bosh admin"
 * Parol terminalda so'raladi yoki ADMIN_PASSWORD muhit o'zgaruvchisidan olinadi.
 */
import '../src/config/env';
import readline from 'readline';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function ask(q: string) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise<string>((r) => rl.question(q, (a) => (rl.close(), r(a))));
}

async function main() {
  const email = (arg('email') ?? (await ask('Email: '))).toLowerCase().trim();
  const fullName = arg('name') ?? 'Administrator';
  const password = process.env.ADMIN_PASSWORD ?? (await ask('Parol (kamida 12 belgi): '));
  if (password.length < 12) throw new Error('Parol kamida 12 belgi bo\'lsin');
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, fullName, role: 'ADMIN', status: 'ACTIVE', emailVerifiedAt: new Date(), passwordHash: await bcrypt.hash(password, 12) },
    update: { role: 'ADMIN', status: 'ACTIVE', passwordHash: await bcrypt.hash(password, 12) },
  });
  await prisma.auditLog.create({ data: { action: 'admin.create_cli', entityType: 'User', entityId: user.id } });
  console.log(`✅ Admin tayyor: ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
