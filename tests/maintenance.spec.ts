import { expect, test } from '@playwright/test';

import { openAuthenticatedRoute } from './helpers/auth';

test('администратор планирует, фильтрует и завершает ТО', async ({ page }) => {
  await openAuthenticatedRoute(page, '/maintenance');

  await expect(page.getByTestId('maintenance-page')).toBeVisible();
  await expect(page.getByTestId('app-header')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Техническое обслуживание', level: 1 }),
  ).toBeVisible();

  const title = `Замена масла ${Date.now()}`;
  await page.getByRole('button', { name: 'Запланировать ТО' }).click();
  await page.getByLabel('Автомобиль').selectOption({ index: 1 });
  await page.getByLabel('Название работы').fill(title);
  await page.getByLabel('Вид работы').selectOption('OIL');
  await page.getByLabel('Плановая дата').fill('2026-07-23T10:00');
  await page.getByRole('button', { name: 'Сохранить ТО' }).click();

  await expect(page.getByText('ТО запланировано.')).toBeVisible();
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.getByRole('searchbox', { name: 'Поиск по обслуживанию' }).fill(title);
  await page.getByLabel('Статус').selectOption('PLANNED');
  await page.getByLabel('Вид ТО').selectOption('OIL');

  const record = page.getByTestId('maintenance-record').filter({ hasText: title });
  await expect(record).toHaveCount(1);
  await expect(record).toContainText('Запланировано');

  await page.getByLabel('Статус').selectOption('');
  await record.getByRole('button', { name: 'Начать работу' }).click();
  await expect(page.getByText('Статус ТО обновлён.')).toBeVisible();
  await page.getByLabel('Статус').selectOption('IN_PROGRESS');
  await expect(record).toContainText('В работе');

  await page.getByLabel('Статус').selectOption('');
  await record.getByRole('button', { name: 'Завершить работу' }).click();
  await expect(page.getByText('Статус ТО обновлён.')).toBeVisible();
  await page.getByLabel('Статус').selectOption('COMPLETED');
  await expect(record).toContainText('Завершено');
});

test('мобильная страница ТО не переполняет экран и показывает карточки', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedRoute(page, '/maintenance');

  await expect(page.getByTestId('maintenance-page')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);

  const createButton = page.getByRole('button', { name: 'Запланировать ТО' });
  expect((await createButton.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await expect(page.getByTestId('maintenance-desktop-table')).toBeHidden();
  await expect(page.getByTestId('maintenance-mobile-list')).toBeVisible();
});
