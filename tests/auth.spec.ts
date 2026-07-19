import { expect, test } from '@playwright/test';

import { openAuthenticatedRoute } from './helpers/auth';

test('гость перенаправляется на публичный экран входа', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Вход в Pilot+' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Пароль')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible();
});

test('форма сообщает локальные ошибки и доступна с клавиатуры', async ({ page }) => {
  await page.goto('/login');
  const email = page.getByLabel('Email');
  await expect(email).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Пароль')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Войти' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Введите корректный email')).toBeVisible();
  await expect(page.getByText('Введите пароль')).toBeVisible();
});

test('экран входа не переполняется на ширине 375 пикселей', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/login');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
});

test('экран входа использует сохранённую тёмную тему', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pilot-theme', 'dark'));
  await page.goto('/login');

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('heading', { name: 'Вход в Pilot+' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
});

test('выход показывает одноразовое уведомление и очищает безопасный marker', async ({ page }) => {
  await page.goto('/login?loggedOut=1');

  await expect(page.getByRole('status')).toContainText('Вы вышли из системы');
  await expect(page).toHaveURL(/\/login$/);
  await page.reload();
  await expect(page.getByRole('status')).toHaveCount(0);
});

test('экран входа игнорирует произвольный текст из URL', async ({ page }) => {
  await page.goto('/login?loggedOut=%D0%BF%D0%BE%D0%B4%D0%BC%D0%B5%D0%BD%D0%B0');

  await expect(page.getByRole('status')).toHaveCount(0);
});

test('вход показывает одноразовое уведомление и очищает безопасный marker', async ({ page }) => {
  test.skip(
    !process.env.PILOT_ADMIN_EMAIL || !process.env.PILOT_ADMIN_PASSWORD,
    'Для проверки входа нужны учётные данные тестового администратора.',
  );

  await openAuthenticatedRoute(page, '/?welcome=1');

  await expect(page.getByRole('status')).toContainText('Вы вошли в Pilot+');
  await expect(page).toHaveURL(/\/$/);
  await page.reload();
  await expect(page.getByRole('status')).toHaveCount(0);
});
