import http from 'http';
import { env } from './config/env';
import { createApp } from './app';
import { createSocket } from './socket';
import { prisma } from './lib/prisma';
import { startJobs } from './jobs';

const app = createApp();
const server = http.createServer(app);
createSocket(server);

server.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`🎓 EduTutor API: http://localhost:${env.PORT}  ·  docs: /api/docs  ·  env: ${env.NODE_ENV}`);
});

const jobs = process.env.RUN_JOBS === 'false' ? null : startJobs();

const shutdown = async (signal: string) => {
  console.log(`${signal} — to'xtatilmoqda...`);
  if (jobs) clearInterval(jobs);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
