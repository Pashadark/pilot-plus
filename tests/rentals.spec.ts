import { randomUUID } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

import { prisma } from '../src/database/prisma/client';

import { openAuthenticatedRoute } from './helpers/auth';

// These tests never provision data themselves. PILOT_RENTALS_E2E=1 is an explicit
// acknowledgement that the target is a disposable database with the fixture IDs below.
// It must not point at a shared local or production tenant.
const runnable = process.env.PILOT_RENTALS_E2E === '1';
const marker = `rental-e2e-${randomUUID()}`;
const created = {
  companyIds: [] as string[],
  userIds: [] as string[],
  clientIds: [] as string[],
  vehicleIds: [] as string[],
};

function requireDisposableDatabase() {
  const url = process.env.DATABASE_URL ?? '';
  if (!/e2e|test/i.test(url))
    throw new Error('PILOT_RENTALS_E2E допускается только с отдельной test/e2e DATABASE_URL.');
}

async function createTenant(role: 'COMPANY_ADMIN' | 'DISPATCHER' | 'DRIVER') {
  const companyId = randomUUID();
  const userId = randomUUID();
  const clientId = randomUUID();
  const vehicleId = randomUUID();
  await prisma.company.create({
    data: {
      id: companyId,
      name: `E2E ${marker}`,
      slug: `${marker}-${companyId.slice(0, 8)}`,
      isDemo: true,
    },
  });
  await prisma.user.create({
    data: {
      id: userId,
      email: `${marker}-${userId}@example.test`,
      name: 'E2E rental',
      passwordHash: 'fixture-only',
    },
  });
  await prisma.companyMember.create({
    data: { companyId, userId, role, additionalPermissions: [] },
  });
  await prisma.client.create({
    data: {
      id: clientId,
      companyId,
      firstName: 'E2E',
      lastName: marker,
      phoneEncrypted: 'fixture',
      phoneIndex: `${marker}-${clientId}`,
      driverCategories: [],
      createdByUserId: userId,
    },
  });
  await prisma.vehicle.create({
    data: {
      id: vehicleId,
      companyId,
      sourceKey: `${marker}-${vehicleId}`,
      internalNumber: marker,
      model: 'E2E',
      city: 'Москва',
      transmission: 'AUTOMATIC',
      fuelType: 'PETROL',
      seats: 4,
      dailyPriceMinor: 100000,
      currency: 'RUB',
    },
  });
  created.companyIds.push(companyId);
  created.userIds.push(userId);
  created.clientIds.push(clientId);
  created.vehicleIds.push(vehicleId);
  return { companyId, userId, clientId, vehicleId };
}

test.beforeAll(async () => {
  if (!runnable) return;
  requireDisposableDatabase();
  await createTenant('COMPANY_ADMIN');
  await createTenant('DISPATCHER');
  await createTenant('DRIVER');
  await createTenant('COMPANY_ADMIN');
});
test.afterAll(async () => {
  if (!runnable) return;
  await prisma.rentalDocumentVersion.deleteMany({
    where: { companyId: { in: created.companyIds } },
  });
  await prisma.rentalDocumentGeneration.deleteMany({
    where: { companyId: { in: created.companyIds } },
  });
  await prisma.rental.deleteMany({ where: { companyId: { in: created.companyIds } } });
  await prisma.vehicle.deleteMany({ where: { id: { in: created.vehicleIds } } });
  await prisma.client.deleteMany({ where: { id: { in: created.clientIds } } });
  await prisma.company.deleteMany({ where: { id: { in: created.companyIds } } });
  await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
  await prisma.$disconnect();
});
const fixture = {
  clientId: process.env.PILOT_RENTALS_E2E_CLIENT_ID,
  overlapClientId: process.env.PILOT_RENTALS_E2E_OVERLAP_CLIENT_ID,
  foreignRentalId: process.env.PILOT_RENTALS_E2E_FOREIGN_RENTAL_ID,
  vehicleId: process.env.PILOT_RENTALS_E2E_VEHICLE_ID,
  importWorkbook: process.env.PILOT_RENTALS_E2E_IMPORT_WORKBOOK,
  importCompanyId: process.env.PILOT_RENTALS_E2E_IMPORT_COMPANY_ID,
};

async function signInAs(page: Page, email: string | undefined, password: string | undefined) {
  if (!email || !password) throw new Error('Для E2E роли нужны отдельные email и пароль fixture.');
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).toHaveURL('/');
}

async function saveDraftWithInterval(page: Page, clientId: string) {
  await page.goto(`/clients/${clientId}/rentals/new`);
  await expect(page.getByTestId('rental-wizard')).toBeVisible();
  await page.getByRole('button', { name: 'Далее' }).click();
  if (!fixture.vehicleId) throw new Error('Нужен PILOT_RENTALS_E2E_VEHICLE_ID общего автомобиля.');
  await page.getByLabel('Автомобиль').selectOption(fixture.vehicleId);
  await page.getByRole('button', { name: 'Далее' }).click();
  await page.getByLabel('Выдача (Москва)').fill('2026-08-20T10:00');
  await page.getByLabel('Возврат (Москва)').fill('2026-08-22T10:00');
  await page.getByLabel('Адрес выдачи').fill('Москва, DEMO ONLY, выдача');
  await page.getByLabel('Адрес возврата').fill('Москва, DEMO ONLY, возврат');
  await page.getByRole('button', { name: 'Сохранить черновик' }).click();
  await expect(page.getByText('Черновик договора сохранён.')).toBeVisible();
}

