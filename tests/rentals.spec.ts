import { randomUUID } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

import { prisma } from '../src/database/prisma/client';
import { hashPassword } from '../src/services/auth/password';

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
const password = `E2E-${randomUUID()}-safe`;
const fixture: {
  admin: { email: string; companyId: string; clientId: string; vehicleId: string };
  dispatcher: { email: string; clientId: string };
  driver: { email: string };
  foreign: { email: string; companyId: string };
  foreignRentalId: string;
} = {} as never;

function requireDisposableDatabase() {
  const url = process.env.DATABASE_URL ?? '';
  if (!/e2e|test/i.test(url))
    throw new Error('PILOT_RENTALS_E2E допускается только с отдельной test/e2e DATABASE_URL.');
}

async function createTenant(role: 'COMPANY_ADMIN' | 'DISPATCHER' | 'DRIVER', companyId?: string) {
  const tenantId = companyId ?? randomUUID();
  const userId = randomUUID();
  const clientId = randomUUID();
  const vehicleId = randomUUID();
  await prisma.company.create({
    data: {
      id: tenantId,
      name: `E2E ${marker}`,
      slug: `${marker}-${tenantId.slice(0, 8)}`,
      isDemo: true,
    },
  });
  await prisma.user.create({
    data: {
      id: userId,
      email: `${marker}-${userId}@example.test`,
      name: 'E2E rental',
      passwordHash: await hashPassword(password),
    },
  });
  await prisma.companyMember.create({
    data: { companyId: tenantId, userId, role, additionalPermissions: [] },
  });
  await prisma.client.create({
    data: {
      id: clientId,
      companyId: tenantId,
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
      companyId: tenantId,
      sourceKey: `${marker}-${vehicleId}`,
      internalNumber: marker,
      model: 'E2E',
      city: 'Москва',
      transmission: 'AUTOMATIC',
      fuelType: 'PETROL',
      seats: 4,
      dailyPriceMinor: 100000,
      currency: 'RUB',
      originalPrice: '1000 ₽/сутки',
    },
  });
  if (!created.companyIds.includes(tenantId)) created.companyIds.push(tenantId);
  created.userIds.push(userId);
  created.clientIds.push(clientId);
  created.vehicleIds.push(vehicleId);
  return {
    companyId: tenantId,
    userId,
    clientId,
    vehicleId,
    email: `${marker}-${userId}@example.test`,
  };
}

test.beforeAll(async () => {
  if (!runnable) return;
  requireDisposableDatabase();
  const admin = await createTenant('COMPANY_ADMIN');
  const dispatcher = await createTenant('DISPATCHER', admin.companyId);
  const driver = await createTenant('DRIVER', admin.companyId);
  const foreign = await createTenant('COMPANY_ADMIN');
  Object.assign(fixture, {
    admin,
    dispatcher,
    driver,
    foreign,
    foreignRentalId: `missing-${randomUUID()}`,
  });
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
async function signInAs(page: Page, email: string) {
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
  await page.getByLabel('Автомобиль').selectOption(fixture.admin.vehicleId);
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
    await signInAs(page, fixture.admin.email);
    await page.goto('/vehicles');
    await expect(page.getByRole('link', { name: 'Добавить автомобиль' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Импортировать Excel' })).toBeVisible();
    await page.getByRole('link', { name: 'Добавить автомобиль' }).click();
    await expect(page.getByRole('heading', { name: 'Добавить автомобиль' })).toBeVisible();

    await page.goto('/vehicles');
    await page.getByRole('button', { name: 'Импортировать Excel' }).click();
    await page.getByLabel('Компания').selectOption(fixture.admin.companyId);
    // A four-row workbook is generated by the import unit suite; browser runtime only
    // uses this isolated company and removes every marker-scoped source key in afterAll.
  });

  test('dispatcher saves a draft, rejects overlap, confirms and downloads both formats', async ({
    page,
  }) => {
    await signInAs(page, fixture.dispatcher.email);

    await saveDraftWithInterval(page, fixture.admin.clientId);
    const overlappingPage = await page.context().newPage();
    await saveDraftWithInterval(overlappingPage, fixture.dispatcher.clientId);
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
    await expect(overlappingPage.getByRole('alert')).toContainText('Автомобиль уже занят');
    await overlappingPage.close();
  });

  test('foreign tenant and driver sessions receive no rental data', async ({ browser, page }) => {
    const foreignContext = await browser.newContext();
    const foreignPage = await foreignContext.newPage();
    await signInAs(foreignPage, fixture.foreign.email);
    await foreignPage.goto(`/rentals/${fixture.foreignRentalId}`);
    await expect(foreignPage.getByTestId('rental-detail-page')).not.toBeVisible();
    await foreignContext.close();
    await signInAs(page, fixture.driver.email);
    await page.goto('/rentals');
    await expect(page.getByTestId('rental-list-page')).not.toBeVisible();
  });

  test('calendar is mobile-safe and rentals loading geometry is labelled', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAs(page, fixture.admin.email);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.getByTestId('rental-calendar-agenda')).toBeVisible();

    await page.goto('/rentals?query=__rental_e2e_loading__', { waitUntil: 'commit' });
    await expect(page.locator('[aria-label="Загрузка договоров аренды"]')).toBeVisible();
  });
});
