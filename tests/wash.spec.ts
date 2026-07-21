import { expect, test } from '@playwright/test';

import { openAuthenticatedRoute } from './helpers/auth';
import { cleanupE2EWashRecords, E2E_WASH_PROVIDER_PREFIX } from './helpers/wash';

test.afterAll(async () => {
  await cleanupE2EWashRecords();
});

test('администратор планирует, фильтрует и завершает мойку', async ({ page }) => {
  await openAuthenticatedRoute(page, '/wash');

  await expect(page.getByTestId('wash-page')).toBeVisible();
  await expect(page.getByTestId('app-header')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Мойка автомобилей', level: 1 })).toBeVisible();
  await expect(page.getByText('Сегодня', { exact: true })).toBeVisible();
  await expect(page.getByText('В работе', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Завершено за месяц', { exact: true })).toBeVisible();
  await expect(page.getByText('Требуют мойки', { exact: true })).toBeVisible();

  const provider = `${E2E_WASH_PROVIDER_PREFIX}desktop-${Date.now()}`;
  await page.getByRole('button', { name: 'Запланировать мойку' }).click();
  await page.getByLabel('Автомобиль').selectOption({ index: 1 });
  await expect(page.getByRole('dialog').locator('img')).toBeVisible();
  await page.getByRole('dialog').getByLabel('Тип мойки').selectOption('COMPLEX');
  await page.getByLabel('Плановая дата').fill('2026-07-23T12:00');
  await page.getByLabel('Мойка или подрядчик').fill(provider);
  await page.getByRole('button', { name: 'Сохранить мойку' }).click();

  await expect(page.getByText('Мойка запланирована.')).toBeVisible();
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.getByRole('searchbox', { name: 'Поиск по мойке' }).fill(provider);
  await page.getByLabel('Статус').selectOption('PLANNED');
  await page.getByLabel('Вид мойки').selectOption('COMPLEX');

  const record = page.getByTestId('wash-record').filter({ hasText: provider });
  await expect(record).toHaveCount(1);
  const plannedBadge = record.getByText('Запланировано', { exact: true });
  await expect(plannedBadge).toBeVisible();
  await expect(plannedBadge.locator('svg')).toBeVisible();

  await record.getByRole('button', { name: 'Начать мойку' }).click();
  await expect(record).toHaveCount(0);
  const transitionToast = page
    .locator('[data-toast-tone="success"]')
    .filter({ hasText: 'Статус мойки обновлён.' });
  await expect(transitionToast).toBeVisible();
  await page.getByLabel('Статус').selectOption('IN_PROGRESS');
  await expect(record.getByText('В работе', { exact: true })).toBeVisible();

  await transitionToast.getByRole('button', { name: 'Закрыть уведомление' }).click();
  await record.getByRole('button', { name: 'Завершить мойку' }).click();
  await expect(record).toHaveCount(0);
  await expect(transitionToast).toBeVisible();
  await page.getByLabel('Статус').selectOption('COMPLETED');
  await expect(record.getByText('Завершено', { exact: true })).toBeVisible();

  await page.getByRole('searchbox', { name: 'Поиск по мойке' }).fill('нет-такой-мойки');
  const desktopTable = page.getByTestId('wash-desktop-table');
  await expect(desktopTable.getByText('Записи не найдены', { exact: true })).toBeVisible();
  await expect(
    desktopTable.getByText('Измените поиск или фильтры.', { exact: true }),
  ).toBeVisible();
});

test('мобильная страница мойки не переполняет экран и сохраняет touch targets', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedRoute(page, '/wash');

  await expect(page.getByTestId('wash-page')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);

  const createButton = page.getByRole('button', { name: 'Запланировать мойку' });
  expect((await createButton.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await expect(page.getByTestId('wash-desktop-table')).toBeHidden();
  await expect(page.getByTestId('wash-mobile-list')).toBeVisible();

  await createButton.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  for (const control of await dialog
    .locator('input:not([type="hidden"]), select, textarea, button')
    .all()) {
    expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  const provider = `${E2E_WASH_PROVIDER_PREFIX}mobile-${Date.now()}`;
  await page.getByLabel('Автомобиль').selectOption({ index: 1 });
  await page.getByLabel('Тип мойки').selectOption('BODY');
  await page.getByLabel('Плановая дата').fill('2026-07-24T12:00');
  await page.getByLabel('Мойка или подрядчик').fill(provider);
  await page.getByRole('button', { name: 'Сохранить мойку' }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('searchbox', { name: 'Поиск по мойке' }).fill(provider);
  const record = page.getByTestId('wash-mobile-record').filter({ hasText: provider });
  await expect(record).toBeVisible();
  await expect(record.getByText('Запланировано', { exact: true })).toBeVisible();
  for (const action of await record.getByRole('button').all()) {
    expect((await action.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
