import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { openAuthenticatedRoute } from './helpers/auth';

test('неизвестный маршрут показывает фирменную 404', async ({ page }) => {
  await page.goto('/такой-страницы-нет');

  await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible();
  await expect(page.getByText('404', { exact: true }).last()).toBeVisible();
  await expect(page.getByRole('link', { name: 'На главную' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Назад' })).toBeVisible();
});

test('несуществующий автомобиль показывает локальную 404', async ({ page }) => {
  await openAuthenticatedRoute(page, '/vehicles/несуществующий-id');

  await expect(page.getByRole('heading', { name: 'Автомобиль не найден' })).toBeVisible();
  await expect(page.getByText('404', { exact: true }).last()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Вернуться к автопарку' })).toBeVisible();
});

test('фирменная 404 помещается в экран шириной 375 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/такой-страницы-нет');

  await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('error boundaries используют retry Next.js 16.2 и не раскрывают message', () => {
  for (const relativePath of [
    'src/app/(protected)/error.tsx',
    'src/app/(protected)/vehicles/error.tsx',
    'src/app/global-error.tsx',
  ]) {
    const source = readFileSync(resolve(relativePath), 'utf8');

    expect(source).toContain('unstable_retry');
    expect(source).not.toContain('error.message');
  }
});

test('global error владеет документом, стилями и безопасным заголовком', () => {
  const source = readFileSync(resolve('src/app/global-error.tsx'), 'utf8');

  expect(source).toContain("import './globals.css'");
  expect(source).toContain('<html');
  expect(source).toContain('<body');
  expect(source).toContain('<title>Ошибка — Pilot+</title>');
  expect(source).toContain('safeErrorReference(error)');
});
