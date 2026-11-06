import { defineConfig, devices } from '@playwright/test';

/**
 * E2E: avval backend (seed bilan) va frontend ishga tushirilgan bo'lishi kerak:
 *   npm run dev   (root)   →  npx playwright test
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173', trace: 'on-first-retry' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
