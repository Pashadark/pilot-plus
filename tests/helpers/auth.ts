import { expect, type Page } from '@playwright/test';

export async function openAuthenticatedRoute(page: Page, route: string) {
  await page.goto(route);
  if (new URL(page.url()).pathname !== '/login') return;

  const email = process.env.PILOT_ADMIN_EMAIL;
  const password = process.env.PILOT_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('Для защищённых browser-тестов нужны PILOT_ADMIN_EMAIL и PILOT_ADMIN_PASSWORD.');
  }

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).toHaveURL('/');
  if (route !== '/') await page.goto(route);
}
