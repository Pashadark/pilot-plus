import { expect, test } from '@playwright/test';

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
