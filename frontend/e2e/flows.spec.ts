import { expect, test, type Page } from '@playwright/test';

async function lampOn(page: Page) {
  await page.evaluate(() => sessionStorage.setItem('et_lamp', '1'));
}

async function login(page: Page, phoneOrEmail: string, password = 'Parol123!') {
  await page.goto('/login');
  await lampOn(page);
  await page.reload();
  await page.getByRole('button', { name: /email/i }).first().click();
  await page.locator('input[type=email]').fill(phoneOrEmail);
  await page.locator('input[type=password]').fill(password);
  await page.locator('form button[type=submit]').click();
}

test('landing ochiladi va qidiruv ishlaydi', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
  await page.getByPlaceholder(/fan|предмет|subject/i).first().fill('Matematika');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/teachers/);
});

test('chiroq ipi tortilganda login formasi paydo bo\'ladi', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => sessionStorage.removeItem('et_lamp'));
  await page.reload();
  await expect(page.locator('input[type=password]')).toHaveCount(0);
  await page.getByRole('button', { pressed: false }).first().click();
  await expect(page.locator('input[type=password]')).toBeVisible();
});

test('o\'quvchi kiradi va kabinetini ko\'radi', async ({ page }) => {
  await login(page, 'student@edututor.uz');
  await expect(page).toHaveURL(/\/student/);
});

test('o\'quvchi admin paneliga kira olmaydi', async ({ page }) => {
  await login(page, 'student@edututor.uz');
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/student/);
});

test('o\'qituvchi bron so\'rovlarini ko\'radi', async ({ page }) => {
  await login(page, 'teacher@edututor.uz');
  await expect(page).toHaveURL(/\/teacher/);
  await page.goto('/teacher/bookings?tab=requests');
  await expect(page.locator('main')).toBeVisible();
});
