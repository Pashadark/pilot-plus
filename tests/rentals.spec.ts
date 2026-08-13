import { expect, test, type Page } from '@playwright/test';

import { openAuthenticatedRoute } from './helpers/auth';

// These tests never provision data themselves. PILOT_RENTALS_E2E=1 is an explicit
// acknowledgement that the target is a disposable database with the fixture IDs below.
// It must not point at a shared local or production tenant.
const runnable = process.env.PILOT_RENTALS_E2E === '1';
const fixture = {
  clientId: process.env.PILOT_RENTALS_E2E_CLIENT_ID,
  overlapClientId: process.env.PILOT_RENTALS_E2E_OVERLAP_CLIENT_ID,
  foreignRentalId: process.env.PILOT_RENTALS_E2E_FOREIGN_RENTAL_ID,
  importWorkbook: process.env.PILOT_RENTALS_E2E_IMPORT_WORKBOOK,
};

async function signInAs(page: Page, email: string | undefined, password: string | undefined) {
  if (!email || !password) throw new Error('Для E2E роли нужны отдельные email и пароль fixture.');
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).toHaveURL('/');
}

test.describe('rental workflow', () => {
  test.skip(!runnable, 'Requires an isolated rental E2E database and approved fixtures.');

  test('administrator can open vehicle create/import controls and preview four fixture rows', async ({
    page,
  }) => {
    if (!fixture.importWorkbook)
      throw new Error('Нужен PILOT_RENTALS_E2E_IMPORT_WORKBOOK с четырьмя fixture-строками.');

    await openAuthenticatedRoute(page, '/vehicles');
    await expect(page.getByRole('link', { name: 'Добавить автомобиль' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Импортировать Excel' })).toBeVisible();
    await page.getByRole('link', { name: 'Добавить автомобиль' }).click();
    await expect(page.getByRole('heading', { name: 'Добавить автомобиль' })).toBeVisible();

    await page.goto('/vehicles');
    await page.getByRole('button', { name: 'Импортировать Excel' }).click();
    await page.getByLabel('Файл Excel').setInputFiles(fixture.importWorkbook);
    await page.getByRole('button', { name: 'Подготовить предпросмотр' }).click();
    await expect(page.getByText(/Будет добавлено:\s*4/u)).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    await page.getByRole('button', { name: 'Применить импорт' }).click();
    await expect(page.getByRole('status')).toContainText('Импорт завершён');
  });

  test('dispatcher saves a draft, rejects overlap, confirms and downloads both formats', async ({
    page,
  }) => {
    if (!fixture.clientId || !fixture.overlapClientId)
      throw new Error('Нужны client IDs для черновика и fixture с пересекающимся интервалом.');
    await signInAs(
      page,
      process.env.PILOT_RENTALS_E2E_DISPATCHER_EMAIL,
      process.env.PILOT_RENTALS_E2E_DISPATCHER_PASSWORD,
    );

    await page.goto(`/clients/${fixture.clientId}/rentals/new`);
    await expect(page.getByTestId('rental-wizard')).toBeVisible();
    await page.getByRole('button', { name: 'Далее' }).click();
    await page.getByLabel('Автомобиль').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Сохранить черновик' }).click();
    await expect(page.getByText('Черновик договора сохранён.')).toBeVisible();
    await page.getByRole('button', { name: 'Далее' }).click();
    await page.getByLabel('Выдача (Москва)').fill('2026-08-20T10:00');
    await page.getByLabel('Возврат (Москва)').fill('2026-08-22T10:00');
    await page.getByLabel('Адрес выдачи').fill('Москва, DEMO ONLY, выдача');
    await page.getByLabel('Адрес возврата').fill('Москва, DEMO ONLY, возврат');
    await page.getByRole('button', { name: 'Далее' }).click();
    await page.getByLabel('Залог, ₽').fill('10000');
    await page.getByLabel('Условия оплаты').fill('DEMO ONLY: при выдаче');
    await page.getByLabel('Территория использования').fill('Москва');
    await page.getByLabel('Допущенные водители').fill('DEMO ONLY водитель');
    await page.getByRole('button', { name: 'Далее' }).click();
    await page.getByRole('button', { name: 'Далее' }).click();
    await page.getByRole('button', { name: 'Подтвердить и занять автомобиль' }).click();
    await expect(page.getByText('Договор подтверждён, документы готовы.')).toBeVisible();
    const docx = page.getByRole('link', { name: 'Скачать DOCX' });
    const pdf = page.getByRole('link', { name: 'Скачать PDF' });
    await expect(docx).toBeVisible();
    await expect(pdf).toBeVisible();
    await Promise.all([page.waitForEvent('download'), docx.click()]);
    await Promise.all([page.waitForEvent('download'), pdf.click()]);

    await page.goto(`/clients/${fixture.overlapClientId}/rentals/new`);
    await page.getByRole('button', { name: 'Далее' }).click();
    await page.getByLabel('Автомобиль').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Далее' }).click();
    await page.getByLabel('Выдача (Москва)').fill('2026-08-10T10:00');
    await page.getByLabel('Возврат (Москва)').fill('2026-08-12T10:00');
    await expect(page.getByRole('alert')).toContainText('Занят подтверждённой арендой');
  });

  test('foreign tenant and driver sessions receive no rental data', async ({ page }) => {
    if (!fixture.foreignRentalId)
      throw new Error('Нужен PILOT_RENTALS_E2E_FOREIGN_RENTAL_ID из другого tenant.');
    await signInAs(
      page,
      process.env.PILOT_RENTALS_E2E_DRIVER_EMAIL,
      process.env.PILOT_RENTALS_E2E_DRIVER_PASSWORD,
    );
    await page.goto('/rentals');
    await expect(page.getByTestId('rental-list-page')).not.toBeVisible();
    await page.goto(`/rentals/${fixture.foreignRentalId}`);
    await expect(page.getByTestId('rental-detail-page')).not.toBeVisible();
  });

  test('calendar is mobile-safe and rentals loading geometry is labelled', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openAuthenticatedRoute(page, '/rentals');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.getByTestId('rental-calendar-agenda')).toBeVisible();

    await page.goto('/rentals?query=__rental_e2e_loading__', { waitUntil: 'commit' });
    await expect(page.locator('[aria-label="Загрузка договоров аренды"]')).toBeVisible();
  });
});
