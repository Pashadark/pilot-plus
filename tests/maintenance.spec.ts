import { expect, test } from '@playwright/test';

import { openAuthenticatedRoute } from './helpers/auth';
import {
  cleanupE2EMaintenanceRecords,
  createE2EMaintenanceOdometerPosition,
  E2E_MAINTENANCE_TITLE_PREFIX,
} from './helpers/maintenance';

function formatMoscowDateTime(value: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(value)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

test.afterAll(async () => {
  await cleanupE2EMaintenanceRecords();
});

test('администратор планирует, фильтрует и завершает ТО', async ({ page }) => {
  const vehicleId = await createE2EMaintenanceOdometerPosition();
  await openAuthenticatedRoute(page, '/maintenance');

  await expect(page.getByTestId('maintenance-page')).toBeVisible();
  await expect(page.getByTestId('app-header')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Техническое обслуживание', level: 1 }),
  ).toBeVisible();
  await expect(page.getByText('Запланировано', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Скоро', { exact: true })).toBeVisible();
  await expect(page.getByText('Просрочено', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Завершено за месяц', { exact: true })).toBeVisible();
  const plannedStat = page.getByTestId('maintenance-planned-stat').locator('strong');
  const dueSoonStat = page.getByTestId('maintenance-due-soon-stat').locator('strong');
  const overdueStat = page.getByTestId('maintenance-overdue-stat').locator('strong');
  const completedStat = page.getByTestId('maintenance-completed-month-stat').locator('strong');
  const initialPlanned = Number(await plannedStat.textContent());
  const initialDueSoon = Number(await dueSoonStat.textContent());
  const initialOverdue = Number(await overdueStat.textContent());
  const initialCompleted = Number(await completedStat.textContent());

  const title = `${E2E_MAINTENANCE_TITLE_PREFIX}desktop-${Date.now()}`;
  await page.getByRole('button', { name: 'Запланировать ТО' }).click();
  await page.getByLabel('Автомобиль').selectOption(vehicleId);
  await page.getByLabel('Название работы').fill(title);
  await page.getByLabel('Вид работы').selectOption('OIL');
  await page
    .getByLabel('Плановая дата')
    .fill(formatMoscowDateTime(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  await page.getByLabel('Плановый пробег, км').fill('15000');
  await page.getByRole('button', { name: 'Сохранить ТО' }).click();

  const plannedToast = page
    .locator('[data-toast-tone="success"]')
    .filter({ hasText: 'ТО запланировано.' });
  await expect(plannedToast).toBeVisible();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(plannedStat).toHaveText(String(initialPlanned + 1));
  await expect(dueSoonStat).toHaveText(String(initialDueSoon + 1));

  await page.getByRole('searchbox', { name: 'Поиск по обслуживанию' }).fill(title);
  await page.getByLabel('Статус').selectOption('PLANNED');
  await page.getByLabel('Вид ТО').selectOption('OIL');

  const record = page.getByTestId('maintenance-record').filter({ hasText: title });
  await expect(record).toHaveCount(1);
  await expect(record).toContainText('Запланировано');
  await expect(record.getByText('Осталось: 3 000 км', { exact: true })).toBeVisible();
  await expect(record.getByRole('progressbar', { name: 'Прогресс до ТО' })).toBeVisible();
  await plannedToast.getByRole('button', { name: 'Закрыть уведомление' }).click();

  await record.getByRole('button', { name: 'Начать работу' }).click();
  await expect(record).toHaveCount(0);
  const transitionToast = page
    .locator('[data-toast-tone="success"]')
    .filter({ hasText: 'Статус ТО обновлён.' });
  await expect(transitionToast).toBeVisible();
  await expect(plannedStat).toHaveText(String(initialPlanned));
  await expect(dueSoonStat).toHaveText(String(initialDueSoon));
  await page.getByLabel('Статус').selectOption('IN_PROGRESS');
  await expect(record).toContainText('В работе');

  await transitionToast.getByRole('button', { name: 'Закрыть уведомление' }).click();
  await record.getByRole('button', { name: 'Завершить работу' }).click();
  await expect(record).toHaveCount(0);
  await expect(transitionToast).toBeVisible();
  await page.getByLabel('Статус').selectOption('COMPLETED');
  await expect(record).toContainText('Завершено');
  await expect(completedStat).toHaveText(String(initialCompleted + 1));

  await transitionToast.getByRole('button', { name: 'Закрыть уведомление' }).click();
  const cancelledTitle = `${E2E_MAINTENANCE_TITLE_PREFIX}cancel-${Date.now()}`;
  await page.getByRole('button', { name: 'Запланировать ТО' }).click();
  const createDialog = page.getByRole('dialog', { name: 'Запланировать ТО' });
  await createDialog.getByLabel('Автомобиль').selectOption(vehicleId);
  await createDialog.getByLabel('Название работы').fill(cancelledTitle);
  await createDialog.getByLabel('Вид работы').selectOption('INSPECTION');
  await createDialog
    .getByLabel('Плановая дата')
    .fill(formatMoscowDateTime(new Date(Date.now() - 5 * 60 * 1000)));
  await createDialog.getByRole('button', { name: 'Сохранить ТО' }).click();
  await expect(createDialog).toBeHidden();
  await expect(overdueStat).toHaveText(String(initialOverdue + 1));

  const createToast = page
    .locator('[data-toast-tone="success"]')
    .filter({ hasText: 'ТО запланировано.' });
  await createToast.getByRole('button', { name: 'Закрыть уведомление' }).click();
  await page.getByRole('searchbox', { name: 'Поиск по обслуживанию' }).fill(cancelledTitle);
  await page.getByLabel('Статус').selectOption('OVERDUE');
  await page.getByLabel('Вид ТО').selectOption('INSPECTION');
  const cancelledRecord = page
    .getByTestId('maintenance-record')
    .filter({ hasText: cancelledTitle });
  await expect(cancelledRecord.getByText('Просрочено', { exact: true })).toBeVisible();
  await cancelledRecord.getByRole('button', { name: 'Отменить' }).click();
  const confirmation = page.getByRole('dialog', { name: 'Отменить ТО?' });
  await expect(confirmation).toBeVisible();
  await expect(cancelledRecord.getByText('Просрочено', { exact: true })).toBeVisible();
  await expect(transitionToast).toBeHidden();

  await confirmation.getByRole('button', { name: 'Подтвердить' }).click();
  await expect(confirmation).toBeHidden();
  await expect(cancelledRecord).toHaveCount(0);
  await expect(transitionToast).toBeVisible();
  await expect(overdueStat).toHaveText(String(initialOverdue));
  await page.getByLabel('Статус').selectOption('CANCELLED');
  await expect(cancelledRecord.getByText('Отменено', { exact: true })).toBeVisible();
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

  await createButton.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  for (const control of await dialog
    .locator('input:not([type="hidden"]), select, textarea, button')
    .all()) {
    expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  const title = `${E2E_MAINTENANCE_TITLE_PREFIX}mobile-${Date.now()}`;
  await page.getByLabel('Автомобиль').selectOption({ index: 1 });
  await page.getByLabel('Название работы').fill(title);
  await page.getByLabel('Вид работы').selectOption('INSPECTION');
  await page
    .getByLabel('Плановая дата')
    .fill(formatMoscowDateTime(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)));
  await page.getByRole('button', { name: 'Сохранить ТО' }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('searchbox', { name: 'Поиск по обслуживанию' }).fill(title);
  const record = page.getByTestId('maintenance-mobile-record').filter({ hasText: title });
  await expect(record).toBeVisible();
  for (const action of await record.getByRole('button').all()) {
    expect((await action.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