async function advanceDraftToConfirmation(page: Page) {
  await page.getByRole('button', { name: 'Далее' }).click();
  await page.getByLabel('Залог, ₽').fill('10000');
  await page.getByLabel('Условия оплаты').fill('DEMO ONLY: при выдаче');
  await page.getByLabel('Территория использования').fill('Москва');
  await page.getByLabel('Допущенные водители').fill('DEMO ONLY водитель');
  await page.getByRole('button', { name: 'Далее' }).click();
  await page.getByRole('button', { name: 'Далее' }).click();
  await expect(page.getByRole('button', { name: 'Подтвердить и занять автомобиль' })).toBeEnabled();
}

test.describe('rental workflow', () => {
  test.skip(!runnable, 'Requires an isolated rental E2E database and approved fixtures.');

  test('administrator can open vehicle create/import controls and preview four fixture rows', async ({
    page,
  }) => {
    if (!fixture.importWorkbook || !fixture.importCompanyId)
      throw new Error(
        'Нужны PILOT_RENTALS_E2E_IMPORT_WORKBOOK и disposable PILOT_RENTALS_E2E_IMPORT_COMPANY_ID.',
      );

    await openAuthenticatedRoute(page, '/vehicles');
    await expect(page.getByRole('link', { name: 'Добавить автомобиль' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Импортировать Excel' })).toBeVisible();
    await page.getByRole('link', { name: 'Добавить автомобиль' }).click();
    await expect(page.getByRole('heading', { name: 'Добавить автомобиль' })).toBeVisible();

    await page.goto('/vehicles');
    await page.getByRole('button', { name: 'Импортировать Excel' }).click();
    await page.getByLabel('Компания').selectOption(fixture.importCompanyId);
    await page.getByLabel('Файл Excel').setInputFiles(fixture.importWorkbook);
    await page.getByRole('button', { name: 'Подготовить предпросмотр' }).click();
    const preview = page.getByRole('table');
    await expect(preview).toBeVisible();
    await expect(preview.locator('tbody tr')).toHaveCount(4);
    await expect(preview.getByText('Ошибка импорта')).toHaveCount(0);
    // The dedicated company and all preview-created markers are removed by the disposable
    // E2E harness teardown. Applying twice is intentionally not asserted as "four adds".
    await page.getByRole('button', { name: 'Применить импорт' }).click();
    await expect(page.getByRole('status')).toContainText(/Импорт завершён: добавлено [0-4]\./u);
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

    await saveDraftWithInterval(page, fixture.clientId);
    const overlappingPage = await page.context().newPage();
    await saveDraftWithInterval(overlappingPage, fixture.overlapClientId);
    await advanceDraftToConfirmation(page);
    await advanceDraftToConfirmation(overlappingPage);
    await page.getByRole('button', { name: 'Подтвердить и занять автомобиль' }).click();
    await expect(page.getByText('Договор подтверждён, документы готовы.')).toBeVisible();
    const docx = page.getByRole('link', { name: 'Скачать DOCX' });
    const pdf = page.getByRole('link', { name: 'Скачать PDF' });
    await expect(docx).toBeVisible();
    await expect(pdf).toBeVisible();
    await Promise.all([page.waitForEvent('download'), docx.click()]);
    await Promise.all([page.waitForEvent('download'), pdf.click()]);

    await overlappingPage.getByRole('button', { name: 'Подтвердить и занять автомобиль' }).click();
    await expect(overlappingPage.getByRole('alert')).toContainText(
      'Не удалось подтвердить договор.',
    );
    await overlappingPage.close();
  });

  test('foreign tenant and driver sessions receive no rental data', async ({ browser, page }) => {
    if (!fixture.foreignRentalId)
      throw new Error('Нужен PILOT_RENTALS_E2E_FOREIGN_RENTAL_ID из другого tenant.');
    const foreignContext = await browser.newContext();
    const foreignPage = await foreignContext.newPage();
    await signInAs(
      foreignPage,
      process.env.PILOT_RENTALS_E2E_FOREIGN_EMAIL,
      process.env.PILOT_RENTALS_E2E_FOREIGN_PASSWORD,
    );
    await foreignPage.goto(`/rentals/${fixture.foreignRentalId}`);
    await expect(foreignPage.getByTestId('rental-detail-page')).not.toBeVisible();
    await foreignContext.close();
    await signInAs(
      page,
      process.env.PILOT_RENTALS_E2E_DRIVER_EMAIL,
      process.env.PILOT_RENTALS_E2E_DRIVER_PASSWORD,
    );
    await page.goto('/rentals');
    await expect(page.getByTestId('rental-list-page')).not.toBeVisible();
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
